import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface Requester {
  id: string;
  role: string;
}

@Injectable()
export class MonitorService {
  constructor(private readonly prisma: PrismaService) {}

  // Ujian milik penguji: dibuat sendiri ATAU mata kuliahnya dia yang punya. Superadmin = semua.
  private async ownedExamIds(userId: string): Promise<string[]> {
    const exams = await this.prisma.exam.findMany({
      where: { OR: [{ createdById: userId }, { course: { createdById: userId } }] },
      select: { id: true },
    });
    return exams.map((e) => e.id);
  }

  private async ownedProblemIds(userId: string): Promise<string[]> {
    const problems = await this.prisma.problem.findMany({
      where: { course: { createdById: userId } },
      select: { id: true },
    });
    return problems.map((p) => p.id);
  }

  // 'all' = tanpa batas (superadmin), 'none' = tak ada yang boleh dilihat, atau daftar id.
  private async scopeExamIds(
    examId: string | undefined,
    user: Requester,
  ): Promise<'all' | 'none' | string[]> {
    if (user.role === 'superadmin') return examId ? [examId] : 'all';
    const owned = await this.ownedExamIds(user.id);
    if (owned.length === 0) return 'none';
    if (examId) return owned.includes(examId) ? [examId] : 'none';
    return owned;
  }

  private async scopeProblemIds(
    problemId: string | undefined,
    user: Requester,
  ): Promise<'all' | 'none' | string[]> {
    if (user.role === 'superadmin') return problemId ? [problemId] : 'all';
    const owned = await this.ownedProblemIds(user.id);
    if (owned.length === 0) return 'none';
    if (problemId) return owned.includes(problemId) ? [problemId] : 'none';
    return owned;
  }

  async attempts(examId: string | undefined, user: Requester) {
    const scope = await this.scopeExamIds(examId, user);
    if (scope === 'none') return [];
    const rows = await this.prisma.examAttempt.findMany({
      where: scope === 'all' ? {} : { examId: { in: scope } },
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

  /** Daftar ujian yang punya attempt (untuk dropdown filter) — hanya milik penguji. */
  async examFilters(user: Requester) {
    const grouped = await this.prisma.examAttempt.groupBy({
      by: ['examId'],
      where: { examId: { not: null } },
      _count: { _all: true },
    });
    let ids = grouped.map((g) => g.examId).filter(Boolean) as string[];
    if (user.role !== 'superadmin') {
      const owned = new Set(await this.ownedExamIds(user.id));
      ids = ids.filter((id) => owned.has(id));
    }
    const idSet = new Set(ids);
    const exams = ids.length
      ? await this.prisma.exam.findMany({
          where: { id: { in: ids } },
          select: { id: true, title: true },
        })
      : [];
    const tMap = new Map(exams.map((e) => [e.id, e.title]));
    return grouped
      .filter((g) => g.examId && idSet.has(g.examId))
      .map((g) => ({
        id: g.examId as string,
        title: tMap.get(g.examId as string) ?? '(ujian terhapus)',
        count: g._count._all,
      }))
      .sort((a, b) => b.count - a.count);
  }

  async submissions(problemId: string | undefined, user: Requester) {
    const scope = await this.scopeProblemIds(problemId, user);
    if (scope === 'none') return [];
    const rows = await this.prisma.submission.findMany({
      where: scope === 'all' ? {} : { problemId: { in: scope } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        problemId: true,
        userId: true,
        passed: true,
        total: true,
        score: true,
        maxScore: true,
        createdAt: true,
      },
    });
    const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))] as string[];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, code: true },
        })
      : [];
    const uMap = new Map(users.map((u) => [u.id, u]));
    return rows.map((s) => {
      const u = s.userId ? uMap.get(s.userId) : undefined;
      return {
        id: s.id,
        problemId: s.problemId,
        passed: s.passed,
        total: s.total,
        score: s.score,
        maxScore: s.maxScore,
        createdAt: s.createdAt,
        peserta: u ? { name: u.name, code: u.code ?? null } : null,
      };
    });
  }
}
