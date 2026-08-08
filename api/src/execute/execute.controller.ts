import { Body, Controller, Get, Post, BadRequestException } from '@nestjs/common';
import {
  ExecuteService,
  SUPPORTED_LANGUAGES,
  LANGUAGE_LABELS,
} from './execute.service';

interface ExecuteDto {
  language?: string;
  code?: string;
}

@Controller('execute')
export class ExecuteController {
  constructor(private readonly execute: ExecuteService) {}

  @Get('languages')
  languages() {
    return SUPPORTED_LANGUAGES.map((id) => ({ id, label: LANGUAGE_LABELS[id] }));
  }

  @Post()
  async run(@Body() body: ExecuteDto) {
    const code = body?.code ?? '';
    const language = body?.language ?? 'python';
    if (typeof code !== 'string' || code.length === 0) {
      throw new BadRequestException('Kode kosong.');
    }
    if (code.length > 100_000) {
      throw new BadRequestException('Kode terlalu panjang.');
    }
    if (!this.execute.isSupported(language)) {
      throw new BadRequestException(
        `Bahasa "${language}" belum didukung. Didukung: ${SUPPORTED_LANGUAGES.join(', ')}.`,
      );
    }
    return this.execute.run(language, code);
  }
}
