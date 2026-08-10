import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ProctorService } from './proctor.service';
import { AuthService } from '../auth/auth.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SkipThrottle } from '@nestjs/throttler';

// Telemetry proctoring real-time (heartbeat/events/vision/snapshot) TIDAK boleh kena
// rate-limit: banyak peserta berbagi 1 IP (NAT lab) -> wajib dikecualikan.
@SkipThrottle()
@Controller('attempts')
export class ProctorController {
  constructor(
    private readonly proctor: ProctorService,
    private readonly auth: AuthService,
  ) {}

  @Post()
  async create(
    @Body() body: { problemId?: string; examId?: string },
    @Req() req: Request & { cookies?: Record<string, string> },
  ) {
    // Tautkan attempt ke peserta bila ada sesi login (best-effort; anonim tetap boleh).
    const user = await this.auth.getSessionUser(req.cookies?.['codeunical_session']);
    return this.proctor.createAttempt(body?.problemId, body?.examId, user?.id ?? undefined);
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
  @UseGuards(RolesGuard)
  @Roles('penguji', 'superadmin')
  replay(@Param('id') id: string) {
    return this.proctor.replay(id);
  }

  @Post(':id/snapshot')
  snapshot(
    @Param('id') id: string,
    @Body() body: { kind?: string; image?: string },
  ) {
    if (!body?.image || !body?.kind) {
      throw new BadRequestException('kind & image wajib.');
    }
    return this.proctor.saveSnapshot(id, body.kind, body.image);
  }

  @Post(':id/vision')
  vision(@Param('id') id: string, @Body() body: { image?: string }) {
    if (!body?.image) throw new BadRequestException('image wajib.');
    return this.proctor.visionCheck(id, body.image);
  }

  @Get(':id/snapshots')
  @UseGuards(RolesGuard)
  @Roles('penguji', 'superadmin')
  snapshots(@Param('id') id: string) {
    return this.proctor.listSnapshots(id);
  }
}

@SkipThrottle()
@Controller('snapshots')
export class SnapshotController {
  constructor(private readonly proctor: ProctorService) {}

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('penguji', 'superadmin')
  async serve(@Param('id') id: string, @Res() res: Response) {
    const s = await this.proctor.getSnapshot(id);
    if (!s) {
      res.status(404).send('not found');
      return;
    }
    res.set('Content-Type', s.mime).send(Buffer.from(s.image));
  }
}
