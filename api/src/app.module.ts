import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ExecuteModule } from './execute/execute.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProblemsModule } from './problems/problems.module';
import { ProctorModule } from './proctor/proctor.module';

@Module({
  imports: [PrismaModule, ExecuteModule, ProblemsModule, ProctorModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
