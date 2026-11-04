<script lang="ts">
    // Compact horizontal level meter of what is sent to a recording/stream (network_sub_<output>).
    import { onDestroy, onMount } from "svelte"
    import { AudioInputCapture } from "../../audio/routing/audioInputCapture"

    export let nodeId: string

    let level = 0 // 0-1
    let peak = 0
    let frame = 0

    // 20 updates per second is plenty for a meter (requestAnimationFrame ran at the screen rate, up to 120 Hz)
    function tick() {
        if (document.hidden) return
        const data = AudioInputCapture.getInstance().getVisualizerData(nodeId)
        const dbs = data?.channels?.length ? data.channels.map((c) => c.db) : typeof data?.db === "number" ? [data.db] : [-60]
        const db = Math.max(...dbs)
        const target = Math.max(0, Math.min(1, (db + 60) / 60))
        level = target > level ? target : level * 0.9 + target * 0.1
        peak = Math.max(level, peak - 0.005)
    }

    onMount(() => (frame = window.setInterval(tick, 50)))
    onDestroy(() => clearInterval(frame))
</script>

<span class="meter" title="{Math.round(level * 60 - 60)} dB">
    <span class="fill" style="width: {level * 100}%;" />
    <span class="peak" style="left: {peak * 100}%;" />
</span>

<style>
    .meter {
        position: relative;
        display: inline-block;
        width: 64px;
        height: 7px;
        border-radius: 2px;
        background: rgb(0 0 0 / 0.45);
        overflow: hidden;
    }
    .fill {
        position: absolute;
        inset: 0 auto 0 0;
        background: linear-gradient(90deg, #1fae5c 0%, #1fae5c 65%, #f5d90a 85%, #ff5d6c 100%);
        background-size: 64px 100%;
    }
    .peak {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 2px;
        margin-left: -2px;
        background: white;
    }
</style>
