// vMix-style mixer types (Mixer page + the "mixer" layer drawn by every output window)

export type MixerInputType =
    | "camera" // local video device (getUserMedia)
    | "ndi"
    | "omt"
    | "blackmagic"
    | "screen" // screen / window capture
    | "video" // video file
    | "image" // image file
    | "replay" // instant replay clip (video file made from the replay buffer)
    | "guest" // remote guest over VDO.Ninja (WebRTC)
    | "audio" // audio only: microphone / audio interface
    | "audiofile" // audio only: music / sound file with its own play/pause (never on the program picture)

export interface MixerInput {
    id: string // unique mixer id
    name: string
    type: MixerInputType
    sourceId: string // device id / NDI url / screen id / file path / guest stream id / audio device id
    cameraGroup?: string
    loop?: boolean
    playing?: boolean // audiofile: playing right now

    // audio
    volume?: number // 0-1.5, default 1
    muted?: boolean
    audioFollow?: boolean // default true: audible only while on air (program, transition or PiP)
    audioDeviceId?: string // camera/guest: microphone that belongs to this input
    guestMode?: "direct" | "webview" // guest: direct WebRTC (default) or the VDO.Ninja page in a webview (compatibility)

    // replay
    playbackRate?: number // default 1 (replay clips default 0.5)
    duration?: number // seconds (replay clips)

    // recording (camera inputs)
    replayBuffer?: boolean // keep the last seconds in memory for instant replay

    // picture filters (chroma key, colour, LUT)
    fx?: MixerFx
}

export interface MixerFx {
    chroma?: { enabled: boolean; color: string; similarity: number; smoothness: number; spill: number }
    brightness?: number // -1..1 (0)
    contrast?: number // 0..2 (1)
    saturation?: number // 0..2 (1)
    gamma?: number // 0.2..3 (1)
    hue?: number // -180..180 degrees (0)
    temperature?: number // -1..1 (0) cold..warm
    lut?: { path: string; intensity: number } // .cube file
}

export type MixerTransitionType = "fade" | "crossfade" | "wipe" | "slide" | "push" | "scale" | "blur" | "fly" | "spin" | "none"

export interface MixerTransition {
    type: MixerTransitionType
    duration: number // ms
    easing: "linear" | "sine" | "cubic"
}

export interface MixerPip {
    id: string
    inputId: string
    enabled: boolean
    // position & size in % of the output
    x: number
    y: number
    w: number
    h: number
    radius: number // px (at 1080p)
    border: number // px (at 1080p)
    borderColor: string
    fit: "cover" | "contain"
}

export interface MixerState {
    previewId: string | null
    programId: string | null
    outputId: string // "" = all active outputs
    transition: MixerTransition // transition 1 (AUTO, Space, T-bar)
    transitions: MixerTransition[] // the 4 transition buttons (vMix style), [0] mirrors `transition`
    inputs: MixerInput[]
    pips: MixerPip[]
    replaySeconds: number // length of an instant replay clip
    replayRate: number // playback speed of new replay clips
}

/** the "black" pseudo input used by Fade To Black */
export const MIXER_BLACK_ID = "__black__"

/** what every output window needs to draw the mixer layer (stored at output.out.mixer) */
export interface OutMixer {
    program: MixerInput | null
    next: MixerInput | null // incoming input while a transition is running / the T-bar is moved
    amount: number // 0-1 manual T-bar position (used when auto is null)
    auto: { start: number; duration: number } | null // time based "Auto" transition
    transition: MixerTransition
    pips: (MixerPip & { input: MixerInput })[]
    revision: number // bump to restart media (e.g. replay played again)
}
