import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ProblemsService } from './problems.service';
import type { ProblemInput } from './problems.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('problems')
export class ProblemsController {
  constructor(private readonly problems: ProblemsService) {}

  @Get()
  list() {
    return this.problems.list();
  }

  @Get('random')
  random() {
    return this.problems.random();
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.problems.detail(id);
  }

  @Get(':id/similarity')
  @UseGuards(RolesGuard)
  @Roles('penguji', 'superadmin')
  similarity(@Param('id') id: string) {
    return this.problems.similarity(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('penguji', 'superadmin')
  create(@Body() body: ProblemInput) {
    if (!body?.title?.trim() || !body?.language?.trim()) {
      throw new BadRequestException('title & language wajib.');
    }
    return this.problems.create(body);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('penguji', 'superadmin')
  update(@Param('id') id: string, @Body() body: Partial<ProblemInput>) {
    if (body?.title !== undefined && !body.title.trim()) {
      throw new BadRequestException('title tidak boleh kosong.');
    }
    if (body?.language !== undefined && !body.language.trim()) {
      throw new BadRequestException('language tidak boleh kosong.');
    }
    return this.problems.update(id, body);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('penguji', 'superadmin')
  remove(@Param('id') id: string) {
    return this.problems.remove(id);
  }

  @Post(':id/submit')
  submit(@Param('id') id: string, @Body() body: { code?: string }) {
    const code = body?.code ?? '';
    if (typeof code !== 'string' || !code.trim()) {
      throw new BadRequestException('Kode kosong.');
    }
    if (code.length > 100_000) {
      throw new BadRequestException('Kode terlalu panjang.');
    }
    return this.problems.submit(id, code);
  }
}
