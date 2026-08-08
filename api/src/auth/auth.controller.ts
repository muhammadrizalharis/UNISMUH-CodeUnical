import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';

const COOKIE = 'codeunical_session';
const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: false,
  path: '/',
  maxAge: 7 * 864e5,
};

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  async login(
    @Body() body: { email?: string; password?: string; gate?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!body?.email || !body?.password) {
      throw new BadRequestException('Email dan sandi wajib.');
    }
    const { token, user } = await this.auth.login(body.email, body.password, body.gate);
    res.cookie(COOKIE, token, cookieOpts);
    return { user };
  }

  @Get('me')
  async me(@Req() req: Request & { cookies?: Record<string, string> }) {
    return this.auth.getSessionUser(req.cookies?.[COOKIE]);
  }

  @Post('logout')
  async logout(
    @Req() req: Request & { cookies?: Record<string, string> },
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(req.cookies?.[COOKIE]);
    res.clearCookie(COOKIE, { path: '/' });
    return { ok: true };
  }

  @Get('users')
  @UseGuards(RolesGuard)
  @Roles('penguji', 'superadmin')
  users() {
    return this.auth.listUsers();
  }

  @Post('users')
  @UseGuards(RolesGuard)
  @Roles('superadmin')
  createUser(@Body() body: { email?: string; name?: string; password?: string }) {
    if (!body?.email || !body?.name || !body?.password) {
      throw new BadRequestException('email, name, password wajib.');
    }
    if (body.password.length < 8) {
      throw new BadRequestException('Sandi minimal 8 karakter.');
    }
    return this.auth.createPenguji(body.email, body.name, body.password);
  }
}
