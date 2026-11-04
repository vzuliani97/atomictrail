import { loadConfig } from '../../src/config';

describe('configuration', () => {
  const env = { DATABASE_URL: 'postgres://localhost/test', JWT_SECRET: 'a'.repeat(64) };

  it('accepts a real secret', () => {
    expect(loadConfig(env).JWT_SECRET).toBe('a'.repeat(64));
  });

  it('refuses the JWT secret placeholder published in .env.example', () => {
    expect(() => loadConfig({ ...env, JWT_SECRET: 'replace-with-output-of-openssl-rand-hex-32' })).toThrow(/JWT_SECRET/);
  });

  it('refuses the published signing secrets in production, even with demo data', () => {
    const production = { ...env, NODE_ENV: 'production' };
    const signing = { CASINO_PROVIDER_SECRET: 'b'.repeat(48), DEMO_PARTNER_SECRET: 'c'.repeat(48) };

    expect(() => loadConfig(production)).toThrow(/CASINO_PROVIDER_SECRET.*DEMO_PARTNER_SECRET/);
    expect(() => loadConfig({ ...production, SEED_DEMO_DATA: 'true' })).toThrow(/CASINO_PROVIDER_SECRET/);
    expect(loadConfig({ ...production, SEED_DEMO_DATA: 'true', ...signing }).NODE_ENV).toBe('production');
  });

  it('keeps the demo defaults outside production', () => {
    expect(loadConfig(env).CASINO_PROVIDER_SECRET).toMatch(/^demo-/);
  });
});

describe('public demo configuration', () => {
  const env = {
    DATABASE_URL: 'postgres://localhost/test',
    JWT_SECRET: 'a'.repeat(64),
    PUBLIC_DEMO: 'true',
    DEMO_DATABASE_CONFIRMATION: 'nekobet_demo',
    CORS_ORIGIN: 'https://nekobet.netlify.app',
  };

  it('accepts an exact https origin and a named demo database', () => {
    expect(loadConfig(env).PUBLIC_DEMO).toBe(true);
  });

  it('requires the demo database name and one exact https origin', () => {
    expect(() => loadConfig({ ...env, DEMO_DATABASE_CONFIRMATION: undefined })).toThrow(/DEMO_DATABASE_CONFIRMATION/);
    expect(() => loadConfig({ ...env, CORS_ORIGIN: 'http://localhost:8081' })).toThrow(/CORS_ORIGIN/);
    expect(() => loadConfig({ ...env, CORS_ORIGIN: 'https://*.netlify.app' })).toThrow(/CORS_ORIGIN/);
  });

  it('allows the boot reset only in demo mode', () => {
    expect(() => loadConfig({ DATABASE_URL: env.DATABASE_URL, JWT_SECRET: env.JWT_SECRET, DEMO_RESET_ON_BOOT: 'true' })).toThrow(/DEMO_RESET_ON_BOOT/);
    expect(loadConfig({ ...env, DEMO_RESET_ON_BOOT: 'true' }).DEMO_RESET_ON_BOOT).toBe(true);
  });
});
