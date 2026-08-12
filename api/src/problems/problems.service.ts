import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GradingService } from '../grading/grading.service';
import { codeFingerprint, lineSignatures, similarity as simScore } from '../similarity/similarity';

export interface CaseInput {
  stdin?: string;
  expected?: string;
  hidden?: boolean;
  points?: number;
  order?: number;
}
export interface ProblemInput {
  title: string;
  description?: string;
  language: string;
  difficulty?: string;
  starterCode?: string;
  setupSql?: string | null;
  courseId?: string | null;
  testCases?: CaseInput[];
}

function normalizeCases(cases?: CaseInput[]) {
  return (cases ?? []).map((t, i) => ({
    stdin: t.stdin ?? '',
    expected: t.expected ?? '',
    hidden: t.hidden ?? true,
    points: Number.isFinite(t.points) ? Number(t.points) : 1,
    order: t.order ?? i + 1,
  }));
}

@Injectable()
export class ProblemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly grading: GradingService,
  ) {}

  list() {
    return this.prisma.problem.findMany({
      select: { id: true, title: true, difficulty: true, language: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async random() {
    const count = await this.prisma.problem.count();
    if (count === 0) throw new NotFoundException('Belum ada soal.');
    const skip = Math.floor(Math.random() * count);
    const rows = await this.prisma.problem.findMany({
      skip,
      take: 1,
      orderBy: { createdAt: 'asc' },
    });
    return this.detail(rows[0].id);
  }

  async detail(id: string) {
    const p = await this.prisma.problem.findUnique({
      where: { id },
      include: {
        testCases: {
          where: { hidden: false },
          orderBy: { order: 'asc' },
          select: { stdin: true, expected: true, order: true, points: true },
        },
      },
    });
    if (!p) throw new NotFoundException('Soal tidak ditemukan.');
    const hiddenCount = await this.prisma.testCase.count({
      where: { problemId: id, hidden: true },
    });
    return { ...p, hiddenCount };
  }

  async submit(id: string, code: string, userId?: string) {
    const p = await this.prisma.problem.findUnique({
      where: { id },
      include: { testCases: true },
    });
    if (!p) throw new NotFoundException('Soal tidak ditemukan.');

    const graded = await this.grading.grade(
      code,
      p.testCases.map((t) => ({
        stdin: t.stdin,
        expected: t.expected,
        points: t.points,
        hidden: t.hidden,
        order: t.order,
      })),
      p.language,
      p.setupSql ?? undefined,
    );

    await this.prisma.submission.create({
      data: {
        problemId: id,
        userId: userId ?? null,
        code,
        language: p.language,
        passed: graded.passed,
        total: graded.total,
        score: graded.score,
        maxScore: graded.maxScore,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        detail: graded.results as any,
      },
    });

    return graded;
  }

  async similarity(problemId: string) {
    const subs = await this.prisma.submission.findMany({
      where: { problemId },
      select: { id: true, createdAt: true, code: true, score: true, userId: true },
      orderBy: { createdAt: 'asc' },
    });
    // userId disimpan tanpa relasi -> ambil identitas peserta batch; ujian dari ExamProblem.
    const userIds = [...new Set(subs.map((s) => s.userId).filter(Boolean))] as string[];
    const [users, exProblems] = await Promise.all([
      userIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, code: true },
          })
        : Promise.resolve([] as { id: string; name: string; code: string | null }[]),
      this.prisma.examProblem.findMany({
        where: { problemId },
        select: { exam: { select: { title: true } } },
      }),
    ]);
    const uMap = new Map(users.map((u) => [u.id, u]));
    const exam =
      [...new Set(exProblems.map((e) => e.exam?.title).filter(Boolean))].join(', ') || null;
    const who = (s: { id: string; userId: string | null }) => {
      const u = s.userId ? uMap.get(s.userId) : undefined;
      return u
        ? { name: u.name, code: u.code ?? null, subId: s.id }
        : { name: null, code: null, sub: s.id.slice(-6), subId: s.id };
    };
    const fps = subs.map((s) => ({ id: s.id, userId: s.userId, fp: codeFingerprint(s.code) }));
    const pairs: {
      a: { name: string | null; code: string | null; sub?: string };
      b: { name: string | null; code: string | null; sub?: string };
      similarity: number;
    }[] = [];
    for (let i = 0; i < fps.length; i++) {
      for (let j = i + 1; j < fps.length; j++) {
        const sim = simScore(fps[i].fp, fps[j].fp);
        if (sim >= 0.6) {
          pairs.push({ a: who(fps[i]), b: who(fps[j]), similarity: Math.round(sim * 100) });
        }
      }
    }
    pairs.sort((x, y) => y.similarity - x.similarity);
    return { total: subs.length, exam, pairs: pairs.slice(0, 100) };
  }

  // Detail sepasang submission: kode lengkap + indeks baris yang identik strukturnya.
  async similarityPair(aId: string, bId: string) {
    const [a, b] = await Promise.all([
      this.prisma.submission.findUnique({
        where: { id: aId },
        select: { id: true, code: true, userId: true },
      }),
      this.prisma.submission.findUnique({
        where: { id: bId },
        select: { id: true, code: true, userId: true },
      }),
    ]);
    if (!a || !b) throw new NotFoundException('Submission tidak ditemukan.');
    const userIds = [a.userId, b.userId].filter(Boolean) as string[];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, code: true },
        })
      : [];
    const uMap = new Map(users.map((u) => [u.id, u]));
    const who = (s: { id: string; userId: string | null }) => {
      const u = s.userId ? uMap.get(s.userId) : undefined;
      return u
        ? { name: u.name, code: u.code ?? null }
        : { name: null, code: null, sub: s.id.slice(-6) };
    };
    // Sorot baris yang tanda-tangan token-nya sama (>=3 token biar tak sekadar simbol).
    const sigA = lineSignatures(a.code);
    const sigB = lineSignatures(b.code);
    const meaningful = (sig: string) => sig.split(' ').filter(Boolean).length >= 3;
    const setA = new Set(sigA.filter(meaningful));
    const setB = new Set(sigB.filter(meaningful));
    const matchedA = sigA.map((s, i) => (meaningful(s) && setB.has(s) ? i : -1)).filter((i) => i >= 0);
    const matchedB = sigB.map((s, i) => (meaningful(s) && setA.has(s) ? i : -1)).filter((i) => i >= 0);
    const sim = Math.round(simScore(codeFingerprint(a.code), codeFingerprint(b.code)) * 100);
    return {
      similarity: sim,
      a: { ...who(a), source: a.code, matched: matchedA },
      b: { ...who(b), source: b.code, matched: matchedB },
    };
  }

  async authoringDetail(id: string) {
    const p = await this.prisma.problem.findUnique({
      where: { id },
      include: {
        testCases: { orderBy: { order: 'asc' } },
      },
    });
    if (!p) throw new NotFoundException('Soal tidak ditemukan.');
    return p;
  }

  async create(input: ProblemInput) {
    return this.prisma.problem.create({
      data: {
        title: input.title.slice(0, 200),
        description: input.description ?? '',
        language: input.language,
        difficulty: input.difficulty ?? 'mudah',
        starterCode: input.starterCode ?? '',
        setupSql: input.setupSql?.trim() ? input.setupSql : null,
        courseId: input.courseId ?? null,
        testCases: { create: normalizeCases(input.testCases) },
      },
      include: { testCases: true },
    });
  }

  async update(id: string, input: Partial<ProblemInput>) {
    const exists = await this.prisma.problem.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Soal tidak ditemukan.');
    const data: Record<string, unknown> = {};
    if (input.title !== undefined) data.title = input.title.slice(0, 200);
    if (input.description !== undefined) data.description = input.description ?? '';
    if (input.language !== undefined) data.language = input.language;
    if (input.difficulty !== undefined) data.difficulty = input.difficulty ?? 'mudah';
    if (input.starterCode !== undefined) data.starterCode = input.starterCode ?? '';
    if (input.setupSql !== undefined) data.setupSql = input.setupSql?.trim() ? input.setupSql : null;
    if (input.courseId !== undefined) data.courseId = input.courseId ?? null;
    if (input.testCases !== undefined) {
      await this.prisma.testCase.deleteMany({ where: { problemId: id } });
      data.testCases = { create: normalizeCases(input.testCases) };
    }
    return this.prisma.problem.update({
      where: { id },
      data,
      include: { testCases: true },
    });
  }

  async remove(id: string) {
    await this.prisma.problem.delete({ where: { id } }).catch(() => undefined);
    return { ok: true };
  }
}
