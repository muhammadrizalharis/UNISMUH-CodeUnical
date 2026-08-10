import { BadRequestException, Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ProdiService } from './prodi.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('prodi')
export class ProdiController {
  constructor(private readonly prodi: ProdiService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('penguji', 'superadmin')
  list() {
    return this.prodi.list();
  }

  @Post('toggle')
  @UseGuards(RolesGuard)
  @Roles('superadmin')
  async toggle(@Body() body: { code?: string; on?: boolean }) {
    if (!body?.code?.trim()) throw new BadRequestException('code prodi wajib.');
    await this.prodi.toggle(body.code.trim(), body.on !== false);
    return this.prodi.list();
  }
}
