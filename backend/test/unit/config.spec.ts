import { loadConfig } from '../../src/config';

describe('configuration', () => {
  const env = { DATABASE_URL: 'postgres://localhost/test', JWT_SECRET: 'a'.repeat(64) };

  it('accepts a real secret', () => {
    expect(loadConfig(env).JWT_SECRET).toBe('a'.repeat(64));
  });

  it('refuses the JWT secret placeholder published in .env.example', () => {
    expect(() => loadConfig({ ...env, JWT_SECRET: 'replace-with-output-of-openssl-rand-hex-32' })).toThrow(/JWT_SECRET/);
  });

  it('refuses the published demo secrets in production without demo data', () => {
    expect(() => loadConfig({ ...env, NODE_ENV: 'production' })).toThrow(/CASINO_PROVIDER_SECRET.*DEMO_PARTNER_SECRET/);
    expect(loadConfig({ ...env, NODE_ENV: 'production', SEED_DEMO_DATA: 'true' }).NODE_ENV).toBe('production');
  });
});
