import { groupStatus, loadDB, saveDB } from "../system/helper.js"

export default {
  name: "Broadcast Status Group",
  command: ["setteks", "setdelay", "swgcall", "autoswgc"],
  help: ["setteks", "setdelay", "swgcall", "autoswgc"],
  tags: ["owner"],
  category: "Owner",
  isOwner: true,

  async run(
    sock,
    m,
    {
      text,
      prefix,
      command,
      isOwner,
      args
    }
  ) {
    if (!isOwner) return m.reply("❌ Khusus owner!")

    const cmd = command.toLowerCase()
    let db = loadDB()

    // ==========================================
    // 1. SETTEKS (Menyimpan Teks Broadcast Permanen)
    // ==========================================
    if (cmd === "setteks") {
      const newText = text?.trim()
      if (!newText) {
        return m.reply(
          `❌ Masukkan teksnya!\n\n*Contoh:*\n\`${prefix}setteks Halo, ini teks status otomatis bot.\``
        )
      }

      db.text = newText
      saveDB(db)
      return m.reply(`✅ Teks permanen berhasil disimpan!\n\n📝 *Isi Teks:*\n${newText}`)
    }

    // ==========================================
    // 2. SETDELAY (Mengatur Jeda Waktu dalam Detik)
    // ==========================================
    if (cmd === "setdelay") {
      const seconds = Number(args[0])
      if (isNaN(seconds) || seconds < 1) {
        return m.reply(
          `❌ Masukkan angka detik yang valid!\n\n*Contoh (1 detik):*\n\`${prefix}setdelay 1\``
        )
      }

      db.delay = seconds
      saveDB(db)
      return m.reply(`✅ Jeda (delay) berhasil diatur ke *${seconds} detik* per grup.`)
    }

    // ==========================================
    // 3. SWGCALL (Broadcast Manual: Support Teks Inline & Tersimpan)
    // ==========================================
    if (cmd === "swgcall") {
      // Cek apakah user nulis teks langsung (misal: .swgcall tes woi)
      // Jika tidak ada, fallback pakai teks tersimpan dari setteks (db.text)
      const inlineText = text?.trim()
      const broadcastText = inlineText || db.text

      if (!broadcastText) {
        return m.reply(`❌ Teks belum ada! Silakan ketik \`${prefix}swgcall <teks>\` atau atur dulu pakai \`${prefix}setteks <teks>\``)
      }

      await m.react("⏳")
      try {
        const groups = await sock.groupFetchAllParticipating()
        const groupIds = Object.keys(groups || {}).filter(jid => jid.endsWith('@g.us'))

        if (!groupIds.length) {
          await m.react("❌")
          return m.reply("❌ Bot tidak bergabung di grup manapun!")
        }

        const delaySec = Number(db.delay || 2) // Default 2 detik
        await m.reply(`🚀 Mengirim status ke *${groupIds.length}* grup\n⏱️ Jeda: *${delaySec} detik/grup*...`)

        let success = 0
        let fail = 0

        for (const jid of groupIds) {
          try {
            await groupStatus(sock, jid, { text: broadcastText })
            success++
            await new Promise(r => setTimeout(r, delaySec * 1000))
          } catch (err) {
            fail++
            console.error(`[SWGCALL FAIL] ${jid}:`, err.message)
          }
        }

        await m.react("✅")
        return m.reply(
          `✅ Broadcast Selesai!\n\n` +
          `📊 *Laporan:*\n` +
          `• Berhasil: ${success} grup\n` +
          `• Gagal: ${fail} grup`
        )
      } catch (err) {
        await m.react("❌")
        return m.reply(`❌ Gagal broadcast: ${err.message}`)
      }
    }

    // ==========================================
    // 4. AUTOSWGC (Cek Status / On / Off Background Task)
    // ==========================================
    if (cmd === "autoswgc") {
      const action = args[0]?.toLowerCase()

      if (!action) {
        return m.reply(
          `⚙️ *STATUS AUTO SWGC*:\n\n` +
          `• Status: *${db.active ? "AKTIF ✅" : "MATI ❌"}*\n` +
          `• Jeda: *${db.delay || 2} detik*\n` +
          `• Teks Tersimpan (Setteks): ${db.text || "(Belum diset)"}\n\n` +
          `*Cara Pakai:*\n` +
          `• \`${prefix}autoswgc on\`\n` +
          `• \`${prefix}autoswgc off\``
        )
      }

      if (action === "on") {
        if (!db.text) return m.reply(`❌ Set teks permanennya dulu pakai \`${prefix}setteks\`!`)
        db.active = true
        saveDB(db)
        return m.reply("✅ Auto SWGC berhasil diaktifkan!")
      }

      if (action === "off") {
        db.active = false
        saveDB(db)
        return m.reply("❌ Auto SWGC berhasil dimatikan.")
      }
    }
  }
}
