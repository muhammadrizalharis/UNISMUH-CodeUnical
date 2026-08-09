import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const roles =
      this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) ?? [];
    const req = ctx
      .switchToHttp()
      .getRequest<Request & { cookies?: Record<string, string> }>();
    const user = await this.auth.getSessionUser(req.cookies?.['codeunical_session']);
    (req as unknown as { user?: unknown }).user = user ?? undefined;
    if (roles.length === 0) return true;
    if (!user) throw new UnauthorizedException();
    if (!roles.includes(user.role)) throw new ForbiddenException();
    return true;
  }
}
