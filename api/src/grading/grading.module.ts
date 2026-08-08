import { Module } from '@nestjs/common';
import { GradingService } from './grading.service';
import { ExecuteModule } from '../execute/execute.module';

@Module({
  imports: [ExecuteModule],
  providers: [GradingService],
  exports: [GradingService],
})
export class GradingModule {}
