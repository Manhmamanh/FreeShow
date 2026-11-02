<script lang="ts">
    // Preview monitor: renders the real output (slides + overlays) with the preview input as background,
    // so the operator sees exactly what "Auto"/"Cut" will put on air.
    import type { OutData } from "../../../types/Output"
    import type { OutBackground } from "../../../types/Show"
    import { outputs, styles } from "../../stores"
    import { clone } from "../helpers/array"
    import { getResolution } from "../helpers/output"
    import Output from "../output/Output.svelte"
    import { getStyleResolution } from "../slide/getStyleResolution"

    export let outputId: string
    export let background: OutBackground | null

    $: resolution = getResolution(null, [$outputs, $styles], false, outputId)
    $: currentOut = $outputs[outputId]?.out || {}
    $: outOverride = { ...clone(currentOut), background: background ? { ...background, mixerTransition: { type: "none", duration: 0, easing: "linear" } } : null } as OutData

    let width = 0
    let height = 0
</script>

<div class="monitor" style="aspect-ratio: {resolution.width}/{resolution.height};" bind:offsetWidth={width} bind:offsetHeight={height}>
    {#if outputId}
        <Output {outputId} {outOverride} mirror preview style={getStyleResolution(resolution, width || resolution.width, height || resolution.height, "fit")} />
    {/if}
</div>

<style>
    .monitor {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        background-color: black;
        overflow: hidden;
    }

    .monitor :global(.main) {
        width: 100%;
        pointer-events: none;
    }
</style>
