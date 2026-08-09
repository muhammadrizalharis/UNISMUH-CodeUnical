import { Module } from '@nestjs/common';
import { ProctorController, SnapshotController } from './proctor.controller';
import { ExaminerController } from './examiner.controller';
import { ProctorService } from './proctor.service';
import { StorageService } from '../storage/storage.service';

@Module({
  controllers: [ProctorController, SnapshotController, ExaminerController],
  providers: [ProctorService, StorageService],
})
export class ProctorModule {}
