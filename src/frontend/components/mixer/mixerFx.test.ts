import { describe, expect, it, vi } from "vitest"

vi.mock("../../IPC/main", () => ({ requestMain: () => Promise.resolve(null) }))

import { cssFilter, hexToRgb, isFxActive, parseCube } from "./mixerFx"

describe("parseCube", () => {
    it("reads a 2x2x2 identity LUT (red fastest)", () => {
        const text = ['TITLE "identity"', "# comment", "LUT_3D_SIZE 2", "0 0 0", "1 0 0", "0 1 0", "1 1 0", "0 0 1", "1 0 1", "0 1 1", "1 1 1"].join("\n")
        const lut = parseCube(text)
        expect(lut.size).toBe(2)
        expect(Array.from(lut.data.slice(0, 8))).toEqual([0, 0, 0, 255, 255, 0, 0, 255])
        expect(Array.from(lut.data.slice(28, 32))).toEqual([255, 255, 255, 255])
    })
    it("applies DOMAIN_MIN/MAX and clamps", () => {
        const values = Array.from({ length: 8 }, () => "2 -1 5").join("\n")
        const lut = parseCube(`LUT_3D_SIZE 2\nDOMAIN_MIN 0 0 0\nDOMAIN_MAX 4 4 4\n${values}`)
        expect(Array.from(lut.data.slice(0, 4))).toEqual([128, 0, 255, 255])
    })
    it("rejects 1D and incomplete LUTs", () => {
        expect(() => parseCube("LUT_1D_SIZE 4\n0 0 0")).toThrow()
        expect(() => parseCube("LUT_3D_SIZE 2\n0 0 0")).toThrow()
    })
})

describe("filter state", () => {
    it("is inactive by default and with default values", () => {
        expect(isFxActive(undefined)).toBe(false)
        expect(isFxActive({ brightness: 0, contrast: 1, chroma: { enabled: false, color: "#00ff00", similarity: 0.3, smoothness: 0.1, spill: 0.1 } })).toBe(false)
    })
    it("is active with chroma, LUT or a colour change", () => {
        expect(isFxActive({ chroma: { enabled: true, color: "#00ff00", similarity: 0.3, smoothness: 0.1, spill: 0.1 } })).toBe(true)
        expect(isFxActive({ lut: { path: "/a.cube", intensity: 1 } })).toBe(true)
        expect(isFxActive({ lut: { path: "/a.cube", intensity: 0 } })).toBe(false)
        expect(isFxActive({ saturation: 1.4 })).toBe(true)
    })
    it("builds a CSS fallback for thumbnails", () => {
        expect(cssFilter({ brightness: 0.2, saturation: 0 })).toBe("brightness(1.200) saturate(0.000)")
        expect(cssFilter({})).toBe("")
    })
    it("parses key colours", () => {
        expect(hexToRgb("#00ff00")).toEqual([0, 1, 0])
        expect(hexToRgb("bad")).toEqual([0, 1, 0])
    })
})
