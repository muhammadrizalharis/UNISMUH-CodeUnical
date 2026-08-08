import { Module } from '@nestjs/common';
import { ExecuteController } from './execute.controller';
import { ExecuteService } from './execute.service';

@Module({
  controllers: [ExecuteController],
  providers: [ExecuteService],
  exports: [ExecuteService],
})
export class ExecuteModule {}
