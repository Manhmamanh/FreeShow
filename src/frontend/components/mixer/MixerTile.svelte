<script lang="ts">
    // One multiview cell: live thumbnail of an input + tally (red = program, green = preview).
    import { createEventDispatcher } from "svelte"
    import type { MixerInput } from "../../../types/Mixer"
    import Icon from "../helpers/Icon.svelte"
    import BackgroundMedia from "../output/layers/BackgroundMedia.svelte"
    import { inputToBackground } from "./mixer"

    export let input: MixerInput
    export let index: number
    export let isPreview = false
    export let isProgram = false
    export let live = true

    const noTransition = { type: "none" as const, duration: 0, easing: "linear" }
    // thumbnails are always muted
    $: data = { ...inputToBackground(input), muted: true }

    const icons = { camera: "camera", ndi: "ndi", omt: "ndi", screen: "screen", blackmagic: "camera", video: "video", image: "image", media: "media", player: "play" }

    const dispatch = createEventDispatcher()
</script>

<button class="tile" class:preview={isPreview} class:program={isProgram} on:click={() => dispatch("preview")} on:dblclick={() => dispatch("play")} title={input.name}>
    <div class="media">
        {#if live}
            {#key input.sourceId}
                <BackgroundMedia {data} transition={noTransition} mirror />
            {/key}
        {:else}
            <Icon id={icons[input.type] || "media"} size={2.5} white />
        {/if}
    </div>

    <div class="label">
        <span class="number">{index + 1}</span>
        <Icon id={icons[input.type] || "media"} size={0.9} white />
        <span class="name">{input.name}</span>
        {#if isProgram}<span class="badge red">PGM</span>{:else if isPreview}<span class="badge green">PVW</span>{/if}
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
    .media :global(video),
    .media :global(img),
    .media :global(canvas) {
        width: 100%;
        height: 100%;
        object-fit: contain;
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
</style>
