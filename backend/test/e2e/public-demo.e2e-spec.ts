import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { APP_CONFIG, AppConfig } from '../../src/config';
import { assertDemoDatabase, resetDemoData } from '../../src/database/demo-reset';
import { seedDemoData } from '../../src/database/seed';
import { configureApp } from '../../src/setup';
import { createTestApp, resetDatabase, TestContext } from './helpers';

describe('Public demo safeguards', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.pool);
  });

  const count = async (table: string) => Number((await ctx.pool.query(`SELECT count(*) FROM ${table}`)).rows[0].count);

  it('refuses a database whose name is not the confirmed demo database', async () => {
    const { rows } = await ctx.pool.query<{ name: string }>('SELECT current_database() AS name');
    await expect(assertDemoDatabase(ctx.pool, 'nekobet_demo_other')).rejects.toThrow(/Refusing to start/);
    await expect(assertDemoDatabase(ctx.pool, undefined)).rejects.toThrow(/Refusing to start/);
    await expect(assertDemoDatabase(ctx.pool, rows[0].name)).resolves.toBeUndefined();
  });

  it('empties every business table, keeping the schema, and the seed loads the demo again', async () => {
    const config = ctx.app.get<AppConfig>(APP_CONFIG);
    await seedDemoData(ctx.pool, config);
    expect(await count('users')).toBeGreaterThan(0);

    await resetDemoData(ctx.pool);
    expect([await count('users'), await count('points_of_sale'), await count('partners'), await count('products')]).toEqual([0, 0, 0, 0]);
    expect(await count('schema_migrations')).toBeGreaterThan(0);

    await seedDemoData(ctx.pool, config);
    expect(await count('users')).toBeGreaterThan(0);
  });

  describe('HTTP in demo mode', () => {
    let demo: NestExpressApplication;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
      demo = moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true, logger: false });
      configureApp(demo, { ...demo.get<AppConfig>(APP_CONFIG), PUBLIC_DEMO: true, RATE_LIMIT_PER_MINUTE: 3 });
      await demo.listen(0, '127.0.0.1');
    });

    afterAll(async () => {
      await demo.close();
    });

    it('closes /metrics, which nginx keeps internal locally but nothing guards on public hosting', async () => {
      const res = await request(demo.getHttpServer()).get('/metrics').expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
      await ctx.http().get('/metrics').expect(200);
    });

    it('answers 429 with Retry-After once a client passes the limit', async () => {
      const server = demo.getHttpServer();
      for (let i = 0; i < 3; i += 1) await request(server).get('/health');
      const res = await request(server).get('/health').expect(429);
      expect(res.headers['retry-after']).toBeDefined();
      expect(res.body.error.code).toBe('RATE_LIMITED');
    });
  });
});
