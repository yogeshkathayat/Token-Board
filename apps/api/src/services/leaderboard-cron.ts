import cron from 'node-cron';
import type { FastifyInstance } from 'fastify';

import { db } from '../db/index.js';
import { refreshSnapshot } from './leaderboard.js';

/**
 * Delete credential rows that are no longer usable so four auth tables don't
 * grow unbounded over a multi-year deployment. Only removes rows that are
 * definitively dead: expired sessions, and expired link codes.
 */
async function reapExpiredCredentials(app: FastifyInstance): Promise<void> {
  try {
    const now = new Date();
    await db.deleteFrom('tb_sessions').where('expires_at', '<', now).execute();
    await db.deleteFrom('tb_link_codes').where('expires_at', '<', now).execute();
  } catch (err) {
    app.log.error({ err }, 'credential reap failed');
  }
}

/**
 * Refresh leaderboard snapshots every 5 minutes. Each tick refreshes week,
 * month, and total. Logged but never thrown — a transient DB blip should not
 * crash the API.
 */
export function startLeaderboardCron(app: FastifyInstance): void {
  let running = false;

  // One guarded refresh of all periods. The `running` flag serializes the cron
  // tick AND the boot-time refresh so they can't collide on the same snapshot.
  const tick = async (label: string): Promise<void> => {
    if (running) {
      app.log.warn({ label }, 'leaderboard refresh skipped — previous tick still running');
      return;
    }
    running = true;
    try {
      const w = await refreshSnapshot('week');
      const m = await refreshSnapshot('month');
      const t = await refreshSnapshot('total');
      app.log.info({ label, week: w.inserted, month: m.inserted, total: t.inserted }, 'leaderboard refreshed');
      await reapExpiredCredentials(app);
    } catch (err) {
      app.log.error({ err, label }, 'leaderboard refresh failed');
    } finally {
      running = false;
    }
  };

  const task = cron.schedule('*/5 * * * *', () => tick('cron'), { scheduled: true });

  app.addHook('onClose', async () => {
    task.stop();
  });

  // Also do an immediate refresh after boot so the leaderboard is populated
  // without waiting up to 5 minutes.
  setTimeout(() => {
    void tick('boot');
  }, 5_000);
}
