import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import * as baileys from 'baileys'

const jidNormalizedUser = baileys.jidNormalizedUser || ((jid) => jid)
const getContentType = baileys.getContentType || ((msg) => Object.keys(msg || {})[0])
const downloadMediaMessage = baileys.downloadMediaMessage || (async () => Buffer.from([]))
const generateWAMessageContent = baileys.generateWAMessageContent || (async () => ({}))
const generateWAMessageFromContent = baileys.generateWAMessageFromContent || ((jid, content) => ({ key: { id: '' }, message: content }))

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATABASE_DIR = path.join(__dirname, '../database')
const LID_FILE = path.join(DATABASE_DIR, 'lidCache.json')
const SWGC_FILE = path.join(DATABASE_DIR, 'autoswgc.json')

if (!fs.existsSync(DATABASE_DIR)) {
    fs.mkdirSync(DATABASE_DIR, { recursive: true })
}

global.lidCache ||= new Map()

function normalizeJid(jid) {
    if (!jid) return ''
    try {
        return jidNormalizedUser(String(jid))
    } catch {
        return String(jid)
    }
}

function loadLidCache() {
    try {
        if (!fs.existsSync(LID_FILE)) return
        const raw = fs.readFileSync(LID_FILE, 'utf8')
        if (!raw.trim()) return
        const data = JSON.parse(raw)
        if (!data || typeof data !== 'object') return
        for (const [lid, pn] of Object.entries(data)) {
            if (!lid || !pn) continue
            global.lidCache.set(normalizeJid(lid), normalizeJid(pn))
        }
    } catch (error) {
        console.error('[LID CACHE LOAD ERROR]', error.message)
    }
}

function saveLidCache() {
    try {
        const data = Object.fromEntries(global.lidCache)
        fs.writeFileSync(LID_FILE, JSON.stringify(data, null, 2), 'utf8')
    } catch (error) {
        console.error('[LID CACHE SAVE ERROR]', error.message)
    }
}

loadLidCache()

function unwrapMessage(message) {
    let current = message
    for (let i = 0; i < 20 && current; i++) {
        if (current.ephemeralMessage?.message) { current = current.ephemeralMessage.message; continue; }
        if (current.viewOnceMessage?.message) { current = current.viewOnceMessage.message; continue; }
        if (current.viewOnceMessageV2?.message) { current = current.viewOnceMessageV2.message; continue; }
        if (current.viewOnceMessageV2Extension?.message) { current = current.viewOnceMessageV2Extension.message; continue; }
        if (current.documentWithCaptionMessage?.message) { current = current.documentWithCaptionMessage.message; continue; }
        if (current.editedMessage?.message) { current = current.editedMessage.message; continue; }
        if (current.associatedChildMessage?.message) { current = current.associatedChildMessage.message; continue; }
        break
    }
    return current || {}
}

function parseJsonSafe(value) {
    if (!value) return null
    if (typeof value === 'object') return value
    if (typeof value !== 'string') return null
    try { return JSON.parse(value) } catch { return null }
}

function getMessageText(message = {}) {
    const type = getContentType(message)
    if (!type) return ''
    const msg = message[type]
    if (!msg) return ''

    switch (type) {
        case 'conversation': return msg || ''
        case 'extendedTextMessage': return msg.text || ''
        case 'imageMessage': case 'videoMessage': case 'documentMessage': case 'audioMessage': case 'stickerMessage': return msg.caption || ''
        case 'buttonsResponseMessage': return msg.selectedButtonId || ''
        case 'listResponseMessage': return msg.singleSelectReply?.selectedRowId || ''
        case 'templateButtonReplyMessage': return msg.selectedId || ''
        case 'interactiveResponseMessage': {
            const params = parseJsonSafe(msg.nativeFlowResponseMessage?.paramsJson)
            return String(params?.id || params?.command || params?.cmd || '')
        }
        case 'reactionMessage': return msg.text || ''
        case 'contactMessage': return msg.displayName || ''
        case 'contactsArrayMessage': return msg.contacts?.map(v => v.displayName || '').filter(Boolean).join(', ') || ''
        case 'locationMessage': case 'liveLocationMessage': return `${msg.degreesLatitude}, ${msg.degreesLongitude}`
        case 'pollCreationMessage': case 'pollUpdateMessage': return msg.name || ''
        case 'groupInviteMessage': return msg.groupJid || ''
        case 'interactiveMessage': return msg.body?.text || msg.header?.title || '[Pesan interaktif]'
        case 'protocolMessage': return '[Pesan sistem]'
        default: return msg.caption || msg.text || ''
    }
}

async function updateLidCache(sock, jid) {
    if (!jid || !jid.endsWith('@g.us')) return
    try {
        const metadata = await sock.groupMetadata(jid)
        if (!metadata?.participants) return
        let changed = false
        for (const participant of metadata.participants) {
            if (!participant.id || !participant.lid) continue
            const lid = normalizeJid(participant.lid)
            const pn = normalizeJid(participant.id)
            if (!lid || !pn) continue
            if (global.lidCache.get(lid) !== pn) {
                global.lidCache.set(lid, pn)
                changed = true
            }
        }
        if (changed) saveLidCache()
    } catch {}
}

function resolveLid(jid) {
    if (jid && jid.endsWith('@lid')) {
        return global.lidCache.get(jid) || jid
    }
    return jid
}

function getSender(sock, message) {
    if (!message?.key) return ''
    const fromMe = !!message.key.fromMe
    const chat = message.key.remoteJid || ''
    const isGroup = chat.endsWith('@g.us')
    let sender

    if (fromMe) {
        const rawId = sock.user?.id || sock.user?.jid || ''
        sender = rawId.split(':')[0] ? `${rawId.split(':')[0]}@s.whatsapp.net` : rawId
    } else if (isGroup) {
        sender = message.key.participant || message.participant || ''
    } else {
        sender = chat
    }
    return resolveLid(normalizeJid(sender))
}

async function createQuoted(sock, m) {
    const context = m.msg?.contextInfo
    const quotedMessage = context?.quotedMessage
    if (!quotedMessage) return null

    let type = getContentType(quotedMessage)
    if (!type) return null
    let quoted = quotedMessage[type]

    if (type === 'productMessage') {
        type = getContentType(quoted || {})
        quoted = quoted?.[type]
    }
    if (!quoted) return null
    if (typeof quoted === 'string') quoted = { text: quoted }

    const sender = resolveLid(normalizeJid(context.participant || ''))

    const quotedObject = {
        ...quoted,
        mtype: type,
        id: context.stanzaId || '',
        sender,
        fromMe: sender === normalizeJid(sock.user?.id),
        text: quoted.text || quoted.caption || quoted.conversation || '',
        isMedia: ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'].includes(type),
        isImage: type === 'imageMessage',
        isVideo: type === 'videoMessage',
        isAudio: type === 'audioMessage',
        isDocument: type === 'documentMessage',
        isSticker: type === 'stickerMessage'
    }

    quotedObject.download = async () => {
        return downloadMediaMessage({
            key: { remoteJid: m.chat, id: quotedObject.id, participant: quotedObject.sender },
            message: { [quotedObject.mtype]: quotedObject }
        }, 'buffer', {})
    }

    return quotedObject
}

async function serialize(sock, message) {
    if (!message) return message
    const m = message

    if (m.key) {
        m.id = m.key.id || ''
        m.chat = m.key.remoteJid || ''
        m.fromMe = !!m.key.fromMe
        m.isGroup = m.chat.endsWith('@g.us')
        m.isBot = !!(m.id?.startsWith('BAE5') && m.id?.length === 16)
        m.sender = getSender(sock, m)

        if (m.isGroup) {
            await updateLidCache(sock, m.chat)
            m.sender = resolveLid(m.sender)
        }
        if (m.chat.endsWith('@lid') && !m.isGroup) {
            m.chat = resolveLid(m.chat)
        }
    }

    if (!m.message) return m

    const raw = unwrapMessage(m.message)
    m.rawMessage = raw
    m.mtype = getContentType(raw) || ''
    m.type = m.mtype
    m.msg = m.mtype ? raw[m.mtype] : {}

    if (m.mtype === 'viewOnceMessage' || m.mtype === 'viewOnceMessageV2') {
        const inner = m.msg?.message || {}
        const innerType = getContentType(inner)
        if (innerType) {
            m.msg = inner[innerType]
            m.innerType = innerType
        }
    }

    if (!m.msg) m.msg = {}

    m.body = getMessageText(raw)
    m.text = m.body
    m.pushName = m.pushName || m.key?.pushName || ''
    m.mentionedJid = m.msg?.contextInfo?.mentionedJid || []
    m.quoted = await createQuoted(sock, m)

    m.isMedia = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'].includes(m.mtype)
    m.isImage = m.mtype === 'imageMessage'
    m.isVideo = m.mtype === 'videoMessage'
    m.isAudio = m.mtype === 'audioMessage'
    m.isDocument = m.mtype === 'documentMessage'
    m.isSticker = m.mtype === 'stickerMessage'

    m.reply = async (text, options = {}) => {
        return sock.sendMessage(m.chat, { text: String(text), ...options }, { quoted: m })
    }

    m.react = async emoji => {
        return sock.sendMessage(m.chat, { react: { text: String(emoji), key: m.key } })
    }

    m.delete = async () => {
        if (!m.key) return null
        return sock.sendMessage(m.chat, { delete: m.key })
    }

    m.download = async () => {
        if (!m.isMedia) throw new Error('Pesan ini bukan media.')
        return downloadMediaMessage(m, 'buffer', {})
    }

    return m
}

async function groupStatus(sock, jid, content = {}) {
    if (!sock || !jid || !content) return null
    try {
        const inside = await generateWAMessageContent(content, { upload: sock.waUploadToServer })
        const messageSecret = crypto.randomBytes(32)
        const msg = generateWAMessageFromContent(jid, {
            messageContextInfo: { messageSecret },
            groupStatusMessageV2: {
                message: { ...inside, messageContextInfo: { messageSecret } }
            }
        }, {})
        await sock.relayMessage(jid, msg.message, { messageId: msg.key.id })
        return msg.key.id
    } catch (error) {
        console.error('[SWGC ERROR]', error.message)
        return null
    }
}

function defaultSwgcDB() {
    return { active: false, text: '', interval: 60 }
}

function loadDB() {
    try {
        if (!fs.existsSync(SWGC_FILE)) {
            const data = defaultSwgcDB()
            fs.writeFileSync(SWGC_FILE, JSON.stringify(data, null, 2), 'utf8')
            return data
        }
        const data = JSON.parse(fs.readFileSync(SWGC_FILE, 'utf8'))
        return { ...defaultSwgcDB(), ...(data || {}) }
    } catch (error) {
        console.error('[SWGC DB ERROR]', error.message)
        return defaultSwgcDB()
    }
}

function saveDB(data) {
    try {
        fs.writeFileSync(SWGC_FILE, JSON.stringify({ ...defaultSwgcDB(), ...(data || {}) }, null, 2), 'utf8')
        return true
    } catch (error) {
        console.error('[SWGC DB SAVE ERROR]', error.message)
        return false
    }
}

let autoSwgcTimer = null
let autoSwgcRunning = false

function startAutoSwgc(sock) {
    if (!sock || autoSwgcTimer) return
    const db = loadDB()
    const interval = Math.max(1, Number(db.interval || 60))

    autoSwgcTimer = setInterval(async () => {
        if (autoSwgcRunning) return
        const current = loadDB()
        if (!current.active || !String(current.text || '').trim()) return
        autoSwgcRunning = true

        try {
            const groups = await sock.groupFetchAllParticipating()
            const ids = Object.keys(groups || {})
            for (const jid of ids) {
                if (!jid.endsWith('@g.us')) continue
                await groupStatus(sock, jid, { text: String(current.text) })
                await new Promise(resolve => setTimeout(resolve, 1500))
            }
            console.log(`[AUTO SWGC] Terkirim ke ${ids.length} group`)
        } catch (error) {
            console.error('[AUTO SWGC ERROR]', error.message)
        } finally {
            autoSwgcRunning = false
        }
    }, interval * 60 * 1000)
}

export { serialize, groupStatus, startAutoSwgc, saveDB, loadDB, normalizeJid }
export default serialize
