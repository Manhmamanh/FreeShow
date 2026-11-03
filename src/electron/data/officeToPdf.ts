// Convert office documents (Word, Excel, PowerPoint, Keynote, Pages, Numbers, OpenDocument) to PDF,
// so they can be shown like any PDF. Tries, in order:
//   1. LibreOffice (free, all formats, all platforms)
//   2. macOS: Keynote / Pages / Numbers (free on every Mac)
//   3. Microsoft PowerPoint / Word / Excel (if installed)

import { execFile } from "child_process"
import fs from "fs"
import path from "path"
import { promisify } from "util"
import { isMac, isWindows } from ".."
import { getDataFolderPath, sanitizeFileName } from "../utils/files"

const execFileAsync = promisify(execFile)

export const officeExtensions = ["ppt", "pptx", "key", "odp", "doc", "docx", "rtf", "pages", "odt", "xls", "xlsx", "csv", "numbers", "ods"]

type Kind = "slides" | "document" | "sheet"
function kindOf(extension: string): Kind {
    if (["ppt", "pptx", "key", "odp"].includes(extension)) return "slides"
    if (["xls", "xlsx", "csv", "numbers", "ods"].includes(extension)) return "sheet"
    return "document"
}

const SOFFICE_PATHS: Record<string, string[]> = {
    win32: [path.join(process.env.PROGRAMFILES || "C:\\Program Files", "LibreOffice", "program", "soffice.exe"), path.join(process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "LibreOffice", "program", "soffice.exe")],
    darwin: ["/Applications/LibreOffice.app/Contents/MacOS/soffice"],
    linux: ["/usr/bin/soffice", "/usr/bin/libreoffice"]
}
const sofficePath = () => (SOFFICE_PATHS[process.platform] || []).find((p) => fs.existsSync(p)) || "soffice"

async function withLibreOffice(input: string, output: string): Promise<boolean> {
    try {
        await execFileAsync(sofficePath(), ["--headless", "--convert-to", "pdf", "--outdir", path.dirname(output), input], { timeout: 180000 })
        // LibreOffice names the file after the input
        const produced = path.join(path.dirname(output), path.basename(input, path.extname(input)) + ".pdf")
        if (produced !== output && fs.existsSync(produced)) fs.renameSync(produced, output)
        return fs.existsSync(output)
    } catch {
        return false
    }
}

const appleQuote = (p: string) => p.replace(/\\/g, "\\\\").replace(/"/g, '\\"')

/** Keynote, Pages and Numbers share the same AppleScript export command */
async function withIWork(input: string, output: string, kind: Kind): Promise<boolean> {
    if (!isMac) return false
    const app = kind === "slides" ? "Keynote" : kind === "sheet" ? "Numbers" : "Pages"
    if (!fs.existsSync(`/Applications/${app}.app`)) return false

    const script = [`tell application "${app}"`, `set theDoc to open (POSIX file "${appleQuote(input)}")`, `export theDoc to (POSIX file "${appleQuote(output)}") as PDF`, `close theDoc saving no`, `end tell`].join("\n")
    try {
        await execFileAsync("osascript", ["-e", script], { timeout: 180000 })
    } catch (err) {
        console.warn(`[Office] ${app} export failed:`, err)
    }
    return fs.existsSync(output)
}

async function withMicrosoft(input: string, output: string, kind: Kind): Promise<boolean> {
    try {
        if (isWindows) {
            const scripts: Record<Kind, string> = {
                slides: `param($in,$out); $a = New-Object -ComObject PowerPoint.Application; try { $d = $a.Presentations.Open([IO.Path]::GetFullPath($in), -1, 0, 0); $d.SaveAs([IO.Path]::GetFullPath($out), 32); $d.Close() } finally { $a.Quit() }`,
                document: `param($in,$out); $a = New-Object -ComObject Word.Application; try { $d = $a.Documents.Open([IO.Path]::GetFullPath($in), $false, $true); $d.ExportAsFixedFormat([IO.Path]::GetFullPath($out), 17); $d.Close(0) } finally { $a.Quit() }`,
                sheet: `param($in,$out); $a = New-Object -ComObject Excel.Application; $a.DisplayAlerts = $false; try { $d = $a.Workbooks.Open([IO.Path]::GetFullPath($in), 0, $true); $d.ExportAsFixedFormat(0, [IO.Path]::GetFullPath($out)); $d.Close($false) } finally { $a.Quit() }`
            }
            await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", scripts[kind], input, output], { timeout: 180000 })
        } else if (isMac) {
            const app = kind === "slides" ? "Microsoft PowerPoint" : kind === "sheet" ? "Microsoft Excel" : "Microsoft Word"
            if (!fs.existsSync(`/Applications/${app}.app`)) return false
            const i = appleQuote(input)
            const o = appleQuote(output)
            const scripts: Record<Kind, string> = {
                slides: `tell application "${app}"\nset theDoc to open (POSIX file "${i}")\nsave theDoc in (POSIX file "${o}") as save as PDF\nclose theDoc saving no\nend tell`,
                document: `tell application "${app}"\nopen (POSIX file "${i}")\nset theDoc to active document\nsave as theDoc file name "${o}" file format format PDF\nclose theDoc saving no\nend tell`,
                sheet: `tell application "${app}"\nopen (POSIX file "${i}")\nset theDoc to active workbook\nsave theDoc in "${o}" as PDF file format\nclose theDoc saving no\nend tell`
            }
            await execFileAsync("osascript", ["-e", scripts[kind]], { timeout: 180000 })
        }
    } catch (err) {
        console.warn("[Office] Microsoft Office export failed:", err)
    }
    return fs.existsSync(output)
}

export async function officeToPdf(data: { paths: string[] }): Promise<{ pdfs: string[]; failed: string[] }> {
    const folder = getDataFolderPath("imports", "Documents")
    const pdfs: string[] = []
    const failed: string[] = []

    for (const input of data.paths || []) {
        if (!input || !fs.existsSync(input)) {
            failed.push(input)
            continue
        }
        const extension = path.extname(input).slice(1).toLowerCase()
        const kind = kindOf(extension)
        const output = path.join(folder, `${sanitizeFileName(path.basename(input, path.extname(input)))}.pdf`)
        if (fs.existsSync(output)) fs.unlinkSync(output)

        const ok = (await withLibreOffice(input, output)) || (await withIWork(input, output, kind)) || (await withMicrosoft(input, output, kind))
        if (ok) pdfs.push(output)
        else failed.push(input)
    }

    return { pdfs, failed }
}
