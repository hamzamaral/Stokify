import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp, setupSwagger } from './app.setup';
import { EnvConfig } from './config/env.validation';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  configureApp(app);
  setupSwagger(app);

  const port = app.get(ConfigService<EnvConfig, true>).get('PORT', { infer: true });
  await app.listen(port);
  app.get(Logger).log(`Stokify API http://localhost:${port}/api/v1 adresinde çalışıyor`);
  app.get(Logger).log(`Swagger: http://localhost:${port}/api/docs`);
}

bootstrap();
