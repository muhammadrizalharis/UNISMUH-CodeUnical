import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

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
  ) {
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
