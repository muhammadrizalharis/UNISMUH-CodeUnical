import { Global, Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SsoService } from './sso.service';
import { SsoController } from './sso.controller';
import { RolesGuard } from './roles.guard';

@Global()
@Module({
  controllers: [AuthController, SsoController],
  providers: [AuthService, SsoService, RolesGuard],
  exports: [AuthService, RolesGuard],
})
export class AuthModule {}
