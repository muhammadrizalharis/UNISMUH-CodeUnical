import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import type { GenerateInput } from './ai.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('courses')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post(':courseId/generate-soal')
  @UseGuards(RolesGuard)
  @Roles('penguji', 'superadmin')
  generate(
    @Param('courseId') courseId: string,
    @Body() body: GenerateInput,
  ) {
    return this.ai.generate(courseId, body);
  }
}
