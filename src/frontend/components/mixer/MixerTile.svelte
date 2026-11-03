<script context="module" lang="ts">
    const icons = { camera: "camera", ndi: "ndi", omt: "ndi", screen: "screen", blackmagic: "camera", video: "video", image: "image", replay: "history", guest: "people", audio: "microphone", audiofile: "music" }
    export const inputIcon = (type: string) => icons[type] || "media"
</script>

<script lang="ts">
    // vMix-style input tile: title bar (number, name, close), live thumbnail, and a button row
    // [1 2 3 4] = put in PiP/overlay slot, Quick Play, Cut, Loop, Audio.
    import { createEventDispatcher } from "svelte"
    import type { MixerInput, MixerPip } from "../../../types/Mixer"
    import Icon from "../helpers/Icon.svelte"
    import { assignPipSlot, cut, PIP_SLOTS, quickPlay, removeInput, renameInput, setPreview, toggleAudioFile, updateInput } from "./mixer"
    import MixerSource from "./output/MixerSource.svelte"

    export let input: MixerInput
    export let index: number
    export let isPreview = false
    export let isProgram = false
    export let pips: MixerPip[] = []
    export let isRecording = false
    export let live = true

    const dispatch = createEventDispatcher()

    $: slotState = Array.from({ length: PIP_SLOTS }, (_, i) => (pips[i]?.inputId === input.id ? (pips[i].enabled ? "on" : "set") : ""))
    $: inPip = slotState.includes("on")
    $: isAudioFile = input.type === "audiofile"
    $: hasSound = input.type === "video" || isAudioFile || input.type === "audio" || input.type === "guest" || input.type === "replay" || !!input.audioDeviceId

    let editing = false
    function focusSelect(node: HTMLInputElement) {
        node.focus()
        node.select()
    }
    function finishRename(value: string) {
        renameInput(input.id, value)
        editing = false
    }

    function cutThis() {
        setPreview(input.id)
        cut()
    }
</script>

<div class="tile" class:preview={isPreview} class:program={isProgram} class:pip={inPip && !isProgram && !isPreview}>
    <div class="titlebar">
        <span class="number">{index + 1}</span>
        {#if editing}
            <input class="rename" value={input.name} use:focusSelect on:blur={(e) => finishRename(e.currentTarget.value)} on:keydown={(e) => (e.key === "Enter" ? e.currentTarget.blur() : e.key === "Escape" ? (editing = false) : null)} />
        {:else}
            <span class="name" title={input.name} on:dblclick={() => (editing = true)}>{input.name}</span>
        {/if}
        {#if isRecording}<span class="rec">REC</span>{/if}
        <button class="close" title="✕" disabled={isProgram} on:click={() => removeInput(input.id)}>✕</button>
    </div>

    <button class="media" class:playing={isAudioFile && input.playing} on:click={() => setPreview(input.id)} on:dblclick={() => !isAudioFile && quickPlay(input.id, true)} title={input.name}>
        {#if isAudioFile}
            <div class="audioFile">
                <Icon id="music" size={2.2} white />
                <span>{input.playing ? "▶ PLAYING" : "⏸ STOPPED"}</span>
            </div>
        {:else if live && input.type !== "audio"}
            <MixerSource {input} mirror thumbnail />
        {:else}
            <Icon id={inputIcon(input.type)} size={2.4} white />
        {/if}
        <span class="type"><Icon id={inputIcon(input.type)} size={0.75} white /></span>
        {#if input.type === "replay"}<span class="speed">{input.playbackRate || 1}×</span>{/if}
    </button>

    <div class="controls">
        {#if isAudioFile}
            <button class="ctl play" class:active={input.playing} title="Play / Pause" on:click={() => toggleAudioFile(input.id)}>{input.playing ? "⏸ PAUSE" : "▶ PLAY"}</button>
            <button class="ctl" class:active={input.loop === true} title="Loop" on:click={() => updateInput(input.id, { loop: input.loop !== true })}>LOOP</button>
            <button class="ctl audio" class:muted={input.muted} title="Audio" on:click={() => updateInput(input.id, { muted: !input.muted })}>
                <Icon id={input.muted ? "volume_off" : "volume"} size={0.8} white />
            </button>
        {:else}
            <div class="slots">
                {#each slotState as state, i}
                    <button class="slot {state}" title="PiP {i + 1}" on:click={() => assignPipSlot(input.id, i)}>{i + 1}</button>
                {/each}
            </div>
            <button class="ctl go" title="Quick Play" on:click={() => quickPlay(input.id, true)}>GO</button>
            <button class="ctl" title="Cut" on:click={cutThis}>CUT</button>
            {#if input.type === "video"}
                <button class="ctl" class:active={input.loop !== false} title="Loop" on:click={() => updateInput(input.id, { loop: input.loop === false })}>LOOP</button>
            {/if}
            {#if hasSound}
                <button class="ctl audio" class:muted={input.muted} title="Audio" on:click={() => updateInput(input.id, { muted: !input.muted })} on:contextmenu|preventDefault={() => dispatch("audio")}>
                    <Icon id={input.muted ? "volume_off" : "volume"} size={0.8} white />
                </button>
            {/if}
        {/if}
    </div>
</div>

<style>
    .tile {
        display: flex;
        flex-direction: column;
        border: 1px solid var(--mx-border);
        border-radius: 4px;
        background-color: var(--mx-panel);
        overflow: hidden;
        min-width: 0;
    }

    .titlebar {
        display: flex;
        align-items: center;
        gap: 6px;
        height: 22px;
        padding: 0 4px 0 0;
        background: linear-gradient(#244a86, #1b3a6b);
        color: white;
        font-size: 0.78em;
        font-weight: 600;
    }
    .tile.preview .titlebar {
        background: linear-gradient(#1fae5c, #178a48);
    }
    .tile.program .titlebar {
        background: linear-gradient(#e5293f, #b81d30);
    }
    .tile.pip .titlebar {
        background: linear-gradient(#f5a623, #c98510);
    }
    .number {
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 22px;
        height: 100%;
        background: rgb(0 0 0 / 0.25);
        font-weight: 800;
    }
    .name {
        flex: 1;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        cursor: text;
    }
    .rename {
        flex: 1;
        min-width: 0;
        height: 18px;
        border: none;
        border-radius: 2px;
        padding: 0 4px;
        font: inherit;
    }
    .rec {
        padding: 0 4px;
        border-radius: 2px;
        background-color: #e5293f;
        font-size: 0.85em;
        animation: blink 1.2s infinite;
    }
    @keyframes blink {
        50% {
            opacity: 0.4;
        }
    }
    .close {
        border: none;
        background: none;
        color: white;
        opacity: 0.6;
        cursor: pointer;
        font-size: 0.95em;
        padding: 0 3px;
    }
    .close:hover:not(:disabled) {
        opacity: 1;
        color: #ff8b98;
    }
    .close:disabled {
        opacity: 0.2;
        cursor: default;
    }

    .media {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        aspect-ratio: 16/9;
        width: 100%;
        padding: 0;
        border: none;
        background-color: #000;
        overflow: hidden;
        cursor: pointer;
    }
    .media :global(.source) {
        pointer-events: none;
    }
    .type,
    .speed {
        position: absolute;
        bottom: 3px;
        padding: 1px 4px;
        border-radius: 3px;
        background: rgb(0 0 0 / 0.55);
        color: white;
        font-size: 0.7em;
        display: flex;
        align-items: center;
    }
    .type {
        left: 3px;
    }
    .speed {
        right: 3px;
        font-weight: bold;
    }

    .controls {
        display: flex;
        gap: 2px;
        padding: 3px;
        background-color: var(--mx-panel-2);
    }
    .slots {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 2px;
        margin-inline-end: 2px;
    }
    .controls button {
        height: 20px;
        border: 1px solid var(--mx-border);
        border-radius: 2px;
        background: linear-gradient(#25314a, #1a2335);
        color: var(--mx-muted);
        font-family: inherit;
        font-size: 0.66em;
        font-weight: 700;
        cursor: pointer;
    }
    .controls button:hover {
        color: white;
        border-color: var(--mx-accent);
    }
    .slot {
        width: 15px;
        padding: 0;
    }
    .slot.set {
        color: #f5a623;
        border-color: #a56f12;
    }
    .slot.on {
        background: linear-gradient(#f5a623, #c98510) !important;
        color: #1b1300 !important;
    }
    .ctl {
        flex: 1;
        padding: 0 3px;
        min-width: 0;
    }
    .ctl.go {
        color: #8fc2ff;
    }
    .ctl.active {
        color: white;
        background: linear-gradient(var(--mx-accent), #1b5fd1) !important;
    }
    .ctl.audio {
        flex: 0 0 22px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(#1fae5c, #178a48) !important;
    }
    .ctl.audio.muted {
        background: linear-gradient(#5a6475, #3c4454) !important;
    }

    .media.playing {
        background: radial-gradient(circle, #13315f, #000 75%);
    }
    .audioFile {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        color: var(--mx-muted);
        font-size: 0.75em;
        font-weight: 800;
        letter-spacing: 0.05em;
    }
    .media.playing .audioFile {
        color: #5fd38d;
    }
    .ctl.play {
        flex: 2;
    }
</style>
