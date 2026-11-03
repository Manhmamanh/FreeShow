<script lang="ts">
    // The mixer layer every output draws (under FreeShow's background/slide/overlay layers):
    // A = program, B = incoming input during Auto / T-bar, then the picture-in-picture boxes on top.
    import { onDestroy } from "svelte"
    import { fade } from "svelte/transition"
    import type { OutMixer } from "../../../../types/Mixer"
    import { MIXER_BLACK_ID } from "../../../../types/Mixer"
    import { ease, getInputGain, getProgress, getTransitionStyles, mixerLiveAmount } from "../mixerLive"
    import MixerSource from "./MixerSource.svelte"

    export let data: OutMixer
    export let outputId = ""
    export let mirror = false

    $: liveAmount = $mixerLiveAmount[outputId] ?? $mixerLiveAmount[""]

    // re-render every frame only while an Auto transition is running
    let now = Date.now()
    let frame = 0
    $: running = !!data?.auto && !!data?.next
    $: if (running) loop()
    function loop() {
        cancelAnimationFrame(frame)
        const tick = () => {
            now = Date.now()
            if (data?.auto && now < data.auto.start + data.auto.duration + 50) frame = requestAnimationFrame(tick)
        }
        frame = requestAnimationFrame(tick)
    }
    onDestroy(() => cancelAnimationFrame(frame))

    $: progress = getProgress(data, liveAmount, now)
    $: eased = ease(progress, data?.transition?.easing)
    $: styles = getTransitionStyles(data?.transition?.type || "fade", eased)

    $: program = data?.program && data.program.id !== MIXER_BLACK_ID ? data.program : null
    $: next = data?.next && data.next.id !== MIXER_BLACK_ID ? data.next : null
    $: toBlack = data?.next?.id === MIXER_BLACK_ID
    // fading to black: the program itself fades out
    $: aStyle = toBlack ? `opacity: ${1 - eased};` : data?.next ? styles.a : ""

    // keep the same element for an input when it moves from B to A, so videos don't restart
    $: layers = [program ? { key: program.id, input: program, style: aStyle, z: 1 } : null, next && next.id !== program?.id ? { key: next.id, input: next, style: styles.b, z: 2 } : null].filter(Boolean) as { key: string; input: any; style: string; z: number }[]
</script>

{#if data}
    <div class="mixerLayer">
        {#each layers as layer (layer.key)}
            <div class="layer" style="z-index: {layer.z};{layer.style}">
                <MixerSource input={layer.input} {outputId} {mirror} gain={getInputGain(layer.input, data, progress)} />
            </div>
        {/each}

        {#each data.pips || [] as pip (pip.id)}
            <div class="pip" transition:fade={{ duration: mirror ? 0 : 300 }} style="left: {pip.x}%;top: {pip.y}%;width: {pip.w}%;height: {pip.h}%;border-radius: {pip.radius / 19.2}cqw;border: {pip.border / 19.2}cqw solid {pip.borderColor || 'white'};">
                <MixerSource input={pip.input} {outputId} {mirror} fit={pip.fit || "cover"} gain={getInputGain(pip.input, data, progress)} />
            </div>
        {/each}
    </div>
{/if}

<style>
    .mixerLayer {
        position: absolute;
        inset: 0;
        overflow: hidden;
        container-type: size;
        pointer-events: none;
    }

    .layer {
        position: absolute;
        inset: 0;
        will-change: opacity, transform, clip-path;
    }

    .pip {
        position: absolute;
        z-index: 10;
        overflow: hidden;
        box-sizing: border-box;
        background-color: black;
    }
</style>
