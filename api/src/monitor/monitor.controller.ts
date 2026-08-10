import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MonitorService } from './monitor.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('monitor')
@UseGuards(RolesGuard)
@Roles('penguji', 'superadmin')
export class MonitorController {
  constructor(private readonly monitor: MonitorService) {}

  @Get('attempts')
  attempts(@Query('examId') examId?: string) {
    return this.monitor.attempts(examId || undefined);
  }

  @Get('exam-filters')
  examFilters() {
    return this.monitor.examFilters();
  }

  @Get('submissions')
  submissions(@Query('problemId') problemId?: string) {
    return this.monitor.submissions(problemId);
  }
}
