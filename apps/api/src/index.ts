import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { loadConfig } from './shared/config.js';
import { createLogger } from './shared/logger.js';

const config = loadConfig();
const logger = createLogger(config.logLevel);

const app = Fastify({
  loggerInstance: logger,
  requestIdHeader: 'x-request-id',
  genReqId: () => crypto.randomUUID(),
  trustProxy: true,
});

// ── Security middleware ────────────────────────────────────────────────────────
await app.register(helmet, { contentSecurityPolicy: false });
await app.register(cors, { origin: config.corsOrigins, credentials: true });
await app.register(rateLimit, { max: 100, timeWindow: '1 minute', redis: undefined });

// ── Health endpoints ───────────────────────────────────────────────────────────
app.get('/health', { logLevel: 'silent' }, async () => ({ status: 'ok', version: process.env['npm_package_version'] ?? '0.0.1' }));
app.get('/ready', { logLevel: 'silent' }, async () => ({ status: 'ready' }));

// ── Module routes (registered here as modules are built) ──────────────────────
// app.register(authRoutes, { prefix: '/v1/auth' });
// app.register(learningRoutes, { prefix: '/v1/learning' });
// app.register(commsRoutes, { prefix: '/v1/comms' });
// app.register(crmRoutes, { prefix: '/v1/crm' });
// app.register(financeRoutes, { prefix: '/v1/finance' });
// app.register(aiRoutes, { prefix: '/v1/ai' });
// app.register(analyticsRoutes, { prefix: '/v1/analytics' });
// app.register(gdprRoutes, { prefix: '/v1/gdpr' });
// app.register(migrationRoutes, { prefix: '/v1/migration' });

// ── Start ──────────────────────────────────────────────────────────────────────
try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
  logger.info({ port: config.port, env: config.nodeEnv }, 'Praxisa API started');
} catch (err) {
  logger.error(err, 'Failed to start server');
  process.exit(1);
}
