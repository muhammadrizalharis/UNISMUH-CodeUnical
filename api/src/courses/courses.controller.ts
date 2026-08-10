import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CoursesService } from './courses.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('courses')
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  @Get()
  list() {
    return this.courses.list();
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.courses.detail(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('penguji', 'superadmin')
  create(
    @Body() body: { name?: string; semester?: number; code?: string },
    @Req() req: Request & { user?: { id: string } },
  ) {
    if (!body?.name?.trim()) throw new BadRequestException('name wajib.');
    return this.courses.create(
      body.name.trim(),
      body.semester ?? null,
      body.code?.trim() || null,
      req.user?.id ?? null,
    );
  }

  @Post('import-sicekcok')
  @UseGuards(RolesGuard)
  @Roles('penguji', 'superadmin')
  importSicekcok(
    @Body() body: { periode?: string; kodeProdi?: string; kodeFakultas?: string },
    @Req() req: Request & { user?: { id: string } },
  ) {
    if (!body?.periode?.trim()) throw new BadRequestException('periode wajib.');
    return this.courses.importFromSicekcok(
      {
        periode: body.periode.trim(),
        kodeProdi: body.kodeProdi?.trim() || undefined,
        kodeFakultas: body.kodeFakultas?.trim() || undefined,
      },
      req.user?.id ?? null,
    );
  }
}
