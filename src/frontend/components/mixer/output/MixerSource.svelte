<script lang="ts">
    // Draws one mixer input filling its box. Used by the output layer, the monitors and the multiview.
    // Video files are always muted here: their sound is played by the main window audio engine (mixerAudio.ts),
    // so it goes through FreeShow's audio routing (speakers, NDI, RTMP stream, recordings).
    import { onDestroy } from "svelte"
    import type { MixerInput } from "../../../../types/Mixer"
    import BmdStream from "../../drawer/live/BMDStream.svelte"
    import NdiStream from "../../drawer/live/NDIStream.svelte"
    import OmtStream from "../../drawer/live/OMTStream.svelte"
    import Icon from "../../helpers/Icon.svelte"
    import { encodeFilePath } from "../../helpers/media"
    import Camera from "../../output/Camera.svelte"
    import Window from "../../output/Window.svelte"
    import { guestVideo } from "../guestReceiver"
    import { cssFilter, isFxActive } from "../mixerFx"
    import MixerFxCanvas from "./MixerFxCanvas.svelte"
    import { getGuestViewUrl } from "../mixerLive"

    export let input: MixerInput
    export let outputId = ""
    export let mirror = false
    export let fit: "contain" | "cover" = "contain"
    /** guest audio only (0-1.5); the guest plays its own sound in the output window */
    export let gain = 0
    export let thumbnail = false

    $: src = input.type === "video" || input.type === "replay" || input.type === "image" ? encodeFilePath(input.sourceId) : ""
    $: rate = input.playbackRate || 1

    let video: HTMLVideoElement | null = null
    $: if (video) video.playbackRate = rate

    // ----- picture filters -----
    let sourceEl: HTMLDivElement | null = null
    let fxFailed = false
    $: canFx = input.type !== "audio" && input.type !== "audiofile" && !(input.type === "guest" && input.guestMode === "webview")
    // thumbnails (many at once) and machines without WebGL2 use cheap CSS filters
    $: useGl = canFx && !thumbnail && !fxFailed && isFxActive(input.fx)
    $: filterStyle = canFx && !useGl ? cssFilter(input.fx) : ""

    // ----- guest webview -----
    let webview: any = null
    let webviewReady = false
    // only the real output window plays the guest's sound (monitors & thumbnails stay silent)
    $: guestAudible = !mirror && !thumbnail
    $: if (webview && webviewReady) applyGuestVolume(guestAudible ? gain : 0)

    function applyGuestVolume(volume: number) {
        try {
            webview.setAudioMuted(volume <= 0)
            // VDO.Ninja renders the guest in <video>/<audio> elements, set their volume directly
            const v = Math.min(1, Math.max(0, volume)).toFixed(3)
            webview.executeJavaScript(`document.querySelectorAll("video,audio").forEach((m) => { m.volume = ${v} })`).catch(() => null)
        } catch (err) {
            console.warn("[Mixer] guest volume", err)
        }
    }

    function guestAttach(node: any) {
        webview = node
        const ready = () => {
            webviewReady = true
            applyGuestVolume(guestAudible ? gain : 0)
        }
        node.addEventListener("dom-ready", ready)
        // VDO.Ninja creates media elements after connecting; re-apply the volume a few times
        const interval = setInterval(() => webviewReady && applyGuestVolume(guestAudible ? gain : 0), 3000)
        return {
            destroy() {
                clearInterval(interval)
                node.removeEventListener("dom-ready", ready)
                webview = null
                webviewReady = false
            }
        }
    }

    onDestroy(() => {
        if (video) {
            video.pause()
            video.removeAttribute("src")
            video.load()
        }
    })
</script>

<div class="source" class:cover={fit === "cover"} class:fxOn={useGl} bind:this={sourceEl} style={filterStyle ? `filter: ${filterStyle};` : ""}>
    {#if input.type === "camera"}
        <Camera id={input.sourceId} groupId={input.cameraGroup || ""} class="media" style="width: 100%;height: 100%;object-fit: {fit};" />
    {:else if input.type === "video" || input.type === "replay"}
        {#key src}
            <!-- svelte-ignore a11y-media-has-caption -->
            <video bind:this={video} {src} autoplay muted loop={input.type === "video" && input.loop !== false} playsinline on:loadedmetadata={() => video && (video.playbackRate = rate)} />
        {/key}
    {:else if input.type === "image"}
        <img {src} alt={input.name} draggable={false} />
    {:else if input.type === "ndi"}
        {#key input.sourceId}
            <NdiStream screen={{ id: input.sourceId, name: "" }} background outputBackground {mirror} {outputId} />
        {/key}
    {:else if input.type === "omt"}
        {#key input.sourceId}
            <OmtStream screen={{ id: input.sourceId, name: "" }} background outputBackground {mirror} {outputId} />
        {/key}
    {:else if input.type === "blackmagic"}
        <BmdStream screen={{ id: input.sourceId, name: "" }} background outputBackground {mirror} {outputId} />
    {:else if input.type === "screen"}
        <Window id={input.sourceId} class="media" style="width: 100%;height: 100%;" />
    {:else if input.type === "guest" && input.guestMode === "webview"}
        <!-- compatibility mode: the VDO.Ninja page itself (its sound plays from this window) -->
        {#key input.sourceId}
            <webview class="guest" src={getGuestViewUrl(input.sourceId)} use:guestAttach />
        {/key}
    {:else if input.type === "guest"}
        <!-- direct WebRTC: a normal video element, so offscreen outputs (NDI/RTMP) capture it; sound via mixerAudio -->
        <!-- svelte-ignore a11y-media-has-caption -->
        <video class="guestVideo" use:guestVideo={input.sourceId} autoplay muted playsinline />
    {:else if input.type === "audio" || input.type === "audiofile"}
        {#if thumbnail}
            <div class="icon"><Icon id={input.type === "audiofile" ? "music" : "microphone"} size={2.5} white /></div>
        {/if}
    {/if}
    {#if useGl && input.fx}
        <MixerFxCanvas container={sourceEl} fx={input.fx} {fit} bind:failed={fxFailed} />
    {/if}
</div>

<style>
    .source {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
    }

    .source :global(video),
    .source :global(img),
    .source :global(canvas) {
        width: 100%;
        height: 100%;
        object-fit: contain;
    }
    .source.cover :global(video),
    .source.cover :global(img),
    .source.cover :global(canvas) {
        object-fit: cover;
    }

    .guest {
        width: 100%;
        height: 100%;
        border: none;
        background: black;
    }

    .icon {
        opacity: 0.6;
    }

    /* filtered picture is drawn by MixerFxCanvas; keep the original playing but invisible */
    .source.fxOn > :global(:not(.mixerFx)) {
        opacity: 0;
    }
</style>
