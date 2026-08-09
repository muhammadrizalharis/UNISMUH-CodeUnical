import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

export interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

// Jenis materi yang diizinkan (pdf, ppt/pptx, doc/docx, teks/markdown).
const ALLOWED_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    'pptx',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
  'text/plain': 'txt',
  'text/markdown': 'md',
};

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

@Injectable()
export class MaterialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  list(courseId: string) {
    return this.prisma.material.findMany({
      where: { courseId },
      select: {
        id: true,
        title: true,
        filename: true,
        mimeType: true,
        size: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    courseId: string,
    file: UploadedFileLike | undefined,
    title: string | undefined,
    userId: string | undefined,
  ) {
    if (!file || !file.buffer?.length) {
      throw new BadRequestException('File wajib.');
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('Ukuran file maksimal 25 MB.');
    }
    const ext = ALLOWED_MIME[file.mimetype];
    if (!ext) {
      throw new BadRequestException(
        'Jenis file tidak didukung (pakai pdf/ppt/pptx/doc/docx/txt/md).',
      );
    }
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });
    if (!course) throw new NotFoundException('Mata kuliah tidak ditemukan.');

    const key = `materials/${courseId}/${randomUUID()}.${ext}`;
    const stored = await this.storage.put(key, file.buffer, file.mimetype);

    return this.prisma.material.create({
      data: {
        courseId,
        title: (title?.trim() || file.originalname).slice(0, 200),
        filename: file.originalname.slice(0, 255),
        mimeType: file.mimetype,
        size: file.size,
        objectKey: stored ? key : null,
        data: stored ? null : new Uint8Array(file.buffer),
        createdById: userId ?? null,
      },
      select: {
        id: true,
        title: true,
        filename: true,
        mimeType: true,
        size: true,
        createdAt: true,
      },
    });
  }

  async download(id: string) {
    const m = await this.prisma.material.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('Materi tidak ditemukan.');
    let buf: Buffer | null = null;
    if (m.objectKey) buf = await this.storage.get(m.objectKey);
    if (!buf && m.data) buf = Buffer.from(m.data);
    if (!buf) throw new NotFoundException('Isi materi tidak tersedia.');
    return { buf, mime: m.mimeType, filename: m.filename };
  }

  async remove(id: string) {
    const m = await this.prisma.material.findUnique({
      where: { id },
      select: { id: true, objectKey: true },
    });
    if (!m) return { ok: true };
    if (m.objectKey) await this.storage.remove(m.objectKey);
    await this.prisma.material.delete({ where: { id } }).catch(() => undefined);
    return { ok: true };
  }
}
