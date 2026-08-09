import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GradingService } from '../grading/grading.service';
import { codeFingerprint, similarity as simScore } from '../similarity/similarity';

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

  async submit(id: string, code: string) {
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
      select: { id: true, createdAt: true, code: true, score: true },
      orderBy: { createdAt: 'asc' },
    });
    const fps = subs.map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      score: s.score,
      fp: codeFingerprint(s.code),
    }));
    const pairs: { a: string; b: string; similarity: number }[] = [];
    for (let i = 0; i < fps.length; i++) {
      for (let j = i + 1; j < fps.length; j++) {
        const sim = simScore(fps[i].fp, fps[j].fp);
        if (sim >= 0.6) {
          pairs.push({
            a: fps[i].id,
            b: fps[j].id,
            similarity: Math.round(sim * 100),
          });
        }
      }
    }
    pairs.sort((x, y) => y.similarity - x.similarity);
    return { total: subs.length, pairs: pairs.slice(0, 100) };
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
