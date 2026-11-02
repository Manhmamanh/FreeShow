// Mixer: vMix-style Preview/Program switching on top of FreeShow outputs.
// The program feed is the output's *background* layer, so slides, overlays,
// NDI/OMT/Blackmagic out, RTMP streaming and recording keep working unchanged.

import { get, writable } from "svelte/store"
import type { MixerInput, MixerInputType, MixerState, MixerTransition } from "../../../types/Mixer"
import type { OutBackground } from "../../../types/Show"
import { outLocked, outputs } from "../../stores"
import { clearBackground } from "../output/clear"
import { getMediaType, getExtension, getFileName, removeExtension } from "../helpers/media"
import { getFirstActiveOutput, setOutput } from "../helpers/output"

const STORAGE_KEY = "freeshow_mixer_v1"
export const MAX_SHORTCUT_INPUTS = 9

export const DEFAULT_TRANSITION: MixerTransition = { type: "fade", duration: 600, easing: "sine" }
const CUT_TRANSITION: MixerTransition = { type: "none", duration: 0, easing: "linear" }

function defaultState(): MixerState {
    return { previewId: null, programId: null, outputId: "", transition: { ...DEFAULT_TRANSITION }, inputs: [] }
}

function loadState(): MixerState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return defaultState()
        const parsed = JSON.parse(raw)
        const state = { ...defaultState(), ...parsed }
        if (!Array.isArray(state.inputs)) state.inputs = []
        // program is live state, never restore it (the output may show something else now)
        state.programId = null
        return state
    } catch (err) {
        console.warn("[Mixer] Could not load saved state", err)
        return defaultState()
    }
}

export const mixer = writable<MixerState>(loadState())

mixer.subscribe((state) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, programId: null }))
    } catch {
        // storage can be unavailable; the mixer still works for this session
    }
})

/** sets true while an "Auto" transition is running, used to light up the T-bar button */
export const mixerTransitioning = writable(false)

// ----- INPUTS -----

function uid() {
    return "mix_" + Math.random().toString(36).slice(2, 10)
}

export function addInput(input: Omit<MixerInput, "id">) {
    let newId = ""
    mixer.update((a) => {
        // avoid duplicates of the same physical source
        const existing = a.inputs.find((i) => i.type === input.type && i.sourceId === input.sourceId)
        if (existing) {
            newId = existing.id
            return a
        }

        newId = uid()
        a.inputs = [...a.inputs, { ...input, id: newId }]
        if (!a.previewId) a.previewId = newId
        return a
    })
    return newId
}

export function addMediaFiles(paths: string[]) {
    paths.forEach((path) => {
        const mediaType = getMediaType(getExtension(path))
        const type: MixerInputType = mediaType === "video" ? "video" : "image"
        addInput({ name: removeExtension(getFileName(path)), type, sourceId: path, loop: true, muted: false })
    })
}

export function removeInput(id: string) {
    mixer.update((a) => {
        a.inputs = a.inputs.filter((i) => i.id !== id)
        if (a.previewId === id) a.previewId = a.inputs[0]?.id || null
        if (a.programId === id) a.programId = null
        return a
    })
}

export function renameInput(id: string, name: string) {
    mixer.update((a) => {
        const input = a.inputs.find((i) => i.id === id)
        if (input && name.trim()) input.name = name.trim()
        return a
    })
}

export function moveInput(id: string, direction: -1 | 1) {
    mixer.update((a) => {
        const index = a.inputs.findIndex((i) => i.id === id)
        const target = index + direction
        if (index < 0 || target < 0 || target >= a.inputs.length) return a
        const list = [...a.inputs]
        ;[list[index], list[target]] = [list[target], list[index]]
        a.inputs = list
        return a
    })
}

export function getInput(id: string | null): MixerInput | null {
    if (!id) return null
    return get(mixer).inputs.find((i) => i.id === id) || null
}

// ----- OUTPUT -----

/** the output the monitors show (selected one, or the first active) */
export function getMonitorOutputId(state: MixerState = get(mixer)): string {
    if (state.outputId && get(outputs)[state.outputId]) return state.outputId
    return getFirstActiveOutput()?.id || ""
}

export function setTargetOutput(outputId: string) {
    mixer.update((a) => {
        a.outputId = outputId
        return a
    })
}

export function setTransition(transition: Partial<MixerTransition>) {
    mixer.update((a) => {
        a.transition = { ...a.transition, ...transition }
        return a
    })
}

/** converts a mixer input to the data FreeShow's background layer understands */
export function inputToBackground(input: MixerInput, transition: MixerTransition | null = null): OutBackground {
    const bg: OutBackground = { name: input.name, type: input.type as any }

    if (input.type === "video" || input.type === "image" || input.type === "media") {
        bg.path = input.sourceId
        bg.loop = input.loop !== false
        bg.muted = !!input.muted
        bg.startAt = 0
    } else {
        bg.id = input.sourceId
        if (input.type === "camera") bg.cameraGroup = input.cameraGroup || ""
        if (input.type === "player") bg.muted = !!input.muted
    }

    if (transition) bg.mixerTransition = { ...transition }
    return bg
}

// ----- SWITCHING -----

export function setPreview(id: string | null) {
    mixer.update((a) => {
        a.previewId = id
        return a
    })
}

function sendToProgram(input: MixerInput, transition: MixerTransition) {
    if (get(outLocked)) return false

    const state = get(mixer)
    setOutput("background", inputToBackground(input, transition), false, state.outputId)
    return true
}

/** vMix "Cut"/"Auto": preview goes to program, the old program becomes the new preview */
function take(transition: MixerTransition) {
    const state = get(mixer)
    const input = getInput(state.previewId)
    if (!input) return
    if (!sendToProgram(input, transition)) return

    const oldProgram = state.programId
    mixer.update((a) => {
        a.programId = input.id
        // swap like a hardware switcher, keep preview if nothing was on program
        if (oldProgram && a.inputs.find((i) => i.id === oldProgram)) a.previewId = oldProgram
        return a
    })

    if (transition.type !== "none" && transition.duration > 0) {
        mixerTransitioning.set(true)
        setTimeout(() => mixerTransitioning.set(false), transition.duration)
    }
}

export function cut() {
    take(CUT_TRANSITION)
}

export function auto() {
    if (get(mixerTransitioning)) return
    take(get(mixer).transition)
}

/** sends an input straight to program, skipping preview (double click / quick play) */
export function quickPlay(id: string, withTransition = false) {
    const input = getInput(id)
    if (!input) return
    const transition = withTransition ? get(mixer).transition : CUT_TRANSITION
    if (!sendToProgram(input, transition)) return

    mixer.update((a) => {
        a.programId = id
        return a
    })
}

/** Fade To Black: clears the background layer (slides/overlays stay) */
export function fadeToBlack() {
    if (get(outLocked)) return
    const state = get(mixer)
    clearBackground(state.outputId)
    mixer.update((a) => {
        if (a.programId) a.previewId = a.programId
        a.programId = null
        return a
    })
}

/** keeps the "on air" marker in sync when the background is changed from elsewhere in FreeShow */
export function syncProgramWithOutput() {
    const state = get(mixer)
    if (!state.programId) return

    const outputId = getMonitorOutputId(state)
    const background = get(outputs)[outputId]?.out?.background
    const input = getInput(state.programId)
    if (!input) return

    const current = background?.path || background?.id || ""
    if (current !== input.sourceId) {
        mixer.update((a) => {
            a.programId = null
            return a
        })
    }
}

// ----- OVERLAYS -----

export function toggleOverlay(overlayId: string) {
    if (get(outLocked)) return
    setOutput("overlays", overlayId, true, get(mixer).outputId)
}

// ----- KEYBOARD -----

const MIXER_KEYS = [" ", "Enter", "c", "C", "b", "B"]
/** keys the mixer page reserves (so slide shortcuts don't also fire) */
export function isMixerKey(e: KeyboardEvent): boolean {
    if (e.ctrlKey || e.metaKey || e.altKey) return false
    const number = Number(e.key)
    return MIXER_KEYS.includes(e.key) || (number >= 1 && number <= MAX_SHORTCUT_INPUTS)
}

/** returns true when the key was handled. Only called while the mixer page is open. */
export function mixerKeydown(e: KeyboardEvent): boolean {
    if (e.ctrlKey || e.metaKey || e.altKey) return false

    const state = get(mixer)
    const number = Number(e.key)
    if (number >= 1 && number <= MAX_SHORTCUT_INPUTS) {
        const input = state.inputs[number - 1]
        if (!input) return true
        if (e.shiftKey) quickPlay(input.id)
        else setPreview(input.id)
        return true
    }

    if (e.key === " " || e.key === "Enter") {
        auto()
        return true
    }
    if (e.key === "c" || e.key === "C") {
        cut()
        return true
    }
    if (e.key === "b" || e.key === "B") {
        fadeToBlack()
        return true
    }

    return false
}
