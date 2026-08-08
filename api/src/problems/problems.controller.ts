import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { ProblemsService } from './problems.service';

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
