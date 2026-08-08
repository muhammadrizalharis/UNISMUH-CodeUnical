import { Controller, Get, Query } from '@nestjs/common';
import { MonitorService } from './monitor.service';

@Controller('monitor')
export class MonitorController {
  constructor(private readonly monitor: MonitorService) {}

  @Get('attempts')
  attempts() {
    return this.monitor.attempts();
  }

  @Get('submissions')
  submissions(@Query('problemId') problemId?: string) {
    return this.monitor.submissions(problemId);
  }
}
