import { Module } from '@nestjs/common';
import { MaterialsController } from './materials.controller';
import { MaterialsService } from './materials.service';
import { StorageService } from '../storage/storage.service';

@Module({
  controllers: [MaterialsController],
  providers: [MaterialsService, StorageService],
})
export class MaterialsModule {}
