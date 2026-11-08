import { groupStatus } from "../system/helper.js"

export default {
  name: "Status Grup",
  command: ["swgc", "swgb"],
  help: ["swgc"],
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
    if (!m.isGroup) return m.reply("❌ Perintah ini khusus digunakan di dalam grup!")

    const q = m.quoted || m
    const mime = q.mimetype || q.msg?.mimetype || ""
    const isMedia = /image|video|audio/.test(mime) || q.isMedia

    let mediaBuffer = null
    if (isMedia && typeof q.download === "function") {
      mediaBuffer = await q.download()
    }

    const statusText = text?.trim() || q.text || ""

    // Bungkus konten untuk helper groupStatus
    let content = {}
    if (isMedia && mediaBuffer) {
      if (/image/.test(mime) || q.isImage) {
        content = { image: mediaBuffer, caption: statusText }
      } else if (/video/.test(mime) || q.isVideo) {
        content = { video: mediaBuffer, caption: statusText, mimetype: "video/mp4" }
      } else if (/audio/.test(mime) || q.isAudio) {
        content = { audio: mediaBuffer, mimetype: "audio/mp4", ptt: false }
      }
    } else {
      content = { text: statusText || "ReyCloud Bot Status" }
    }

    await m.react("⏳")
    try {
      await groupStatus(sock, m.chat, content)
      await m.react("✅")
    } catch (err) {
      await m.react("❌")
      console.error("[SWGC ERROR]", err)
    }
  }
}
