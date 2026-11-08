import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default {
  name: "Menu Utama",
  command: ["menu", "help", "start"],
  help: ["menu"],
  tags: ["main"],
  category: "Main",

  async run(
    sock,
    m,
    {
      prefix,
      pushName,
      isOwner
    }
  ) {
    try {
      await m.react("🔥")

      const modeStatus = sock.public ? "Public 🌐" : "Self 🔒"
      const userName = pushName || "Pengguna"

      let menuText = `╭━━━〔 *SANJUBOTS PANEL* 〕━━━╮\n`
      menuText += `┃ Halo, *${userName}*! 👋\n`
      menuText += `┣━━━━━━━━━━━━━━━━━━━━━━━━━━━┫\n`
      menuText += `┃ • *Mode:* ${modeStatus}\n`
      menuText += `┃ • *Prefix:* [ ${prefix || "Multi"} ]\n`
      menuText += `┣━━━━━━━━━━━━━━━━━━━━━━━━━━━┫\n`
      menuText += `┃      📋 *LIST COMMAND*    📦\n`
      menuText += `┣━━━━━━━━━━━━━━━━━━━━━━━━━━━┫\n`
      
      menuText += `┃ *[ UTAMA ]*\n`
      menuText += `┃ • ${prefix}menu\n`
      menuText += `┃ • ${prefix}ping\n`
      menuText += `┃\n`
      
      menuText += `┃ *[ OWNER / STATUS GRUP ]*\n`
      menuText += `┃ • ${prefix}swgc / ${prefix}swgb\n`
      menuText += `┃ • ${prefix}setteks <teks>\n`
      menuText += `┃ • ${prefix}setdelay <detik>\n`
      menuText += `┃ • ${prefix}swgcall [teks]\n`
      menuText += `┃ • ${prefix}autoswgc <on/off>\n`
      
      menuText += `╰───────────────────────────╯\n\n`

      // ==========================================
      // PANDUAN PENGGUNAAN FITUR STATUS GRUP
      // ==========================================
      menuText += `📖 *PANDUAN FITUR STATUS:* \n`
      menuText += `1️⃣ *${prefix}swgc* (Kirim status ke grup tempat kamu mengetik perintah ini, cukup reaksi emoji).\n`
      menuText += `2️⃣ *${prefix}setteks* (Menyimpan teks permanen untuk broadcast otomatis/massal).\n`
      menuText += `3️⃣ *${prefix}setdelay* (Mengatur jeda waktu detik per grup, misal \`${prefix}setdelay 1\` untuk 1 detik).\n`
      menuText += `4️⃣ *${prefix}swgcall* (Broadcast ke SEMUA grup. Bisa pakai teks tersimpan atau teks instan, misal \`${prefix}swgcall Halo Woi\` tanpa merusak teks tersimpan).\n`
      menuText += `5️⃣ *${prefix}autoswgc on* (Mengaktifkan broadcast status otomatis background berdasarkan teks & delay tersimpan).\n\n`
      
      menuText += `_⚡ Powered by ReyCodeDGTL & Sanjubots_`

      // Link Grup WhatsApp Kamu
      const linkGroup = "https://chat.whatsapp.com/DAyL7U4Biep2BC5ZMGX6n6?s=cl&p=a&iam=2"
      
      // Ganti dengan URL link gambar dari internet (misal upload ke catbox.moe)
      const thumbUrl = "https://files.catbox.moe/ejy85w.png" 

      // Kirim pesan dengan AdReply Thumbnail
      await sock.sendMessage(
        m.chat,
        {
          text: menuText,
          contextInfo: {
            externalAdReply: {
              title: "🔥 Senjubots Automation Engine",
              body: "ReyCodeDGTL x Senjubots Panel",
              thumbnailUrl: thumbUrl,
              sourceUrl: linkGroup,
              mediaType: 1,
              renderLargerThumbnail: true,
              showAdAttribution: false
            }
          }
        },
        { quoted: m }
      )

    } catch (err) {
      console.error("[MENU ERROR]", err)
      await m.reply(`❌ Gagal memuat menu: ${err.message}`)
    }
  }
}
