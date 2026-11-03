<script lang="ts">
    // Preview monitor: renders the real output (slides + overlays + active PiPs) with the preview input as
    // the mixer program, so the operator sees exactly what "Auto"/"Cut" will put on air.
    import type { MixerInput } from "../../../types/Mixer"
    import type { OutData } from "../../../types/Output"
    import { outputs, styles } from "../../stores"
    import { clone } from "../helpers/array"
    import { getResolution } from "../helpers/output"
    import Output from "../output/Output.svelte"
    import { getStyleResolution } from "../slide/getStyleResolution"
    import { emptyOutMixer, mixer } from "./mixer"

    export let outputId: string
    export let input: MixerInput | null

    $: resolution = getResolution(null, [$outputs, $styles], false, outputId)
    $: currentOut = $outputs[outputId]?.out || {}
    $: pips = $mixer.pips
        .filter((p) => p.enabled)
        .map((p) => ({ ...p, input: $mixer.inputs.find((i) => i.id === p.inputId) as MixerInput }))
        .filter((p) => p.input)
    $: outOverride = { ...clone(currentOut), mixer: { ...emptyOutMixer(), program: input, pips, transition: $mixer.transition } } as OutData

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
