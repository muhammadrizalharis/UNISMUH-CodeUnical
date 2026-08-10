import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MonitorService {
  constructor(private readonly prisma: PrismaService) {}

  async attempts() {
    const rows = await this.prisma.examAttempt.findMany({
      orderBy: { startedAt: 'desc' },
      take: 100,
      include: { _count: { select: { events: true, keystrokes: true } } },
    });
    // userId/examId disimpan sebagai kolom biasa (tanpa relasi) -> ambil batch.
    const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))] as string[];
    const examIds = [...new Set(rows.map((r) => r.examId).filter(Boolean))] as string[];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, code: true },
        })
      : [];
    const exams = examIds.length
      ? await this.prisma.exam.findMany({
          where: { id: { in: examIds } },
          select: { id: true, title: true },
        })
      : [];
    const uMap = new Map(users.map((u) => [u.id, u]));
    const eMap = new Map(exams.map((e) => [e.id, e]));
    const now = Date.now();
    return rows.map((a) => {
      const u = a.userId ? uMap.get(a.userId) : undefined;
      return {
        id: a.id,
        problemId: a.problemId,
        status: a.status,
        strikes: a.strikes,
        startedAt: a.startedAt,
        lastSeenAt: a.lastSeenAt,
        live: now - new Date(a.lastSeenAt).getTime() < 30_000,
        events: a._count.events,
        keystrokes: a._count.keystrokes,
        peserta: u ? { name: u.name, code: u.code ?? null } : null,
        examTitle: a.examId ? (eMap.get(a.examId)?.title ?? null) : null,
      };
    });
  }

  submissions(problemId?: string) {
    return this.prisma.submission.findMany({
      where: problemId ? { problemId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        problemId: true,
        passed: true,
        total: true,
        score: true,
        maxScore: true,
        createdAt: true,
      },
    });
  }
}
