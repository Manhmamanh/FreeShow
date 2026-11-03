import { beforeEach, describe, expect, it, vi } from "vitest"

// mixerAudio imports the FreeShow audio engine; only the device matching is tested here
vi.mock("../../audio/audioAnalyser", () => ({ AudioAnalyser: {} }))
vi.mock("./mixer", () => ({ mixer: { subscribe: () => () => null }, getMonitorOutputId: () => "", updateInput: () => null }))
vi.mock("../../stores", () => ({ outputs: { subscribe: () => () => null } }))
vi.mock("../helpers/media", () => ({ encodeFilePath: (p: string) => p }))
vi.mock("./guestReceiver", () => ({ acquireGuestStream: () => null, releaseGuestStream: () => null }))

const devices = [
    { kind: "videoinput", deviceId: "cam-iphone", groupId: "g-iphone", label: "MMM 15Plus Camera" },
    { kind: "audioinput", deviceId: "default", groupId: "g-mac", label: "Default - MacBook Pro Microphone" },
    { kind: "audioinput", deviceId: "mic-mac", groupId: "g-mac", label: "MacBook Pro Microphone" },
    { kind: "audioinput", deviceId: "mic-iphone", groupId: "g-iphone-audio", label: "MMM 15Plus Microphone" },
    { kind: "audioinput", deviceId: "mic-usb", groupId: "g-usb", label: "USB Capture HDMI Audio" }
]

beforeEach(() => {
    vi.stubGlobal("navigator", { mediaDevices: { enumerateDevices: () => Promise.resolve(devices) } })
})

describe("findLinkedMicrophone", () => {
    it("matches the microphone of the same device by groupId", async () => {
        const { findLinkedMicrophone } = await import("./mixerAudio")
        expect(await findLinkedMicrophone("USB Capture HDMI", "g-usb")).toBe("mic-usb")
    })
    it("falls back to the device name (iPhone Continuity Camera)", async () => {
        const { findLinkedMicrophone } = await import("./mixerAudio")
        expect(await findLinkedMicrophone("MMM 15Plus Camera", "g-iphone")).toBe("mic-iphone")
    })
    it("returns nothing when no microphone belongs to the camera", async () => {
        const { findLinkedMicrophone } = await import("./mixerAudio")
        expect(await findLinkedMicrophone("FaceTime HD Camera (1C1C:B782)", "g-none")).toBe("")
    })
})
