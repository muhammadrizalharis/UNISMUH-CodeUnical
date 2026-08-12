import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ProctorService } from './proctor.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

// Wajah penguji: enroll (POST) utk penguji+superadmin; lihat daftar (GET) & hapus (DELETE) HANYA superadmin.
@Controller('examiners')
@UseGuards(RolesGuard)
@Roles('penguji', 'superadmin')
export class ExaminerController {
  constructor(private readonly proctor: ProctorService) {}

  @Get()
  @Roles('superadmin')
  list() {
    return this.proctor.listExaminers();
  }

  @Post()
  enroll(@Body() body: { name?: string; images?: string[] }) {
    if (!body?.name || !Array.isArray(body.images) || body.images.length < 3) {
      throw new BadRequestException('name & minimal 3 foto (depan/kiri/kanan) wajib.');
    }
    return this.proctor.enrollExaminer(body.name, body.images);
  }

  @Delete(':name')
  @Roles('superadmin')
  remove(@Param('name') name: string) {
    return this.proctor.removeExaminer(name);
  }
}
