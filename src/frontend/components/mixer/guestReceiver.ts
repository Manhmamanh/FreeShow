// Remote guests received directly over WebRTC with the VDO.Ninja SDK (public/vendor/vdoninja, MPL-2.0).
// The guest opens the invite link (vdo.ninja/?push=ID) in a browser; every window that shows the guest
// (output windows, mixer thumbnails/monitors, audio engine) gets the same MediaStream per window.
// Unlike a <webview>, a plain <video> with a MediaStream is captured by offscreen output windows (NDI/RTMP).

import { writable } from "svelte/store"

export type GuestState = "connecting" | "waiting" | "live" | "error"
/** connection state per guest stream id (in this window) */
export const guestStates = writable<{ [streamId: string]: GuestState }>({})

type Entry = {
    streamId: string
    stream: MediaStream
    sdk: any
    refs: number
    closeTimer: NodeJS.Timeout | null
    retryTimer: NodeJS.Timeout | null
    destroyed: boolean
}
const entries = new Map<string, Entry>()

const SDK_URL = "./vendor/vdoninja/vdoninja-sdk.min.js"
let sdkPromise: Promise<any> | null = null

function loadSdk(): Promise<any> {
    if (sdkPromise) return sdkPromise
    sdkPromise = new Promise((resolve, reject) => {
        const existing = (window as any).VDONinjaSDK
        if (existing) return resolve(existing)

        const script = document.createElement("script")
        script.src = SDK_URL
        script.async = true
        script.onload = () => {
            // browser global; when node integration is on (development) the UMD wrapper uses module.exports
            const sdk = (window as any).VDONinjaSDK || (window as any).module?.exports?.VDONinjaSDK
            if (sdk) resolve(sdk)
            else reject(new Error("VDO.Ninja SDK did not load"))
        }
        script.onerror = () => reject(new Error("Could not load " + SDK_URL))
        document.head.appendChild(script)
    }).catch((err) => {
        sdkPromise = null
        throw err
    })
    return sdkPromise
}

function setState(streamId: string, state: GuestState) {
    guestStates.update((a) => ({ ...a, [streamId]: state }))
}

/** replace a track of the same kind so <video>/<audio> elements keep playing after a guest reconnects */
function putTrack(stream: MediaStream, track: MediaStreamTrack) {
    stream
        .getTracks()
        .filter((t) => t.kind === track.kind && t.id !== track.id)
        .forEach((old) => stream.removeTrack(old))
    if (!stream.getTracks().some((t) => t.id === track.id)) stream.addTrack(track)
    // MediaStream does not fire addtrack for local changes; tell listeners ourselves
    stream.dispatchEvent(new Event("mixertrack"))
}

async function connect(entry: Entry) {
    if (entry.destroyed) return
    setState(entry.streamId, "connecting")

    try {
        const SDK = await loadSdk()
        if (entry.destroyed) return

        // salt "vdo.ninja" + default password: same stream ids as links opened on vdo.ninja
        const sdk = new SDK({ salt: "vdo.ninja" })
        entry.sdk = sdk

        sdk.addEventListener("track", (event: any) => {
            const track: MediaStreamTrack | undefined = event?.detail?.track
            if (!track || entry.destroyed) return
            putTrack(entry.stream, track)
            setState(entry.streamId, "live")
            track.addEventListener("ended", () => {
                if (!entry.destroyed && !entry.stream.getTracks().some((t) => t.readyState === "live")) scheduleRetry(entry)
            })
        })
        sdk.addEventListener("peerDisconnected", () => !entry.destroyed && scheduleRetry(entry))
        sdk.addEventListener("disconnected", () => !entry.destroyed && scheduleRetry(entry))

        await sdk.connect()
        if (entry.destroyed) return sdk.disconnect?.()
        await sdk.view(entry.streamId, { audio: true, video: true, label: "Haidangshow" })

        // the guest may not be online yet: keep asking until tracks arrive
        if (!entry.stream.getTracks().length) {
            setState(entry.streamId, "waiting")
            scheduleRetry(entry, 8000)
        }
    } catch (err) {
        console.warn("[Mixer] guest connection", entry.streamId, err)
        setState(entry.streamId, "error")
        scheduleRetry(entry, 10000)
    }
}

function scheduleRetry(entry: Entry, delay = 5000) {
    if (entry.destroyed || entry.retryTimer) return
    entry.retryTimer = setTimeout(() => {
        entry.retryTimer = null
        if (entry.destroyed) return
        if (entry.stream.getTracks().some((t) => t.readyState === "live")) return
        try {
            entry.sdk?.disconnect?.()
        } catch {
            // ignore
        }
        entry.sdk = null
        connect(entry)
    }, delay)
}

/** shared stream of a guest in this window (call releaseGuestStream when done) */
export function acquireGuestStream(streamId: string): MediaStream {
    let entry = entries.get(streamId)
    if (entry) {
        entry.refs++
        if (entry.closeTimer) clearTimeout(entry.closeTimer)
        entry.closeTimer = null
        return entry.stream
    }

    entry = { streamId, stream: new MediaStream(), sdk: null, refs: 1, closeTimer: null, retryTimer: null, destroyed: false }
    entries.set(streamId, entry)
    connect(entry)
    return entry.stream
}

export function releaseGuestStream(streamId: string) {
    const entry = entries.get(streamId)
    if (!entry) return
    entry.refs--
    if (entry.refs > 0) return

    // keep it a moment: switching program/preview remounts the same guest
    entry.closeTimer = setTimeout(() => {
        entry.destroyed = true
        if (entry.retryTimer) clearTimeout(entry.retryTimer)
        try {
            entry.sdk?.disconnect?.()
        } catch {
            // ignore
        }
        entry.stream.getTracks().forEach((t) => t.stop())
        entries.delete(streamId)
        guestStates.update((a) => {
            delete a[streamId]
            return a
        })
    }, 4000)
}

/** svelte action: <video use:guestVideo={streamId}> */
export function guestVideo(node: HTMLVideoElement, streamId: string) {
    let current = streamId
    const attach = (id: string) => {
        const stream = acquireGuestStream(id)
        node.srcObject = stream
        node.muted = true // sound goes through the mixer audio engine (main window)
        node.play().catch(() => null)
        const replay = () => node.play().catch(() => null)
        stream.addEventListener("mixertrack", replay)
        return () => stream.removeEventListener("mixertrack", replay)
    }
    let detach = attach(current)

    return {
        update(id: string) {
            if (id === current) return
            detach()
            releaseGuestStream(current)
            current = id
            detach = attach(current)
        },
        destroy() {
            detach()
            node.srcObject = null
            releaseGuestStream(current)
        }
    }
}
