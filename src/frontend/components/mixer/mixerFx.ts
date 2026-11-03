// Picture filters of mixer inputs: chroma key, colour correction and 3D LUTs (.cube).
// The heavy lifting happens in a WebGL2 shader (output/MixerFxCanvas.svelte); thumbnails use cheap CSS filters.

import { Main } from "../../../types/IPC/Main"
import type { MixerFx } from "../../../types/Mixer"
import { requestMain } from "../../IPC/main"

export const DEFAULT_CHROMA = { enabled: true, color: "#00ff00", similarity: 0.32, smoothness: 0.08, spill: 0.15 }

export const DEFAULT_FX: Required<Omit<MixerFx, "chroma" | "lut">> = { brightness: 0, contrast: 1, saturation: 1, gamma: 1, hue: 0, temperature: 0 }

export const hasColorFx = (fx?: MixerFx) => !!fx && (["brightness", "contrast", "saturation", "gamma", "hue", "temperature"] as const).some((k) => fx[k] !== undefined && fx[k] !== DEFAULT_FX[k])
export const hasChroma = (fx?: MixerFx) => !!fx?.chroma?.enabled
export const hasLut = (fx?: MixerFx) => !!fx?.lut?.path && (fx.lut.intensity ?? 1) > 0
/** anything that needs the WebGL shader */
export const isFxActive = (fx?: MixerFx) => hasChroma(fx) || hasLut(fx) || hasColorFx(fx)

/** cheap approximation for thumbnails (no keying, no LUT) */
export function cssFilter(fx?: MixerFx): string {
    if (!fx || !hasColorFx(fx)) return ""
    const parts: string[] = []
    if (fx.brightness) parts.push(`brightness(${(1 + fx.brightness).toFixed(3)})`)
    if (fx.contrast !== undefined && fx.contrast !== 1) parts.push(`contrast(${fx.contrast.toFixed(3)})`)
    if (fx.saturation !== undefined && fx.saturation !== 1) parts.push(`saturate(${fx.saturation.toFixed(3)})`)
    if (fx.hue) parts.push(`hue-rotate(${fx.hue}deg)`)
    if (fx.temperature) parts.push(fx.temperature > 0 ? `sepia(${(fx.temperature * 0.35).toFixed(3)})` : `hue-rotate(${(fx.temperature * 12).toFixed(1)}deg)`)
    return parts.join(" ")
}

export function hexToRgb(hex: string): [number, number, number] {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || "")
    if (!m) return [0, 1, 0]
    return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255]
}

// ----- LUT (.cube) -----

export type Lut = { size: number; data: Uint8Array } // RGBA8, red fastest, then green, then blue

/** Adobe/Resolve .cube 3D LUT parser (LUT_3D_SIZE, optional DOMAIN_MIN/MAX) */
export function parseCube(text: string): Lut {
    let size = 0
    let min = [0, 0, 0]
    let max = [1, 1, 1]
    const values: number[] = []

    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim()
        if (!line || line.startsWith("#")) continue
        const upper = line.toUpperCase()
        if (upper.startsWith("TITLE")) continue
        if (upper.startsWith("LUT_1D_SIZE")) throw new Error("1D LUTs are not supported, use a 3D .cube LUT")
        if (upper.startsWith("LUT_3D_SIZE")) {
            size = parseInt(line.split(/\s+/)[1], 10)
            continue
        }
        if (upper.startsWith("DOMAIN_MIN")) {
            min = line.split(/\s+/).slice(1, 4).map(Number)
            continue
        }
        if (upper.startsWith("DOMAIN_MAX")) {
            max = line.split(/\s+/).slice(1, 4).map(Number)
            continue
        }
        const parts = line.split(/\s+/)
        if (parts.length >= 3 && !isNaN(Number(parts[0]))) values.push(Number(parts[0]), Number(parts[1]), Number(parts[2]))
    }

    if (!size || size < 2 || size > 128) throw new Error("Missing or invalid LUT_3D_SIZE")
    const count = size * size * size
    if (values.length < count * 3) throw new Error(`LUT has ${values.length / 3} entries, expected ${count}`)

    const data = new Uint8Array(count * 4)
    for (let i = 0; i < count; i++) {
        for (let c = 0; c < 3; c++) {
            const v = (values[i * 3 + c] - min[c]) / (max[c] - min[c] || 1)
            data[i * 4 + c] = Math.round(Math.min(1, Math.max(0, v)) * 255)
        }
        data[i * 4 + 3] = 255
    }
    return { size, data }
}

const lutCache = new Map<string, Promise<Lut | null>>()
/** loads a .cube file through the main process (works in output windows too) */
export function loadLut(path: string): Promise<Lut | null> {
    if (!path) return Promise.resolve(null)
    let promise = lutCache.get(path)
    if (!promise) {
        promise = requestMain(Main.READ_FILE, { path })
            .then((res) => (res?.content ? parseCube(res.content) : null))
            .catch((err) => {
                console.warn("[Mixer] LUT", path, err)
                lutCache.delete(path)
                return null
            })
        lutCache.set(path, promise)
    }
    return promise
}
