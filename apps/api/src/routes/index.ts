import type { FastifyInstance } from 'fastify';

import { authRoutes } from './auth.js';
import { ingestRoutes } from './ingest.js';
import { usageRoutes } from './usage.js';
import { leaderboardRoutes } from './leaderboard.js';
import { visibilityRoutes } from './visibility.js';
import { adminRoutes } from './admin.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(
    async (scope) => {
      await scope.register(authRoutes, { prefix: '/auth' });
      await scope.register(ingestRoutes);
      await scope.register(usageRoutes, { prefix: '/usage' });
      await scope.register(leaderboardRoutes, { prefix: '/leaderboard' });
      await scope.register(visibilityRoutes);
      await scope.register(adminRoutes, { prefix: '/admin' });
    },
    { prefix: '/api/v1' },
  );
}
