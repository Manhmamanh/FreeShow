<script lang="ts">
    // Left panel: the mixer's input list + adding new sources (camera, NDI, screen, media file).
    import { onDestroy } from "svelte"
    import { NDI } from "../../../types/Channels"
    import { Main } from "../../../types/IPC/Main"
    import { requestMain } from "../../IPC/main"
    import { cameraManager, type CameraData } from "../../media/cameraManager"
    import { dictionary, special } from "../../stores"
    import { translateText } from "../../utils/language"
    import { destroy, receive, send } from "../../utils/request"
    import { mediaExtensions } from "../../values/extensions"
    import Icon from "../helpers/Icon.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import MediaPicker from "../inputs/MediaPicker.svelte"
    import { addGuest, addInput, addMediaFiles, MAX_SHORTCUT_INPUTS, mixer, moveInput, removeInput, renameInput, setPreview } from "./mixer"
    import { getAudioInputDevices } from "./mixerAudio"
    import { inputIcon } from "./MixerTile.svelte"

    type Source = { id: string; name: string; group?: string }

    let addType: "" | "camera" | "ndi" | "screen" | "audio" = ""
    let sources: Source[] = []
    let loading = false

    async function openAdd(type: typeof addType) {
        addType = addType === type ? "" : type
        sources = []
        if (!addType) return

        loading = true
        if (addType === "camera") {
            const cams: CameraData[] = await cameraManager.getCamerasList()
            sources = cams.map((c) => ({ id: c.id, name: c.name, group: c.group }))
            loading = false
        } else if (addType === "audio") {
            sources = await getAudioInputDevices()
            loading = false
        } else if (addType === "screen") {
            sources = ((await requestMain(Main.GET_SCREENS)) || []).map((s) => ({ id: s.id, name: s.name }))
            loading = false
        } else if (addType === "ndi") {
            send(NDI, ["RECEIVE_LIST"], { groups: $special?.ndiInputGroups || "" })
            // the list is answered async; stop the spinner if nothing is found
            setTimeout(() => (loading = false), 4000)
        }
    }

    receive(
        NDI,
        {
            RECEIVE_LIST: (msg) => {
                if (addType !== "ndi" || !msg) return
                loading = false
                try {
                    sources = JSON.parse(msg).map(({ name, urlAddress }) => ({ id: urlAddress, name }))
                } catch {
                    sources = []
                }
            }
        },
        "MIXER_NDI"
    )
    onDestroy(() => destroy(NDI, "MIXER_NDI"))

    function add(source: Source) {
        if (!addType) return
        addInput({ name: source.name, type: addType, sourceId: source.id, cameraGroup: source.group })
    }

    // window.prompt is not available in Electron, so names are edited inline
    let editingId = ""
    function finishRename(id: string, value: string) {
        renameInput(id, value)
        editingId = ""
    }
    function focusSelect(node: HTMLInputElement) {
        node.focus()
        node.select()
    }
</script>

<div class="panel">
    <div class="header">{translateText("mixer.inputs", $dictionary)} ({$mixer.inputs.length})</div>

    <div class="list">
        {#each $mixer.inputs as input, index (input.id)}
            <div class="input" class:preview={$mixer.previewId === input.id} class:program={$mixer.programId === input.id}>
                {#if editingId === input.id}
                    <input
                        class="rename"
                        value={input.name}
                        use:focusSelect
                        on:blur={(e) => finishRename(input.id, e.currentTarget.value)}
                        on:keydown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur()
                            if (e.key === "Escape") editingId = ""
                        }}
                    />
                {:else}
                    <button class="name" on:click={() => setPreview(input.id)} on:dblclick={() => (editingId = input.id)} title={translateText("mixer.rename_hint", $dictionary)}>
                        <span class="number">{index < MAX_SHORTCUT_INPUTS ? index + 1 : "-"}</span>
                        <Icon id={inputIcon(input.type)} size={0.9} white />
                        <span class="text">{input.name}</span>
                    </button>
                {/if}
                <MaterialButton icon="up" title="↑" disabled={index === 0} on:click={() => moveInput(input.id, -1)} small />
                <MaterialButton icon="down" title="↓" disabled={index === $mixer.inputs.length - 1} on:click={() => moveInput(input.id, 1)} small />
                <MaterialButton icon="delete" title={translateText("actions.remove", $dictionary)} on:click={() => removeInput(input.id)} small red />
            </div>
        {:else}
            <p class="empty">{translateText("mixer.no_inputs", $dictionary)}</p>
        {/each}
    </div>

    <div class="header">{translateText("mixer.add_input", $dictionary)}</div>
    <div class="addButtons">
        <MaterialButton icon="camera" isActive={addType === "camera"} on:click={() => openAdd("camera")}>{translateText("mixer.camera", $dictionary)}</MaterialButton>
        <MaterialButton icon="ndi" isActive={addType === "ndi"} on:click={() => openAdd("ndi")}>NDI</MaterialButton>
        <MaterialButton icon="screen" isActive={addType === "screen"} on:click={() => openAdd("screen")}>{translateText("mixer.screen", $dictionary)}</MaterialButton>
        <MaterialButton icon="microphone" isActive={addType === "audio"} on:click={() => openAdd("audio")}>{translateText("mixer.audio_input", $dictionary)}</MaterialButton>
        <MaterialButton icon="people" on:click={() => addGuest()}>{translateText("mixer.guest", $dictionary)}</MaterialButton>
        <MediaPicker id="mixer_media" filter={{ name: "Media files", extensions: mediaExtensions }} multiple on:picked={(e) => addMediaFiles(Array.isArray(e.detail) ? e.detail : [e.detail])}>
            <Icon id="media" white />
            <span style="margin-left: 6px;">{translateText("mixer.media_file", $dictionary)}</span>
        </MediaPicker>
    </div>

    {#if addType}
        <div class="sources">
            {#if loading}
                <p class="empty">{translateText("mixer.searching", $dictionary)}</p>
            {:else}
                {#each sources as source}
                    {@const added = $mixer.inputs.some((i) => i.type === addType && i.sourceId === source.id)}
                    <MaterialButton icon={added ? "check" : "add"} disabled={added} on:click={() => add(source)} style="justify-content: flex-start;">
                        {source.name}
                    </MaterialButton>
                {:else}
                    <p class="empty">{translateText("mixer.no_sources", $dictionary)}</p>
                {/each}
            {/if}
        </div>
    {/if}
</div>

<style>
    .panel {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow-y: auto;
    }

    .header {
        padding: 8px 10px;
        font-weight: 600;
        font-size: 0.9em;
        text-transform: uppercase;
        opacity: 0.8;
        background-color: var(--primary-darker);
    }

    .list {
        display: flex;
        flex-direction: column;
    }

    .input {
        display: flex;
        align-items: center;
        border-inline-start: 4px solid transparent;
    }
    .input:nth-child(even) {
        background-color: rgb(0 0 20 / 0.08);
    }
    .input.preview {
        border-inline-start-color: #23b14d;
    }
    .input.program {
        border-inline-start-color: #e5243b;
    }

    .input .name {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px;
        overflow: hidden;
        border: none;
        background: none;
        color: var(--text);
        font-family: inherit;
        font-size: inherit;
        cursor: pointer;
        text-align: start;
    }
    .input .name:hover {
        background-color: var(--hover);
    }
    .rename {
        flex: 1;
        margin: 4px;
        padding: 4px 6px;
        border: 1px solid var(--secondary);
        background-color: var(--primary-darker);
        color: var(--text);
        font-family: inherit;
        font-size: inherit;
    }
    .number {
        min-width: 1.2em;
        font-weight: bold;
        opacity: 0.6;
    }
    .text {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }

    .addButtons {
        display: grid;
        grid-template-columns: 1fr 1fr;
    }

    .sources {
        display: flex;
        flex-direction: column;
        border-top: 2px solid var(--primary-lighter);
    }

    .empty {
        padding: 10px;
        opacity: 0.6;
        font-size: 0.9em;
        text-align: center;
    }
</style>
