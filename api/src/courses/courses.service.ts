import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.course.findMany({
      orderBy: [{ semester: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        semester: true,
        createdById: true,
        _count: { select: { problems: true } },
      },
    });
  }

  async detail(id: string) {
    const c = await this.prisma.course.findUnique({
      where: { id },
      include: {
        problems: {
          select: { id: true, title: true, language: true, difficulty: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!c) throw new NotFoundException('Mata kuliah tidak ditemukan.');
    return c;
  }

  create(name: string, semester: number | null, code: string | null, createdById: string | null) {
    return this.prisma.course.create({
      data: { name: name.slice(0, 160), semester, code, createdById },
    });
  }
}
