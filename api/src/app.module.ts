import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ExecuteModule } from './execute/execute.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProblemsModule } from './problems/problems.module';
import { ProctorModule } from './proctor/proctor.module';
import { MonitorModule } from './monitor/monitor.module';
import { CoursesModule } from './courses/courses.module';
import { MaterialsModule } from './materials/materials.module';
import { ExamsModule } from './exams/exams.module';
import { AiModule } from './ai/ai.module';
import { ProdiModule } from './prodi/prodi.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    // Rate-limit global: 300 permintaan / menit / IP (cegah brute-force & spam).
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 300 }] }),
    PrismaModule,
    AuthModule,
    ExecuteModule,
    ProblemsModule,
    ProctorModule,
    MonitorModule,
    CoursesModule,
    MaterialsModule,
    ExamsModule,
    AiModule,
    ProdiModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
