import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const VIOLATION_KINDS = new Set([
  'tabhidden',
  'blur',
  'fullscreen_exit',
  'split',
  'multimonitor',
]);
const MAX_STRIKES = 3;

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
  constructor(private readonly prisma: PrismaService) {}

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
}
