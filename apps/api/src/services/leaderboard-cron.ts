import cron from 'node-cron';
import type { FastifyInstance } from 'fastify';

import { refreshSnapshot } from './leaderboard.js';

/**
 * Refresh leaderboard snapshots every 5 minutes. Each tick refreshes week,
 * month, and total. Logged but never thrown — a transient DB blip should not
 * crash the API.
 */
export function startLeaderboardCron(app: FastifyInstance): void {
  const task = cron.schedule(
    '*/5 * * * *',
    async () => {
      try {
        const w = await refreshSnapshot('week');
        const m = await refreshSnapshot('month');
        const t = await refreshSnapshot('total');
        app.log.info({ week: w.inserted, month: m.inserted, total: t.inserted }, 'leaderboard refreshed');
      } catch (err) {
        app.log.error({ err }, 'leaderboard refresh failed');
      }
    },
    { scheduled: true },
  );

  app.addHook('onClose', async () => {
    task.stop();
  });

  // Also do an immediate refresh after boot so the leaderboard is populated
  // without waiting up to 5 minutes.
  setTimeout(() => {
    refreshSnapshot('week').catch((err) => app.log.error({ err }, 'initial week refresh failed'));
    refreshSnapshot('month').catch((err) => app.log.error({ err }, 'initial month refresh failed'));
    refreshSnapshot('total').catch((err) => app.log.error({ err }, 'initial total refresh failed'));
  }, 5_000);
}
