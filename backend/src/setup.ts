import { RequestMethod } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { rateLimit } from './common/rate-limit';
import { AppConfig } from './config';
import { MetricsService } from './metrics/metrics.module';

/** HTTP setup shared by main.ts and the e2e tests, so tests exercise the real configuration. */
export function configureApp(app: NestExpressApplication, config: AppConfig): void {
  app.set('trust proxy', config.TRUST_PROXY);
  if (config.PUBLIC_DEMO) {
    // On public hosting there is no nginx in front to keep /metrics internal, so the demo closes it.
    app.use('/metrics', (_req: Request, res: Response) => {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
    });
  }
  app.use(app.get(MetricsService).httpMiddleware());
  app.use(helmet());
  if (config.PUBLIC_DEMO) {
    app.use(rateLimit(config.RATE_LIMIT_PER_MINUTE));
  }
  app.enableCors({ origin: config.CORS_ORIGIN });
  app.useBodyParser('json', { limit: '10kb' });
  // /health and /metrics stay outside /api: nginx only exposes /api, so metrics are internal-only.
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'metrics', method: RequestMethod.GET },
    ],
  });
  app.useGlobalFilters(new AllExceptionsFilter());
}
