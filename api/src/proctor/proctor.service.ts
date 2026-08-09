import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const VIOLATION_KINDS = new Set([
  'tabhidden',
  'blur',
  'fullscreen_exit',
  'split',
  'multimonitor',
]);
const MAX_STRIKES = 3;
// Service GPU proctoring (YOLO HP + face-rec). Opsional: bila mati, /vision degradasi anggun.
const VISION_URL = process.env.PROCTOR_AI_URL ?? 'http://127.0.0.1:47610';

interface EventIn {
  kind: string;
  meta?: unknown;
}
interface KeyIn {
  t: number;
  value: string;
}

@Injectable()
export class ProctorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async createAttempt(problemId?: string) {
    const a = await this.prisma.examAttempt.create({
      data: { problemId: problemId ?? null },
    });
    return { attemptId: a.id, startedAt: a.startedAt };
  }

  async logEvents(attemptId: string, events: EventIn[]) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
    });
    if (!attempt) throw new NotFoundException('Attempt tidak ditemukan.');
    if (attempt.status === 'kicked') {
      return { strikes: attempt.strikes, status: attempt.status, kicked: true };
    }

    let strikes = attempt.strikes;
    for (const e of events) {
      await this.prisma.proctorEvent.create({
        data: {
          attemptId,
          kind: String(e.kind).slice(0, 40),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          meta: (e.meta ?? undefined) as any,
        },
      });
      if (VIOLATION_KINDS.has(e.kind)) strikes += 1;
    }

    const status = strikes >= MAX_STRIKES ? 'kicked' : attempt.status;
    await this.prisma.examAttempt.update({
      where: { id: attemptId },
      data: { strikes, status, lastSeenAt: new Date() },
    });
    return { strikes, status, kicked: status === 'kicked' };
  }

  async logKeys(attemptId: string, keys: KeyIn[]) {
    if (!keys?.length) return { ok: true, saved: 0 };
    const rows = keys.slice(0, 500).map((k) => ({
      attemptId,
      t: Math.max(0, Math.floor(k.t)),
      value: String(k.value).slice(0, 20000),
    }));
    await this.prisma.keystroke.createMany({ data: rows });
    await this.prisma.examAttempt
      .update({ where: { id: attemptId }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);
    return { ok: true, saved: rows.length };
  }

  async heartbeat(attemptId: string) {
    await this.prisma.examAttempt
      .update({ where: { id: attemptId }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);
    return { ok: true };
  }

  async replay(attemptId: string) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        events: { orderBy: { at: 'asc' } },
        keystrokes: { orderBy: { t: 'asc' } },
      },
    });
    if (!attempt) throw new NotFoundException('Attempt tidak ditemukan.');
    return attempt;
  }

  async saveSnapshot(attemptId: string, kind: string, dataUrl: string) {
    const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
    if (!m) return { ok: false };
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 2_000_000) return { ok: false };
    const mime = m[1];
    const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin';
    const key = `${attemptId}/${randomUUID()}.${ext}`;
    // Utamakan MinIO; bila tak siap/gagal -> simpan bytes di DB (fallback).
    const stored = await this.storage.put(key, buf, mime).catch(() => false);
    await this.prisma.proctorSnapshot.create({
      data: stored
        ? { attemptId, kind: kind.slice(0, 40), mime, objectKey: key }
        : { attemptId, kind: kind.slice(0, 40), mime, image: buf },
    });
    await this.prisma.examAttempt
      .update({ where: { id: attemptId }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);
    return { ok: true };
  }

  listSnapshots(attemptId: string) {
    return this.prisma.proctorSnapshot.findMany({
      where: { attemptId },
      orderBy: { at: 'asc' },
      select: { id: true, kind: true, mime: true, at: true },
    });
  }

  async getSnapshot(id: string) {
    const s = await this.prisma.proctorSnapshot.findUnique({ where: { id } });
    if (!s) return null;
    if (s.objectKey) {
      const buf = await this.storage.get(s.objectKey).catch(() => null);
      return buf ? { mime: s.mime, image: buf } : null;
    }
    return { mime: s.mime, image: s.image ?? Buffer.alloc(0) };
  }

  /** Kirim 1 frame kamera ke service GPU; catat pelanggaran (HP/wajah) + simpan bukti. */
  async visionCheck(attemptId: string, dataUrl: string) {
    const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
    if (!m) return { ok: false, reason: 'bad_image' };
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 3_000_000) return { ok: false, reason: 'too_large' };

    let det: {
      phone_detected?: boolean;
      face_count?: number;
      faces?: { examiner?: string | null }[];
    };
    try {
      const fd = new FormData();
      fd.append('file', new Blob([buf], { type: m[1] }), 'frame.jpg');
      const res = await fetch(`${VISION_URL}/detect`, {
        method: 'POST',
        body: fd,
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return { ok: false, reason: 'service_error' };
      det = (await res.json()) as typeof det;
    } catch {
      return { ok: false, reason: 'service_unavailable' };
    }

    // Penguji ter-whitelist tidak dihitung "asing"; peserta = 1 wajah non-penguji dianggap normal.
    const examinerFaces = (det.faces ?? []).filter((f) => f.examiner).length;
    const nonExaminer = (det.face_count ?? 0) - examinerFaces;
    const violations: string[] = [];
    if (det.phone_detected) violations.push('phone_detected');
    if ((det.face_count ?? 0) === 0) violations.push('face_absent');
    else if (nonExaminer >= 2) violations.push('multi_face');

    for (const kind of violations) {
      await this.prisma.proctorEvent
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .create({ data: { attemptId, kind, meta: det as any } })
        .catch(() => undefined);
      await this.saveSnapshot(attemptId, kind, dataUrl).catch(() => undefined);
    }
    await this.prisma.examAttempt
      .update({ where: { id: attemptId }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);
    return { ok: true, detected: det, violations };
  }

  /** Daftar nama penguji ter-whitelist (dari service GPU). */
  async listExaminers(): Promise<string[]> {
    try {
      const res = await fetch(`${VISION_URL}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return [];
      const d = (await res.json()) as { whitelist?: string[] };
      return d.whitelist ?? [];
    } catch {
      return [];
    }
  }

  /** Daftarkan wajah penguji ke whitelist service GPU. */
  async enrollExaminer(name: string, dataUrl: string) {
    const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
    if (!m) return { ok: false, reason: 'bad_image' };
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 3_000_000) return { ok: false, reason: 'too_large' };
    try {
      const fd = new FormData();
      fd.append('name', name.slice(0, 60));
      fd.append('file', new Blob([buf], { type: m[1] }), 'face.jpg');
      const res = await fetch(`${VISION_URL}/enroll`, {
        method: 'POST',
        body: fd,
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return { ok: false, reason: 'service_error' };
      return (await res.json()) as { ok: boolean };
    } catch {
      return { ok: false, reason: 'service_unavailable' };
    }
  }

  async removeExaminer(name: string) {
    try {
      const res = await fetch(`${VISION_URL}/enroll/${encodeURIComponent(name)}`, {
        method: 'DELETE',
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return { ok: false };
      return (await res.json()) as { ok: boolean };
    } catch {
      return { ok: false };
    }
  }
}
