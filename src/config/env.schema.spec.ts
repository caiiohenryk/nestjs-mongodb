import { validateEnv } from './env.schema.js';

describe('validateEnv', () => {
  it('applies defaults when optional variables are missing', () => {
    const env = validateEnv({ MONGODB_URI: 'mongodb://localhost:27017/app' });

    expect(env).toEqual({ NODE_ENV: 'development', PORT: 3000, MONGODB_URI: 'mongodb://localhost:27017/app' });
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
});
