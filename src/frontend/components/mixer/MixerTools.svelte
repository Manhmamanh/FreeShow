<script lang="ts">
    // Right panel: target output, overlay channels (vMix "Overlay 1-4" style), and where to stream/record/NDI.
    import { activePage, dictionary, outputs, overlays, settingsTab } from "../../stores"
    import { translateText } from "../../utils/language"
    import { sortByName } from "../helpers/array"
    import Icon from "../helpers/Icon.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import { clearOverlays, clearSlide } from "../output/clear"
    import { getMonitorOutputId, mixer, setTargetOutput, toggleOverlay } from "./mixer"

    $: outputList = Object.entries($outputs)
        .filter(([_id, o]) => !o.stageOutput && o.enabled !== false)
        .map(([id, o]) => ({ id, name: o.name }))

    $: monitorOutputId = getMonitorOutputId($mixer)
    $: out = $outputs[monitorOutputId]?.out || {}
    $: activeOverlays = out.overlays || []
    $: overlayList = sortByName(Object.entries($overlays).map(([id, o]) => ({ id, name: o.name })))
    $: slideOn = !!out.slide

    $: output = $outputs[monitorOutputId]
    $: status = [
        { label: "NDI", on: !!output?.ndi },
        { label: "RTMP", on: !!output?.rtmp },
        { label: "Blackmagic", on: !!output?.blackmagic },
        { label: "OMT", on: !!output?.omt }
    ]

    function openOutputSettings() {
        settingsTab.set("display_settings")
        activePage.set("settings")
    }
</script>

<div class="tools">
    <div class="section">
        <div class="header">{translateText("mixer.target_output", $dictionary)}</div>
        <select value={$mixer.outputId} on:change={(e) => setTargetOutput(e.currentTarget.value)}>
            <option value="">{translateText("mixer.all_outputs", $dictionary)}</option>
            {#each outputList as o}
                <option value={o.id}>{o.name}</option>
            {/each}
        </select>
    </div>

    <div class="section">
        <div class="header">{translateText("mixer.slide_layer", $dictionary)}</div>
        <p class="hint">{translateText("mixer.slide_hint", $dictionary)}</p>
        <MaterialButton icon="clear" disabled={!slideOn} on:click={() => clearSlide()}>{translateText("mixer.clear_slide", $dictionary)}</MaterialButton>
    </div>

    <div class="section">
        <div class="header">
            {translateText("mixer.overlays", $dictionary)}
            {#if activeOverlays.length}<button class="link" on:click={() => clearOverlays($mixer.outputId)}>{translateText("mixer.clear_all", $dictionary)}</button>{/if}
        </div>
        {#each overlayList as overlay}
            {@const on = activeOverlays.includes(overlay.id)}
            <button class="overlay" class:on on:click={() => toggleOverlay(overlay.id)}>
                <span class="dot" />
                <span class="name">{overlay.name || "-"}</span>
                <span class="state">{on ? "ON AIR" : "OFF"}</span>
            </button>
        {:else}
            <p class="hint">{translateText("mixer.no_overlays", $dictionary)}</p>
        {/each}
    </div>

    <div class="section">
        <div class="header">{translateText("mixer.outputs_status", $dictionary)}</div>
        <div class="status">
            {#each status as s}
                <span class="pill" class:on={s.on}>{s.label}</span>
            {/each}
        </div>
        <p class="hint">{translateText("mixer.outputs_hint", $dictionary)}</p>
        <MaterialButton icon="display_settings" on:click={openOutputSettings}>{translateText("mixer.open_output_settings", $dictionary)}</MaterialButton>
    </div>

    <div class="section">
        <div class="header"><Icon id="keyboard" size={0.9} white /> {translateText("mixer.shortcuts", $dictionary)}</div>
        <ul class="keys">
            <li><kbd>1</kbd>–<kbd>9</kbd> {translateText("mixer.key_preview", $dictionary)}</li>
            <li><kbd>Shift</kbd>+<kbd>1</kbd>–<kbd>9</kbd> {translateText("mixer.key_quickplay", $dictionary)}</li>
            <li><kbd>Space</kbd> / <kbd>Enter</kbd> AUTO</li>
            <li><kbd>C</kbd> CUT · <kbd>B</kbd> FTB</li>
            <li><kbd>→</kbd> / <kbd>←</kbd> {translateText("mixer.key_slides", $dictionary)}</li>
        </ul>
    </div>
</div>

<style>
    .tools {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow-y: auto;
    }

    .section {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding-bottom: 8px;
        border-bottom: 2px solid var(--primary-lighter);
    }

    .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        padding: 8px 10px;
        font-weight: 600;
        font-size: 0.9em;
        text-transform: uppercase;
        opacity: 0.8;
        background-color: var(--primary-darker);
    }

    select {
        margin: 4px 10px;
        padding: 6px;
        border: none;
        border-radius: 4px;
        background-color: var(--primary-darker);
        color: var(--text);
        font-family: inherit;
    }

    .hint {
        padding: 0 10px;
        font-size: 0.8em;
        opacity: 0.6;
    }

    .link {
        border: none;
        background: none;
        color: var(--secondary);
        font-size: 0.85em;
        cursor: pointer;
        text-transform: none;
    }

    .overlay {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 10px;
        padding: 6px 8px;
        border: 1px solid var(--primary-lighter);
        border-radius: 4px;
        background-color: var(--primary-darkest);
        color: var(--text);
        font-family: inherit;
        cursor: pointer;
    }
    .overlay .dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background-color: var(--primary-lighter);
    }
    .overlay.on {
        border-color: #e5243b;
    }
    .overlay.on .dot {
        background-color: #e5243b;
    }
    .overlay .name {
        flex: 1;
        text-align: start;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }
    .overlay .state {
        font-size: 0.75em;
        font-weight: bold;
        opacity: 0.7;
    }

    .status {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        padding: 0 10px;
    }
    .pill {
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 0.8em;
        background-color: var(--primary-darker);
        opacity: 0.6;
    }
    .pill.on {
        background-color: #1d8f3f;
        color: white;
        opacity: 1;
    }

    .keys {
        margin: 0;
        padding: 4px 10px 0 28px;
        font-size: 0.85em;
        line-height: 1.8;
    }
    kbd {
        padding: 1px 5px;
        border-radius: 3px;
        background-color: var(--primary-darker);
        font-family: inherit;
        font-size: 0.9em;
    }
</style>
