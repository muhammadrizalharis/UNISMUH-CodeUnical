import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { SsoService } from './sso.service';
import { AuthService } from './auth.service';

const SESSION_COOKIE = 'codeunical_session';
const STATE_COOKIE = 'codeunical_sso_state';
const sessionCookieOpts = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: false,
  path: '/',
  maxAge: 7 * 864e5,
};
const stateCookieOpts = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: false,
  path: '/',
  maxAge: 10 * 60 * 1000,
};

@Controller('auth/sso')
export class SsoController {
  constructor(
    private readonly sso: SsoService,
    private readonly auth: AuthService,
  ) {}

  /** Publik: frontend memakai ini untuk tahu apakah tombol SSO diaktifkan. */
  @Get('status')
  status() {
    return this.sso.status();
  }

  @Get('login')
  login(@Res() res: Response) {
    if (!this.sso.isEnabled()) {
      throw new BadRequestException('SSO belum dikonfigurasi.');
    }
    const state = randomBytes(16).toString('hex');
    res.cookie(STATE_COOKIE, state, stateCookieOpts);
    res.redirect(this.sso.authorizeUrl(state));
  }

  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() req: Request & { cookies?: Record<string, string> },
    @Res() res: Response,
  ) {
    const web = process.env.WEB_ORIGIN ?? 'http://localhost:47300';
    if (!this.sso.isEnabled()) {
      throw new BadRequestException('SSO belum dikonfigurasi.');
    }
    const saved = req.cookies?.[STATE_COOKIE];
    res.clearCookie(STATE_COOKIE, { path: '/' });
    try {
      if (!code || !state || !saved || state !== saved) {
        return res.redirect(`${web}/welcome?sso=error`);
      }
      const profile = await this.sso.handleCallback(code);
      const result = await this.auth.loginWithSso(profile);
      if ('pending' in result) {
        return res.redirect(`${web}/welcome?sso=pending`);
      }
      res.cookie(SESSION_COOKIE, result.token, sessionCookieOpts);
      const dest = result.user.role === 'peserta' ? '/exam' : '/dashboard';
      return res.redirect(`${web}${dest}`);
    } catch {
      return res.redirect(`${web}/welcome?sso=error`);
    }
  }
}
