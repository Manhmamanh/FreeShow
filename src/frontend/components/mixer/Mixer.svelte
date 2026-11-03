<script lang="ts">
    // Center panel: Preview | transition controls (Cut / Auto / T-bar / FTB) | Program, then tabs:
    // Multiview, Audio mixer, Picture-in-picture, Replay & ISO recording, Remote guests.
    import { onMount } from "svelte"
    import type { MixerTransitionType } from "../../../types/Mixer"
    import { MIXER_BLACK_ID } from "../../../types/Mixer"
    import { dictionary, outLocked, outputs } from "../../stores"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import PreviewOutput from "../output/preview/PreviewOutput.svelte"
    import { auto, cut, fadeToBlack, getMonitorOutputId, mixer, mixerTransitioning, quickPlay, setPreview, setTransition, syncProgramWithOutput } from "./mixer"
    import MixerAudioPanel from "./MixerAudioPanel.svelte"
    import { startMixerAudio } from "./mixerAudio"
    import MixerGuestPanel from "./MixerGuestPanel.svelte"
    import MixerMonitor from "./MixerMonitor.svelte"
    import MixerPipPanel from "./MixerPipPanel.svelte"
    import MixerRecordPanel from "./MixerRecordPanel.svelte"
    import { captureReplay, isoRecording, replayBuffers, replayBusy } from "./mixerRecorder"
    import MixerTBar from "./MixerTBar.svelte"
    import MixerTile from "./MixerTile.svelte"

    onMount(startMixerAudio)

    $: monitorOutputId = getMonitorOutputId($mixer) || Object.keys($outputs).find((id) => !$outputs[id]?.stageOutput) || ""
    $: previewInput = $mixer.inputs.find((i) => i.id === $mixer.previewId) || null
    $: programInput = $mixer.inputs.find((i) => i.id === $mixer.programId) || null
    $: outMixer = $outputs[monitorOutputId]?.out?.mixer
    $: isBlack = outMixer?.program?.id === MIXER_BLACK_ID
    $: pipInputIds = $mixer.pips.filter((p) => p.enabled).map((p) => p.inputId)

    // tally follows the output (changes from remote/other windows)
    $: if ($outputs) syncProgramWithOutput()

    const transitionTypes: MixerTransitionType[] = ["fade", "crossfade", "wipe", "slide", "push", "scale", "blur", "fly", "spin", "none"]
    const durations = [250, 500, 1000, 2000]

    function changeType(e: Event) {
        setTransition({ type: (e.currentTarget as HTMLSelectElement).value as MixerTransitionType })
    }
    function changeDuration(e: Event) {
        setTransition({ duration: Math.max(0, Number((e.currentTarget as HTMLInputElement).value) || 0) })
    }

    type Tab = "multiview" | "audio" | "pip" | "record" | "guest"
    let tab: Tab = "multiview"
    const tabs: { id: Tab; icon: string; label: string }[] = [
        { id: "multiview", icon: "grid", label: "Multiview" },
        { id: "audio", icon: "volume", label: "mixer.tab_audio" },
        { id: "pip", icon: "fullscreen", label: "PiP" },
        { id: "record", icon: "history", label: "mixer.tab_record" },
        { id: "guest", icon: "people", label: "mixer.tab_guest" }
    ]

    let liveThumbnails = true
</script>

<div class="mixer">
    <div class="monitors">
        <div class="monitor">
            <div class="title green">
                <span>PREVIEW</span>
                <span class="source">{previewInput?.name || "-"}</span>
            </div>
            <MixerMonitor outputId={monitorOutputId} input={previewInput} />
        </div>

        <div class="transitions">
            <div class="buttons">
                <MaterialButton variant="contained" title="[C]" on:click={cut} disabled={!previewInput || $outLocked} style="width: 100%;">
                    <Icon id="cut" white />
                    CUT
                </MaterialButton>
                <MaterialButton variant="contained" title="[Space / Enter]" on:click={auto} disabled={!previewInput || $outLocked} isActive={$mixerTransitioning} style="width: 100%;" gradient>
                    <Icon id="transition" white />
                    AUTO
                </MaterialButton>

                <div class="setting">
                    <label for="mixer-transition">{translateText("mixer.transition", $dictionary)}</label>
                    <select id="mixer-transition" value={$mixer.transition.type} on:change={changeType}>
                        {#each transitionTypes as type}
                            <option value={type}>{type}</option>
                        {/each}
                    </select>
                </div>

                <div class="setting">
                    <label for="mixer-duration">{translateText("mixer.duration", $dictionary)} (ms)</label>
                    <input id="mixer-duration" type="number" min="0" max="10000" step="50" value={$mixer.transition.duration} on:change={changeDuration} />
                    <div class="presets">
                        {#each durations as d}
                            <button class:active={$mixer.transition.duration === d} on:click={() => setTransition({ duration: d })}>{d / 1000}s</button>
                        {/each}
                    </div>
                </div>

                <MaterialButton title="[R]" on:click={() => captureReplay()} disabled={!$replayBuffers.length || $replayBusy} style="width: 100%;">
                    <Icon id="history" white />
                    REPLAY
                </MaterialButton>
                <MaterialButton title="[B]" on:click={fadeToBlack} disabled={$outLocked} red={isBlack} style="width: 100%;">
                    <Icon id="clear" white />
                    FTB
                </MaterialButton>
            </div>

            <MixerTBar disabled={!previewInput} />
        </div>

        <div class="monitor">
            <div class="title red">
                <span>PROGRAM</span>
                <span class="source">{isBlack ? "BLACK" : programInput?.name || "-"}</span>
            </div>
            <div class="program">
                {#if monitorOutputId}
                    <PreviewOutput outputId={monitorOutputId} />
                {:else}
                    <p class="empty">{translateText("mixer.no_output", $dictionary)}</p>
                {/if}
            </div>
        </div>
    </div>

    <div class="tabs">
        {#each tabs as t}
            <button class:active={tab === t.id} on:click={() => (tab = t.id)}>
                <Icon id={t.icon} size={0.9} white />
                {t.label.includes(".") ? translateText(t.label, $dictionary) : t.label}
                {#if t.id === "record" && Object.keys($isoRecording).length}<span class="dot" />{/if}
            </button>
        {/each}
        {#if tab === "multiview"}
            <span class="hint">{translateText("mixer.multiview_hint", $dictionary)}</span>
            <label class="toggle"><input type="checkbox" bind:checked={liveThumbnails} /> {translateText("mixer.live_thumbnails", $dictionary)}</label>
        {/if}
    </div>

    <div class="tabContent">
        {#if tab === "multiview"}
            <div class="multiview">
                {#each $mixer.inputs as input, index (input.id)}
                    <MixerTile {input} {index} live={liveThumbnails} isPreview={$mixer.previewId === input.id} isProgram={$mixer.programId === input.id} isPip={pipInputIds.includes(input.id)} isRecording={!!$isoRecording[input.id]} on:preview={() => setPreview(input.id)} on:play={() => quickPlay(input.id)} />
                {:else}
                    <p class="empty">{translateText("mixer.no_inputs", $dictionary)}</p>
                {/each}
            </div>
        {:else if tab === "audio"}
            <MixerAudioPanel />
        {:else if tab === "pip"}
            <MixerPipPanel />
        {:else if tab === "record"}
            <MixerRecordPanel />
        {:else if tab === "guest"}
            <MixerGuestPanel />
        {/if}
    </div>
</div>

<style>
    .mixer {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 10px;
        min-height: 100%;
    }

    .monitors {
        display: grid;
        grid-template-columns: 1fr 220px 1fr;
        gap: 10px;
        align-items: start;
    }

    .monitor {
        display: flex;
        flex-direction: column;
        border-radius: 6px;
        overflow: hidden;
        background-color: var(--primary-darkest);
    }

    .title {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        padding: 4px 10px;
        font-weight: bold;
        font-size: 0.85em;
        color: white;
    }
    .title.green {
        background-color: #1d8f3f;
    }
    .title.red {
        background-color: #c41d31;
    }
    .source {
        font-weight: normal;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }

    .program {
        position: relative;
        display: flex;
        width: 100%;
        background-color: black;
    }

    .transitions {
        display: flex;
        gap: 10px;
    }
    .buttons {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
    }

    .setting {
        display: flex;
        flex-direction: column;
        gap: 3px;
        font-size: 0.8em;
    }
    .setting label {
        opacity: 0.7;
    }
    .setting select,
    .setting input {
        width: 100%;
        padding: 4px;
        border: none;
        border-radius: 4px;
        background-color: var(--primary-darker);
        color: var(--text);
        font-family: inherit;
    }
    .presets {
        display: flex;
        gap: 3px;
    }
    .presets button {
        flex: 1;
        padding: 2px 0;
        border: none;
        border-radius: 3px;
        background-color: var(--primary-darker);
        color: var(--text);
        font-size: 0.85em;
        cursor: pointer;
    }
    .presets button.active {
        background-color: var(--secondary);
        color: var(--secondary-text);
    }

    .tabs {
        display: flex;
        align-items: center;
        gap: 4px;
        border-bottom: 2px solid var(--primary-lighter);
    }
    .tabs button {
        position: relative;
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 6px 12px;
        border: none;
        border-bottom: 2px solid transparent;
        margin-bottom: -2px;
        background: none;
        color: var(--text);
        font-family: inherit;
        font-weight: 600;
        font-size: 0.85em;
        cursor: pointer;
        opacity: 0.7;
    }
    .tabs button.active {
        border-bottom-color: var(--secondary);
        opacity: 1;
    }
    .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background-color: #e5243b;
    }
    .tabs .hint {
        flex: 1;
        text-align: end;
        font-size: 0.8em;
        opacity: 0.6;
    }
    .toggle {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 0.8em;
        cursor: pointer;
    }

    .multiview {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
        gap: 8px;
    }

    .empty {
        grid-column: 1 / -1;
        padding: 20px;
        opacity: 0.6;
        text-align: center;
    }

    @media screen and (max-width: 1150px) {
        .monitors {
            grid-template-columns: 1fr 1fr;
        }
        .transitions {
            grid-column: 1 / -1;
            grid-row: 2;
        }
        .buttons {
            flex-direction: row;
            flex-wrap: wrap;
        }
    }
</style>
