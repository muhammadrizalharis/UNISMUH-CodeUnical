#!/usr/bin/env node
/**
 * CodeUnical Guard — bot ops Telegram (long polling, tanpa webhook/ngrok).
 * Memantau layanan inti dan mengirim alert: 🔴 PADAM / 🟢 PULIH (padam ±N menit).
 * Perintah: /status /help. Hanya melayani chat TELEGRAM_CHAT_ID.
 *
 * Konfigurasi dibaca dari ~/CodeUnical/api/.env (TIDAK di-commit):
 *   TELEGRAM_BOT_TOKEN=...   (dari BotFather — RAHASIA)
 *   TELEGRAM_CHAT_ID=...     (chat tujuan; kosongkan dulu -> bot balas chat id saat di-/start)
 *
 * Jalankan via systemd --user: codeunical-guard.service.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import net from 'node:net';

const HOME = homedir();

// Baca .env project (nilai bisa mengandung kutip/spasi liar -> bersihkan).
function readEnv() {
  const raw = readFileSync(join(HOME, 'CodeUnical', 'api', '.env'), 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^"/, '').replace(/"\s*$/, '').trim();
  }
  return env;
}

const env = readEnv();
const TOKEN = env.TELEGRAM_BOT_TOKEN;
let CHAT_ID = env.TELEGRAM_CHAT_ID || '';
const API = `https://api.telegram.org/bot${TOKEN}`;
if (!TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN belum diisi di api/.env — bot berhenti.');
  process.exit(1);
}

async function send(chatId, text) {
  await fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 3900) }),
  }).catch(() => {});
}
const notify = (t) => (CHAT_ID ? send(CHAT_ID, t) : Promise.resolve());

// --- health checks ---
function httpUp(url, { timeout = 8000, needOk = false } = {}) {
  return fetch(url, { signal: AbortSignal.timeout(timeout) })
    .then(async (r) => {
      if (!needOk) return r.status > 0; // merespons (404 pun) = server jalan
      if (!r.ok) return false;
      const j = await r.json().catch(() => ({}));
      return j?.ok !== false;
    })
    .catch(() => false);
}
function tcpUp(host, port, timeout = 5000) {
  return new Promise((resolve) => {
    const s = net.connect({ host, port });
    const done = (v) => {
      s.destroy();
      resolve(v);
    };
    s.setTimeout(timeout);
    s.once('connect', () => done(true));
    s.once('timeout', () => done(false));
    s.once('error', () => done(false));
  });
}

const CHECKS = [
  { name: 'API :47080', fn: () => httpUp('http://127.0.0.1:47080/') },
  { name: 'Web :47300', fn: () => httpUp('http://127.0.0.1:47300/') },
  { name: 'Postgres :47432', fn: () => tcpUp('127.0.0.1', 47432) },
  { name: 'MinIO :47900', fn: () => httpUp('http://127.0.0.1:47900/minio/health/live') },
  { name: 'Proctor-AI :47610', fn: () => httpUp('http://127.0.0.1:47610/health', { needOk: true }) },
];

const state = new Map(); // name -> { up, since }
function fmtDur(ms) {
  const m = Math.round(ms / 60000);
  if (m < 1) return '<1 menit';
  if (m < 60) return `${m} menit`;
  const h = Math.floor(m / 60);
  return `${h} jam ${m % 60} mnt`;
}

async function checkAll(announce) {
  const lines = [];
  for (const c of CHECKS) {
    const up = await c.fn();
    lines.push(`${up ? '🟢' : '🔴'} ${c.name}`);
    const prev = state.get(c.name);
    if (!prev) {
      state.set(c.name, { up, since: Date.now() });
      continue;
    }
    if (prev.up !== up) {
      if (announce) {
        await notify(
          up
            ? `🟢 ${c.name} PULIH (padam ±${fmtDur(Date.now() - prev.since)}).`
            : `🔴 ${c.name} PADAM.`,
        );
      }
      state.set(c.name, { up, since: Date.now() });
    }
  }
  return lines.join('\n');
}

async function handle(chatId, text) {
  const cmd = text.split(/\s+/)[0].slice(1).split('@')[0].toLowerCase();
  // Mode penemuan chat id: selama TELEGRAM_CHAT_ID kosong, balas id ke siapa pun yang /start.
  if (!CHAT_ID && (cmd === 'start' || cmd === 'id' || cmd === 'chatid')) {
    await send(
      chatId,
      `Chat ID Anda: ${chatId}\n\nTambahkan baris ini ke ~/CodeUnical/api/.env:\nTELEGRAM_CHAT_ID=${chatId}\n\nlalu: systemctl --user restart codeunical-guard`,
    );
    return;
  }
  if (CHAT_ID && String(chatId) !== String(CHAT_ID)) return; // hanya developer
  switch (cmd) {
    case 'start':
    case 'help':
      await send(
        chatId,
        '🤖 CodeUnical Guard\n\n/status — status semua layanan\n/help — bantuan\n\nAlert otomatis: 🔴 PADAM / 🟢 PULIH (padam ±N menit).',
      );
      break;
    case 'status':
      await send(chatId, '📊 Status layanan CodeUnical:\n' + (await checkAll(false)));
      break;
    default:
      await send(chatId, 'Perintah tak dikenal. Coba /status atau /help.');
  }
}

async function main() {
  await checkAll(false); // isi state awal tanpa alert
  await notify(`🤖 CodeUnical Guard aktif — memantau ${CHECKS.length} layanan.`);
  setInterval(() => checkAll(true).catch(() => {}), 30_000);

  let offset = 0;
  console.log(`[${new Date().toISOString()}] CodeUnical Guard mulai polling…`);
  for (;;) {
    try {
      const res = await fetch(
        `${API}/getUpdates?timeout=50&offset=${offset}&allowed_updates=["message"]`,
        { signal: AbortSignal.timeout(60_000) },
      );
      const data = await res.json();
      if (!data.ok) {
        if (data.error_code === 409) await fetch(`${API}/deleteWebhook`).catch(() => {});
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      for (const upd of data.result) {
        offset = upd.update_id + 1;
        const msg = upd.message;
        if (!msg?.text?.startsWith('/')) continue;
        await handle(msg.chat.id, msg.text.trim());
      }
    } catch {
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}
main();
