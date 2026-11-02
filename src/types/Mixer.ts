import type { MediaType, TransitionType } from "./Show"

// A source the mixer can cut to the output background layer (vMix style "input").
export type MixerInputType = Extract<MediaType, "camera" | "ndi" | "omt" | "screen" | "media" | "video" | "image" | "player"> | "blackmagic"

export interface MixerInput {
    id: string // unique mixer id
    name: string
    type: MixerInputType
    sourceId: string // device id / NDI url / screen id / file path
    cameraGroup?: string
    loop?: boolean
    muted?: boolean
}

export interface MixerTransition {
    type: TransitionType
    duration: number
    easing: string
}

export interface MixerState {
    previewId: string | null
    programId: string | null
    outputId: string // "" = all active outputs
    transition: MixerTransition
    // remembers the inputs order shown in the multiview
    inputs: MixerInput[]
}
