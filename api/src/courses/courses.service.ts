import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SyncStatus {
  at: string;
  ok: boolean;
  trigger: string;
  periode?: string;
  imported?: number;
  skipped?: number;
  total?: number;
  reason?: string;
  message?: string;
}

type ImportResult =
  | { ok: true; imported: number; skipped: number; total: number }
  | { ok: false; reason: string; message?: string };

/** Periode akademik SEVIMA gaya `YYYYS` (S: 1=ganjil Agu–Jan, 2=genap Feb–Jul). */
function currentPeriode(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  if (m >= 8) return `${y}1`; // Agu–Des: ganjil tahun ini
  if (m === 1) return `${y - 1}1`; // Jan: masih ganjil tahun ajaran lalu
  return `${y}2`; // Feb–Jul: genap
}

const SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 jam

@Injectable()
export class CoursesService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('SICEKCOK');
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastSync: SyncStatus | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private syncConfigured(): boolean {
    return Boolean(
      process.env.SICEKCOK_URL &&
        process.env.SICEKCOK_ACCESS_KEY_ID &&
        process.env.SICEKCOK_SECRET_KEY,
    );
  }

  onModuleInit(): void {
    const enabled = (process.env.SICEKCOK_SYNC_ENABLED ?? 'true') !== 'false';
    if (!enabled || !this.syncConfigured()) {
      this.log.log('Auto-sync MK nonaktif (env belum diisi / dimatikan).');
      return;
    }
    // Sync awal setelah boot (jangan blokir startup) + berkala tiap 12 jam.
    setTimeout(() => void this.syncFromSicekcok('startup'), 10_000);
    this.timer = setInterval(() => void this.syncFromSicekcok('scheduled'), SYNC_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  getSyncStatus(): { configured: boolean; enabled: boolean; last: SyncStatus | null } {
    return {
      configured: this.syncConfigured(),
      enabled: (process.env.SICEKCOK_SYNC_ENABLED ?? 'true') !== 'false',
      last: this.lastSync,
    };
  }

  /** Sinkronisasi otomatis: ambil MK dari SICEKCOK lalu upsert katalog. Best-effort (aman bila gagal). */
  async syncFromSicekcok(trigger: string): Promise<SyncStatus> {
    const periode = process.env.SICEKCOK_SYNC_PERIODE?.trim() || currentPeriode();
    const kodeProdi = process.env.SICEKCOK_SYNC_KODE_PRODI?.trim() || undefined;
    const kodeFakultas = process.env.SICEKCOK_SYNC_KODE_FAKULTAS?.trim() || undefined;
    const res = await this.importFromSicekcok({ periode, kodeProdi, kodeFakultas }, null);
    const status: SyncStatus = res.ok
      ? { at: new Date().toISOString(), ok: true, trigger, periode, imported: res.imported, skipped: res.skipped, total: res.total }
      : { at: new Date().toISOString(), ok: false, trigger, periode, reason: res.reason, message: res.message };
    this.lastSync = status;
    if (res.ok) {
      this.log.log(`Sync (${trigger}) periode ${periode}: ${res.imported} MK baru, ${res.skipped} dilewati.`);
    } else {
      this.log.warn(`Sync (${trigger}) gagal: ${res.reason}${res.message ? ' — ' + res.message : ''}.`);
    }
    return status;
  }

  list() {
    return this.prisma.course.findMany({
      orderBy: [{ semester: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        semester: true,
        createdById: true,
        _count: { select: { problems: true } },
      },
    });
  }

  async detail(id: string) {
    const c = await this.prisma.course.findUnique({
      where: { id },
      include: {
        problems: {
          select: { id: true, title: true, language: true, difficulty: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!c) throw new NotFoundException('Mata kuliah tidak ditemukan.');
    return c;
  }

  create(name: string, semester: number | null, code: string | null, createdById: string | null) {
    return this.prisma.course.create({
      data: { name: name.slice(0, 160), semester, code, createdById },
    });
  }

  /**
   * Impor daftar mata kuliah dari API akademik SICEKCOK (query `jadwal`).
   * Ekstrak MK unik (kode+nama) dari jadwal 1 periode/prodi, lalu upsert ke katalog.
   */
  async importFromSicekcok(
    input: { periode: string; kodeProdi?: string; kodeFakultas?: string },
    createdById: string | null,
  ): Promise<ImportResult> {
    const url = process.env.SICEKCOK_URL;
    const akid = process.env.SICEKCOK_ACCESS_KEY_ID;
    const ask = process.env.SICEKCOK_SECRET_KEY;
    if (!url || !akid || !ask) {
      return { ok: false, reason: 'not_configured' as const };
    }

    const query =
      'query($periode:String!,$kodeFakultas:String,$kodeProdi:String){' +
      'jadwal(periode:$periode,kodeFakultas:$kodeFakultas,kodeProdi:$kodeProdi){' +
      'kodeMatakuliah namaMatakuliah sks}}';
    const variables = {
      periode: input.periode,
      kodeFakultas: input.kodeFakultas ?? null,
      kodeProdi: input.kodeProdi ?? null,
    };

    let payload: {
      data?: { jadwal?: { kodeMatakuliah?: string; namaMatakuliah?: string; sks?: number }[] };
      errors?: { message?: string }[];
    };
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Access-Key-Id': akid,
          'X-Secret-Access-Key': ask,
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(20000),
      });
      payload = (await res.json()) as typeof payload;
    } catch {
      return { ok: false, reason: 'unreachable' as const };
    }
    if (payload.errors?.length) {
      return { ok: false, reason: 'api_error' as const, message: payload.errors[0]?.message };
    }

    const rows = payload.data?.jadwal ?? [];
    // MK unik berdasarkan kode (fallback nama).
    const unique = new Map<string, { code: string | null; name: string }>();
    for (const r of rows) {
      const code = (r.kodeMatakuliah ?? '').trim();
      const name = (r.namaMatakuliah ?? '').trim();
      if (!name) continue;
      const key = code || name.toLowerCase();
      if (!unique.has(key)) unique.set(key, { code: code || null, name });
    }

    let imported = 0;
    let skipped = 0;
    for (const mk of unique.values()) {
      const orConds: { code?: string; name?: string }[] = [{ name: mk.name }];
      if (mk.code) orConds.push({ code: mk.code });
      const exists = await this.prisma.course.findFirst({
        where: { OR: orConds },
        select: { id: true },
      });
      if (exists) {
        skipped++;
        continue;
      }
      await this.prisma.course.create({
        data: { name: mk.name.slice(0, 160), code: mk.code, semester: null, createdById },
      });
      imported++;
    }
    return { ok: true as const, imported, skipped, total: unique.size };
  }
}
