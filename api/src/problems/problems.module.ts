import { Module } from '@nestjs/common';
import { ProblemsController } from './problems.controller';
import { ProblemsService } from './problems.service';
import { GradingModule } from '../grading/grading.module';

@Module({
  imports: [GradingModule],
  controllers: [ProblemsController],
  providers: [ProblemsService],
})
export class ProblemsModule {}
