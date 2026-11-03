<script lang="ts">
    // Audio mixer (vMix style): one vertical channel strip per input with sound.
    // M = mute, A = audio follow video (off = always on), ⋯ = microphone linked to a camera.
    import { onMount } from "svelte"
    import type { MixerInput } from "../../../types/Mixer"
    import { dictionary } from "../../stores"
    import { translateText } from "../../utils/language"
    import { mixer, updateInput } from "./mixer"
    import { getAudioInputDevices, mixerLevels } from "./mixerAudio"

    let devices: { id: string; name: string }[] = []
    onMount(async () => (devices = await getAudioInputDevices()))

    $: channels = $mixer.inputs.filter((i) => i.type !== "image" && i.type !== "screen")
    $: programId = $mixer.programId
    $: pipIds = $mixer.pips.filter((p) => p.enabled).map((p) => p.inputId)

    const toDb = (v: number) => (v <= 0 ? "-∞" : (20 * Math.log10(v)).toFixed(1))
    const levelPercent = (db: number | undefined) => (db === undefined ? 0 : Math.max(0, Math.min(100, ((db + 60) / 60) * 100)))
    const canPlaySound = (input: MixerInput) => input.type === "video" || input.type === "audiofile" || input.type === "audio" || input.type === "guest" || input.type === "replay" || !!input.audioDeviceId

    let micMenu = ""
</script>

<div class="audio">
    <div class="head">
        <span>AUDIO MIXER</span>
        <span class="hint" title={translateText("mixer.audio_hint", $dictionary)}>?</span>
    </div>

    <div class="strips">
        {#each channels as input (input.id)}
            {@const volume = input.volume ?? 1}
            {@const onAir = programId === input.id || pipIds.includes(input.id)}
            {@const sound = canPlaySound(input)}
            <div class="strip" class:onAir class:off={!sound}>
                <div class="name" title={input.name}><b>{$mixer.inputs.indexOf(input) + 1}</b> {input.name}</div>

                <div class="faderRow">
                    <div class="meter"><div class="level" style="height: {levelPercent($mixerLevels[input.id])}%;" /></div>
                    <input class="fader" type="range" min="0" max="1.5" step="0.01" value={volume} disabled={!sound} title={translateText("mixer.fader_reset", $dictionary)} on:input={(e) => updateInput(input.id, { volume: Number(e.currentTarget.value) })} on:dblclick={() => updateInput(input.id, { volume: 1 })} />
                </div>
                <div class="db">{toDb(volume)}</div>

                <div class="buttons">
                    <button class="m" class:active={input.muted} title="Mute" on:click={() => updateInput(input.id, { muted: !input.muted })}>M</button>
                    <button class="a" class:active={input.audioFollow !== false} title={translateText("mixer.afv_hint", $dictionary)} on:click={() => updateInput(input.id, { audioFollow: input.audioFollow === false })}>A</button>
                    {#if input.type === "camera"}
                        <button class="mic" class:active={!!input.audioDeviceId} title={translateText("mixer.linked_mic", $dictionary)} on:click={() => (micMenu = micMenu === input.id ? "" : input.id)}>🎤</button>
                    {/if}
                </div>

                {#if micMenu === input.id}
                    <select
                        value={input.audioDeviceId || ""}
                        on:change={(e) => {
                            updateInput(input.id, { audioDeviceId: e.currentTarget.value })
                            micMenu = ""
                        }}
                    >
                        <option value="">{translateText("mixer.no_mic", $dictionary)}</option>
                        {#each devices as device}
                            <option value={device.id}>{device.name}</option>
                        {/each}
                    </select>
                {/if}
            </div>
        {:else}
            <p class="empty">{translateText("mixer.no_audio_inputs", $dictionary)}</p>
        {/each}
    </div>
</div>

<style>
    .audio {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }
    .head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 4px 8px;
        font-size: 0.75em;
        font-weight: 800;
        letter-spacing: 0.06em;
        color: var(--mx-muted);
        border-bottom: 1px solid var(--mx-border);
    }
    .hint {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 1px solid var(--mx-border);
        text-align: center;
        line-height: 14px;
        cursor: help;
    }

    .strips {
        flex: 1;
        display: flex;
        gap: 4px;
        padding: 6px;
        overflow-x: auto;
        overflow-y: hidden;
    }

    .strip {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        width: 64px;
        min-width: 64px;
        padding: 4px;
        border: 1px solid var(--mx-border);
        border-radius: 4px;
        background: linear-gradient(var(--mx-panel-2), var(--mx-panel));
    }
    .strip.onAir {
        border-color: var(--mx-pgm);
        box-shadow: inset 0 2px 0 var(--mx-pgm);
    }
    .strip.off {
        opacity: 0.45;
    }

    .name {
        width: 100%;
        font-size: 0.68em;
        text-align: center;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        color: var(--mx-text);
    }

    .faderRow {
        flex: 1;
        display: flex;
        align-items: stretch;
        gap: 4px;
        min-height: 90px;
    }
    .meter {
        position: relative;
        width: 6px;
        border-radius: 2px;
        background-color: #070b14;
        overflow: hidden;
    }
    .level {
        position: absolute;
        bottom: 0;
        width: 100%;
        background: linear-gradient(to top, #1fae5c 60%, #f5d90a 85%, #e5293f);
        transition: height 0.08s linear;
    }
    .fader {
        writing-mode: vertical-lr;
        direction: rtl;
        width: 22px;
        accent-color: var(--mx-accent);
        cursor: pointer;
    }

    .db {
        font-size: 0.65em;
        font-variant-numeric: tabular-nums;
        color: var(--mx-muted);
    }

    .buttons {
        display: flex;
        gap: 2px;
        width: 100%;
    }
    .buttons button {
        flex: 1;
        height: 18px;
        padding: 0;
        border: 1px solid var(--mx-border);
        border-radius: 2px;
        background: linear-gradient(#25314a, #1a2335);
        color: var(--mx-muted);
        font-size: 0.65em;
        font-weight: 800;
        cursor: pointer;
    }
    .buttons .m.active {
        background: linear-gradient(#e5293f, #b81d30);
        color: white;
    }
    .buttons .a.active {
        background: linear-gradient(var(--mx-accent), #1b5fd1);
        color: white;
    }
    .buttons .mic.active {
        background: linear-gradient(#1fae5c, #178a48);
    }

    select {
        width: 100%;
        font-size: 0.65em;
        background-color: var(--mx-panel-2);
        color: var(--mx-text);
        border: 1px solid var(--mx-border);
    }

    .empty {
        padding: 8px;
        color: var(--mx-muted);
        font-size: 0.8em;
    }
</style>
