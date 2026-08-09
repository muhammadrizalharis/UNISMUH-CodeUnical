import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { parseOffice } from 'officeparser';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'gemma4-16k:latest';
const MAX_CONTEXT_CHARS = 12000; // batasi materi agar muat konteks model
const GEN_TIMEOUT_MS = 180_000;

export interface GenerateInput {
  materialIds?: string[];
  count?: number;
  language?: string;
  difficulty?: string;
}

export interface SoalDraft {
  title: string;
  description: string;
  language: string;
  difficulty: string;
  starterCode: string;
  testCases: {
    stdin: string;
    expected: string;
    points: number;
    hidden: boolean;
  }[];
}

@Injectable()
export class AiService {
  private readonly log = new Logger('AI');

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** Ekstrak teks dari buffer materi sesuai tipe MIME. */
  private async extractText(buf: Buffer, mime: string): Promise<string> {
    if (mime === 'text/plain' || mime === 'text/markdown') {
      return buf.toString('utf8');
    }
    try {
      const ast = await parseOffice(buf);
      return ast.toText();
    } catch (e) {
      this.log.warn(`Ekstraksi teks gagal (${mime}): ${String(e).slice(0, 120)}`);
      return '';
    }
  }

  /** Ambil teks materi (cache di Material.text bila belum ada). */
  private async materialText(id: string): Promise<{ title: string; text: string }> {
    const m = await this.prisma.material.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('Materi tidak ditemukan.');
    if (m.text && m.text.trim()) return { title: m.title, text: m.text };
    let buf: Buffer | null = null;
    if (m.objectKey) buf = await this.storage.get(m.objectKey);
    if (!buf && m.data) buf = Buffer.from(m.data);
    if (!buf) return { title: m.title, text: '' };
    const text = await this.extractText(buf, m.mimeType);
    if (text.trim()) {
      await this.prisma.material
        .update({ where: { id }, data: { text: text.slice(0, 200_000) } })
        .catch(() => undefined);
    }
    return { title: m.title, text };
  }

  private buildPrompt(
    materi: string,
    count: number,
    language: string,
    difficulty: string,
  ): string {
    return [
      'Anda adalah dosen pembuat soal pemrograman untuk ujian mahasiswa.',
      `Berdasarkan MATERI di bawah, buat ${count} soal latihan pemrograman.`,
      `Bahasa pemrograman: ${language}. Tingkat kesulitan: ${difficulty}.`,
      'Setiap soal harus dapat diuji otomatis via stdin/stdout.',
      'Balas HANYA JSON valid (tanpa penjelasan) dengan bentuk PERSIS:',
      '{"problems":[{"title":string,"description":string,"starterCode":string,' +
        '"testCases":[{"stdin":string,"expected":string,"points":number,"hidden":boolean}]}]}',
      'Aturan: setiap soal minimal 2 test case; "expected" adalah output PERSIS ' +
        '(tanpa spasi/enter berlebih); minimal 1 test case hidden=false sebagai contoh; ' +
        'gunakan bahasa Indonesia untuk title & description.',
      '',
      '=== MATERI ===',
      materi,
    ].join('\n');
  }

  private normalizeDrafts(
    raw: unknown,
    language: string,
    difficulty: string,
  ): SoalDraft[] {
    let arr: unknown = raw;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const obj = raw as Record<string, unknown>;
      arr = obj.problems ?? obj.soal ?? obj.questions ?? [];
    }
    if (!Array.isArray(arr)) return [];
    const out: SoalDraft[] = [];
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue;
      const p = item as Record<string, unknown>;
      const title = String(p.title ?? '').trim();
      if (!title) continue;
      const casesRaw = Array.isArray(p.testCases) ? p.testCases : [];
      const testCases = casesRaw
        .filter((c) => c && typeof c === 'object')
        .map((c) => {
          const cc = c as Record<string, unknown>;
          return {
            stdin: String(cc.stdin ?? ''),
            expected: String(cc.expected ?? ''),
            points: Number(cc.points) > 0 ? Number(cc.points) : 10,
            hidden: Boolean(cc.hidden),
          };
        });
      if (testCases.length && !testCases.some((c) => !c.hidden)) {
        testCases[0].hidden = false; // pastikan ada contoh terlihat
      }
      out.push({
        title: title.slice(0, 200),
        description: String(p.description ?? '').slice(0, 5000),
        language,
        difficulty,
        starterCode: String(p.starterCode ?? ''),
        testCases,
      });
    }
    return out;
  }

  async generate(courseId: string, input: GenerateInput): Promise<{ drafts: SoalDraft[] }> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });
    if (!course) throw new NotFoundException('Mata kuliah tidak ditemukan.');

    const ids = input.materialIds ?? [];
    if (!ids.length) throw new BadRequestException('Pilih minimal 1 materi.');
    const count = Math.min(Math.max(Number(input.count) || 1, 1), 5);
    const language = (input.language || 'python').toLowerCase();
    const difficulty = input.difficulty || 'sedang';

    // Kumpulkan teks materi (hanya milik course ini).
    const owned = await this.prisma.material.findMany({
      where: { id: { in: ids }, courseId },
      select: { id: true },
    });
    if (!owned.length) throw new BadRequestException('Materi tidak valid untuk MK ini.');
    const parts: string[] = [];
    for (const { id } of owned) {
      const { title, text } = await this.materialText(id);
      if (text.trim()) parts.push(`## ${title}\n${text}`);
    }
    const materi = parts.join('\n\n').slice(0, MAX_CONTEXT_CHARS);
    if (!materi.trim()) {
      throw new BadRequestException(
        'Tidak ada teks yang bisa diekstrak dari materi terpilih.',
      );
    }

    const prompt = this.buildPrompt(materi, count, language, difficulty);
    const raw = await this.callOllama(prompt);
    const drafts = this.normalizeDrafts(raw, language, difficulty);
    if (!drafts.length) {
      throw new BadRequestException(
        'AI tidak menghasilkan soal yang valid. Coba lagi atau ganti materi.',
      );
    }
    return { drafts };
  }

  private async callOllama(prompt: string): Promise<unknown> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), GEN_TIMEOUT_MS);
    try {
      const res = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt,
          stream: false,
          format: 'json',
          options: { temperature: 0.4, num_predict: 3072 },
        }),
      });
      if (!res.ok) {
        throw new BadRequestException(`Ollama error HTTP ${res.status}.`);
      }
      const data = (await res.json()) as { response?: string };
      try {
        return JSON.parse(data.response ?? '{}');
      } catch {
        throw new BadRequestException('Respons AI bukan JSON valid.');
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      const msg = String(e);
      if (msg.includes('abort')) {
        throw new BadRequestException('Generasi AI melebihi batas waktu.');
      }
      throw new BadRequestException(`Gagal menghubungi Ollama: ${msg.slice(0, 120)}`);
    } finally {
      clearTimeout(timer);
    }
  }
}
