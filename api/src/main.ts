import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const origins = (process.env.WEB_ORIGIN ?? 'http://localhost:47300').split(',');
  app.enableCors({ origin: origins });
  await app.listen(Number(process.env.API_PORT ?? 47080), '0.0.0.0');
}
void bootstrap();
