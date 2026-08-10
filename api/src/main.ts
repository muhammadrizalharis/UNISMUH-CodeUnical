import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Di belakang reverse proxy / tunnel (cloudflared, nginx): percayai 1 hop proxy
  // agar secure-cookie & rate-limit per-IP membaca X-Forwarded-* dengan benar.
  (app.getHttpAdapter().getInstance() as { set(k: string, v: unknown): void }).set(
    'trust proxy',
    1,
  );
  app.use(helmet());
  app.use(cookieParser());
  const origins = (process.env.WEB_ORIGIN ?? 'http://localhost:47300').split(',');
  app.enableCors({ origin: origins, credentials: true });
  const host = process.env.API_HOST ?? '0.0.0.0';
  await app.listen(Number(process.env.API_PORT ?? 47080), host);
}
void bootstrap();
