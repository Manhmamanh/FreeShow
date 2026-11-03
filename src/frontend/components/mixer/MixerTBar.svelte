<script lang="ts">
    // Manual transition lever (vMix T-bar), horizontal. Drag: preview fades into program; a full move takes it.
    import { outLocked } from "../../stores"
    import { mixerTransitioning, tbarEnd, tbarMove, tbarPosition, tbarStart } from "./mixer"

    export let disabled = false

    let track: HTMLDivElement
    let dragging = false

    function positionFromEvent(e: PointerEvent) {
        const rect = track.getBoundingClientRect()
        return Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    }

    function down(e: PointerEvent) {
        if (disabled || $outLocked || $mixerTransitioning) return
        if (!tbarStart()) return
        dragging = true
        track.setPointerCapture(e.pointerId)
        tbarMove(positionFromEvent(e))
    }
    function move(e: PointerEvent) {
        if (dragging) tbarMove(positionFromEvent(e))
    }
    function up(e: PointerEvent) {
        if (!dragging) return
        dragging = false
        track.releasePointerCapture(e.pointerId)
        tbarEnd()
    }
</script>

<div class="tbar" class:disabled={disabled || $outLocked} title="T-Bar">
    <div class="track" bind:this={track} on:pointerdown={down} on:pointermove={move} on:pointerup={up} on:pointercancel={up}>
        <div class="groove" />
        <div class="fill" style="width: {$tbarPosition * 100}%;" />
        <div class="handle" class:dragging style="left: {$tbarPosition * 100}%;" />
    </div>
</div>

<style>
    .tbar {
        width: 100%;
        padding: 8px 10px;
        user-select: none;
    }
    .tbar.disabled {
        opacity: 0.4;
        pointer-events: none;
    }

    .track {
        position: relative;
        height: 22px;
        cursor: ew-resize;
        touch-action: none;
    }
    .groove {
        position: absolute;
        top: 50%;
        left: 0;
        right: 0;
        height: 6px;
        margin-top: -3px;
        border-radius: 3px;
        background: #070b14;
        box-shadow: inset 0 1px 2px rgb(0 0 0 / 0.8);
    }
    .fill {
        position: absolute;
        top: 50%;
        left: 0;
        height: 6px;
        margin-top: -3px;
        border-radius: 3px;
        background: linear-gradient(90deg, var(--mx-accent, #2f80ed), var(--mx-accent-2, #00b4ff));
    }
    .handle {
        position: absolute;
        top: 0;
        width: 16px;
        height: 22px;
        margin-left: -8px;
        border-radius: 3px;
        background: linear-gradient(90deg, #cfd8e6, #ffffff 45%, #9aa8bd);
        box-shadow: 0 2px 6px rgb(0 0 0 / 0.6);
    }
    .handle.dragging {
        background: linear-gradient(90deg, #8fc2ff, #ffffff 45%, #2f80ed);
    }
</style>
