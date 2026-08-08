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
    const now = Date.now();
    return rows.map((a) => ({
      id: a.id,
      problemId: a.problemId,
      status: a.status,
      strikes: a.strikes,
      startedAt: a.startedAt,
      lastSeenAt: a.lastSeenAt,
      live: now - new Date(a.lastSeenAt).getTime() < 30_000,
      events: a._count.events,
      keystrokes: a._count.keystrokes,
    }));
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
