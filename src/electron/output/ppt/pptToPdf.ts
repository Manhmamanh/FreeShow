import fs from "fs"
import { isMac, isWindows } from "../.."
import { ToMain } from "../../../types/IPC/ToMain"
import { sendToMain } from "../../IPC/main"
import { openURL } from "../../IPC/responsesMain"
import { officeExtensions, officeToPdf } from "../../data/officeToPdf"
import { selectFilesDialog } from "../../utils/files"

export async function pptToPdf() {
    const files = await selectFilesDialog("", { name: "PowerPoint / Keynote / Word / Excel", extensions: officeExtensions }, false)
    if (!files.length) return

    processPptToPdf(files[0])
}

async function processPptToPdf(inputPath: string) {
    if (!fs.existsSync(inputPath) || !fs.lstatSync(inputPath).isFile()) {
        sendToMain(ToMain.TOAST, "Input file does not exist or is a directory")
        return
    }

    sendToMain(ToMain.ALERT, "popup.importing")

    // LibreOffice, then (Mac) Keynote/Pages/Numbers, then Microsoft Office
    const { pdfs } = await officeToPdf({ paths: [inputPath] })
    if (pdfs.length) {
        sendToMain(ToMain.IMPORT2, { channel: "pdf", data: pdfs })
        return
    }

    // nothing could convert it -> alert user and open LibreOffice download link
    sendToMain(ToMain.ALERT, isWindows ? "LibreOffice or Microsoft Office is not installed or not found in default location.<br>Upon LibreOffice installation, it's recommended to enable the 'Add to PATH' option." : isMac ? "Could not convert the file. Keynote/Pages/Numbers (App Store, free), LibreOffice or Microsoft Office is needed." : "LibreOffice is not installed or not found")
    setTimeout(() => openURL("https://www.libreoffice.org/download/"), 500)
}
