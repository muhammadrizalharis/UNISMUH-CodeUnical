import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { StorageService } from '../storage/storage.service';

@Module({
  controllers: [AiController],
  providers: [AiService, StorageService],
})
export class AiModule {}
