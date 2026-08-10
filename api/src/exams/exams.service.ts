import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ExamInput {
  courseId: string;
  title: string;
  description?: string;
  durationMin: number;
  startAt: string;
  endAt: string;
  published?: boolean;
  problemIds?: string[];
}

function parseSchedule(input: {
  durationMin?: number;
  startAt?: string;
  endAt?: string;
}) {
  const duration = Number(input.durationMin);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new BadRequestException('Durasi (menit) harus > 0.');
  }
  const start = new Date(String(input.startAt));
  const end = new Date(String(input.endAt));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new BadRequestException('Jadwal mulai/selesai tidak valid.');
  }
  if (end <= start) {
    throw new BadRequestException('Jadwal selesai harus setelah mulai.');
  }
  return { duration, start, end };
}

@Injectable()
export class ExamsService {
  constructor(private readonly prisma: PrismaService) {}

  list(courseId?: string) {
    return this.prisma.exam.findMany({
      where: courseId ? { courseId } : undefined,
      select: {
        id: true,
        courseId: true,
        title: true,
        durationMin: true,
        startAt: true,
        endAt: true,
        published: true,
        createdAt: true,
        _count: { select: { problems: true } },
      },
      orderBy: { startAt: 'desc' },
    });
  }

  async detail(id: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      include: {
        problems: {
          orderBy: { order: 'asc' },
          include: {
            problem: {
              select: { id: true, title: true, language: true, difficulty: true },
            },
          },
        },
      },
    });
    if (!exam) throw new NotFoundException('Ujian tidak ditemukan.');
    return exam;
  }

  private async validProblemIds(courseId: string, ids: string[]) {
    if (!ids.length) return [];
    const rows = await this.prisma.problem.findMany({
      where: { id: { in: ids }, courseId },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  async create(input: ExamInput, userId?: string) {
    if (!input?.title?.trim()) throw new BadRequestException('Judul wajib.');
    if (!input?.courseId) throw new BadRequestException('Mata kuliah wajib.');
    const course = await this.prisma.course.findUnique({
      where: { id: input.courseId },
      select: { id: true },
    });
    if (!course) throw new NotFoundException('Mata kuliah tidak ditemukan.');
    const { duration, start, end } = parseSchedule(input);
    const validIds = await this.validProblemIds(
      input.courseId,
      input.problemIds ?? [],
    );
    return this.prisma.exam.create({
      data: {
        courseId: input.courseId,
        title: input.title.slice(0, 200),
        description: input.description ?? '',
        durationMin: duration,
        startAt: start,
        endAt: end,
        published: Boolean(input.published),
        createdById: userId ?? null,
        problems: {
          create: validIds.map((pid, i) => ({ problemId: pid, order: i + 1 })),
        },
      },
      include: { problems: true },
    });
  }

  async update(id: string, input: Partial<ExamInput>) {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      select: { id: true, courseId: true },
    });
    if (!exam) throw new NotFoundException('Ujian tidak ditemukan.');

    const data: Record<string, unknown> = {};
    if (input.title !== undefined) {
      if (!input.title.trim()) throw new BadRequestException('Judul tidak boleh kosong.');
      data.title = input.title.slice(0, 200);
    }
    if (input.description !== undefined) data.description = input.description ?? '';
    if (input.published !== undefined) data.published = Boolean(input.published);
    if (
      input.durationMin !== undefined ||
      input.startAt !== undefined ||
      input.endAt !== undefined
    ) {
      const current = await this.prisma.exam.findUnique({
        where: { id },
        select: { durationMin: true, startAt: true, endAt: true },
      });
      const { duration, start, end } = parseSchedule({
        durationMin: input.durationMin ?? current?.durationMin,
        startAt: input.startAt ?? current?.startAt.toISOString(),
        endAt: input.endAt ?? current?.endAt.toISOString(),
      });
      data.durationMin = duration;
      data.startAt = start;
      data.endAt = end;
    }
    if (input.problemIds !== undefined) {
      const validIds = await this.validProblemIds(exam.courseId, input.problemIds);
      await this.prisma.examProblem.deleteMany({ where: { examId: id } });
      data.problems = {
        create: validIds.map((pid, i) => ({ problemId: pid, order: i + 1 })),
      };
    }
    return this.prisma.exam.update({
      where: { id },
      data,
      include: { problems: true },
    });
  }

  async remove(id: string) {
    await this.prisma.exam.delete({ where: { id } }).catch(() => undefined);
    return { ok: true };
  }

  /** Daftar ujian yang sudah TAYANG (published) — untuk peserta. */
  listPublic() {
    return this.prisma.exam.findMany({
      where: { published: true },
      select: {
        id: true,
        title: true,
        description: true,
        durationMin: true,
        startAt: true,
        endAt: true,
        course: { select: { name: true } },
        _count: { select: { problems: true } },
      },
      orderBy: { startAt: 'asc' },
    });
  }

  /** Detail ujian tayang + daftar soal (bentuk publik) untuk peserta. */
  async publicDetail(id: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        durationMin: true,
        startAt: true,
        endAt: true,
        published: true,
        course: { select: { name: true } },
        problems: {
          orderBy: { order: 'asc' },
          select: {
            order: true,
            problem: {
              select: { id: true, title: true, language: true, difficulty: true },
            },
          },
        },
      },
    });
    if (!exam || !exam.published) {
      throw new NotFoundException('Ujian tidak tersedia.');
    }
    return {
      id: exam.id,
      title: exam.title,
      description: exam.description,
      durationMin: exam.durationMin,
      startAt: exam.startAt,
      endAt: exam.endAt,
      courseName: exam.course?.name ?? null,
      problems: exam.problems.map((ep) => ({
        order: ep.order,
        id: ep.problem.id,
        title: ep.problem.title,
        language: ep.problem.language,
        difficulty: ep.problem.difficulty,
      })),
    };
  }
}
