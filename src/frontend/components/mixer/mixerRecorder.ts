// Mixer recording (main window):
//  - ISO: every camera input recorded to its own file (chunks are streamed to disk by the main process)
//  - Instant replay: cameras with "replay buffer" keep the last seconds in memory as independent 2 s segments;
//    a replay joins the newest segments (FFmpeg, main process) into a clip that becomes a "replay" input.

import { get, writable } from "svelte/store"
import { Main } from "../../../types/IPC/Main"
import type { MixerInput } from "../../../types/Mixer"
import { requestMain, sendMain } from "../../IPC/main"
import { cameraManager } from "../../media/cameraManager"
import { activePopup, activeRecording, alertMessage, outputDisplay, outputs, special } from "../../stores"
import { newToast } from "../../utils/common"
import { translateText } from "../../utils/language"
import { startOutputRecording, stopMediaRecorder } from "../drawer/live/recorder"
import { checkFFmpeg } from "../helpers/output"
import { addInput, getMonitorOutputId, getOutMixer, mixer, mixerHotkeys, setPreview } from "./mixer"

const SEGMENT_MS = 2000
const MAX_REPLAY_SECONDS = 30

type Format = { mimeType: string; extension: "mp4" | "webm" }

function pickFormat(withAudio: boolean): Format {
    const candidates: Format[] = [
        { mimeType: withAudio ? "video/mp4;codecs=avc1.640028,mp4a.40.2" : "video/mp4;codecs=avc1.640028", extension: "mp4" },
        { mimeType: "video/mp4", extension: "mp4" },
        { mimeType: withAudio ? "video/webm;codecs=h264,opus" : "video/webm;codecs=h264", extension: "webm" },
        { mimeType: withAudio ? "video/webm;codecs=vp9,opus" : "video/webm;codecs=vp9", extension: "webm" },
        { mimeType: "video/webm", extension: "webm" }
    ]
    return candidates.find((c) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c.mimeType)) || candidates[candidates.length - 1]
}

const timestamp = () => new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
const cleanName = (name: string) => name.replace(/[\\/:*?"<>|]/g, "_")

/** camera picture + its linked microphone */
async function openStream(input: MixerInput): Promise<{ stream: MediaStream; release: () => void } | null> {
    if (input.type !== "camera") return null
    const camera = await cameraManager.getCameraStream(input.sourceId, input.cameraGroup)
    if (typeof camera === "string") {
        newToast(camera)
        return null
    }

    let mic: MediaStream | null = null
    if (input.audioDeviceId) {
        try {
            mic = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: input.audioDeviceId } } })
        } catch (err) {
            console.warn("[Mixer] linked microphone not available", err)
        }
    }

    const stream = new MediaStream([...camera.getVideoTracks(), ...(mic?.getAudioTracks() || [])])
    return {
        stream,
        release: () => {
            mic?.getTracks().forEach((t) => t.stop())
            cameraManager.stopTracks(camera, input.sourceId)
        }
    }
}

// ----- PROGRAM RECORDING -----

export const isProgramRecording = () => !!get(activeRecording)?.isOutput

function alertUser(key: string) {
    alertMessage.set(translateText(key))
    activePopup.set("alert")
}

/** REC button: records the program output (FreeShow's output recorder, encoded with FFmpeg) */
export async function toggleProgramRecording() {
    if (isProgramRecording()) {
        await stopMediaRecorder()
        return
    }
    // another recording (e.g. a camera/screen recording from the drawer) is running
    if (get(activeRecording)) await stopMediaRecorder()

    const outputId = getMonitorOutputId()
    if (!outputId || !get(outputs)[outputId]) return alertUser("mixer.rec_no_output")
    // the recorder captures the output window, so it has to be shown
    if (!get(outputDisplay)) return alertUser("mixer.rec_not_presenting")
    // the encoder needs FFmpeg (asks to download it the first time)
    if (!(await checkFFmpeg())) return

    await startOutputRecording(outputId)
}

// ----- ISO -----

type IsoRecorder = { recorder: MediaRecorder; release: () => void; queue: Promise<void>; id: string; name: string; startedAt: number }
const isoRecorders = new Map<string, IsoRecorder>()

/** input ids currently recorded, with start time */
export const isoRecording = writable<{ [inputId: string]: number }>({})

export async function startIso(inputIds?: string[]) {
    const inputs = get(mixer).inputs.filter((i) => i.type === "camera" && (!inputIds || inputIds.includes(i.id)))
    if (!inputs.length) {
        newToast("No camera inputs to record")
        return
    }

    const stamp = timestamp()
    for (const input of inputs) {
        if (isoRecorders.has(input.id)) continue
        const opened = await openStream(input)
        if (!opened) continue

        const format = pickFormat(opened.stream.getAudioTracks().length > 0)
        let recorder: MediaRecorder
        try {
            recorder = new MediaRecorder(opened.stream, { mimeType: format.mimeType, videoBitsPerSecond: 12_000_000, audioBitsPerSecond: 192_000 })
        } catch (err) {
            console.error("[Mixer] ISO recorder", err)
            opened.release()
            continue
        }

        const entry: IsoRecorder = { recorder, release: opened.release, queue: Promise.resolve(), id: `${input.id}_${stamp}`, name: `FreeShow_ISO_${cleanName(input.name)}_${stamp}.${format.extension}`, startedAt: Date.now() }
        const folder = get(special)?.audioRecordingsPath

        // chunks are written in order, one after the other
        recorder.ondataavailable = (e) => {
            if (!e.data?.size) return
            entry.queue = entry.queue.then(async () => sendMain(Main.MIXER_ISO_CHUNK, { id: entry.id, name: entry.name, data: await e.data.arrayBuffer(), folder }))
        }
        recorder.onstop = () => {
            entry.queue = entry.queue.then(() => sendMain(Main.MIXER_ISO_CHUNK, { id: entry.id, name: entry.name, data: new ArrayBuffer(0), done: true, folder }))
            entry.release()
        }
        recorder.start(1000)

        isoRecorders.set(input.id, entry)
        isoRecording.update((a) => ({ ...a, [input.id]: entry.startedAt }))
    }

    if (isoRecorders.size) newToast(`ISO: ${isoRecorders.size} camera(s) recording`)
}

export function stopIso(inputIds?: string[]) {
    isoRecorders.forEach((entry, inputId) => {
        if (inputIds && !inputIds.includes(inputId)) return
        if (entry.recorder.state !== "inactive") entry.recorder.stop()
        isoRecorders.delete(inputId)
    })
    isoRecording.set(Object.fromEntries([...isoRecorders].map(([id, e]) => [id, e.startedAt])))
    newToast("ISO recording stopped")
}

export const isIsoRunning = () => isoRecorders.size > 0

// ----- REPLAY BUFFER -----

type Segment = { blob: Blob; start: number; end: number }
type ReplayBuffer = {
    input: MixerInput
    stream: MediaStream
    release: () => void
    format: Format
    recorder: MediaRecorder | null
    segments: Segment[]
    timer: NodeJS.Timeout | null
    stopped: boolean
    flush: (() => void) | null
}
const buffers = new Map<string, ReplayBuffer>()

/** camera input ids with a running replay buffer */
export const replayBuffers = writable<string[]>([])
export const replayBusy = writable(false)

function startSegment(buffer: ReplayBuffer) {
    if (buffer.stopped) return
    const chunks: Blob[] = []
    const start = Date.now()
    let recorder: MediaRecorder
    try {
        recorder = new MediaRecorder(buffer.stream, { mimeType: buffer.format.mimeType, videoBitsPerSecond: 8_000_000 })
    } catch (err) {
        console.error("[Mixer] replay recorder", err)
        return
    }

    recorder.ondataavailable = (e) => e.data?.size && chunks.push(e.data)
    recorder.onstop = () => {
        if (chunks.length) buffer.segments.push({ blob: new Blob(chunks, { type: buffer.format.mimeType }), start, end: Date.now() })
        // keep a bit more than the longest replay
        const keepFrom = Date.now() - (MAX_REPLAY_SECONDS + 4) * 1000
        buffer.segments = buffer.segments.filter((s) => s.end > keepFrom)

        const flush = buffer.flush
        buffer.flush = null
        startSegment(buffer)
        flush?.()
    }

    buffer.recorder = recorder
    recorder.start()
    if (buffer.timer) clearTimeout(buffer.timer)
    buffer.timer = setTimeout(() => recorder.state !== "inactive" && recorder.stop(), SEGMENT_MS)
}

export async function setReplayBuffer(inputId: string, enabled: boolean) {
    if (!enabled) {
        const running = buffers.get(inputId)
        if (running) {
            running.stopped = true
            if (running.timer) clearTimeout(running.timer)
            if (running.recorder?.state !== "inactive") running.recorder?.stop()
            running.release()
            buffers.delete(inputId)
        }
        replayBuffers.set([...buffers.keys()])
        return
    }

    if (buffers.has(inputId)) return
    const input = get(mixer).inputs.find((i) => i.id === inputId)
    if (!input) return
    // replay clips are joined with FFmpeg: offer to download it now instead of failing at the first replay
    await checkFFmpeg()
    const opened = await openStream(input)
    if (!opened) return

    const buffer: ReplayBuffer = { input, stream: opened.stream, release: opened.release, format: pickFormat(opened.stream.getAudioTracks().length > 0), recorder: null, segments: [], timer: null, stopped: false, flush: null }
    buffers.set(inputId, buffer)
    startSegment(buffer)
    replayBuffers.set([...buffers.keys()])
}

/** the camera to replay: the program camera if it has a buffer, else the first buffered camera */
function pickReplayCamera(): string | null {
    const programId = getOutMixer().program?.id || ""
    if (buffers.has(programId)) return programId
    return [...buffers.keys()][0] || null
}

/** creates a replay clip of the last N seconds and puts it on preview */
export async function captureReplay(inputId: string | null = pickReplayCamera()) {
    const buffer = inputId ? buffers.get(inputId) : null
    if (!buffer) {
        newToast("Enable the replay buffer on a camera first")
        return null
    }
    if (get(replayBusy)) return null
    replayBusy.set(true)

    try {
        // close the running segment so the replay includes the last moment
        await new Promise<void>((resolve) => {
            if (!buffer.recorder || buffer.recorder.state === "inactive") return resolve()
            buffer.flush = resolve
            if (buffer.timer) clearTimeout(buffer.timer)
            buffer.recorder.stop()
            setTimeout(resolve, 1500)
        })

        const state = get(mixer)
        const wanted = Math.min(MAX_REPLAY_SECONDS, Math.max(2, state.replaySeconds || 8)) * 1000
        const picked: Segment[] = []
        let total = 0
        for (let i = buffer.segments.length - 1; i >= 0 && total < wanted; i--) {
            picked.unshift(buffer.segments[i])
            total += buffer.segments[i].end - buffer.segments[i].start
        }
        if (!picked.length) {
            newToast("Replay buffer is still empty")
            return null
        }

        const segments = await Promise.all(picked.map((s) => s.blob.arrayBuffer()))
        const time = new Date().toTimeString().slice(0, 8)
        const name = `Replay_${cleanName(buffer.input.name)}_${timestamp()}`
        const result = await requestMain(Main.MIXER_SAVE_REPLAY, { name, extension: buffer.format.extension, segments, folder: get(special)?.audioRecordingsPath }, undefined, 90000)

        if (!result?.path) {
            newToast(`Replay failed: ${result?.error || "unknown error"}`)
            return null
        }
        if (result.error) newToast(result.error)

        const id = addInput({ name: `⟲ ${buffer.input.name} ${time}`, type: "replay", sourceId: result.path, playbackRate: state.replayRate || 0.5, duration: total / 1000, loop: false, audioDeviceId: buffer.input.audioDeviceId, volume: 1, audioFollow: true }, false)
        setPreview(id)
        return id
    } finally {
        replayBusy.set(false)
    }
}

mixerHotkeys.replay = () => {
    captureReplay()
}

// stop buffers of removed inputs
mixer.subscribe((state) => {
    buffers.forEach((_b, id) => {
        if (!state.inputs.some((i) => i.id === id)) setReplayBuffer(id, false)
    })
    isoRecorders.forEach((_r, id) => {
        if (!state.inputs.some((i) => i.id === id)) stopIso([id])
    })
})
