// Shared by the main window and the output windows: live T-bar value, transition maths,
// audio-follow-video gains and guest (VDO.Ninja) links. Keep this file free of heavy imports.

import { writable } from "svelte/store"
import type { MixerInput, MixerTransition, OutMixer } from "../../../types/Mixer"

/**
 * Live T-bar position while dragging (0-1), keyed by output id ("" = all).
 * Sent over a lightweight OUTPUT message so dragging never resends the whole outputs store.
 */
export const mixerLiveAmount = writable<{ [outputId: string]: number | null }>({})

export const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v))

export function ease(t: number, easing: MixerTransition["easing"] = "sine") {
    t = clamp(t)
    if (easing === "linear") return t
    if (easing === "cubic") return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    return -(Math.cos(Math.PI * t) - 1) / 2
}

/** current (un-eased) transition progress from the out data + live T-bar value */
export function getProgress(mixer: OutMixer | null | undefined, liveAmount: number | null | undefined, now = Date.now()): number {
    if (!mixer?.next) return 0
    if (mixer.auto) {
        const duration = Math.max(1, mixer.auto.duration)
        return clamp((now - mixer.auto.start) / duration)
    }
    if (typeof liveAmount === "number") return clamp(liveAmount)
    return clamp(mixer.amount || 0)
}

/** CSS for the outgoing (A) and incoming (B) layers at progress p (already eased) */
export function getTransitionStyles(type: MixerTransition["type"], p: number): { a: string; b: string } {
    const pct = (v: number) => `${(v * 100).toFixed(3)}%`
    switch (type) {
        case "none":
            return { a: p >= 0.5 ? "opacity: 0;" : "", b: p >= 0.5 ? "" : "opacity: 0;" }
        case "crossfade":
            return { a: `opacity: ${1 - p};`, b: `opacity: ${p};` }
        case "wipe":
            return { a: "", b: `clip-path: inset(0 0 0 ${pct(1 - p)});` }
        case "slide":
            return { a: "", b: `transform: translateX(${pct(1 - p)});` }
        case "push":
            return { a: `transform: translateX(${pct(-p)});`, b: `transform: translateX(${pct(1 - p)});` }
        case "scale":
            return { a: "", b: `opacity: ${p}; transform: scale(${0.6 + 0.4 * p});` }
        case "blur":
            return { a: `filter: blur(${(p * 30).toFixed(1)}px); opacity: ${1 - p};`, b: `filter: blur(${((1 - p) * 30).toFixed(1)}px); opacity: ${p};` }
        case "fly":
            return { a: "", b: `transform: translateY(${pct(1 - p)});` }
        case "spin":
            return { a: `opacity: ${1 - p};`, b: `opacity: ${p}; transform: rotate(${((1 - p) * -180).toFixed(1)}deg) scale(${p.toFixed(3)});` }
        case "fade":
        default:
            return { a: "", b: `opacity: ${p};` }
    }
}

export const inputVolume = (input: MixerInput | null | undefined) => (input && !input.muted ? (input.volume ?? 1) : 0)

/**
 * Audio follow video: how loud an input should be right now (0-1.5).
 * program fades out while the next input fades in; PiP inputs are on air too.
 */
export function getOnAirFactor(inputId: string, mixer: OutMixer | null | undefined, progress: number): number {
    if (!mixer) return 0
    const p = mixer.next ? progress : 0
    let factor = 0
    if (mixer.program?.id === inputId) factor = Math.max(factor, 1 - p)
    if (mixer.next?.id === inputId) factor = Math.max(factor, p)
    if (mixer.pips.some((pip) => pip.input.id === inputId)) factor = 1
    return factor
}

export function getInputGain(input: MixerInput, mixer: OutMixer | null | undefined, progress: number): number {
    const volume = inputVolume(input)
    // inputs without a picture are never "on air": AFV does not apply to them
    if (input.audioFollow === false || input.type === "audiofile" || input.type === "audio") return volume
    return volume * getOnAirFactor(input.id, mixer, progress)
}

// ----- GUEST (VDO.Ninja) -----
// VDO.Ninja is a free, open source WebRTC service (https://github.com/steveseguin/vdo.ninja),
// FreeShow already uses its sister project caption.ninja for captions.

export const GUEST_SERVER = "https://vdo.ninja/"

/** link the guest opens on their phone/laptop to send camera + microphone */
export const getGuestInviteUrl = (streamId: string, name = "") => `${GUEST_SERVER}?push=${encodeURIComponent(streamId)}&webcam&quality=1${name ? `&label=${encodeURIComponent(name)}` : ""}`

/** link the output window opens to receive the guest (no VDO.Ninja interface) */
export const getGuestViewUrl = (streamId: string) => `${GUEST_SERVER}?view=${encodeURIComponent(streamId)}&cleanoutput&autostart&transparent`

export function newGuestStreamId() {
    const chars = "abcdefghijkmnpqrstuvwxyz23456789"
    let id = "fs"
    for (let i = 0; i < 10; i++) id += chars[Math.floor(Math.random() * chars.length)]
    return id
}
