<script lang="ts">
    // Instant replay + ISO (one file per camera) + program recording.
    import { onDestroy } from "svelte"
    import { activeRecording, dictionary } from "../../stores"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"
    import { mixer, playReplay, removeInput, replayAutoReturn, setMixerOption, setPreview } from "./mixer"
    import { captureReplay, isoRecording, replayBuffers, replayBusy, setReplayBuffer, startIso, stopIso, toggleProgramRecording } from "./mixerRecorder"

    $: cameras = $mixer.inputs.filter((i) => i.type === "camera")
    $: replays = $mixer.inputs.filter((i) => i.type === "replay").reverse()
    $: isoActive = Object.keys($isoRecording).length > 0

    let now = Date.now()
    const timer = setInterval(() => (now = Date.now()), 1000)
    onDestroy(() => clearInterval(timer))
    const elapsed = (start: number) => {
        const s = Math.max(0, Math.floor((now - start) / 1000))
        return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
    }

    $: programRecording = !!$activeRecording?.isOutput

    const rates = [0.25, 0.5, 0.75, 1]
    const lengths = [5, 8, 10, 15, 20, 30]
</script>

<div class="columns">
    <section>
        <h4><Icon id="history" size={0.9} white /> Instant Replay</h4>
        <p class="hint">{translateText("mixer.replay_hint", $dictionary)}</p>

        <div class="row">
            <span>{translateText("mixer.replay_length", $dictionary)}</span>
            <div class="chips">
                {#each lengths as l}
                    <button class:active={$mixer.replaySeconds === l} on:click={() => setMixerOption({ replaySeconds: l })}>{l}s</button>
                {/each}
            </div>
        </div>
        <div class="row">
            <span>{translateText("mixer.replay_speed", $dictionary)}</span>
            <div class="chips">
                {#each rates as r}
                    <button class:active={$mixer.replayRate === r} on:click={() => setMixerOption({ replayRate: r })}>{r}×</button>
                {/each}
            </div>
        </div>
        <label class="check"><input type="checkbox" bind:checked={$replayAutoReturn} /> {translateText("mixer.replay_return", $dictionary)}</label>

        <div class="list">
            {#each cameras as cam (cam.id)}
                {@const buffering = $replayBuffers.includes(cam.id)}
                <div class="item">
                    <span class="name">{cam.name}</span>
                    <button class="toggle" class:active={buffering} on:click={() => setReplayBuffer(cam.id, !buffering)}>{buffering ? "● BUFFER" : "BUFFER OFF"}</button>
                    <button class="action" disabled={!buffering || $replayBusy} on:click={() => captureReplay(cam.id)}>⟲ {translateText("mixer.make_replay", $dictionary)}</button>
                </div>
            {:else}
                <p class="hint">{translateText("mixer.no_cameras", $dictionary)}</p>
            {/each}
        </div>

        {#if replays.length}
            <h5>{translateText("mixer.replay_clips", $dictionary)}</h5>
            <div class="list">
                {#each replays as clip (clip.id)}
                    <div class="item">
                        <span class="name">{clip.name} · {Math.round(clip.duration || 0)}s · {clip.playbackRate || 1}×</span>
                        <button class="action" on:click={() => setPreview(clip.id)}>PVW</button>
                        <button class="action red" on:click={() => playReplay(clip.id)}>▶ {translateText("mixer.play_now", $dictionary)}</button>
                        <button class="icon" title={translateText("actions.remove", $dictionary)} on:click={() => removeInput(clip.id)}><Icon id="delete" size={0.85} white /></button>
                    </div>
                {/each}
            </div>
        {/if}
    </section>

    <section>
        <h4><Icon id="record" size={0.9} white /> ISO {translateText("mixer.iso_title", $dictionary)}</h4>
        <p class="hint">{translateText("mixer.iso_hint", $dictionary)}</p>

        <button class="big" class:recording={isoActive} disabled={!cameras.length} on:click={() => (isoActive ? stopIso() : startIso())}>
            {isoActive ? `■ ${translateText("mixer.stop_iso", $dictionary)}` : `● ${translateText("mixer.start_iso", $dictionary)}`}
        </button>
        <div class="list">
            {#each cameras as cam (cam.id)}
                {@const started = $isoRecording[cam.id]}
                <div class="item">
                    <span class="name">{cam.name}</span>
                    {#if started}<span class="rec">● {elapsed(started)}</span>{/if}
                    <button class="action" on:click={() => (started ? stopIso([cam.id]) : startIso([cam.id]))}>{started ? "■" : "●"}</button>
                </div>
            {/each}
        </div>

        <h4 style="margin-top: 14px;"><Icon id="record" size={0.9} white /> Program</h4>
        <p class="hint">{translateText("mixer.program_record_hint", $dictionary)}</p>
        <button class="big" class:recording={programRecording} on:click={() => toggleProgramRecording()}>
            {programRecording ? `■ ${translateText("mixer.stop_program_record", $dictionary)}` : `● ${translateText("mixer.start_program_record", $dictionary)}`}
        </button>
    </section>
</div>

<style>
    .columns {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
    }
    @media screen and (max-width: 1000px) {
        .columns {
            grid-template-columns: 1fr;
        }
    }

    section {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    h4,
    h5 {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 0;
    }
    h5 {
        margin-top: 8px;
        opacity: 0.8;
    }

    .hint {
        font-size: 0.8em;
        opacity: 0.6;
        margin: 0;
    }

    .row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-size: 0.85em;
    }
    .chips {
        display: flex;
        gap: 3px;
    }
    .chips button,
    .toggle,
    .action,
    .big {
        padding: 4px 8px;
        border: none;
        border-radius: 4px;
        background-color: var(--primary-darker);
        color: var(--text);
        font-family: inherit;
        font-size: 0.85em;
        cursor: pointer;
    }
    .chips button.active,
    .toggle.active {
        background-color: var(--secondary);
        color: var(--secondary-text);
    }
    .action.red,
    .big.recording {
        background-color: #e5243b;
        color: white;
    }
    button:disabled {
        opacity: 0.4;
        cursor: default;
    }
    .big {
        padding: 8px;
        font-weight: bold;
    }

    .check {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.85em;
        cursor: pointer;
    }

    .list {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .item {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 5px 6px;
        border-radius: 4px;
        background-color: var(--primary-darkest);
    }
    .name {
        flex: 1;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        font-size: 0.85em;
    }
    .rec {
        color: #ff5d6c;
        font-size: 0.8em;
        font-variant-numeric: tabular-nums;
    }
    .icon {
        display: flex;
        padding: 3px;
        border: none;
        background: none;
        cursor: pointer;
    }
</style>
