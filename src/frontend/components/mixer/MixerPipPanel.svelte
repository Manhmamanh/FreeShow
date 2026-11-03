<script lang="ts">
    // Picture-in-picture: boxes drawn over the program (vMix "overlay" channels / multi view layouts).
    import { dictionary } from "../../stores"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"
    import { addPip, getPipPreset, mixer, movePip, PIP_PRESETS, removePip, togglePip, updatePip, type PipPreset } from "./mixer"

    $: videoInputs = $mixer.inputs.filter((i) => i.type !== "audio")
    let newInputId = ""
    $: if (!newInputId || !videoInputs.some((i) => i.id === newInputId)) newInputId = $mixer.previewId && videoInputs.some((i) => i.id === $mixer.previewId) ? $mixer.previewId : videoInputs[0]?.id || ""

    function applyPreset(id: string, preset: PipPreset) {
        updatePip(id, getPipPreset(preset))
    }

    // two-camera interview layout in one click
    function splitScreen() {
        const [a, b] = videoInputs
        if (!a || !b) return
        const left = addPip(a.id, "left")
        const right = addPip(b.id, "right")
        updatePip(left, { border: 0, radius: 0, enabled: true })
        updatePip(right, { border: 0, radius: 0, enabled: true })
    }

    const num = (e: Event) => Number((e.currentTarget as HTMLInputElement).value)
</script>

<div class="add">
    <select bind:value={newInputId}>
        {#each videoInputs as input}
            <option value={input.id}>{input.name}</option>
        {/each}
    </select>
    <button class="btn" disabled={!newInputId} on:click={() => addPip(newInputId, "br")}><Icon id="add" size={0.9} white /> {translateText("mixer.add_pip", $dictionary)}</button>
    <button class="btn" disabled={videoInputs.length < 2} on:click={splitScreen} title={translateText("mixer.split_hint", $dictionary)}>◧◨ {translateText("mixer.split_screen", $dictionary)}</button>
</div>

<div class="pips">
    {#each $mixer.pips as pip, index (pip.id)}
        {@const input = $mixer.inputs.find((i) => i.id === pip.inputId)}
        <div class="pip" class:on={pip.enabled}>
            <div class="head">
                <button class="onAir" class:on={pip.enabled} on:click={() => togglePip(pip.id)}>{pip.enabled ? "ON AIR" : "OFF"}</button>
                <select value={pip.inputId} on:change={(e) => updatePip(pip.id, { inputId: e.currentTarget.value })}>
                    {#each videoInputs as i}
                        <option value={i.id}>{i.name}</option>
                    {/each}
                </select>
                <button class="icon" title="↑" disabled={index === 0} on:click={() => movePip(pip.id, -1)}><Icon id="up" size={0.9} white /></button>
                <button class="icon" title="↓" disabled={index === $mixer.pips.length - 1} on:click={() => movePip(pip.id, 1)}><Icon id="down" size={0.9} white /></button>
                <button class="icon red" title={translateText("actions.remove", $dictionary)} on:click={() => removePip(pip.id)}><Icon id="delete" size={0.9} white /></button>
            </div>

            {#if !input}<p class="warn">{translateText("mixer.pip_missing", $dictionary)}</p>{/if}

            <div class="presets">
                {#each PIP_PRESETS as preset}
                    <button on:click={() => applyPreset(pip.id, preset.id)} title={preset.id}>{preset.label}</button>
                {/each}
            </div>

            <div class="grid">
                <label>X <input type="range" min="0" max="100" step="0.5" value={pip.x} on:input={(e) => updatePip(pip.id, { x: num(e) })} /></label>
                <label>Y <input type="range" min="0" max="100" step="0.5" value={pip.y} on:input={(e) => updatePip(pip.id, { y: num(e) })} /></label>
                <label>{translateText("mixer.size", $dictionary)} <input type="range" min="5" max="100" step="0.5" value={pip.w} on:input={(e) => updatePip(pip.id, { w: num(e), h: num(e) * (pip.h / Math.max(1, pip.w)) })} /></label>
                <label>{translateText("mixer.height", $dictionary)} <input type="range" min="5" max="100" step="0.5" value={pip.h} on:input={(e) => updatePip(pip.id, { h: num(e) })} /></label>
                <label>{translateText("mixer.border", $dictionary)} <input type="range" min="0" max="20" step="1" value={pip.border} on:input={(e) => updatePip(pip.id, { border: num(e) })} /></label>
                <label>{translateText("mixer.radius", $dictionary)} <input type="range" min="0" max="80" step="1" value={pip.radius} on:input={(e) => updatePip(pip.id, { radius: num(e) })} /></label>
                <label>{translateText("mixer.border_color", $dictionary)} <input type="color" value={pip.borderColor || "#ffffff"} on:change={(e) => updatePip(pip.id, { borderColor: e.currentTarget.value })} /></label>
                <label>
                    {translateText("mixer.fit", $dictionary)}
                    <select value={pip.fit || "cover"} on:change={(e) => updatePip(pip.id, { fit: e.currentTarget.value === "contain" ? "contain" : "cover" })}>
                        <option value="cover">{translateText("mixer.fit_cover", $dictionary)}</option>
                        <option value="contain">{translateText("mixer.fit_contain", $dictionary)}</option>
                    </select>
                </label>
            </div>
        </div>
    {:else}
        <p class="empty">{translateText("mixer.no_pips", $dictionary)}</p>
    {/each}
</div>

<style>
    .add {
        display: flex;
        gap: 6px;
        margin-bottom: 8px;
    }
    select,
    .btn {
        padding: 5px 8px;
        border: none;
        border-radius: 4px;
        background-color: var(--primary-darker);
        color: var(--text);
        font-family: inherit;
    }
    .btn {
        display: flex;
        align-items: center;
        gap: 4px;
        cursor: pointer;
    }
    .btn:disabled {
        opacity: 0.4;
        cursor: default;
    }

    .pips {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 8px;
    }

    .pip {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 8px;
        border-radius: 6px;
        border: 2px solid var(--primary-lighter);
        background-color: var(--primary-darkest);
    }
    .pip.on {
        border-color: #f39c12;
    }

    .head {
        display: flex;
        align-items: center;
        gap: 4px;
    }
    .head select {
        flex: 1;
        min-width: 0;
    }
    .onAir {
        padding: 5px 8px;
        border: none;
        border-radius: 4px;
        background-color: var(--primary-darker);
        color: var(--text);
        font-weight: bold;
        font-size: 0.75em;
        cursor: pointer;
    }
    .onAir.on {
        background-color: #e5243b;
        color: white;
    }
    .icon {
        display: flex;
        padding: 4px;
        border: none;
        border-radius: 4px;
        background: none;
        cursor: pointer;
    }
    .icon:hover {
        background-color: var(--hover);
    }
    .icon.red:hover {
        background-color: rgb(229 36 59 / 0.4);
    }
    .icon:disabled {
        opacity: 0.3;
    }

    .presets {
        display: flex;
        gap: 3px;
    }
    .presets button {
        flex: 1;
        padding: 3px 0;
        border: none;
        border-radius: 3px;
        background-color: var(--primary-darker);
        color: var(--text);
        cursor: pointer;
    }
    .presets button:hover {
        background-color: var(--hover);
    }

    .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 4px 10px;
        font-size: 0.8em;
    }
    .grid label {
        display: flex;
        flex-direction: column;
        gap: 2px;
        opacity: 0.85;
    }
    .grid input[type="range"] {
        accent-color: var(--secondary);
    }
    .grid input[type="color"] {
        width: 100%;
        height: 22px;
        border: none;
        background: none;
    }

    .warn,
    .empty {
        font-size: 0.8em;
        opacity: 0.6;
    }
</style>
