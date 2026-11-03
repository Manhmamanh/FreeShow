<script lang="ts">
    // "Add Input" menu (vMix style): pick a source type, then a device/stream.
    import { createEventDispatcher, onDestroy } from "svelte"
    import { NDI } from "../../../types/Channels"
    import { Main } from "../../../types/IPC/Main"
    import { requestMain } from "../../IPC/main"
    import { cameraManager } from "../../media/cameraManager"
    import { dictionary, special } from "../../stores"
    import { translateText } from "../../utils/language"
    import { destroy, receive, send } from "../../utils/request"
    import { audioExtensions, mediaExtensions } from "../../values/extensions"
    import Icon from "../helpers/Icon.svelte"
    import MediaPicker from "../inputs/MediaPicker.svelte"
    import { addGuest, addInput, addMediaFiles, mixer } from "./mixer"
    import { findLinkedMicrophone, getAudioInputDevices } from "./mixerAudio"

    type Kind = "camera" | "ndi" | "screen" | "audio"
    type Source = { id: string; name: string; group?: string }

    const dispatch = createEventDispatcher()
    let kind: Kind | "" = ""
    let sources: Source[] = []
    let loading = false

    const kinds: { id: Kind; icon: string; label: string }[] = [
        { id: "camera", icon: "camera", label: "mixer.camera" },
        { id: "ndi", icon: "ndi", label: "NDI" },
        { id: "screen", icon: "screen", label: "mixer.screen" },
        { id: "audio", icon: "microphone", label: "mixer.audio_input" }
    ]

    async function open(k: Kind) {
        kind = k
        sources = []
        loading = true
        if (k === "camera") sources = (await cameraManager.getCamerasList()).map((c) => ({ id: c.id, name: c.name, group: c.group }))
        else if (k === "screen") sources = ((await requestMain(Main.GET_SCREENS)) || []).map((s) => ({ id: s.id, name: s.name }))
        else if (k === "audio") sources = await getAudioInputDevices()
        else if (k === "ndi") {
            send(NDI, ["RECEIVE_LIST"], { groups: $special?.ndiInputGroups || "" })
            setTimeout(() => (loading = false), 4000)
            return
        }
        loading = false
    }

    receive(
        NDI,
        {
            RECEIVE_LIST: (msg) => {
                if (kind !== "ndi" || !msg) return
                loading = false
                try {
                    sources = JSON.parse(msg).map(({ name, urlAddress }) => ({ id: urlAddress, name }))
                } catch {
                    sources = []
                }
            }
        },
        "MIXER_ADD_NDI"
    )
    onDestroy(() => destroy(NDI, "MIXER_ADD_NDI"))

    async function add(source: Source) {
        if (!kind) return
        // a camera brings its own microphone along (sound for AFV, ISO and replay)
        const audioDeviceId = kind === "camera" ? (await findLinkedMicrophone(source.name, source.group)) || undefined : undefined
        addInput({ name: source.name, type: kind, sourceId: source.id, cameraGroup: source.group, audioDeviceId }, false)
    }

    const t = (key: string) => (key.includes(".") ? translateText(key, $dictionary) : key)
</script>

<div class="menu">
    <div class="kinds">
        {#each kinds as k}
            <button class:active={kind === k.id} on:click={() => open(k.id)}><Icon id={k.icon} size={1} white /> {t(k.label)}</button>
        {/each}
        <button
            on:click={() => {
                addGuest()
                dispatch("close")
            }}><Icon id="people" size={1} white /> {t("mixer.guest")}</button
        >
        <MediaPicker id="mixer_add_media" title={t("mixer.media_file")} filter={{ name: "Media / audio files", extensions: [...mediaExtensions, ...audioExtensions] }} multiple dark={false} center={false} on:picked={(e) => addMediaFiles(Array.isArray(e.detail) ? e.detail : [e.detail])}>
            <Icon id="media" size={1} white />
            <span style="margin-inline-start: 6px;">{t("mixer.media_file")}</span>
        </MediaPicker>
    </div>

    {#if !kind}
        <div class="sources">
            <p class="hint">{t("mixer.office_hint")}</p>
        </div>
    {/if}

    {#if kind}
        <div class="sources">
            {#if loading}
                <p class="hint">{t("mixer.searching")}</p>
            {:else}
                {#each sources as source}
                    {@const added = $mixer.inputs.some((i) => i.type === kind && i.sourceId === source.id)}
                    <button class="source" disabled={added} on:click={() => add(source)}>
                        <Icon id={added ? "check" : "add"} size={0.9} white />
                        <span>{source.name}</span>
                    </button>
                {:else}
                    <p class="hint">{t("mixer.no_sources")}</p>
                {/each}
            {/if}
        </div>
    {/if}
</div>

<style>
    .menu {
        display: flex;
        gap: 0;
        min-width: 460px;
        max-height: 360px;
        border: 1px solid var(--mx-border);
        border-radius: 6px;
        background-color: var(--mx-panel);
        box-shadow: 0 10px 30px rgb(0 0 0 / 0.6);
        overflow: hidden;
    }

    .kinds {
        display: flex;
        flex-direction: column;
        min-width: 170px;
        padding: 6px;
        gap: 2px;
        background-color: var(--mx-panel-2);
    }
    .kinds button,
    .kinds :global(button) {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 7px 10px;
        border: none;
        border-radius: 4px;
        background: none;
        color: var(--mx-text);
        font-family: inherit;
        font-size: 0.9em;
        text-align: start;
        cursor: pointer;
        justify-content: flex-start;
    }
    .kinds button:hover,
    .kinds :global(button:hover) {
        background-color: rgb(47 128 237 / 0.18);
    }
    .kinds button.active {
        background-color: var(--mx-accent);
        color: white;
    }

    .sources {
        flex: 1;
        display: flex;
        flex-direction: column;
        padding: 6px;
        gap: 2px;
        overflow-y: auto;
    }
    .source {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 7px 10px;
        border: none;
        border-radius: 4px;
        background: none;
        color: var(--mx-text);
        font-family: inherit;
        text-align: start;
        cursor: pointer;
    }
    .source:hover:not(:disabled) {
        background-color: rgb(47 128 237 / 0.18);
    }
    .source:disabled {
        opacity: 0.45;
        cursor: default;
    }
    .source span {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }
    .hint {
        padding: 10px;
        color: var(--mx-muted);
        font-size: 0.85em;
    }
</style>
