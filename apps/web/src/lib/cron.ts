import cron from 'node-cron';
import 'server-only';

import { refreshLeaderboard } from '@/lib/leaderboard';
import { Logger } from '@/lib/logger';

const logger = new Logger('lib/cron');
let started = false;

export function startLeaderboardCron(): void {
  if (process.env.LEADERBOARD_REFRESH_DISABLED === 'true') {
    logger.log('Leaderboard refresh cron disabled via LEADERBOARD_REFRESH_DISABLED');
    return;
  }

  if (started) {
    logger.debug('Leaderboard cron already started');
    return;
  }

  started = true;

  cron.schedule('*/5 * * * *', async () => {
    try {
      logger.log('Starting scheduled leaderboard refresh');
      const result = await refreshLeaderboard();
      logger.log({ message: 'Leaderboard refresh completed', metadata: { result } });
    } catch (error) {
      logger.error({ message: 'Leaderboard refresh failed', logInfo: { error } });
    }
  });

  logger.log('Leaderboard refresh cron started (every 5 minutes)');
}
