<script lang="ts">
    // Mixer page, laid out like a hardware/vMix switcher:
    //  header bar  : output, add input, STREAM / REC / ISO status, clock
    //  top row     : PREVIEW | transition column (Quick Play, Cut, 4 transitions, FTB, PiP 1-4, T-bar) | PROGRAM
    //  middle row  : input tiles | audio mixer
    //  bottom bar  : panels (PiP layout, Replay & ISO, Guests) opening in a dock above it
    import { onDestroy, onMount } from "svelte"
    import type { MixerTransitionType } from "../../../types/Mixer"
    import { MIXER_BLACK_ID } from "../../../types/Mixer"
    import { activePage, activeRecording, dictionary, outLocked, outputs, settingsTab } from "../../stores"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"
    import PreviewOutput from "../output/preview/PreviewOutput.svelte"
    import { auto, cut, fadeToBlack, getMonitorOutputId, mixer, mixerTransitioning, PIP_SLOTS, quickPlay, setTargetOutput, setTransitionPreset, syncProgramWithOutput, togglePipSlot } from "./mixer"
    import MixerAddInput from "./MixerAddInput.svelte"
    import MixerAudioPanel from "./MixerAudioPanel.svelte"
    import { startMixerAudio } from "./mixerAudio"
    import MixerGuestPanel from "./MixerGuestPanel.svelte"
    import MixerMonitor from "./MixerMonitor.svelte"
    import MixerPipPanel from "./MixerPipPanel.svelte"
    import MixerRecordPanel from "./MixerRecordPanel.svelte"
    import { captureReplay, isoRecording, replayBuffers, replayBusy, startIso, stopIso, toggleProgramRecording } from "./mixerRecorder"
    import MixerTBar from "./MixerTBar.svelte"
    import MixerTile from "./MixerTile.svelte"

    onMount(startMixerAudio)

    $: monitorOutputId = getMonitorOutputId($mixer) || Object.keys($outputs).find((id) => !$outputs[id]?.stageOutput) || ""
    $: monitorOutput = $outputs[monitorOutputId]
    $: previewInput = $mixer.inputs.find((i) => i.id === $mixer.previewId) || null
    $: programInput = $mixer.inputs.find((i) => i.id === $mixer.programId) || null
    $: outMixer = monitorOutput?.out?.mixer
    $: isBlack = outMixer?.program?.id === MIXER_BLACK_ID
    $: outputList = Object.entries($outputs)
        .filter(([_id, o]) => !o.stageOutput && o.enabled !== false)
        .map(([id, o]) => ({ id, name: o.name }))

    // tally follows the output (changes from remote/other windows); a subscription, not a reactive
    // statement, so titles computed above see the synced value in the same update
    onMount(() => outputs.subscribe(() => syncProgramWithOutput()))

    // ----- status -----
    $: streaming = !!monitorOutput?.rtmp
    $: ndiOn = !!monitorOutput?.ndi
    $: recording = !!$activeRecording?.isOutput
    $: isoActive = Object.keys($isoRecording).length > 0
    const toggleRecord = () => toggleProgramRecording()
    function openOutputSettings() {
        settingsTab.set("display_settings")
        activePage.set("settings")
    }

    let now = new Date()
    const clock = setInterval(() => (now = new Date()), 500)
    onDestroy(() => clearInterval(clock))
    $: time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })

    // ----- transitions -----
    const transitionTypes: MixerTransitionType[] = ["fade", "crossfade", "wipe", "slide", "push", "scale", "blur", "fly", "spin", "none"]
    const label = (type: string) => (type === "scale" ? "ZOOM" : type.toUpperCase())
    let editTransition = -1
    function setType(index: number, e: Event) {
        setTransitionPreset(index, { type: (e.currentTarget as HTMLSelectElement).value as MixerTransitionType })
    }

    // ----- panels -----
    type Dock = "" | "pip" | "record" | "guest"
    let dock: Dock = ""
    let addOpen = false
    let liveThumbnails = true
    const toggleDock = (d: Dock) => (dock = dock === d ? "" : d)
</script>

<svelte:window
    on:click={() => {
        editTransition = -1
        addOpen = false
    }}
/>

<div class="mixer">
    <!-- HEADER -->
    <header>
        <div class="brand"><Icon id="mixer" size={1.2} white /> <span>MIXER</span></div>

        <div class="group">
            <span class="label">OUTPUT</span>
            <select value={$mixer.outputId} on:change={(e) => setTargetOutput(e.currentTarget.value)}>
                <option value="">{translateText("mixer.all_outputs", $dictionary)}</option>
                {#each outputList as o}
                    <option value={o.id}>{o.name}</option>
                {/each}
            </select>
        </div>

        <div class="addWrap">
            <button class="btn accent" on:click|stopPropagation={() => (addOpen = !addOpen)}><Icon id="add" size={0.9} white /> {translateText("mixer.add_input", $dictionary)}</button>
            {#if addOpen}
                <div class="popover" role="presentation" on:click|stopPropagation on:keydown|stopPropagation>
                    <MixerAddInput on:close={() => (addOpen = false)} />
                </div>
            {/if}
        </div>

        <div class="spacer" />

        <button class="pill" class:live={streaming} title={translateText("mixer.open_output_settings", $dictionary)} on:click={openOutputSettings}>STREAM</button>
        <button class="pill" class:live={ndiOn} title={translateText("mixer.open_output_settings", $dictionary)} on:click={openOutputSettings}>NDI</button>
        <button class="pill" class:live={recording} on:click={toggleRecord}>● REC</button>
        <button class="pill" class:live={isoActive} disabled={!$mixer.inputs.some((i) => i.type === "camera")} on:click={() => (isoActive ? stopIso() : startIso())}>● ISO</button>
        <div class="clock">{time}</div>
    </header>

    <!-- MONITORS + TRANSITIONS -->
    <section class="top">
        <div class="monitor">
            <div class="mtitle pvw"><span>PREVIEW</span><span class="src">{previewInput?.name || "—"}</span></div>
            <MixerMonitor outputId={monitorOutputId} input={previewInput} />
        </div>

        <div class="transitions">
            <button class="tbtn quick" disabled={!previewInput || $outLocked} title="Quick Play" on:click={() => previewInput && quickPlay(previewInput.id, true)}>QUICK PLAY</button>
            <button class="tbtn cut" disabled={!previewInput || $outLocked} title="[C]" on:click={cut}>CUT</button>

            {#each $mixer.transitions || [] as transition, i}
                <div class="tpreset">
                    <button class="tbtn" class:running={$mixerTransitioning} disabled={!previewInput || $outLocked} title="{transition.duration} ms {i === 0 ? '[Space]' : ''}" on:click={() => auto(i)}>{label(transition.type)}</button>
                    <button class="arrow" title={translateText("mixer.transition", $dictionary)} on:click|stopPropagation={() => (editTransition = editTransition === i ? -1 : i)}>▾</button>
                    {#if editTransition === i}
                        <div class="tedit" role="presentation" on:click|stopPropagation on:keydown|stopPropagation>
                            <select value={transition.type} on:change={(e) => setType(i, e)}>
                                {#each transitionTypes as type}
                                    <option value={type}>{label(type)}</option>
                                {/each}
                            </select>
                            <div class="durations">
                                {#each [250, 500, 800, 1000, 2000] as d}
                                    <button class:active={transition.duration === d} on:click={() => setTransitionPreset(i, { duration: d })}>{d / 1000}s</button>
                                {/each}
                            </div>
                            <input type="number" min="0" max="10000" step="50" value={transition.duration} on:change={(e) => setTransitionPreset(i, { duration: Math.max(0, Number(e.currentTarget.value) || 0) })} />
                        </div>
                    {/if}
                </div>
            {/each}

            <button class="tbtn ftb" class:onBlack={isBlack} disabled={$outLocked} title="[B]" on:click={fadeToBlack}>FTB</button>

            <div class="slots">
                {#each Array(PIP_SLOTS) as _, i}
                    {@const pip = $mixer.pips[i]}
                    <button class="slot" class:set={!!pip} class:on={pip?.enabled} disabled={!pip} title="PiP {i + 1}" on:click={() => togglePipSlot(i)}>{i + 1}</button>
                {/each}
            </div>

            <MixerTBar disabled={!previewInput} />

            <button class="tbtn replay" disabled={!$replayBuffers.length || $replayBusy} title="[R]" on:click={() => captureReplay()}><Icon id="history" size={0.85} white /> REPLAY</button>
        </div>

        <div class="monitor">
            <div class="mtitle pgm"><span>PROGRAM</span><span class="src">{isBlack ? "BLACK" : programInput?.name || "—"}</span></div>
            <div class="program">
                {#if monitorOutputId}
                    <PreviewOutput outputId={monitorOutputId} />
                {:else}
                    <p class="empty">{translateText("mixer.no_output", $dictionary)}</p>
                {/if}
            </div>
        </div>
    </section>

    <!-- INPUTS + AUDIO -->
    <section class="middle">
        <div class="inputs">
            <div class="grid">
                {#each $mixer.inputs as input, index (input.id)}
                    <MixerTile {input} {index} live={liveThumbnails} isPreview={$mixer.previewId === input.id} isProgram={$mixer.programId === input.id} pips={$mixer.pips} isRecording={!!$isoRecording[input.id]} />
                {:else}
                    <button class="emptyAdd" on:click|stopPropagation={() => (addOpen = true)}>
                        <Icon id="add" size={2} white />
                        <span>{translateText("mixer.no_inputs", $dictionary)}</span>
                    </button>
                {/each}
            </div>
        </div>
        <div class="audioDock">
            <MixerAudioPanel />
        </div>
    </section>

    <!-- DOCK PANEL -->
    {#if dock}
        <section class="dock">
            <div class="dockHead">
                <span>{dock === "pip" ? "PiP / LAYOUT" : dock === "record" ? "REPLAY & ISO" : translateText("mixer.tab_guest", $dictionary).toUpperCase()}</span>
                <button class="x" on:click={() => (dock = "")}>✕</button>
            </div>
            <div class="dockBody">
                {#if dock === "pip"}
                    <MixerPipPanel />
                {:else if dock === "record"}
                    <MixerRecordPanel />
                {:else if dock === "guest"}
                    <MixerGuestPanel />
                {/if}
            </div>
        </section>
    {/if}

    <!-- BOTTOM BAR -->
    <footer>
        <button class="btn accent" on:click|stopPropagation={() => (addOpen = !addOpen)}><Icon id="add" size={0.9} white /> {translateText("mixer.add_input", $dictionary)}</button>
        <button class="btn" class:rec={recording} on:click={toggleRecord}>● {translateText("mixer.record", $dictionary)}</button>
        <button class="btn" class:active={dock === "record"} on:click={() => toggleDock("record")}
            ><Icon id="history" size={0.85} white /> Replay & ISO {#if isoActive}<span class="dot" />{/if}</button
        >
        <button class="btn" class:active={dock === "pip"} on:click={() => toggleDock("pip")}><Icon id="fullscreen" size={0.85} white /> PiP / Layout</button>
        <button class="btn" class:active={dock === "guest"} on:click={() => toggleDock("guest")}><Icon id="people" size={0.85} white /> {translateText("mixer.tab_guest", $dictionary)}</button>
        <div class="spacer" />
        <label class="check"><input type="checkbox" bind:checked={liveThumbnails} /> {translateText("mixer.live_thumbnails", $dictionary)}</label>
        <span class="status">{$mixer.inputs.length} inputs · {$mixer.pips.filter((p) => p.enabled).length} PiP · {Object.keys($isoRecording).length} ISO</span>
    </footer>
</div>

<style>
    /* scoped palette: navy + blue brand, white text; tally colours follow broadcast conventions */
    .mixer {
        --mx-bg: #0b1220;
        --mx-panel: #111a2c;
        --mx-panel-2: #16223a;
        --mx-border: #243453;
        --mx-accent: #2f80ed;
        --mx-accent-2: #00b4ff;
        --mx-text: #eaf2ff;
        --mx-muted: #8b9cbb;
        --mx-pgm: #e5293f;
        --mx-pvw: #1fae5c;

        display: flex;
        flex-direction: column;
        gap: 6px;
        min-height: 100%;
        padding: 6px;
        background-color: var(--mx-bg);
        color: var(--mx-text);
        font-size: 0.95em;
    }

    .btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 28px;
        padding: 0 12px;
        border: 1px solid var(--mx-border);
        border-radius: 4px;
        background: linear-gradient(#22304b, #19243a);
        color: var(--mx-text);
        font-family: inherit;
        font-size: 0.8em;
        font-weight: 700;
        cursor: pointer;
        white-space: nowrap;
    }
    .btn:hover {
        border-color: var(--mx-accent);
    }
    .btn.accent {
        border-color: transparent;
        background: linear-gradient(160deg, #1b5fd1, var(--mx-accent) 55%, var(--mx-accent-2));
        color: white;
    }
    .btn.active {
        border-color: var(--mx-accent);
        background: linear-gradient(#24477d, #1b3561);
    }
    .btn.rec {
        background: linear-gradient(var(--mx-pgm), #b81d30);
        border-color: transparent;
    }
    .spacer {
        flex: 1;
    }
    .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background-color: var(--mx-pgm);
    }

    /* HEADER */
    header,
    footer {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 5px 8px;
        border: 1px solid var(--mx-border);
        border-radius: 6px;
        background: linear-gradient(var(--mx-panel-2), var(--mx-panel));
    }
    .brand {
        display: flex;
        align-items: center;
        gap: 6px;
        padding-inline-end: 8px;
        border-inline-end: 1px solid var(--mx-border);
        font-weight: 900;
        letter-spacing: 0.12em;
        color: white;
    }
    .group {
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .label {
        font-size: 0.7em;
        font-weight: 800;
        color: var(--mx-muted);
    }
    select,
    input[type="number"] {
        height: 26px;
        padding: 0 6px;
        border: 1px solid var(--mx-border);
        border-radius: 4px;
        background-color: var(--mx-bg);
        color: var(--mx-text);
        font-family: inherit;
        font-size: 0.85em;
    }
    .addWrap {
        position: relative;
    }
    .popover {
        position: absolute;
        top: calc(100% + 6px);
        left: 0;
        z-index: 50;
    }
    .pill {
        height: 24px;
        padding: 0 10px;
        border: 1px solid var(--mx-border);
        border-radius: 3px;
        background: #0a101c;
        color: var(--mx-muted);
        font-family: inherit;
        font-size: 0.72em;
        font-weight: 800;
        letter-spacing: 0.05em;
        cursor: pointer;
    }
    .pill.live {
        background: linear-gradient(var(--mx-pgm), #b81d30);
        border-color: transparent;
        color: white;
    }
    .pill:disabled {
        opacity: 0.4;
        cursor: default;
    }
    .clock {
        min-width: 96px;
        padding: 2px 8px;
        border: 1px solid var(--mx-border);
        border-radius: 3px;
        background: #04070d;
        color: #5fd38d;
        font-family: "SF Mono", Menlo, Consolas, monospace;
        font-size: 1.05em;
        font-weight: 700;
        text-align: center;
        letter-spacing: 0.05em;
    }

    /* MONITORS */
    .top {
        display: grid;
        grid-template-columns: 1fr 150px 1fr;
        gap: 6px;
        align-items: start;
    }
    .monitor {
        display: flex;
        flex-direction: column;
        border: 1px solid var(--mx-border);
        border-radius: 4px;
        overflow: hidden;
        background-color: #000;
    }
    .mtitle {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        height: 22px;
        padding: 0 8px;
        align-items: center;
        font-size: 0.75em;
        font-weight: 800;
        letter-spacing: 0.05em;
        color: white;
    }
    .mtitle.pvw {
        background: linear-gradient(#1fae5c, #178a48);
    }
    .mtitle.pgm {
        background: linear-gradient(#e5293f, #b81d30);
    }
    .src {
        font-weight: 600;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }
    .program {
        position: relative;
        display: flex;
        width: 100%;
    }

    /* TRANSITIONS */
    .transitions {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 6px;
        border: 1px solid var(--mx-border);
        border-radius: 4px;
        background: linear-gradient(var(--mx-panel-2), var(--mx-panel));
    }
    .tbtn {
        width: 100%;
        height: 28px;
        border: 1px solid var(--mx-border);
        border-radius: 3px;
        background: linear-gradient(#2a3a5a, #1c2840);
        color: var(--mx-text);
        font-family: inherit;
        font-size: 0.72em;
        font-weight: 800;
        letter-spacing: 0.04em;
        cursor: pointer;
    }
    .tbtn:hover:not(:disabled) {
        border-color: var(--mx-accent);
        color: white;
    }
    .tbtn:disabled {
        opacity: 0.4;
        cursor: default;
    }
    .tbtn.cut {
        background: linear-gradient(#3b4d73, #263555);
    }
    .tbtn.quick {
        color: #8fc2ff;
    }
    .tbtn.running {
        background: linear-gradient(var(--mx-accent), #1b5fd1);
    }
    .tbtn.ftb.onBlack {
        background: linear-gradient(var(--mx-pgm), #b81d30);
        color: white;
    }
    .tbtn.replay {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
    }
    .tpreset {
        position: relative;
        display: flex;
        gap: 2px;
    }
    .arrow {
        width: 20px;
        border: 1px solid var(--mx-border);
        border-radius: 3px;
        background: linear-gradient(#22304b, #19243a);
        color: var(--mx-muted);
        cursor: pointer;
        font-size: 0.7em;
    }
    .tedit {
        position: absolute;
        top: 0;
        left: calc(100% + 6px);
        z-index: 40;
        display: flex;
        flex-direction: column;
        gap: 6px;
        width: 190px;
        padding: 8px;
        border: 1px solid var(--mx-border);
        border-radius: 6px;
        background-color: var(--mx-panel);
        box-shadow: 0 10px 30px rgb(0 0 0 / 0.6);
    }
    .durations {
        display: flex;
        gap: 2px;
    }
    .durations button {
        flex: 1;
        height: 22px;
        border: 1px solid var(--mx-border);
        border-radius: 3px;
        background: #0a101c;
        color: var(--mx-muted);
        font-size: 0.72em;
        cursor: pointer;
    }
    .durations button.active {
        background: var(--mx-accent);
        color: white;
    }
    .slots {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 3px;
        margin-top: 2px;
    }
    .slot {
        height: 24px;
        border: 1px solid var(--mx-border);
        border-radius: 3px;
        background: #0a101c;
        color: var(--mx-muted);
        font-weight: 800;
        cursor: pointer;
    }
    .slot.set {
        color: #f5a623;
    }
    .slot.on {
        background: linear-gradient(#f5a623, #c98510);
        color: #1b1300;
    }
    .slot:disabled {
        opacity: 0.35;
        cursor: default;
    }

    /* INPUTS + AUDIO */
    .middle {
        flex: 1;
        display: grid;
        grid-template-columns: 1fr minmax(220px, 34%);
        gap: 6px;
        min-height: 230px;
    }
    .inputs,
    .audioDock {
        border: 1px solid var(--mx-border);
        border-radius: 4px;
        background-color: var(--mx-panel);
        overflow: auto;
    }
    .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
        gap: 6px;
        padding: 6px;
    }
    .emptyAdd {
        grid-column: 1 / -1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 30px;
        border: 2px dashed var(--mx-border);
        border-radius: 6px;
        background: none;
        color: var(--mx-muted);
        font-family: inherit;
        cursor: pointer;
    }
    .emptyAdd:hover {
        border-color: var(--mx-accent);
        color: var(--mx-text);
    }

    /* DOCK */
    .dock {
        border: 1px solid var(--mx-accent);
        border-radius: 4px;
        background-color: var(--mx-panel);
        max-height: 45vh;
        display: flex;
        flex-direction: column;
    }
    .dockHead {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 4px 8px;
        font-size: 0.75em;
        font-weight: 800;
        letter-spacing: 0.06em;
        background: linear-gradient(#24477d, #1b3561);
    }
    .x {
        border: none;
        background: none;
        color: white;
        cursor: pointer;
    }
    .dockBody {
        padding: 8px;
        overflow: auto;
    }

    /* FOOTER */
    footer {
        position: relative;
    }
    .check {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 0.78em;
        color: var(--mx-muted);
        cursor: pointer;
    }
    .status {
        font-size: 0.72em;
        color: var(--mx-muted);
        font-family: "SF Mono", Menlo, Consolas, monospace;
    }
    .empty {
        padding: 20px;
        color: var(--mx-muted);
        text-align: center;
    }

    @media screen and (max-width: 1200px) {
        .top {
            grid-template-columns: 1fr 1fr;
        }
        .transitions {
            grid-column: 1 / -1;
            grid-row: 2;
            flex-direction: row;
            flex-wrap: wrap;
        }
        .transitions > * {
            flex: 1 1 90px;
        }
        .middle {
            grid-template-columns: 1fr;
        }
    }
</style>
