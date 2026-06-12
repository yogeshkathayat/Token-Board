import Fastify, { type FastifyInstance } from 'fastify';

import { config, isOidcConfigured } from './config.js';
import { db, closeDb, pingDb } from './db/index.js';
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

  // Liveness only — the process is up. Cheap and dependency-free.
  app.get('/healthz', async () => ({ ok: true }));
  // Readiness — verifies the DB is actually reachable so an LB/uptime check can
  // tell a wedged-but-running API apart from a healthy one.
  app.get('/api/v1/healthz', async (_req, reply) => {
    const dbOk = await pingDb();
    if (!dbOk) {
      return reply.code(503).send({ ok: false, db: false, oidc: isOidcConfigured() });
    }
    return { ok: true, db: true, oidc: isOidcConfigured() };
  });

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

  // Graceful shutdown: let Fastify drain in-flight requests and run onClose
  // hooks (stop the cron, close the DB pool) before the container exits.
  let shuttingDown = false;
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      if (shuttingDown) return;
      shuttingDown = true;
      app.log.info({ signal }, 'shutting down');
      app
        .close()
        .then(() => process.exit(0))
        .catch((err) => {
          app.log.error({ err }, 'error during shutdown');
          process.exit(1);
        });
    });
  }
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
