#!/usr/bin/env node
/**
 * CodeUnical Guard — bot ops Telegram lengkap (long polling, tanpa webhook).
 *
 * PANTAU (bebas)  : /status /gpu /disk /pengguna /ujian /backup /log /bantuan
 * KENDALI (kode)  : /matikan /hidupkan /restart /backupsekarang  (butuh CODEUNICAL_BOT_SECRET)
 * Notif otomatis  : layanan padam/pulih, disk menipis, ringkasan harian.
 *
 * Konfigurasi dari ~/CodeUnical/api/.env (TIDAK di-commit):
 *   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, CODEUNICAL_BOT_SECRET
 * Jalankan via systemd --user: codeunical-guard.service.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import net from 'node:net';

const HOME = homedir();

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
const SECRET = env.CODEUNICAL_BOT_SECRET || '';
const API = `https://api.telegram.org/bot${TOKEN}`;
if (!TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN belum diisi di api/.env — bot berhenti.');
  process.exit(1);
}

// ---------- util ----------
async function send(chatId, text) {
  await fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 3900) }),
  }).catch(() => {});
}
const notify = (t) => (CHAT_ID ? send(CHAT_ID, t) : Promise.resolve());

function sh(file, args, timeout = 90_000) {
  return new Promise((resolve) => {
    execFile(file, args, { timeout, maxBuffer: 8 * 1024 * 1024 }, (err, out, errout) => {
      const s = ((out || '') + (errout ? '\n' + errout : '')).trim();
      resolve(s || (err ? String(err) : '(tanpa output)'));
    });
  });
}
const bash = (script) => sh('bash', ['-lc', script]);
const psql = (sql) =>
  sh('sudo', [
    '-n', 'docker', 'exec', 'codeunical-postgres',
    'psql', '-U', 'codeunical', '-d', 'codeunical', '-tAc', sql,
  ]);

function httpUp(url, { timeout = 8000, needOk = false } = {}) {
  return fetch(url, { signal: AbortSignal.timeout(timeout) })
    .then(async (r) => {
      if (!needOk) return r.status > 0;
      if (!r.ok) return false;
      const j = await r.json().catch(() => ({}));
      return j?.ok !== false;
    })
    .catch(() => false);
}
function tcpUp(host, port, timeout = 5000) {
  return new Promise((resolve) => {
    const s = net.connect({ host, port });
    const done = (v) => { s.destroy(); resolve(v); };
    s.setTimeout(timeout);
    s.once('connect', () => done(true));
    s.once('timeout', () => done(false));
    s.once('error', () => done(false));
  });
}
function tunnelUrl() {
  try {
    const m = readFileSync('/tmp/cf-codeunical.log', 'utf8').match(
      /https:\/\/[a-z0-9-]+\.trycloudflare\.com/,
    );
    return m ? m[0] : null;
  } catch {
    return null;
  }
}

// ---------- health watcher ----------
const CHECKS = [
  { name: 'API :47080', fn: () => httpUp('http://127.0.0.1:47080/') },
  { name: 'Web :47300', fn: () => httpUp('http://127.0.0.1:47300/') },
  { name: 'Postgres :47432', fn: () => tcpUp('127.0.0.1', 47432) },
  { name: 'MinIO :47900', fn: () => httpUp('http://127.0.0.1:47900/minio/health/live') },
  { name: 'Proctor-AI :47610', fn: () => httpUp('http://127.0.0.1:47610/health', { needOk: true }) },
];
const state = new Map();
function fmtDur(ms) {
  const m = Math.round(ms / 60000);
  if (m < 1) return '<1 menit';
  if (m < 60) return `${m} menit`;
  return `${Math.floor(m / 60)} jam ${m % 60} mnt`;
}
async function checkAll(announce) {
  const lines = [];
  for (const c of CHECKS) {
    const up = await c.fn();
    lines.push(`${up ? '🟢' : '🔴'} ${c.name}`);
    const prev = state.get(c.name);
    if (!prev) { state.set(c.name, { up, since: Date.now() }); continue; }
    if (prev.up !== up) {
      if (announce)
        await notify(up ? `🟢 ${c.name} PULIH (padam ±${fmtDur(Date.now() - prev.since)}).` : `🔴 ${c.name} PADAM.`);
      state.set(c.name, { up, since: Date.now() });
    }
  }
  return lines.join('\n');
}

let diskAlertAt = 0;
let lastSummaryDay = '';
async function background() {
  await checkAll(true).catch(() => {});
  // disk menipis (>90%), maks 1 alert / 6 jam
  try {
    const pctRaw = await bash(`df --output=pcent /home | tail -1 | tr -dc '0-9'`);
    const pct = Number(pctRaw);
    if (pct >= 90 && Date.now() - diskAlertAt > 6 * 3600_000) {
      diskAlertAt = Date.now();
      await notify(`⚠️ Disk menipis: terpakai ${pct}% (${await diskLine()}).`);
    }
  } catch {}
  // ringkasan harian ~07:00 WITA
  try {
    const now = new Date().toLocaleString('en-CA', {
      timeZone: 'Asia/Makassar', hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
    });
    const [day, hm] = now.split(', ');
    if (hm?.startsWith('07') && lastSummaryDay !== day) {
      lastSummaryDay = day;
      await notify('🗓️ Ringkasan harian\n' + (await summaryText()));
    }
  } catch {}
}

// ---------- PANTAU ----------
async function diskLine() {
  return bash(`df -h /home | tail -1 | awk '{print $3" / "$2" ("$5"), sisa "$4}'`);
}
async function statusText() {
  const svc = await checkAll(false);
  const live = await psql(
    `SELECT count(*) FROM "ExamAttempt" WHERE "lastSeenAt" > now() - interval '40 seconds' AND status='active';`,
  ).catch(() => '?');
  const url = tunnelUrl();
  return `📊 CodeUnical — status\n${svc}\n\n👤 Peserta live: ${live}\n🔗 Tunnel: ${url ?? '(tak aktif)'}`;
}
async function gpuText() {
  const g = await sh('nvidia-smi', [
    '--query-gpu=index,name,memory.used,memory.total,utilization.gpu',
    '--format=csv,noheader,nounits',
  ]);
  const lines = g.split('\n').map((l) => {
    const p = l.split(',').map((x) => x.trim());
    return p.length >= 5 ? `GPU${p[0]} ${p[1]}: ${p[2]}/${p[3]} MB · ${p[4]}% util` : l;
  });
  return '🎮 GPU (2× L40S)\n' + lines.join('\n');
}
async function diskText() {
  const ram = await bash(`free -h | awk '/Mem:/{print $3" / "$2" (sisa "$7")"}'`);
  return `💾 Disk: ${await diskLine()}\n🧠 RAM: ${ram}`;
}
async function penggunaText() {
  const q = await psql(`SELECT role||': '||count(*) FROM "User" GROUP BY role ORDER BY role;`);
  return '👥 Pengguna per peran:\n' + (q || '(kosong)');
}
async function ujianText() {
  const live = await psql(
    `SELECT count(*) FROM "ExamAttempt" WHERE "lastSeenAt" > now() - interval '40 seconds' AND status='active';`,
  );
  const kicked = await psql(`SELECT count(*) FROM "ExamAttempt" WHERE status='kicked';`);
  const total = await psql(`SELECT count(*) FROM "ExamAttempt";`);
  return `📝 Ujian\n👤 Peserta live: ${live}\n🚫 Kicked: ${kicked}\nΣ attempt: ${total}`;
}
async function backupText() {
  const b = await bash(
    `ls -1t ~/codeunical-backups/*.dump 2>/dev/null | head -1 | xargs -r ls -lh --time-style=+'%d/%m %H:%M' | awk '{print $6" "$7" ("$5")"}'`,
  );
  return '💽 Backup DB terakhir: ' + (b || '(belum ada)');
}
async function logText(arg) {
  if (arg === 'error')
    return '📜 Log error/warn (api):\n' +
      (await bash(`journalctl --user -u codeunical-api --no-pager -n 300 | grep -iE 'error|warn|exception' | tail -20`) || '(bersih)');
  const n = Math.min(40, Math.max(5, Number(arg) || 20));
  return `📜 Log api (${n}):\n` + (await bash(`journalctl --user -u codeunical-api --no-pager -n ${n}`));
}
async function summaryText() {
  return [await checkAll(false), '', await penggunaText(), '', await ujianText(), '', await backupText()].join('\n');
}

// ---------- KENDALI (butuh kode) ----------
const UNIT = { api: 'codeunical-api', web: 'codeunical-web', proctor: 'codeunical-proctor' };
async function restartSvc(name) {
  const unit = UNIT[name];
  if (!unit) return '❓ Layanan tak dikenal. Pakai: api | web | proctor.';
  await sh('systemctl', ['--user', 'restart', unit]);
  await new Promise((r) => setTimeout(r, 2500));
  const st = await sh('systemctl', ['--user', 'is-active', unit]);
  return `🔁 ${unit}: ${st}`;
}

const HELP = [
  '🤖 CodeUnical Guard',
  '',
  'PANTAU (bebas):',
  '/status — layanan + peserta live + URL tunnel',
  '/gpu — pemakaian 2× L40S',
  '/disk — disk & RAM',
  '/pengguna — jumlah user per peran',
  '/ujian — ujian & peserta yang mengerjakan',
  '/backup — backup DB terakhir',
  '/log [n|error] — log api terbaru',
  '/bantuan — pesan ini',
  '',
  'KENDALI (tambah kode rahasia di akhir):',
  '/matikan <kode> — stop Web (maintenance)',
  '/hidupkan <kode> — nyalakan Web lagi',
  '/restart <api|web|proctor> <kode> — restart layanan',
  '/backupsekarang <kode> — backup DB manual',
  '',
  'Notif otomatis: layanan padam/pulih, disk menipis, ringkasan harian.',
].join('\n');

async function handle(chatId, text) {
  const parts = text.split(/\s+/);
  const cmd = parts[0].slice(1).split('@')[0].toLowerCase();
  const args = parts.slice(1);

  // Mode penemuan chat id (selama TELEGRAM_CHAT_ID kosong).
  if (!CHAT_ID && (cmd === 'start' || cmd === 'id' || cmd === 'chatid')) {
    await send(chatId, `Chat ID Anda: ${chatId}\nIsi TELEGRAM_CHAT_ID=${chatId} di api/.env lalu restart bot.`);
    return;
  }
  if (CHAT_ID && String(chatId) !== String(CHAT_ID)) return; // hanya developer

  const needCode = () => {
    if (!SECRET) return '⚠️ CODEUNICAL_BOT_SECRET belum di-set di api/.env.';
    if (args[args.length - 1] !== SECRET) return '🔒 Kode rahasia salah/kurang. Format: /perintah [arg] <kode>';
    return null;
  };

  try {
    switch (cmd) {
      case 'start':
      case 'help':
      case 'bantuan':
        return void (await send(chatId, HELP));
      case 'status':
        return void (await send(chatId, await statusText()));
      case 'gpu':
        return void (await send(chatId, await gpuText()));
      case 'disk':
        return void (await send(chatId, await diskText()));
      case 'pengguna':
        return void (await send(chatId, await penggunaText()));
      case 'ujian':
        return void (await send(chatId, await ujianText()));
      case 'backup':
        return void (await send(chatId, await backupText()));
      case 'log':
        return void (await send(chatId, await logText(args[0])));
      case 'matikan': {
        const e = needCode(); if (e) return void (await send(chatId, e));
        await send(chatId, '⏳ Mematikan Web (maintenance)…');
        await sh('systemctl', ['--user', 'stop', 'codeunical-web']);
        return void (await send(chatId, '🛑 Web dimatikan. Mahasiswa tak bisa akses sampai /hidupkan.'));
      }
      case 'hidupkan': {
        const e = needCode(); if (e) return void (await send(chatId, e));
        await sh('systemctl', ['--user', 'start', 'codeunical-web']);
        await new Promise((r) => setTimeout(r, 2500));
        return void (await send(chatId, '▶️ Web: ' + (await sh('systemctl', ['--user', 'is-active', 'codeunical-web']))));
      }
      case 'restart': {
        const e = needCode(); if (e) return void (await send(chatId, e));
        await send(chatId, `⏳ Restart ${args[0]}…`);
        return void (await send(chatId, await restartSvc(args[0])));
      }
      case 'backupsekarang': {
        const e = needCode(); if (e) return void (await send(chatId, e));
        await send(chatId, '⏳ Backup DB manual…');
        await bash(`bash ~/CodeUnical/scripts/backup-db.sh`);
        return void (await send(chatId, await backupText()));
      }
      default:
        return void (await send(chatId, `Perintah tak dikenal: /${cmd}\n\n${HELP}`));
    }
  } catch (err) {
    await send(chatId, `⚠️ Gagal: ${String(err).slice(0, 200)}`);
  }
}

// ---------- main ----------
async function main() {
  await checkAll(false);
  await notify(`🤖 CodeUnical Guard aktif — memantau ${CHECKS.length} layanan. Ketik /bantuan.`);
  setInterval(() => background().catch(() => {}), 30_000);

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
