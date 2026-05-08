import type { FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';

import { config } from '../config.js';
import { authPlugin } from '../auth/plugin.js';

export async function registerPlugins(app: FastifyInstance): Promise<void> {
  await app.register(sensible);
  await app.register(helmet, {
    // The dashboard is served from the same origin via nginx, so a relaxed
    // CSP here doesn't help; let nginx own headers.
    contentSecurityPolicy: false,
  });
  await app.register(cookie, { secret: config.jwtSecret });
  await app.register(cors, {
    origin: config.publicUrl,
    credentials: true,
  });
  await app.register(rateLimit, {
    global: false, // routes opt in via { config: { rateLimit: ... } }
  });
  await app.register(authPlugin);
}
