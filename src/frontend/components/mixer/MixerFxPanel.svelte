<script lang="ts">
    // FX / Key panel: chroma key, colour correction and LUT per input.
    import type { MixerFx } from "../../../types/Mixer"
    import { dictionary } from "../../stores"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"
    import { getFileName } from "../helpers/media"
    import MediaPicker from "../inputs/MediaPicker.svelte"
    import { mixer, updateInput } from "./mixer"
    import { DEFAULT_CHROMA, DEFAULT_FX, isFxActive, loadLut } from "./mixerFx"

    export let inputId = ""

    $: pictureInputs = $mixer.inputs.filter((i) => i.type !== "audio" && i.type !== "audiofile")
    $: if (!inputId || !pictureInputs.some((i) => i.id === inputId)) inputId = pictureInputs.find((i) => i.id === $mixer.previewId)?.id || pictureInputs[0]?.id || ""
    $: input = pictureInputs.find((i) => i.id === inputId)
    $: fx = (input?.fx || {}) as MixerFx
    $: chroma = { ...DEFAULT_CHROMA, enabled: false, ...(fx.chroma || {}) }

    const t = (key: string) => translateText(key, $dictionary)
    const num = (e: Event) => Number((e.currentTarget as HTMLInputElement).value)

    function setFx(patch: Partial<MixerFx>) {
        if (!input) return
        updateInput(input.id, { fx: { ...fx, ...patch } })
    }
    function setChroma(patch: Partial<typeof chroma>) {
        setFx({ chroma: { ...chroma, ...patch } })
    }

    const colorSliders: { key: keyof typeof DEFAULT_FX; label: string; min: number; max: number; step: number }[] = [
        { key: "brightness", label: "mixer.fx_brightness", min: -1, max: 1, step: 0.01 },
        { key: "contrast", label: "mixer.fx_contrast", min: 0, max: 2, step: 0.01 },
        { key: "saturation", label: "mixer.fx_saturation", min: 0, max: 2, step: 0.01 },
        { key: "gamma", label: "mixer.fx_gamma", min: 0.2, max: 3, step: 0.01 },
        { key: "hue", label: "mixer.fx_hue", min: -180, max: 180, step: 1 },
        { key: "temperature", label: "mixer.fx_temperature", min: -1, max: 1, step: 0.01 }
    ]

    let lutError = ""
    async function pickLut(path: string) {
        lutError = ""
        if (!path) return
        const lut = await loadLut(path)
        if (!lut) {
            lutError = t("mixer.fx_lut_invalid")
            return
        }
        setFx({ lut: { path, intensity: fx.lut?.intensity ?? 1 } })
    }

    const chromaPresets = [
        { label: "mixer.fx_green", color: "#00ff00" },
        { label: "mixer.fx_blue", color: "#0047bb" }
    ]
</script>

<div class="head">
    <select bind:value={inputId}>
        {#each pictureInputs as i}
            <option value={i.id}>{i.name}{isFxActive(i.fx) ? " ✦" : ""}</option>
        {/each}
    </select>
    {#if input && isFxActive(fx)}
        <button class="btn danger" on:click={() => input && updateInput(input.id, { fx: undefined })}><Icon id="reset" size={0.85} white /> {t("mixer.fx_reset_all")}</button>
    {/if}
    <span class="hint">{t("mixer.fx_hint")}</span>
</div>

{#if !input}
    <p class="hint">{t("mixer.no_inputs")}</p>
{:else}
    <div class="sections">
        <section>
            <h4>
                <label class="switch"><input type="checkbox" checked={chroma.enabled} on:change={(e) => setChroma({ enabled: e.currentTarget.checked })} /> Chroma key</label>
            </h4>
            <div class="row">
                {#each chromaPresets as p}
                    <button class="chip" class:active={chroma.color.toLowerCase() === p.color} on:click={() => setChroma({ color: p.color, enabled: true })}><span class="dot" style="background: {p.color};" /> {t(p.label)}</button>
                {/each}
                <label class="color">{t("mixer.fx_key_color")} <input type="color" value={chroma.color} on:change={(e) => setChroma({ color: e.currentTarget.value, enabled: true })} /></label>
            </div>
            <label>{t("mixer.fx_similarity")} <span>{chroma.similarity.toFixed(2)}</span><input type="range" min="0" max="1" step="0.01" value={chroma.similarity} disabled={!chroma.enabled} on:input={(e) => setChroma({ similarity: num(e) })} /></label>
            <label>{t("mixer.fx_smoothness")} <span>{chroma.smoothness.toFixed(2)}</span><input type="range" min="0" max="0.5" step="0.01" value={chroma.smoothness} disabled={!chroma.enabled} on:input={(e) => setChroma({ smoothness: num(e) })} /></label>
            <label>{t("mixer.fx_spill")} <span>{chroma.spill.toFixed(2)}</span><input type="range" min="0" max="1" step="0.01" value={chroma.spill} disabled={!chroma.enabled} on:input={(e) => setChroma({ spill: num(e) })} /></label>
            <p class="hint">{t("mixer.fx_chroma_hint")}</p>
        </section>

        <section>
            <h4>
                {t("mixer.fx_color")}
                <button class="link" on:click={() => setFx({ ...DEFAULT_FX })}>{t("mixer.fx_reset")}</button>
            </h4>
            {#each colorSliders as s}
                {@const value = fx[s.key] ?? DEFAULT_FX[s.key]}
                <label>
                    {t(s.label)} <span>{s.key === "hue" ? `${value}°` : Number(value).toFixed(2)}</span>
                    <input type="range" min={s.min} max={s.max} step={s.step} {value} on:input={(e) => setFx({ [s.key]: num(e) })} on:dblclick={() => setFx({ [s.key]: DEFAULT_FX[s.key] })} />
                </label>
            {/each}
        </section>

        <section>
            <h4>LUT (.cube)</h4>
            <div class="row">
                <MediaPicker id="mixer_lut" title={t("mixer.fx_pick_lut")} filter={{ name: "3D LUT", extensions: ["cube"] }} on:picked={(e) => pickLut(e.detail)}>
                    <Icon id="folder" size={0.9} white />
                    <span style="margin-inline-start: 6px;">{t("mixer.fx_pick_lut")}</span>
                </MediaPicker>
                {#if fx.lut?.path}
                    <span class="file" title={fx.lut.path}>{getFileName(fx.lut.path)}</span>
                    <button class="btn danger" on:click={() => setFx({ lut: undefined })}>✕</button>
                {/if}
            </div>
            {#if lutError}<p class="error">{lutError}</p>{/if}
            <label>{t("mixer.fx_intensity")} <span>{Math.round((fx.lut?.intensity ?? 1) * 100)}%</span><input type="range" min="0" max="1" step="0.01" value={fx.lut?.intensity ?? 1} disabled={!fx.lut?.path} on:input={(e) => fx.lut && setFx({ lut: { ...fx.lut, intensity: num(e) } })} /></label>
            <p class="hint">{t("mixer.fx_lut_hint")}</p>
        </section>
    </div>
{/if}

<style>
    .head {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
    }
    select {
        padding: 5px 8px;
        border: 1px solid var(--mx-border);
        border-radius: 4px;
        background-color: var(--mx-bg);
        color: var(--mx-text);
        font-family: inherit;
    }
    .hint {
        margin: 0;
        font-size: 0.78em;
        color: var(--mx-muted);
    }
    .error {
        margin: 0;
        font-size: 0.8em;
        color: #ff8b98;
    }

    .sections {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 10px;
    }
    section {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 10px;
        border: 1px solid var(--mx-border);
        border-radius: 6px;
        background-color: var(--mx-panel-2);
    }
    h4 {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 0 0 2px;
        font-size: 0.85em;
        letter-spacing: 0.04em;
    }
    label {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 2px 8px;
        font-size: 0.8em;
        color: var(--mx-text);
    }
    label span {
        color: var(--mx-muted);
        font-variant-numeric: tabular-nums;
    }
    label input[type="range"] {
        grid-column: 1 / -1;
        accent-color: var(--mx-accent);
    }
    .switch {
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
    }
    .row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
    }
    .chip,
    .btn,
    .link {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 4px 8px;
        border: 1px solid var(--mx-border);
        border-radius: 4px;
        background: linear-gradient(#22304b, #19243a);
        color: var(--mx-text);
        font-family: inherit;
        font-size: 0.78em;
        cursor: pointer;
    }
    .chip.active {
        border-color: var(--mx-accent);
    }
    .dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
    }
    .color {
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .color input {
        width: 34px;
        height: 22px;
        border: none;
        background: none;
    }
    .btn.danger {
        border-color: #e5293f;
        background: rgb(229 41 63 / 0.15);
        color: #ff8b98;
    }
    .link {
        background: none;
        border: none;
        color: var(--mx-accent-2);
    }
    .file {
        max-width: 160px;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        font-size: 0.8em;
    }
</style>
