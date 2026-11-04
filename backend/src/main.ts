import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { APP_CONFIG, AppConfig } from './config';
import { DatabaseService } from './database/database.service';
import { assertDemoDatabase, resetDemoData } from './database/demo-reset';
import { runMigrations } from './database/migrate';
import { seedDemoData } from './database/seed';
import { configureApp } from './setup';

async function bootstrap(): Promise<void> {
  // rawBody keeps the exact request bytes, which the partner HMAC signature is computed over.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const config = app.get<AppConfig>(APP_CONFIG);
  const logger = new Logger('Bootstrap');

  configureApp(app, config);

  const db = app.get(DatabaseService);
  if (config.PUBLIC_DEMO) {
    await assertDemoDatabase(db.pool, config.DEMO_DATABASE_CONFIRMATION);
  }
  const applied = await runMigrations(db.pool);
  logger.log(applied.length ? `Applied migrations: ${applied.join(', ')}` : 'Database schema is up to date');

  // Before listen(), so the live feed (started on module init) refills the board after the reset.
  if (config.DEMO_RESET_ON_BOOT) {
    await resetDemoData(db.pool);
    logger.log(`Demo data reset at ${new Date().toISOString()}`);
  }

  if (config.SEED_DEMO_DATA) {
    await seedDemoData(db.pool, config);
    logger.log('Demo data ready');
  }

  app.enableShutdownHooks();
  await app.listen(config.PORT);
  logger.log(`PayPoint API listening on port ${config.PORT}`);
}

void bootstrap();
