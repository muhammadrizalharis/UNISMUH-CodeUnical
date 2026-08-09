import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ExamsService } from './exams.service';
import type { ExamInput } from './exams.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('exams')
@UseGuards(RolesGuard)
@Roles('penguji', 'superadmin')
export class ExamsController {
  constructor(private readonly exams: ExamsService) {}

  @Get()
  list(@Query('courseId') courseId?: string) {
    return this.exams.list(courseId);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.exams.detail(id);
  }

  @Post()
  create(@Body() body: ExamInput, @Req() req: Request) {
    const user = (req as unknown as { user?: { id?: string } }).user;
    return this.exams.create(body, user?.id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: Partial<ExamInput>) {
    return this.exams.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.exams.remove(id);
  }
}
