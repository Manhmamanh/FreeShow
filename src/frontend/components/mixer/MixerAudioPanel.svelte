<script lang="ts">
    // Audio mixer: one channel strip per input (volume, mute, audio-follow-video, linked microphone, level).
    import { onMount } from "svelte"
    import type { MixerInput } from "../../../types/Mixer"
    import { dictionary } from "../../stores"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"
    import { mixer, updateInput } from "./mixer"
    import { getAudioInputDevices, mixerLevels } from "./mixerAudio"
    import { inputIcon } from "./MixerTile.svelte"

    let devices: { id: string; name: string }[] = []
    onMount(async () => (devices = await getAudioInputDevices()))

    // inputs that can carry sound (cameras/replays through a linked microphone)
    $: channels = $mixer.inputs.filter((i) => i.type !== "image" && i.type !== "screen")

    const toDb = (v: number) => (v <= 0 ? "-∞" : (20 * Math.log10(v)).toFixed(1))
    const levelPercent = (db: number | undefined) => (db === undefined ? 0 : Math.max(0, Math.min(100, ((db + 60) / 60) * 100)))

    const supportsMic = (input: MixerInput) => input.type === "camera"
    const canPlaySound = (input: MixerInput) => input.type === "video" || input.type === "audio" || input.type === "guest" || input.type === "replay" || !!input.audioDeviceId
</script>

<div class="audio">
    {#each channels as input (input.id)}
        {@const volume = input.volume ?? 1}
        {@const onAir = $mixer.programId === input.id}
        <div class="strip" class:onAir class:muted={input.muted}>
            <div class="title" title={input.name}>
                <Icon id={inputIcon(input.type)} size={0.9} white />
                <span>{input.name}</span>
            </div>

            <div class="faderRow">
                <div class="meter"><div class="level" style="height: {levelPercent($mixerLevels[input.id])}%;" /></div>
                <input class="fader" type="range" min="0" max="1.5" step="0.01" value={volume} disabled={!canPlaySound(input)} on:input={(e) => updateInput(input.id, { volume: Number(e.currentTarget.value) })} on:dblclick={() => updateInput(input.id, { volume: 1 })} title={translateText("mixer.fader_reset", $dictionary)} />
            </div>
            <div class="db">{toDb(volume)} dB</div>

            <button class="toggle" class:active={input.muted} on:click={() => updateInput(input.id, { muted: !input.muted })}>
                <Icon id={input.muted ? "volume_off" : "volume"} size={0.9} white />
                {input.muted ? "MUTE" : "ON"}
            </button>
            <button class="toggle" class:active={input.audioFollow !== false} title={translateText("mixer.afv_hint", $dictionary)} on:click={() => updateInput(input.id, { audioFollow: input.audioFollow === false })}>
                {input.audioFollow !== false ? "AFV" : translateText("mixer.always_on", $dictionary)}
            </button>

            {#if supportsMic(input)}
                <select value={input.audioDeviceId || ""} on:change={(e) => updateInput(input.id, { audioDeviceId: e.currentTarget.value || undefined })} title={translateText("mixer.linked_mic", $dictionary)}>
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

<p class="hint">{translateText("mixer.audio_hint", $dictionary)}</p>

<style>
    .audio {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        padding-bottom: 6px;
    }

    .strip {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 5px;
        width: 110px;
        min-width: 110px;
        padding: 8px 6px;
        border-radius: 6px;
        border: 2px solid var(--primary-lighter);
        background-color: var(--primary-darkest);
    }
    .strip.onAir {
        border-color: #e5243b;
    }
    .strip.muted {
        opacity: 0.6;
    }

    .title {
        display: flex;
        align-items: center;
        gap: 4px;
        width: 100%;
        font-size: 0.8em;
        font-weight: 600;
    }
    .title span {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }

    .faderRow {
        display: flex;
        align-items: center;
        gap: 8px;
        height: 140px;
    }
    .meter {
        position: relative;
        width: 8px;
        height: 100%;
        border-radius: 3px;
        background-color: var(--primary-darker);
        overflow: hidden;
    }
    .level {
        position: absolute;
        bottom: 0;
        width: 100%;
        background: linear-gradient(to top, #23b14d 60%, #f1c40f 85%, #e5243b);
        transition: height 0.08s linear;
    }
    .fader {
        writing-mode: vertical-lr;
        direction: rtl;
        width: 28px;
        height: 100%;
        accent-color: var(--secondary);
        cursor: pointer;
    }

    .db {
        font-size: 0.75em;
        font-variant-numeric: tabular-nums;
        opacity: 0.8;
    }

    .toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        width: 100%;
        padding: 3px 0;
        border: none;
        border-radius: 4px;
        background-color: var(--primary-darker);
        color: var(--text);
        font-family: inherit;
        font-size: 0.75em;
        font-weight: bold;
        cursor: pointer;
    }
    .toggle.active {
        background-color: var(--secondary);
        color: var(--secondary-text);
    }

    select {
        width: 100%;
        padding: 3px;
        border: none;
        border-radius: 4px;
        background-color: var(--primary-darker);
        color: var(--text);
        font-family: inherit;
        font-size: 0.75em;
    }

    .empty,
    .hint {
        padding: 6px;
        font-size: 0.8em;
        opacity: 0.6;
    }
</style>
