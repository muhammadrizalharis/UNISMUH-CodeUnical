import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ExecuteModule } from './execute/execute.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProblemsModule } from './problems/problems.module';
import { ProctorModule } from './proctor/proctor.module';
import { MonitorModule } from './monitor/monitor.module';
import { CoursesModule } from './courses/courses.module';
import { MaterialsModule } from './materials/materials.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ExecuteModule,
    ProblemsModule,
    ProctorModule,
    MonitorModule,
    CoursesModule,
    MaterialsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
