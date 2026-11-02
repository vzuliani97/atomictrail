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
