import { z } from 'zod';

const configSchema = z.object({
  nodeEnv:     z.enum(['development', 'staging', 'production']).default('development'),
  port:        z.coerce.number().default(3000),
  logLevel:    z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  corsOrigins: z.string().transform(s => s.split(',')),
  databaseUrl: z.string().url(),
  redisUrl:    z.string().url(),
  jwt: z.object({
    privateKey: z.string().min(1),
    publicKey:  z.string().min(1),
  }),
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(): AppConfig {
  const result = configSchema.safeParse({
    nodeEnv:     process.env['NODE_ENV'],
    port:        process.env['PORT'],
    logLevel:    process.env['LOG_LEVEL'],
    corsOrigins: process.env['CORS_ORIGINS'] ?? 'http://localhost:5173',
    databaseUrl: process.env['DATABASE_URL'],
    redisUrl:    process.env['REDIS_URL'],
    jwt: {
      // Doppler stores keys as base64-encoded PEM — decode at startup
      privateKey: process.env['JWT_SIGNING_KEY']
        ? Buffer.from(process.env['JWT_SIGNING_KEY'], 'base64').toString('utf-8')
        : '',
      publicKey: process.env['JWT_SIGNING_KEY_PUBLIC']
        ? Buffer.from(process.env['JWT_SIGNING_KEY_PUBLIC'], 'base64').toString('utf-8')
        : '',
    },
  });

  if (!result.success) {
    console.error('Invalid configuration:', result.error.flatten());
    process.exit(1);
  }

  return result.data;
}
