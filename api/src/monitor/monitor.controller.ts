import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { MonitorService } from './monitor.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

// req.user diisi RolesGuard dari sesi login.
type Requester = { id: string; role: string };
const requester = (req: Request): Requester => (req as Request & { user: Requester }).user;

@Controller('monitor')
@UseGuards(RolesGuard)
@Roles('penguji', 'superadmin')
export class MonitorController {
  constructor(private readonly monitor: MonitorService) {}

  @Get('attempts')
  attempts(@Req() req: Request, @Query('examId') examId?: string) {
    return this.monitor.attempts(examId || undefined, requester(req));
  }

  @Get('exam-filters')
  examFilters(@Req() req: Request) {
    return this.monitor.examFilters(requester(req));
  }

  @Get('submissions')
  submissions(@Req() req: Request, @Query('problemId') problemId?: string) {
    return this.monitor.submissions(problemId || undefined, requester(req));
  }
}
