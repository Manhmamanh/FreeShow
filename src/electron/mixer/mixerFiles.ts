// Mixer page file helpers (main process):
// - ISO recordings: every camera is recorded by its own MediaRecorder in the main window and streamed here in chunks
// - Instant replay: the last seconds (independent segments) are joined into one clip with FFmpeg

import { execFile } from "child_process"
import fs from "fs"
import path from "path"
import { resolveFfmpegPath } from "../streaming/ffmpegManager"
import { createFolder, getDataFolderPath, openInSystem } from "../utils/files"

const safeName = (name: string) => (name || "clip").replace(/[\\/:*?"<>|]/g, "_").slice(0, 120)

function mixerFolder(sub: "iso" | "replay", customFolder?: string) {
    const root = customFolder ? createFolder(customFolder) : getDataFolderPath("recordings")
    return createFolder(path.join(root, sub === "iso" ? "Mixer ISO" : "Mixer Replay"))
}

// ----- ISO -----

const openFiles = new Map<string, string>() // recording id -> file path
let isoFolderOpened = false

export function mixerIsoChunk(data: { id: string; name: string; data: ArrayBuffer; done?: boolean; folder?: string }): string {
    let filePath = openFiles.get(data.id)
    if (!filePath) {
        filePath = path.join(mixerFolder("iso", data.folder), safeName(data.name))
        openFiles.set(data.id, filePath)
    }

    try {
        if (data.data?.byteLength) fs.appendFileSync(filePath, Buffer.from(data.data))
    } catch (err) {
        console.error("[Mixer] Could not write ISO chunk:", err)
    }

    if (data.done) {
        openFiles.delete(data.id)
        if (!isoFolderOpened) {
            isoFolderOpened = true
            openInSystem(path.dirname(filePath))
        }
    }

    return filePath
}

// ----- REPLAY -----

export async function mixerSaveReplay(data: { name: string; extension: string; segments: ArrayBuffer[]; folder?: string }): Promise<{ path: string; error?: string }> {
    const folder = mixerFolder("replay", data.folder)
    const extension = data.extension === "mp4" ? "mp4" : "webm"
    const base = safeName(data.name)
    const output = path.join(folder, `${base}.${extension}`)
    const segments = (data.segments || []).filter((s) => s?.byteLength)
    if (!segments.length) return { path: "", error: "No replay data" }

    // one segment: no joining needed
    if (segments.length === 1) {
        fs.writeFileSync(output, Buffer.from(segments[0]))
        return { path: output }
    }

    const tempDir = fs.mkdtempSync(path.join(folder, ".tmp_"))
    const cleanup = () => {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true })
        } catch {
            // ignore
        }
    }

    try {
        const files = segments.map((segment, i) => {
            const file = path.join(tempDir, `part${String(i).padStart(3, "0")}.${extension}`)
            fs.writeFileSync(file, Buffer.from(segment))
            return file
        })

        const ffmpeg = await resolveFfmpegPath()
        if (!ffmpeg) {
            // without FFmpeg, keep the newest segment so the operator still gets a (shorter) replay
            fs.copyFileSync(files[files.length - 1], output)
            cleanup()
            return { path: output, error: "FFmpeg not found: replay is shorter than requested" }
        }

        const list = path.join(tempDir, "list.txt")
        fs.writeFileSync(list, files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n"))

        await new Promise<void>((resolve, reject) => {
            // stream copy: segments come from the same encoder, so no re-encoding is needed
            execFile(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", output], { timeout: 60000 }, (err, _stdout, stderr) => {
                if (err) reject(new Error(stderr || err.message))
                else resolve()
            })
        })

        cleanup()
        return { path: output }
    } catch (err: any) {
        console.error("[Mixer] Replay join failed:", err)
        cleanup()
        return { path: "", error: String(err?.message || err) }
    }
}
