// CI check: every packaged app.asar must match the hashes stored in its header (and the header hash in Info.plist).
// A mismatch makes Electron quit at launch with exit code 1 and no message (asar integrity validation).
// Usage: node scripts/ci/verifyAsar.js <folder with packaged apps, e.g. dist>

const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const asar = require("@electron/asar")

function findAsars(dir, found = []) {
    if (!fs.existsSync(dir)) return found
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory() && !entry.name.endsWith(".unpacked")) findAsars(full, found)
        else if (entry.isFile() && entry.name === "app.asar") found.push(full)
    }
    return found
}

function verify(file) {
    const raw = asar.getRawHeader(file)
    const fd = fs.openSync(file, "r")
    const base = 8 + raw.headerSize
    const problems = []
    let checked = 0

    const walk = (node, prefix) => {
        for (const [name, entry] of Object.entries(node.files || {})) {
            const p = `${prefix}/${name}`
            if (entry.files) walk(entry, p)
            else if (!entry.unpacked && entry.offset !== undefined && entry.integrity?.hash) {
                const buf = Buffer.alloc(entry.size)
                fs.readSync(fd, buf, 0, entry.size, base + Number(entry.offset))
                const hash = crypto.createHash("sha256").update(buf).digest("hex")
                checked++
                if (hash !== entry.integrity.hash) problems.push(p)
            }
        }
    }
    walk(raw.header, "")
    fs.closeSync(fd)

    // header hash vs Info.plist (macOS)
    const plist = path.join(path.dirname(path.dirname(file)), "Info.plist")
    if (fs.existsSync(plist)) {
        const text = fs.readFileSync(plist, "utf8")
        const match = /<key>hash<\/key>\s*<string>([0-9a-f]{64})<\/string>/.exec(text)
        const headerHash = crypto.createHash("sha256").update(raw.headerString).digest("hex")
        if (match && match[1] !== headerHash) problems.unshift(`Info.plist ElectronAsarIntegrity ${match[1]} != header ${headerHash}`)
    }

    return { checked, problems }
}

const root = process.argv[2] || "dist"
const files = findAsars(root)
if (!files.length) {
    console.error(`No app.asar found in ${root}`)
    process.exit(1)
}

let failed = false
for (const file of files) {
    const { checked, problems } = verify(file)
    if (problems.length) {
        failed = true
        console.error(`✗ ${file}: ${problems.length} problem(s), first: ${problems.slice(0, 5).join(", ")}`)
    } else {
        console.info(`✓ ${file}: ${checked} files match their hashes`)
    }
}
process.exit(failed ? 1 : 0)
