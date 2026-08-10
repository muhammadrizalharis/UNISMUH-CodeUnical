import { Global, Module } from '@nestjs/common';
import { ProdiController } from './prodi.controller';
import { ProdiService } from './prodi.service';

@Global()
@Module({
  controllers: [ProdiController],
  providers: [ProdiService],
  exports: [ProdiService],
})
export class ProdiModule {}
