import { Controller, Get, Param } from '@nestjs/common';
import { ExamsService } from './exams.service';

/** Endpoint publik (tanpa guard) untuk peserta melihat & masuk ujian tayang. */
@Controller('public/exams')
export class ExamsPublicController {
  constructor(private readonly exams: ExamsService) {}

  @Get()
  list() {
    return this.exams.listPublic();
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.exams.publicDetail(id);
  }
}
