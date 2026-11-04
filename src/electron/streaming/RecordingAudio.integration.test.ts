// Haidangshow: program recording (REC) with sound, through the real RtmpStreamer + real ffmpeg.
// Covers the field bugs: header-only files when nothing played sound, recordings without audio,
// and files shorter than the time recorded.
import { execFileSync, spawnSync } from "child_process"
import fs from "fs"
import os from "os"
import path from "path"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import type { EncoderId } from "./encoderProfiles"

const mocked = vi.hoisted(() => ({ encoder: "x264" as EncoderId }))
vi.mock("./encoderDetection", () => ({ resolveEncoder: async () => mocked.encoder, getRtmpEncoderSetting: () => mocked.encoder }))
vi.mock("./ffmpegManager", () => ({ resolveFfmpegPath: async () => "ffmpeg" }))

const { RtmpStreamer, setRtmpResolvers } = await import("./RtmpStreamer")
setRtmpResolvers({ resolveFfmpegPath: async () => "ffmpeg", resolveEncoder: async (): Promise<EncoderId> => mocked.encoder })

function hasFfmpeg() {
    try {
        execFileSync("ffmpeg", ["-version"], { stdio: "ignore" })
        return true
    } catch {
        return false
    }
}

const W = 320
const H = 180
const FPS = 25
const SR = 48000
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

function probe(file: string) {
    const info = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", file], { encoding: "utf8" }))
    const video = info.streams.find((s: any) => s.codec_type === "video")
    const audio = info.streams.find((s: any) => s.codec_type === "audio")
    return { video, audio, duration: Number(info.format.duration), videoDuration: Number(video?.duration || 0), audioDuration: Number(audio?.duration || 0) }
}

/** mean volume of the audio track in dB (-91 = digital silence) */
function meanVolume(file: string, start = 0, length = 0): number {
    const args = ["-hide_banner", "-nostats"]
    if (start) args.push("-ss", String(start))
    args.push("-i", file)
    if (length) args.push("-t", String(length))
    args.push("-map", "0:a", "-af", "volumedetect", "-f", "null", "-")
    // volumedetect reports on stderr
    const out = String(spawnSync("ffmpeg", args, { encoding: "utf8" }).stderr || "")
    const m = /mean_volume: (-?[\d.]+) dB/.exec(out)
    return m ? Number(m[1]) : -91
}

/** 20 ms of a 440 Hz tone, s16le stereo, at -12 dBFS */
let phase = 0
function tone(ms = 20): Buffer {
    const samples = Math.round((SR * ms) / 1000)
    const buf = Buffer.alloc(samples * 4)
    for (let i = 0; i < samples; i++) {
        const v = Math.round(Math.sin(phase) * 8200)
        phase += (2 * Math.PI * 440) / SR
        buf.writeInt16LE(v, i * 4)
        buf.writeInt16LE(v, i * 4 + 2)
    }
    return buf
}

const describeIfFfmpeg = hasFfmpeg() ? describe : describe.skip

describeIfFfmpeg("Program recording with audio (real ffmpeg)", () => {
    let dir: string
    const timers = new Set<NodeJS.Timeout>()
    beforeAll(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "haidangshow-rec-"))
    })
    afterEach(() => {
        timers.forEach((t) => clearInterval(t))
        timers.clear()
        RtmpStreamer.stopAll()
    })

    function feedVideo(id: string) {
        let i = 0
        const frame = Buffer.alloc(W * H * 4)
        const t = setInterval(() => {
            frame.fill((i++ * 8) % 256)
            RtmpStreamer.updateFrame(id, frame, { width: W, height: H })
        }, 1000 / FPS)
        timers.add(t)
        return t
    }
    function feedAudio(id: string) {
        const t = setInterval(() => RtmpStreamer.updateAudio(id, tone(20), SR), 20)
        timers.add(t)
        return t
    }

    async function record(id: string, file: string, scenario: (audio: { start: () => void; stop: () => void }) => Promise<void>) {
        await RtmpStreamer.start(id, { width: W, height: H, fps: FPS, bitrate: 800, enableAudio: true, encoder: "x264" }, [{ id: "recording", url: file, key: "", enabled: true, file: true } as any])
        const video = feedVideo(id)
        let audio: NodeJS.Timeout | null = null
        const started = Date.now()
        await scenario({
            start: () => (audio = feedAudio(id)),
            stop: () => {
                if (audio) clearInterval(audio)
                audio = null
            }
        })
        const recorded = (Date.now() - started) / 1000
        console.info(`[test] ${id}: recorded ${recorded.toFixed(2)} s`)
        clearInterval(video)
        if (audio) clearInterval(audio)
        RtmpStreamer.stopAll()
        await wait(1500)
        return recorded
    }

    it("records picture and silent audio when nothing plays sound (no more header-only files)", async () => {
        const file = path.join(dir, "silent.mp4")
        const recorded = await record("rec-silent", file, () => wait(4000))

        // test frames are flat colours, so the file is small but must contain more than headers (752 bytes before the fix)
        expect(fs.statSync(file).size).toBeGreaterThan(4_000)
        const p = probe(file)
        console.info(`[test] silent: video ${p.videoDuration}s audio ${p.audioDuration}s mean ${meanVolume(file)} dB`)
        expect(p.video?.codec_name).toBe("h264")
        expect(p.audio?.codec_name).toBe("aac")
        // not shorter than what was recorded (minus encoder start-up)
        expect(p.videoDuration).toBeGreaterThan(recorded - 0.8)
        expect(Math.abs(p.audioDuration - p.videoDuration)).toBeLessThan(0.5)
        expect(meanVolume(file)).toBeLessThan(-80)
    }, 30000)

    it("records the sound sent by the audio engine", async () => {
        const file = path.join(dir, "tone.mp4")
        const recorded = await record("rec-tone", file, async (audio) => {
            audio.start()
            await wait(4000)
        })

        const p = probe(file)
        console.info(`[test] tone: video ${p.videoDuration}s audio ${p.audioDuration}s mean ${meanVolume(file)} dB`)
        expect(p.audio?.codec_name).toBe("aac")
        expect(p.videoDuration).toBeGreaterThan(recorded - 1.2)
        expect(Math.abs(p.audioDuration - p.videoDuration)).toBeLessThan(0.5)
        // -12 dBFS sine = about -15 dB mean
        expect(meanVolume(file)).toBeGreaterThan(-25)
    }, 30000)

    it("keeps recording through gaps in the sound, in sync", async () => {
        const file = path.join(dir, "gaps.mp4")
        const recorded = await record("rec-gaps", file, async (audio) => {
            audio.start()
            await wait(1500)
            audio.stop() // e.g. a video with sound ends
            await wait(2000)
            audio.start()
            await wait(1500)
        })

        const p = probe(file)
        console.info(`[test] gaps: video ${p.videoDuration}s audio ${p.audioDuration}s start ${meanVolume(file, 0.2, 0.8)} mid ${meanVolume(file, 2.3, 0.8)} end ${meanVolume(file, p.audioDuration - 1, 0.8)} dB`)
        expect(p.videoDuration).toBeGreaterThan(recorded - 1.2)
        expect(Math.abs(p.audioDuration - p.videoDuration)).toBeLessThan(0.6)
        // sound at the start and the end, silence in the middle
        expect(meanVolume(file, 0.2, 0.8)).toBeGreaterThan(-25)
        expect(meanVolume(file, 2.3, 0.8)).toBeLessThan(-60)
        expect(meanVolume(file, p.audioDuration - 1, 0.8)).toBeGreaterThan(-25)
    }, 30000)
})
