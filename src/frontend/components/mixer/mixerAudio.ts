// Mixer audio engine (main window only).
// Sound of mixer inputs is played here and attached to FreeShow's AudioAnalyser, so it follows the normal
// audio routing: speakers, NDI/OMT audio, RTMP streams and recordings.
//  - video files: an audio element plays the file's sound while the input is on air (picture is drawn muted in the outputs)
//  - audio inputs (microphones / interfaces) and microphones linked to a camera: getUserMedia streams
//  - guests: their sound plays inside the guest webview in the output window (see MixerSource.svelte)

import { get, writable } from "svelte/store"
import type { MixerInput, OutMixer } from "../../../types/Mixer"
import { AudioAnalyser } from "../../audio/audioAnalyser"
import { outputs } from "../../stores"
import { encodeFilePath } from "../helpers/media"
import { getMonitorOutputId, mixer } from "./mixer"
import { ease, getInputGain, getOnAirFactor, getProgress, mixerLiveAmount } from "./mixerLive"

type Source = {
    key: string
    kind: "file" | "stream"
    element?: HTMLAudioElement
    stream?: MediaStream
    deviceId?: string
    path?: string
    attached: boolean
    meter?: { ctx: AudioContext; analyser: AnalyserNode; data: Float32Array }
}

const sources = new Map<string, Source>() // input id -> source

/** live input levels in dBFS for the audio panel meters */
export const mixerLevels = writable<{ [inputId: string]: number }>({})

const sourceKey = (inputId: string) => `mixer_${inputId}`

export const hasAudio = (input: MixerInput) => input.type === "video" || input.type === "audio" || input.type === "guest" || ((input.type === "camera" || input.type === "replay") && !!input.audioDeviceId)

let started = false
export function startMixerAudio() {
    if (started) return
    started = true

    mixer.subscribe(() => update())
    outputs.subscribe(() => update())
    mixerLiveAmount.subscribe(() => updateGains(false))
    setInterval(updateMeters, 100)
}

function currentOut(): OutMixer | null {
    return get(outputs)[getMonitorOutputId()]?.out?.mixer || null
}

let lastOnAir = new Set<string>()
let lastAutoStart = 0

function update() {
    const state = get(mixer)
    const out = currentOut()

    // remove sources of deleted inputs / inputs without audio
    for (const [inputId] of sources) {
        const input = state.inputs.find((i) => i.id === inputId)
        if (!input || !hasAudio(input) || input.type === "guest") destroySource(inputId)
    }

    const onAir = new Set<string>()
    state.inputs.forEach((input) => {
        if (!hasAudio(input) || input.type === "guest") return
        const factor = getOnAirFactor(input.id, out, 1) + getOnAirFactor(input.id, out, 0)
        const isOnAir = factor > 0
        if (isOnAir) onAir.add(input.id)

        // file sound only exists while the input is on air (or when it is set to always play)
        const isFile = input.type === "video" || input.type === "replay"
        const needsSource = isFile ? isOnAir || input.audioFollow === false : true
        if (!needsSource) {
            if (sources.has(input.id)) destroySource(input.id)
            return
        }
        ensureSource(input)
    })

    // file audio starts together with its picture (which is mounted when the input goes on air)
    onAir.forEach((id) => {
        const source = sources.get(id)
        if (source?.kind !== "file" || !source.element || lastOnAir.has(id)) return
        source.element.currentTime = 0
        source.element.play().catch(() => null)
    })
    lastOnAir = onAir

    // a new Auto transition: ramp gains over its duration
    const autoStart = out?.auto?.start || 0
    updateGains(!!autoStart && autoStart !== lastAutoStart)
    lastAutoStart = autoStart
}

function ensureSource(input: MixerInput) {
    const existing = sources.get(input.id)

    // files (replay clips contain the sound of the camera's linked microphone)
    if (input.type === "video" || input.type === "replay") {
        if (existing?.kind === "file" && existing.path === input.sourceId) {
            applyFileOptions(existing, input)
            return
        }
        if (existing) destroySource(input.id)
        const element = new Audio()
        element.src = encodeFilePath(input.sourceId)
        element.preload = "auto"
        const fileSource: Source = { key: sourceKey(input.id), kind: "file", element, path: input.sourceId, attached: false }
        applyFileOptions(fileSource, input)
        sources.set(input.id, fileSource)
        AudioAnalyser.attach(fileSource.key, element).then(() => {
            fileSource.attached = true
            updateGains(false)
        })
        if (input.audioFollow === false) element.play().catch(() => null)
        return
    }

    // microphone (audio input, or the mic linked to a camera/replay)
    const deviceId = input.type === "audio" ? input.sourceId : input.audioDeviceId || ""
    if (!deviceId) return
    if (existing?.kind === "stream" && existing.deviceId === deviceId) return
    if (existing) destroySource(input.id)

    const source: Source = { key: sourceKey(input.id), kind: "stream", deviceId, attached: false }
    sources.set(input.id, source)
    navigator.mediaDevices
        .getUserMedia({ audio: { deviceId: { exact: deviceId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
        .then(async (stream) => {
            // removed while waiting for permission
            if (sources.get(input.id) !== source) return stream.getTracks().forEach((t) => t.stop())
            source.stream = stream
            await AudioAnalyser.attach(source.key, stream)
            source.attached = true
            source.meter = createMeter(stream)
            updateGains(false)
        })
        .catch((err) => console.error("[Mixer] Could not open audio device", deviceId, err))
}

function applyFileOptions(source: Source, input: MixerInput) {
    if (!source.element) return
    source.element.loop = input.type === "video" && input.loop !== false
    source.element.playbackRate = input.playbackRate || 1
}

function destroySource(inputId: string) {
    const source = sources.get(inputId)
    if (!source) return
    sources.delete(inputId)

    try {
        AudioAnalyser.detach(source.key)
    } catch {
        // already detached
    }
    if (source.element) {
        source.element.pause()
        source.element.removeAttribute("src")
        source.element.load()
    }
    source.stream?.getTracks().forEach((t) => t.stop())
    source.meter?.ctx.close().catch(() => null)
    mixerLevels.update((a) => {
        delete a[inputId]
        return a
    })
}

function updateGains(ramp: boolean) {
    const state = get(mixer)
    const out = currentOut()
    const live = get(mixerLiveAmount)[""]
    const progress = ease(getProgress(out, live), out?.transition?.easing)

    sources.forEach((source, inputId) => {
        if (!source.attached) return
        const input = state.inputs.find((i) => i.id === inputId)
        if (!input) return

        if (ramp && out?.auto) {
            // target = state after the transition
            const target = getInputGain(input, { ...out, program: out.next, next: null }, 0)
            const remaining = Math.max(0, out.auto.start + out.auto.duration - Date.now())
            AudioAnalyser.rampSourceVolume(source.key, target, remaining)
            return
        }
        AudioAnalyser.setSourceVolume(source.key, getInputGain(input, out, progress))
    })
}

// ----- METERS -----

function createMeter(stream: MediaStream) {
    try {
        const ctx = new AudioContext()
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 1024
        ctx.createMediaStreamSource(stream).connect(analyser)
        return { ctx, analyser, data: new Float32Array(analyser.fftSize) }
    } catch {
        return undefined
    }
}

function updateMeters() {
    if (!sources.size) return
    const levels: { [id: string]: number } = {}
    sources.forEach((source, inputId) => {
        if (!source.meter) return
        source.meter.analyser.getFloatTimeDomainData(source.meter.data as any)
        let peak = 0
        for (const sample of source.meter.data) peak = Math.max(peak, Math.abs(sample))
        levels[inputId] = peak > 0 ? Math.max(-60, 20 * Math.log10(peak)) : -60
    })
    mixerLevels.set(levels)
}

// ----- DEVICES -----

export async function getAudioInputDevices(): Promise<{ id: string; name: string }[]> {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        return devices.filter((d) => d.kind === "audioinput" && d.deviceId !== "default" && d.deviceId !== "communications").map((d) => ({ id: d.deviceId, name: d.label || `Microphone ${d.deviceId.slice(0, 6)}` }))
    } catch {
        return []
    }
}
