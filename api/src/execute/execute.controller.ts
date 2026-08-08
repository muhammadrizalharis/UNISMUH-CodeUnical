import { Body, Controller, Post, BadRequestException } from '@nestjs/common';
import { ExecuteService } from './execute.service';

interface ExecuteDto {
  language?: string;
  code?: string;
}

@Controller('execute')
export class ExecuteController {
  constructor(private readonly execute: ExecuteService) {}

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
    if (language !== 'python') {
      throw new BadRequestException(`Bahasa "${language}" belum didukung (MVP: Python).`);
    }
    return this.execute.runPython(code);
  }
}
