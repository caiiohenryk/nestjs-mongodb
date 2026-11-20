import { validateEnv } from './env.schema.js';

describe('validateEnv', () => {
  it('applies defaults when optional variables are missing', () => {
    const env = validateEnv({ MONGODB_URI: 'mongodb://localhost:27017/app' });

    expect(env).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      MONGODB_URI: 'mongodb://localhost:27017/app',
      ORDERS_DUAL_WRITE: false,
      ORDERS_READ_FROM_V2: false,
    });
  });

  it('coerces PORT to a number', () => {
    const env = validateEnv({ MONGODB_URI: 'mongodb+srv://cluster.example.net/app', PORT: '8080' });

    expect(env.PORT).toBe(8080);
  });

  it('throws when MONGODB_URI is missing', () => {
    expect(() => validateEnv({})).toThrow(/MONGODB_URI/);
  });

  it('throws when MONGODB_URI is not a mongodb url', () => {
    expect(() => validateEnv({ MONGODB_URI: 'postgres://localhost/app' })).toThrow(/MONGODB_URI/);
  });

  it('parses feature flags from strings', () => {
    const env = validateEnv({
      MONGODB_URI: 'mongodb://localhost/app',
      ORDERS_DUAL_WRITE: 'true',
      ORDERS_READ_FROM_V2: '1',
    });

    expect(env).toMatchObject({ ORDERS_DUAL_WRITE: true, ORDERS_READ_FROM_V2: true });
  });

  it('refuses to read from v2 without dual write', () => {
    expect(() => validateEnv({ MONGODB_URI: 'mongodb://localhost/app', ORDERS_READ_FROM_V2: 'true' })).toThrow(
      /ORDERS_READ_FROM_V2/,
    );
  });
});
