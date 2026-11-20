import { z } from 'zod';

export const NodeEnv = {
  Development: 'development',
  Test: 'test',
  Production: 'production',
} as const;

export const envSchema = z.object({
  NODE_ENV: z.enum([NodeEnv.Development, NodeEnv.Test, NodeEnv.Production]).default(NodeEnv.Development),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  MONGODB_URI: z.url({ protocol: /^mongodb(\+srv)?$/ }),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid environment variables: ${z.prettifyError(result.error)}`);
  }
  return result.data;
}
