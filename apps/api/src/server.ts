import Fastify, { type FastifyInstance } from 'fastify';

import { config, isOidcConfigured } from './config.js';
import { db, closeDb } from './db/index.js';
import { registerPlugins } from './plugins/index.js';
import { registerRoutes } from './routes/index.js';
import { installScriptRoutes } from './routes/install.js';
import { startLeaderboardCron } from './services/leaderboard-cron.js';

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      ...(config.env === 'production'
        ? {}
        : { transport: { target: 'pino-pretty', options: { colorize: true } } }),
    },
    trustProxy: true,
    bodyLimit: 4 * 1024 * 1024,
    ajv: { customOptions: { removeAdditional: 'all', useDefaults: true, coerceTypes: true } },
    genReqId: () => crypto.randomUUID(),
  });

  app.decorate('config', config);
  app.decorate('db', db);

  await registerPlugins(app);
  await registerRoutes(app);
  await app.register(installScriptRoutes);

  app.setErrorHandler((err, req, reply) => {
    const statusCode = (err as { statusCode?: number }).statusCode ?? 500;
    if (statusCode >= 500) {
      req.log.error({ err, reqId: req.id }, 'request failed');
    } else {
      req.log.warn({ err: { message: err.message }, reqId: req.id }, 'request rejected');
    }
    return reply.status(statusCode).send({
      error: err.name || 'Error',
      message: statusCode >= 500 ? 'Internal server error' : err.message,
    });
  });

  app.get('/healthz', async () => ({ ok: true }));
  app.get('/api/v1/healthz', async () => ({ ok: true, oidc: isOidcConfigured() }));

  app.addHook('onClose', async () => {
    await closeDb();
  });

  return app;
}

async function start(): Promise<void> {
  const app = await buildServer();
  if (!config.leaderboardRefreshDisabled) {
    startLeaderboardCron(app);
  }
  await app.listen({ port: config.port, host: config.host });
}

const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  start().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

declare module 'fastify' {
  interface FastifyInstance {
    config: typeof config;
    db: typeof db;
  }
}
