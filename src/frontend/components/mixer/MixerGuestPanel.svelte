<script lang="ts">
    // Remote guests (vMix Call style) over VDO.Ninja: send the invite link / QR, the guest appears as an input.
    import qrcode from "qrcode-generator"
    import { dictionary } from "../../stores"
    import { newToast } from "../../utils/common"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"
    import { addGuest, mixer, removeInput, setPreview, updateInput } from "./mixer"
    import { guestStates } from "./guestReceiver"
    import { getGuestInviteUrl, newGuestStreamId } from "./mixerLive"

    const stateLabel = { connecting: "mixer.guest_connecting", waiting: "mixer.guest_waiting", live: "mixer.guest_live", error: "mixer.guest_error" }

    $: guests = $mixer.inputs.filter((i) => i.type === "guest")

    function qrSvg(text: string) {
        try {
            const qr = qrcode(0, "M")
            qr.addData(text)
            qr.make()
            return qr.createSvgTag({ scalable: true, margin: 2 })
        } catch {
            return ""
        }
    }

    async function copy(text: string) {
        try {
            await navigator.clipboard.writeText(text)
            newToast(translateText("mixer.link_copied", $dictionary))
        } catch {
            newToast(text)
        }
    }
</script>

<div class="top">
    <button class="btn" on:click={() => addGuest()}><Icon id="add" size={0.9} white /> {translateText("mixer.add_guest", $dictionary)}</button>
    <p class="hint">{translateText("mixer.guest_hint", $dictionary)}</p>
</div>

<div class="guests">
    {#each guests as guest (guest.id)}
        {@const link = getGuestInviteUrl(guest.sourceId, guest.name)}
        <div class="guest" class:onAir={$mixer.programId === guest.id}>
            <div class="qr">{@html qrSvg(link)}</div>
            <div class="info">
                <div class="nameRow">
                    <input class="name" value={guest.name} on:change={(e) => updateInput(guest.id, { name: e.currentTarget.value || guest.name })} />
                    {#if guest.guestMode !== "webview"}
                        {@const state = $guestStates[guest.sourceId] || "connecting"}
                        <span class="state {state}">● {translateText(stateLabel[state], $dictionary)}</span>
                    {/if}
                </div>
                <code title={link}>{link}</code>
                <label class="mode" title={translateText("mixer.guest_mode_hint", $dictionary)}>
                    <input type="checkbox" checked={guest.guestMode === "webview"} on:change={(e) => updateInput(guest.id, { guestMode: e.currentTarget.checked ? "webview" : "direct" })} />
                    {translateText("mixer.guest_webview_mode", $dictionary)}
                </label>
                <div class="actions">
                    <button class="btn" on:click={() => copy(link)}><Icon id="copy" size={0.85} white /> {translateText("mixer.copy_link", $dictionary)}</button>
                    <button class="btn" on:click={() => setPreview(guest.id)}>PVW</button>
                    <button class="btn" title={translateText("mixer.new_link_hint", $dictionary)} on:click={() => updateInput(guest.id, { sourceId: newGuestStreamId() })}><Icon id="refresh" size={0.85} white /></button>
                    <button class="btn red" title={translateText("actions.remove", $dictionary)} on:click={() => removeInput(guest.id)}><Icon id="delete" size={0.85} white /></button>
                </div>
            </div>
        </div>
    {:else}
        <p class="hint">{translateText("mixer.no_guests", $dictionary)}</p>
    {/each}
</div>

<p class="hint">{translateText("mixer.guest_privacy", $dictionary)}</p>

<style>
    .top {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
    }
    .hint {
        margin: 0;
        font-size: 0.8em;
        opacity: 0.6;
    }

    .btn {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 5px 8px;
        border: none;
        border-radius: 4px;
        background-color: var(--primary-darker);
        color: var(--text);
        font-family: inherit;
        font-size: 0.85em;
        cursor: pointer;
        white-space: nowrap;
    }
    .btn.red:hover {
        background-color: rgb(229 36 59 / 0.5);
    }

    .guests {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
        gap: 8px;
        margin-bottom: 8px;
    }
    .guest {
        display: flex;
        gap: 10px;
        padding: 8px;
        border-radius: 6px;
        border: 2px solid var(--primary-lighter);
        background-color: var(--primary-darkest);
    }
    .guest.onAir {
        border-color: #e5243b;
    }

    .qr {
        width: 110px;
        min-width: 110px;
        height: 110px;
        background-color: white;
        border-radius: 4px;
        overflow: hidden;
    }
    .qr :global(svg) {
        width: 100%;
        height: 100%;
    }

    .info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .name {
        padding: 4px 6px;
        border: 1px solid var(--primary-lighter);
        border-radius: 4px;
        background-color: var(--primary-darker);
        color: var(--text);
        font-family: inherit;
        font-weight: 600;
    }
    code {
        font-size: 0.75em;
        opacity: 0.7;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        user-select: all;
    }
    .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
    }

    .nameRow {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .nameRow .name {
        flex: 1;
        min-width: 0;
    }
    .state {
        font-size: 0.75em;
        font-weight: 700;
        white-space: nowrap;
        color: #8b9cbb;
    }
    .state.live {
        color: #1fae5c;
    }
    .state.waiting {
        color: #f5a623;
    }
    .state.error {
        color: #e5293f;
    }
    .mode {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.78em;
        opacity: 0.8;
        cursor: pointer;
    }
</style>
