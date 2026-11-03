// Mixer: vMix-style Preview/Program switching on top of FreeShow outputs.
// The program feed is drawn by the "mixer" layer of every output (output.out.mixer), under FreeShow's own
// background/slide/overlay layers, so lyrics & overlays stay on top and NDI/RTMP/recording keep working.

import { get, writable } from "svelte/store"
import { OUTPUT } from "../../../types/Channels"
import type { MixerInput, MixerPip, MixerState, MixerTransition, OutMixer } from "../../../types/Mixer"
import { MIXER_BLACK_ID } from "../../../types/Mixer"
import { currentWindow, outLocked, outputs } from "../../stores"
import { send } from "../../utils/request"
import { getExtension, getFileName, getMediaType, removeExtension } from "../helpers/media"
import { getActiveOutputs, getFirstActiveOutput, setOutput } from "../helpers/output"
import { clamp, mixerLiveAmount, newGuestStreamId } from "./mixerLive"

const STORAGE_KEY = "freeshow_mixer_v2"
export const MAX_SHORTCUT_INPUTS = 9

export const DEFAULT_TRANSITION: MixerTransition = { type: "fade", duration: 600, easing: "sine" }
const BLACK: MixerInput = { id: MIXER_BLACK_ID, name: "Black", type: "image", sourceId: "" }

function defaultState(): MixerState {
    return { previewId: null, programId: null, outputId: "", transition: { ...DEFAULT_TRANSITION }, inputs: [], pips: [], replaySeconds: 8, replayRate: 0.5 }
}

function loadState(): MixerState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("freeshow_mixer_v1")
        if (!raw) return defaultState()
        const parsed = JSON.parse(raw)
        const state: MixerState = { ...defaultState(), ...parsed }
        if (!Array.isArray(state.inputs)) state.inputs = []
        if (!Array.isArray(state.pips)) state.pips = []
        // replay clips are temporary files of the last session
        state.inputs = state.inputs.filter((i) => i.type !== "replay")
        state.pips = state.pips.filter((p) => state.inputs.some((i) => i.id === p.inputId))
        // program is live state: it is read back from the output
        state.programId = null
        return state
    } catch (err) {
        console.warn("[Mixer] Could not load saved state", err)
        return defaultState()
    }
}

export const mixer = writable<MixerState>(loadState())

mixer.subscribe((state) => {
    // output windows load this module too (keyboard shortcuts), only the main window saves
    if (get(currentWindow)) return
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, programId: null }))
    } catch {
        // storage can be unavailable; the mixer still works for this session
    }
})

/** true while an Auto transition / FTB is running */
export const mixerTransitioning = writable(false)

const uid = (prefix = "mix_") => prefix + Math.random().toString(36).slice(2, 10)

// ----- OUTPUT DATA -----

function getTargetOutputIds(state: MixerState = get(mixer)): string[] {
    const all = get(outputs)
    if (state.outputId && all[state.outputId]) return [state.outputId]
    return getActiveOutputs(all, true, false, true)
}

/** the output the monitors show (selected one, or the first active) */
export function getMonitorOutputId(state: MixerState = get(mixer)): string {
    if (state.outputId && get(outputs)[state.outputId]) return state.outputId
    return getFirstActiveOutput()?.id || ""
}

export function emptyOutMixer(): OutMixer {
    return { program: null, next: null, amount: 0, auto: null, transition: { ...get(mixer).transition }, pips: [], revision: 0 }
}

export function getOutMixer(): OutMixer {
    const outputId = getMonitorOutputId()
    return { ...emptyOutMixer(), ...(get(outputs)[outputId]?.out?.mixer || {}) }
}

function getActivePips(state: MixerState = get(mixer)): OutMixer["pips"] {
    return state.pips
        .filter((p) => p.enabled)
        .map((p) => ({ ...p, input: state.inputs.find((i) => i.id === p.inputId) as MixerInput }))
        .filter((p) => !!p.input)
}

/** writes the mixer layer of all target outputs */
function writeOut(change: (current: OutMixer) => Partial<OutMixer>) {
    const ids = getTargetOutputIds()
    if (!ids.length) return false

    outputs.update((a) => {
        ids.forEach((id) => {
            if (!a[id]) return
            const out = a[id].out || {}
            const current: OutMixer = { ...emptyOutMixer(), ...(out.mixer || {}) }
            a[id].out = { ...out, mixer: { ...current, ...change(current) } }
        })
        return a
    })
    return true
}

/** keep the input snapshots in the output data up to date (names, volumes...) */
function refreshOutInputs() {
    const state = get(mixer)
    const find = (input: MixerInput | null) => (input && input.id !== MIXER_BLACK_ID ? state.inputs.find((i) => i.id === input.id) || input : input)
    writeOut((current) => ({ program: find(current.program), next: find(current.next), pips: getActivePips(state), transition: { ...state.transition } }))
}

let refreshTimeout: NodeJS.Timeout | null = null
function refreshOutInputsSoon() {
    if (refreshTimeout) clearTimeout(refreshTimeout)
    refreshTimeout = setTimeout(refreshOutInputs, 120)
}

// ----- INPUTS -----

export function addInput(input: Omit<MixerInput, "id">, select = true) {
    let newId = ""
    mixer.update((a) => {
        // avoid duplicates of the same physical source (replays & guests are always new)
        const existing = input.type !== "replay" && a.inputs.find((i) => i.type === input.type && i.sourceId === input.sourceId)
        if (existing) {
            newId = existing.id
            return a
        }

        newId = uid()
        a.inputs = [...a.inputs, { volume: 1, audioFollow: true, ...input, id: newId }]
        if (select || !a.previewId) a.previewId = newId
        return a
    })
    return newId
}

export function addMediaFiles(paths: string[]) {
    paths.forEach((path) => {
        const mediaType = getMediaType(getExtension(path))
        const type = mediaType === "video" ? "video" : "image"
        addInput({ name: removeExtension(getFileName(path)), type, sourceId: path, loop: true }, false)
    })
}

export function addGuest(name = "") {
    const count = get(mixer).inputs.filter((i) => i.type === "guest").length
    return addInput({ name: name || `Guest ${count + 1}`, type: "guest", sourceId: newGuestStreamId() })
}

export function updateInput(id: string, patch: Partial<MixerInput>) {
    mixer.update((a) => {
        a.inputs = a.inputs.map((i) => (i.id === id ? { ...i, ...patch, id } : i))
        return a
    })
    refreshOutInputsSoon()
}

export function removeInput(id: string) {
    const out = getOutMixer()
    if (out.program?.id === id || out.next?.id === id) writeOut(() => ({ program: null, next: null, auto: null, amount: 0 }))

    mixer.update((a) => {
        a.inputs = a.inputs.filter((i) => i.id !== id)
        a.pips = a.pips.filter((p) => p.inputId !== id)
        if (a.previewId === id) a.previewId = a.inputs[0]?.id || null
        if (a.programId === id) a.programId = null
        return a
    })
    refreshOutInputsSoon()
}

export function renameInput(id: string, name: string) {
    if (name.trim()) updateInput(id, { name: name.trim() })
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
    refreshOutInputsSoon()
}

export function setMixerOption(patch: Partial<Pick<MixerState, "replaySeconds" | "replayRate">>) {
    mixer.update((a) => ({ ...a, ...patch }))
}

// ----- SWITCHING -----

export function setPreview(id: string | null) {
    mixer.update((a) => {
        a.previewId = id
        return a
    })
}

let autoTimeout: NodeJS.Timeout | null = null
let replayReturnTimeout: NodeJS.Timeout | null = null
// the program before a replay / fade to black, so they can return to it
let lastRealProgramId: string | null = null

/** finish: `input` is now on program */
function commit(input: MixerInput | null, swapPreview = true) {
    if (autoTimeout) clearTimeout(autoTimeout)
    autoTimeout = null
    mixerTransitioning.set(false)
    resetTbar()

    const old = getOutMixer().program
    writeOut((current) => ({ program: input, next: null, auto: null, amount: 0, pips: getActivePips(), transition: { ...get(mixer).transition }, revision: (current.revision || 0) + 1 }))

    mixer.update((a) => {
        a.programId = input && input.id !== MIXER_BLACK_ID ? input.id : null
        if (swapPreview && old && old.id !== MIXER_BLACK_ID && a.inputs.some((i) => i.id === old.id)) a.previewId = old.id
        return a
    })

    if (input && input.id !== MIXER_BLACK_ID && input.type !== "replay") lastRealProgramId = input.id
    scheduleReplayReturn(input)
}

function startAuto(input: MixerInput, swapPreview = true) {
    if (get(outLocked)) return
    const transition = get(mixer).transition
    if (transition.type === "none" || transition.duration <= 0) return commit(input, swapPreview)

    // small lead so all windows start the same frame
    const start = Date.now() + 40
    const ok = writeOut(() => ({ next: input, auto: { start, duration: transition.duration }, amount: 0, transition: { ...transition }, pips: getActivePips() }))
    if (!ok) return

    mixerTransitioning.set(true)
    if (autoTimeout) clearTimeout(autoTimeout)
    autoTimeout = setTimeout(() => commit(input, swapPreview), transition.duration + 60)
}

export function cut() {
    if (get(outLocked)) return
    const input = getInput(get(mixer).previewId)
    if (input) commit(input)
}

export function auto() {
    if (get(mixerTransitioning)) return
    const input = getInput(get(mixer).previewId)
    if (input) startAuto(input)
}

/** sends an input straight to program (double click / Shift+number), preview is kept */
export function quickPlay(id: string, withTransition = false) {
    if (get(outLocked)) return
    const input = getInput(id)
    if (!input) return
    if (withTransition) startAuto(input, false)
    else commit(input, false)
}

/** Fade To Black (toggle): fades the mixer layer out; slides & overlays stay */
export function fadeToBlack() {
    if (get(outLocked) || get(mixerTransitioning)) return
    const program = getOutMixer().program

    if (program?.id === MIXER_BLACK_ID || !program) {
        const back = getInput(lastRealProgramId)
        if (back) startAuto(back, false)
        return
    }
    startAuto(BLACK, false)
}

/** clears the mixer layer completely (no fade) */
export function clearMixer() {
    commit(null, false)
}

// ----- T-BAR -----

// vMix style: after a full move the bar stays at that end, the next move goes back the other way
let tbarFrom = 0
let tbarActive = false
export const tbarPosition = writable(0)

let liveFrame = 0
let pendingAmount: number | null = null
function sendLive(amount: number | null) {
    pendingAmount = amount
    if (liveFrame) return
    liveFrame = requestAnimationFrame(() => {
        liveFrame = 0
        const value = pendingAmount
        mixerLiveAmount.update((a) => ({ ...a, "": value }))
        send(OUTPUT, ["MIXER_LIVE"], { outputId: "", amount: value })
    })
}

function resetTbar() {
    if (tbarActive) tbarFrom = get(tbarPosition) >= 0.5 ? 1 : 0
    tbarActive = false
    sendLive(null)
}

export function tbarStart() {
    if (get(outLocked) || get(mixerTransitioning)) return false
    const input = getInput(get(mixer).previewId)
    if (!input) return false
    tbarActive = true
    writeOut(() => ({ next: input, auto: null, amount: 0, pips: getActivePips(), transition: { ...get(mixer).transition } }))
    return true
}

export function tbarMove(position: number) {
    if (!tbarActive) return
    position = clamp(position)
    tbarPosition.set(position)
    const amount = Math.abs(position - tbarFrom)
    sendLive(amount)

    if (amount >= 0.995) {
        const next = getOutMixer().next
        tbarFrom = position >= 0.5 ? 1 : 0
        tbarPosition.set(tbarFrom)
        tbarActive = false
        if (next) commit(next)
    }
}

export function tbarEnd() {
    if (!tbarActive) return
    const amount = Math.abs(get(tbarPosition) - tbarFrom)
    if (amount <= 0.01) {
        // moved back to the start: cancel
        tbarActive = false
        tbarPosition.set(tbarFrom)
        writeOut(() => ({ next: null, amount: 0 }))
        sendLive(null)
        return
    }
    // stays mid-transition (like a hardware T-bar); store it so new/reloaded outputs match
    writeOut(() => ({ amount }))
}

// ----- PICTURE IN PICTURE -----

export type PipPreset = "tr" | "tl" | "br" | "bl" | "left" | "right" | "center" | "full"
export const PIP_PRESETS: { id: PipPreset; label: string }[] = [
    { id: "tl", label: "↖" },
    { id: "tr", label: "↗" },
    { id: "bl", label: "↙" },
    { id: "br", label: "↘" },
    { id: "left", label: "◧" },
    { id: "right", label: "◨" },
    { id: "center", label: "▣" },
    { id: "full", label: "⛶" }
]

export function getPipPreset(preset: PipPreset): Pick<MixerPip, "x" | "y" | "w" | "h" | "fit"> {
    const size = 30
    const margin = 3
    switch (preset) {
        case "tl":
            return { x: margin, y: margin * 1.78, w: size, h: size, fit: "cover" }
        case "tr":
            return { x: 100 - size - margin, y: margin * 1.78, w: size, h: size, fit: "cover" }
        case "bl":
            return { x: margin, y: 100 - size - margin * 1.78, w: size, h: size, fit: "cover" }
        case "left":
            return { x: 0, y: 0, w: 50, h: 100, fit: "cover" }
        case "right":
            return { x: 50, y: 0, w: 50, h: 100, fit: "cover" }
        case "center":
            return { x: 25, y: 25, w: 50, h: 50, fit: "cover" }
        case "full":
            return { x: 0, y: 0, w: 100, h: 100, fit: "contain" }
        case "br":
        default:
            return { x: 100 - size - margin, y: 100 - size - margin * 1.78, w: size, h: size, fit: "cover" }
    }
}

export function addPip(inputId: string, preset: PipPreset = "br") {
    const id = uid("pip_")
    mixer.update((a) => {
        a.pips = [...a.pips, { id, inputId, enabled: false, radius: 12, border: 4, borderColor: "#ffffff", ...getPipPreset(preset) }]
        return a
    })
    return id
}

export function updatePip(id: string, patch: Partial<MixerPip>) {
    mixer.update((a) => {
        a.pips = a.pips.map((p) => (p.id === id ? { ...p, ...patch, id } : p))
        return a
    })
    if (!get(outLocked)) writeOut(() => ({ pips: getActivePips() }))
}

export function togglePip(id: string, enabled?: boolean) {
    const pip = get(mixer).pips.find((p) => p.id === id)
    if (!pip) return
    updatePip(id, { enabled: enabled ?? !pip.enabled })
}

export function removePip(id: string) {
    mixer.update((a) => {
        a.pips = a.pips.filter((p) => p.id !== id)
        return a
    })
    writeOut(() => ({ pips: getActivePips() }))
}

export function movePip(id: string, direction: -1 | 1) {
    mixer.update((a) => {
        const index = a.pips.findIndex((p) => p.id === id)
        const target = index + direction
        if (index < 0 || target < 0 || target >= a.pips.length) return a
        const list = [...a.pips]
        ;[list[index], list[target]] = [list[target], list[index]]
        a.pips = list
        return a
    })
    writeOut(() => ({ pips: getActivePips() }))
}

// ----- REPLAY -----

export const replayAutoReturn = writable(true)

function scheduleReplayReturn(input: MixerInput | null) {
    if (replayReturnTimeout) clearTimeout(replayReturnTimeout)
    replayReturnTimeout = null
    if (!input || input.type !== "replay" || !get(replayAutoReturn) || !input.duration) return

    const seconds = input.duration / (input.playbackRate || 1)
    replayReturnTimeout = setTimeout(() => {
        // only return if the replay is still on program
        if (getOutMixer().program?.id !== input.id) return
        const back = getInput(lastRealProgramId)
        if (back) startAuto(back, false)
    }, seconds * 1000)
}

/** puts a replay clip straight on air with the current transition */
export function playReplay(id: string) {
    quickPlay(id, true)
}

// ----- SYNC -----

/** program/preview tally follow the output (so changes from other windows/remote show up) */
export function syncProgramWithOutput() {
    const program = getOutMixer().program
    const programId = program && program.id !== MIXER_BLACK_ID ? program.id : null
    if (get(mixer).programId !== programId) {
        mixer.update((a) => {
            a.programId = programId
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

const MIXER_KEYS = [" ", "Enter", "c", "C", "b", "B", "r", "R"]
/** keys the mixer page reserves (so slide shortcuts don't also fire) */
export function isMixerKey(e: KeyboardEvent): boolean {
    if (e.ctrlKey || e.metaKey || e.altKey) return false
    const number = Number(e.key)
    return MIXER_KEYS.includes(e.key) || (number >= 1 && number <= MAX_SHORTCUT_INPUTS)
}

/** set by the replay engine (avoids a circular import) */
export const mixerHotkeys: { replay: (() => void) | null } = { replay: null }

/** returns true when the key was handled. Only called while the mixer page is open. */
export function mixerKeydown(e: KeyboardEvent): boolean {
    if (!isMixerKey(e)) return false

    const state = get(mixer)
    const number = Number(e.key)
    if (number >= 1 && number <= MAX_SHORTCUT_INPUTS) {
        const input = state.inputs[number - 1]
        if (!input) return true
        if (e.shiftKey) quickPlay(input.id)
        else setPreview(input.id)
        return true
    }

    const key = e.key.toLowerCase()
    if (key === " " || key === "enter") auto()
    else if (key === "c") cut()
    else if (key === "b") fadeToBlack()
    else if (key === "r") mixerHotkeys.replay?.()
    return true
}
