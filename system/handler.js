import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url" // <--- Tambahkan pathToFileURL di sini!
import chalk from "chalk"
import serialize from "./helper.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const configPath = path.join(__dirname, "../config.json")

// Fungsi untuk membaca ownerNumber dari config.json
function getOwnerNumber() {
    try {
        if (fs.existsSync(configPath)) {
            const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"))
            return String(cfg.ownerNumber || "").replace(/[^0-9]/g, "")
        }
    } catch (err) {
        console.log(chalk.yellowBright("⚠️ Gagal membaca ownerNumber dari config.json"))
    }
    return ""
}

export default async function handler(sock, rawMessage) {
    try {
        // Serialize pesan menggunakan helper
        const m = await serialize(sock, rawMessage)
        if (!m || !m.message) return
        if (m.chat === "status@broadcast") return

        // Cek Public / Self Mode dari properti socket
        const isPublic = sock.public
        if (!isPublic && !m.fromMe) return

        // Ambil teks / body pesan
        const body = m.body || ""
        if (!body) return

        // Deteksi Prefix & Command Parser
        const prefix = /^[°•π÷×¶∆£¢€¥®™+=|~<>#/.\\!?^&,%]/.test(body) 
            ? body.match(/^[°•π÷×¶∆£¢€¥®™+=|~<>#/.\\!?^&,%]/)[0] 
            : ""
            
        const isCmd = body.startsWith(prefix)
        const command = isCmd ? body.slice(prefix.length).trim().split(/ +/).shift().toLowerCase() : ""
        const args = body.trim().split(/ +/).slice(1)
        const q = args.join(" ")

        if (!isCmd) return

        // Validasi Status Owner berdasarkan config.json & bot session
        const botNumber = sock.user?.id ? sock.user.id.split(":")[0].replace(/[^0-9]/g, "") : ""
        const senderNumber = m.sender.replace(/[^0-9]/g, "")
        const configOwner = getOwnerNumber()
        
        const isOwner = m.fromMe || senderNumber === botNumber || (configOwner && senderNumber === configOwner)

        // System Logging Command
        console.log(
            chalk.gray("[CMD] ") +
            chalk.yellow(m.pushName || "User") + " -> " +
            chalk.cyan(`${prefix}${command}`) +
            chalk.white(` [${m.chat}]`)
        )

        // Dynamic Plugin Loader
        const pluginPath = path.join(__dirname, `../plugins/${command}.js`)

        if (fs.existsSync(pluginPath)) {
            const pluginUrl = pathToFileURL(pluginPath).href
            const plugin = await import(pluginUrl)

            const pluginFunc = plugin.default?.run || plugin.default
            if (typeof pluginFunc === "function") {
                await pluginFunc(sock, m, {
                    args,
                    q,
                    text: q,
                    prefix,
                    command,
                    pushName: m.pushName,
                    isOwner
                })
            }
        }

    } catch (err) {
        console.error(chalk.redBright("[CRITICAL ERROR in handler.js]:"), err)
    }
}
