<script context="module" lang="ts">
    const captures = new Map<string, { stream: Promise<MediaStream>; refs: number }>()

    function acquireCapture(id: string, constraints: any): Promise<MediaStream> {
        let entry = captures.get(id)
        if (!entry) {
            entry = { stream: navigator.mediaDevices.getUserMedia(constraints), refs: 0 }
            captures.set(id, entry)
            entry.stream.catch(() => captures.delete(id))
        }
        entry.refs++
        return entry.stream
    }

    function releaseCapture(id: string) {
        const entry = captures.get(id)
        if (!entry) return
        entry.refs--
        if (entry.refs > 0) return
        captures.delete(id)
        entry.stream.then((stream) => stream.getTracks().forEach((track) => track.stop())).catch(() => null)
    }
</script>

<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount } from "svelte"

    export let id: string

    let videoElem: HTMLVideoElement | undefined

    let constraints: any = {
        video: {
            // https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackSettings/cursor
            // hiding the cursor is not yet supported
            // cursor: "never",
            mandatory: {
                chromeMediaSource: "desktop",
                chromeMediaSourceId: id,
                maxWidth: 1920,
                maxHeight: 1080,
                // maxAspectRatio: 16/9,
                maxFrameRate: 30 // Haidangshow: 30 is enough for screens and halves the capture cost
            }
        }
    }

    // Haidangshow: one capture per screen/window in this window, shared by every <Window> showing it
    // (the mixer shows the same screen in its tile, preview and program: 1 capture instead of 3+).
    let currentStream: MediaStream | null = null
    let destroyed = false
    onDestroy(() => {
        destroyed = true
        if (currentStream) releaseCapture(id)
    })

    onMount(() => {
        acquireCapture(id, constraints)
            .then((stream) => {
                if (destroyed || !videoElem) return releaseCapture(id)

                currentStream = stream
                videoElem.srcObject = stream
                videoElem.onloadedmetadata = loaded
            })
            .catch((err) => {
                console.error(err.name + ": " + err.message)
            })
    })

    let dispatch = createEventDispatcher()
    function loaded() {
        // WIP not working!!!
        if (!videoElem) return

        videoElem.play()
        dispatch("loaded", true)
    }
</script>

<video bind:this={videoElem} class={$$props.class} data-source={id} style={$$props.style}>
    <track kind="captions" />
</video>
