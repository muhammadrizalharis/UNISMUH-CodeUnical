import { Module } from '@nestjs/common';
import { ProctorController, SnapshotController } from './proctor.controller';
import { ProctorService } from './proctor.service';

@Module({
  controllers: [ProctorController, SnapshotController],
  providers: [ProctorService],
})
export class ProctorModule {}
