<script lang="ts">
    // Manual transition lever (vMix T-bar). Drag down/up: preview fades into program; a full move takes it.
    import { outLocked } from "../../stores"
    import { mixerTransitioning, tbarEnd, tbarMove, tbarPosition, tbarStart } from "./mixer"

    export let disabled = false

    let track: HTMLDivElement
    let dragging = false

    function positionFromEvent(e: PointerEvent) {
        const rect = track.getBoundingClientRect()
        return Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
    }

    function down(e: PointerEvent) {
        if (disabled || $outLocked || $mixerTransitioning) return
        if (!tbarStart()) return
        dragging = true
        track.setPointerCapture(e.pointerId)
        tbarMove(positionFromEvent(e))
    }
    function move(e: PointerEvent) {
        if (!dragging) return
        tbarMove(positionFromEvent(e))
    }
    function up(e: PointerEvent) {
        if (!dragging) return
        dragging = false
        track.releasePointerCapture(e.pointerId)
        tbarEnd()
    }
</script>

<div class="tbar" class:disabled={disabled || $outLocked}>
    <span class="label">T-BAR</span>
    <div class="track" bind:this={track} on:pointerdown={down} on:pointermove={move} on:pointerup={up} on:pointercancel={up}>
        <div class="fill" style="height: {$tbarPosition * 100}%;" />
        <div class="handle" class:dragging style="top: {$tbarPosition * 100}%;" />
    </div>
</div>

<style>
    .tbar {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        user-select: none;
    }
    .tbar.disabled {
        opacity: 0.4;
        pointer-events: none;
    }
    .label {
        font-size: 0.7em;
        font-weight: bold;
        opacity: 0.7;
    }

    .track {
        position: relative;
        width: 34px;
        height: 150px;
        border-radius: 6px;
        background-color: var(--primary-darkest);
        border: 1px solid var(--primary-lighter);
        cursor: ns-resize;
        touch-action: none;
    }
    .fill {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        border-radius: 6px;
        background: linear-gradient(#e5243b55, #e5243b22);
    }
    .handle {
        position: absolute;
        left: -6px;
        width: calc(100% + 12px);
        height: 16px;
        margin-top: -8px;
        border-radius: 4px;
        background: linear-gradient(#f0f0f0, #9a9a9a);
        box-shadow: 0 2px 6px rgb(0 0 0 / 0.5);
    }
    .handle.dragging {
        background: linear-gradient(#ffffff, #c41d31);
    }
</style>
