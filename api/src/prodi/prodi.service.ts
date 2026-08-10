import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

export interface ProdiRef {
  kodeFakultas: string;
  kodeProdi: string;
  kodeNim: string | null;
  name: string;
}

// Label prodi yang diketahui (fallback saat SICEKCOK belum bisa diakses).
const KNOWN_LABELS: Record<string, string> = {
  '84': 'Teknik Informatika',
  '81': 'Teknik Sipil',
  '11': 'Keperawatan',
};

const SYNC_MS = 12 * 60 * 60 * 1000; // 12 jam

/**
 * Referensi prodi dari SICEKCOK (query `getAllProdi`). Auto-sync begitu key valid.
 * Dipakai untuk nama prodi + (nanti) validasi NIM otoritatif via `kodeNim`.
 */
@Injectable()
export class ProdiService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('SICEKCOK-Prodi');
  private timer: ReturnType<typeof setInterval> | null = null;
  private cache: ProdiRef[] = [];
  private lastSyncAt: string | null = null;
  private lastError: string | null = null;

  private configured(): boolean {
    return Boolean(
      process.env.SICEKCOK_URL &&
        process.env.SICEKCOK_ACCESS_KEY_ID &&
        process.env.SICEKCOK_SECRET_KEY,
    );
  }

  onModuleInit(): void {
    const enabled = (process.env.SICEKCOK_SYNC_ENABLED ?? 'true') !== 'false';
    if (!enabled || !this.configured()) return;
    setTimeout(() => void this.sync(), 12_000);
    this.timer = setInterval(() => void this.sync(), SYNC_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  allowedCodes(): string[] {
    return (process.env.ALLOWED_PRODI ?? '84')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private code(p: { kodeFakultas: string; kodeProdi: string }): string {
    return `${p.kodeFakultas}${p.kodeProdi}`;
  }

  /** Nama prodi dari kode fakultas+prodi (2 digit). Cache SICEKCOK dulu, lalu label bawaan. */
  nameForCode(code: string): string {
    const hit = this.cache.find((p) => this.code(p) === code);
    return hit?.name || KNOWN_LABELS[code] || `Prodi ${code}`;
  }

  /** Daftar prodi (cache SICEKCOK bila ada; selain itu label bawaan) + status izin. */
  list() {
    const allowed = this.allowedCodes();
    const source: ProdiRef[] = this.cache.length
      ? this.cache
      : Object.entries(KNOWN_LABELS).map(([c, name]) => ({
          kodeFakultas: c[0],
          kodeProdi: c[1],
          kodeNim: null,
          name,
        }));
    return {
      synced: this.cache.length > 0,
      lastSyncAt: this.lastSyncAt,
      lastError: this.lastError,
      allowed,
      prodi: source.map((p) => ({
        code: this.code(p),
        kodeFakultas: p.kodeFakultas,
        kodeProdi: p.kodeProdi,
        kodeNim: p.kodeNim,
        name: p.name,
        allowed: allowed.includes(this.code(p)),
      })),
    };
  }

  async sync(): Promise<void> {
    if (!this.configured()) return;
    const url = process.env.SICEKCOK_URL as string;
    const akid = process.env.SICEKCOK_ACCESS_KEY_ID as string;
    const ask = process.env.SICEKCOK_SECRET_KEY as string;
    const query = '{ getAllProdi { kodeFakultas kodeProdi namaProdi kodeNim } }';
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Access-Key-Id': akid,
          'X-Secret-Access-Key': ask,
        },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(20000),
      });
      const data = (await res.json()) as {
        data?: {
          getAllProdi?: {
            kodeFakultas?: string | number;
            kodeProdi?: string | number;
            namaProdi?: string;
            kodeNim?: string | null;
          }[];
        };
        errors?: { message?: string }[];
      };
      if (data.errors?.length) {
        this.lastError = data.errors[0]?.message ?? 'error';
        this.log.warn(`Prodi sync gagal: ${this.lastError}.`);
        return;
      }
      const rows = data.data?.getAllProdi ?? [];
      this.cache = rows
        .filter((r) => r)
        .map((r) => ({
          kodeFakultas: String(r.kodeFakultas ?? ''),
          kodeProdi: String(r.kodeProdi ?? ''),
          kodeNim: r.kodeNim ?? null,
          name: String(r.namaProdi ?? ''),
        }));
      this.lastSyncAt = new Date().toISOString();
      this.lastError = null;
      this.log.log(`Prodi tersinkron dari SICEKCOK: ${this.cache.length} prodi.`);
    } catch (e) {
      this.lastError = String(e).slice(0, 120);
      this.log.warn(`Prodi sync error: ${this.lastError}.`);
    }
  }
}
