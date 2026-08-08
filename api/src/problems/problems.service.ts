import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GradingService } from '../grading/grading.service';
import { codeFingerprint, similarity as simScore } from '../similarity/similarity';

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
}
