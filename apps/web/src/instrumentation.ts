export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startLeaderboardCron } = await import('@/lib/cron');
    startLeaderboardCron();
  }
}
