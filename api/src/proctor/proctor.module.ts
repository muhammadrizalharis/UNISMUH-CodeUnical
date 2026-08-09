import { Module } from '@nestjs/common';
import { ProctorController, SnapshotController } from './proctor.controller';
import { ProctorService } from './proctor.service';
import { StorageService } from '../storage/storage.service';

@Module({
  controllers: [ProctorController, SnapshotController],
  providers: [ProctorService, StorageService],
})
export class ProctorModule {}
