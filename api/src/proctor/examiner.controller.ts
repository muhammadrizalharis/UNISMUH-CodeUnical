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

// Kelola whitelist wajah penguji (hanya penguji/superadmin).
@Controller('examiners')
@UseGuards(RolesGuard)
@Roles('penguji', 'superadmin')
export class ExaminerController {
  constructor(private readonly proctor: ProctorService) {}

  @Get()
  list() {
    return this.proctor.listExaminers();
  }

  @Post()
  enroll(@Body() body: { name?: string; image?: string }) {
    if (!body?.name || !body?.image) {
      throw new BadRequestException('name & image wajib.');
    }
    return this.proctor.enrollExaminer(body.name, body.image);
  }

  @Delete(':name')
  remove(@Param('name') name: string) {
    return this.proctor.removeExaminer(name);
  }
}
