import { Module } from '@nestjs/common';
import { ExamsController } from './exams.controller';
import { ExamsPublicController } from './exams-public.controller';
import { ExamsService } from './exams.service';

@Module({
  controllers: [ExamsController, ExamsPublicController],
  providers: [ExamsService],
})
export class ExamsModule {}
