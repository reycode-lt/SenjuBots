import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from 'baileys';
import readline from 'readline';
import pino from 'pino';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import handler from './handler.js';
import { startAutoSwgc } from './helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SESSION_DIR = path.join(__dirname, '../session');
const configPath = path.join(__dirname, '../config.json');

function getPublicStatus() {
    try {
        if (fs.existsSync(configPath)) {
            const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (typeof cfg.public === 'boolean') return cfg.public;
        }
    } catch (err) {}
    return true;
}

const question = (text) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => rl.question(text, (ans) => { rl.close(); resolve(ans.trim()); }));
};

export default async function startBot() {
    if (!fs.existsSync(SESSION_DIR)) {
        fs.mkdirSync(SESSION_DIR, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "120.0.0.0"]
    });

    sock.public = getPublicStatus();

    // Minta nomor dan tampilkan custom pairing code SANJU123 jika belum terdaftar
    if (!sock.authState.creds.registered) {
        let phoneNumber = await question(chalk.yellowBright('\nMasukkan Nomor WhatsApp (Format: 62xxxxxx):\n> '));
        phoneNumber = phoneNumber.replace(/\D/g, '');
        
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                code = code?.match(/.{1,4}/g)?.join('-') || code;
                
                console.log("\n" + chalk.cyanBright("╭────────────────────────────────╮"));
                console.log(chalk.cyanBright("│      SANJU123 PAIRING CODE     │"));
                console.log(chalk.cyanBright("├────────────────────────────────┤"));
                console.log(chalk.white(`│ Nomor : ${phoneNumber}`));
                console.log(chalk.cyanBright("├────────────────────────────────┤"));
                console.log(chalk.greenBright(`│ Kode  : ${code}         │`));
                console.log(chalk.cyanBright("╰────────────────────────────────╯\n"));
            } catch (err) {
                console.error(chalk.redBright('Gagal meminta pairing code:'), err);
            }
        }, 3000);
    }

    // Otomatis simpan kredensial sesi
    sock.ev.on('creds.update', saveCreds);

    // Monitoring status koneksi
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            console.log(chalk.greenBright('\n╭────────────────────────────────╮'));
            console.log(chalk.greenBright('│    REYCODEDGTL & SANJUBOTS     │'));
            console.log(chalk.greenBright('├────────────────────────────────┤'));
            console.log(chalk.greenBright('│    ✅ CONNECTED (BAILEYS)      │'));
            console.log(chalk.greenBright('╰────────────────────────────────╯\n'));
            
            startAutoSwgc(sock);
        } else if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(chalk.redBright('Koneksi terputus, mencoba menghubungkan ulang...'));
            if (shouldReconnect) startBot();
        }
    });

    // Menghubungkan handler pesan masuk
    sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            if (!chatUpdate?.messages?.length) return;
            for (const msg of chatUpdate.messages) {
                if (!msg?.message) continue;
                if (msg.key?.remoteJid === 'status@broadcast') continue;
                
                await handler(sock, msg);
            }
        } catch (err) {
            console.error(chalk.redBright('[ ERROR messages.upsert ]'), err);
        }
    });

    return sock;
}
