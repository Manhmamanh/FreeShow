import { describe, expect, it } from "vitest"
import type { MixerInput, OutMixer } from "../../../types/Mixer"
import { ease, getGuestInviteUrl, getGuestViewUrl, getInputGain, getOnAirFactor, getProgress, getTransitionStyles, newGuestStreamId } from "./mixerLive"

const cam1: MixerInput = { id: "a", name: "Cam 1", type: "camera", sourceId: "dev1", volume: 1 }
const cam2: MixerInput = { id: "b", name: "Cam 2", type: "camera", sourceId: "dev2", volume: 0.5 }
const music: MixerInput = { id: "m", name: "Music", type: "video", sourceId: "/x.mp4", volume: 0.8, audioFollow: false }

function out(patch: Partial<OutMixer> = {}): OutMixer {
    return { program: cam1, next: null, amount: 0, auto: null, transition: { type: "fade", duration: 1000, easing: "linear" }, pips: [], revision: 0, ...patch }
}

describe("getProgress", () => {
    it("is 0 without an incoming input", () => {
        expect(getProgress(out({ amount: 0.7 }), 0.4)).toBe(0)
    })
    it("follows the live T-bar value first, then the stored amount", () => {
        expect(getProgress(out({ next: cam2, amount: 0.7 }), 0.4)).toBe(0.4)
        expect(getProgress(out({ next: cam2, amount: 0.7 }), null)).toBe(0.7)
    })
    it("is time based for Auto and clamps to 0-1", () => {
        const o = out({ next: cam2, auto: { start: 1000, duration: 1000 } })
        expect(getProgress(o, null, 500)).toBe(0)
        expect(getProgress(o, null, 1500)).toBe(0.5)
        expect(getProgress(o, null, 5000)).toBe(1)
    })
})

describe("ease", () => {
    it("keeps the end points", () => {
        for (const e of ["linear", "sine", "cubic"] as const) {
            expect(ease(0, e)).toBeCloseTo(0)
            expect(ease(1, e)).toBeCloseTo(1)
            expect(ease(0.5, e)).toBeCloseTo(0.5)
        }
    })
})

describe("getTransitionStyles", () => {
    it("fade only changes the incoming layer", () => {
        expect(getTransitionStyles("fade", 0.25)).toEqual({ a: "", b: "opacity: 0.25;" })
    })
    it("push moves both layers", () => {
        const s = getTransitionStyles("push", 0.5)
        expect(s.a).toContain("translateX(-50.000%)")
        expect(s.b).toContain("translateX(50.000%)")
    })
    it("none switches at the half way point", () => {
        expect(getTransitionStyles("none", 0.4).b).toBe("opacity: 0;")
        expect(getTransitionStyles("none", 0.6).b).toBe("")
    })
})

describe("audio follow video", () => {
    it("program is full, others silent", () => {
        expect(getOnAirFactor("a", out(), 0)).toBe(1)
        expect(getOnAirFactor("b", out(), 0)).toBe(0)
    })
    it("crossfades program and next with the transition", () => {
        const o = out({ next: cam2 })
        expect(getInputGain(cam1, o, 0.25)).toBeCloseTo(0.75)
        expect(getInputGain(cam2, o, 0.25)).toBeCloseTo(0.125) // volume 0.5
    })
    it("PiP inputs are on air", () => {
        const o = out({ pips: [{ id: "p", inputId: "b", enabled: true, x: 0, y: 0, w: 30, h: 30, radius: 0, border: 0, borderColor: "#fff", fit: "cover", input: cam2 }] })
        expect(getOnAirFactor("b", o, 0)).toBe(1)
    })
    it("audio files play at their volume (no picture, AFV ignored)", () => {
        const song: MixerInput = { id: "s", name: "Song", type: "audiofile", sourceId: "/song.mp3", volume: 0.6, audioFollow: true }
        expect(getInputGain(song, out(), 0)).toBeCloseTo(0.6)
        expect(getInputGain({ ...song, muted: true }, out(), 0)).toBe(0)
    })
    it("microphones are always audible (AFV does not apply without a picture)", () => {
        const mic: MixerInput = { id: "mic", name: "Mic", type: "audio", sourceId: "dev", volume: 1, audioFollow: true }
        expect(getInputGain(mic, out(), 0)).toBe(1)
    })
    it("always-on and muted inputs", () => {
        expect(getInputGain(music, out(), 0)).toBeCloseTo(0.8)
        expect(getInputGain({ ...cam1, muted: true }, out(), 0)).toBe(0)
    })
})

describe("guest links", () => {
    it("builds push and view links for the same stream", () => {
        const id = newGuestStreamId()
        expect(id).toMatch(/^fs[a-z0-9]{10}$/)
        expect(getGuestInviteUrl(id, "Anh Minh")).toBe(`https://vdo.ninja/?push=${id}&webcam&quality=1&label=Anh%20Minh`)
        expect(getGuestViewUrl(id)).toContain(`view=${id}`)
    })
})
