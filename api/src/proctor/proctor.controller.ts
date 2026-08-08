import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { ProctorService } from './proctor.service';

@Controller('attempts')
export class ProctorController {
  constructor(private readonly proctor: ProctorService) {}

  @Post()
  create(@Body() body: { problemId?: string }) {
    return this.proctor.createAttempt(body?.problemId);
  }

  @Post(':id/events')
  events(
    @Param('id') id: string,
    @Body() body: { events?: { kind: string; meta?: unknown }[] },
  ) {
    const events = Array.isArray(body?.events) ? body.events.slice(0, 50) : [];
    if (!events.length) throw new BadRequestException('events kosong.');
    return this.proctor.logEvents(id, events);
  }

  @Post(':id/keys')
  keys(
    @Param('id') id: string,
    @Body() body: { keys?: { t: number; value: string }[] },
  ) {
    const keys = Array.isArray(body?.keys) ? body.keys : [];
    return this.proctor.logKeys(id, keys);
  }

  @Post(':id/heartbeat')
  heartbeat(@Param('id') id: string) {
    return this.proctor.heartbeat(id);
  }

  @Get(':id/replay')
  replay(@Param('id') id: string) {
    return this.proctor.replay(id);
  }
}
