<script context="module" lang="ts">
    const icons = { camera: "camera", ndi: "ndi", omt: "ndi", screen: "screen", blackmagic: "camera", video: "video", image: "image", replay: "history", guest: "people", audio: "microphone" }
    export const inputIcon = (type: string) => icons[type] || "media"
</script>

<script lang="ts">
    // One multiview cell: live thumbnail of an input + tally (red = program, green = preview, orange = PiP).
    import { createEventDispatcher } from "svelte"
    import type { MixerInput } from "../../../types/Mixer"
    import Icon from "../helpers/Icon.svelte"
    import MixerSource from "./output/MixerSource.svelte"

    export let input: MixerInput
    export let index: number
    export let isPreview = false
    export let isProgram = false
    export let isPip = false
    export let isRecording = false
    export let live = true

    const dispatch = createEventDispatcher()
</script>

<button class="tile" class:preview={isPreview} class:program={isProgram} class:pip={isPip && !isProgram} on:click={() => dispatch("preview")} on:dblclick={() => dispatch("play")} title={input.name}>
    <div class="media">
        {#if live && input.type !== "audio"}
            <MixerSource {input} mirror thumbnail />
        {:else}
            <Icon id={inputIcon(input.type)} size={2.5} white />
        {/if}
        {#if isRecording}<span class="rec">● REC</span>{/if}
        {#if input.type === "replay"}<span class="speed">{input.playbackRate || 1}×</span>{/if}
    </div>

    <div class="label">
        <span class="number">{index + 1}</span>
        <Icon id={inputIcon(input.type)} size={0.9} white />
        <span class="name">{input.name}</span>
        {#if input.muted}<Icon id="volume_off" size={0.8} white />{/if}
        {#if isProgram}<span class="badge red">PGM</span>{:else if isPreview}<span class="badge green">PVW</span>{/if}
        {#if isPip}<span class="badge orange">PiP</span>{/if}
    </div>
</button>

<style>
    .tile {
        position: relative;
        display: flex;
        flex-direction: column;
        padding: 0;
        border: 3px solid var(--primary-lighter);
        border-radius: 6px;
        background-color: var(--primary-darkest);
        color: var(--text);
        cursor: pointer;
        overflow: hidden;
        font-family: inherit;
    }
    .tile:hover {
        border-color: var(--secondary-opacity);
    }
    .tile.pip {
        border-color: #f39c12;
    }
    .tile.preview {
        border-color: #23b14d;
    }
    .tile.program {
        border-color: #e5243b;
    }

    .media {
        position: relative;
        aspect-ratio: 16/9;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: black;
        overflow: hidden;
        pointer-events: none;
    }

    .rec,
    .speed {
        position: absolute;
        top: 4px;
        padding: 1px 6px;
        border-radius: 4px;
        font-size: 0.7em;
        font-weight: bold;
        color: white;
        z-index: 2;
    }
    .rec {
        left: 4px;
        background-color: #e5243b;
    }
    .speed {
        right: 4px;
        background-color: rgb(0 0 0 / 0.6);
    }

    .label {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 6px;
        font-size: 0.85em;
        background-color: var(--primary-darker);
    }
    .number {
        font-weight: bold;
        opacity: 0.7;
    }
    .name {
        flex: 1;
        text-align: start;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }
    .badge {
        padding: 0 6px;
        border-radius: 4px;
        font-size: 0.8em;
        font-weight: bold;
        color: white;
    }
    .badge.red {
        background-color: #e5243b;
    }
    .badge.green {
        background-color: #23b14d;
    }
    .badge.orange {
        background-color: #f39c12;
    }
</style>
