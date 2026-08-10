import { Controller, Get, UseGuards } from '@nestjs/common';
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
}
