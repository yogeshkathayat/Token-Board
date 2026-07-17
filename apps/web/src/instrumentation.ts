export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if (process.env.NODE_ENV === 'production' && process.env.AUTH_BYPASS === 'true') {
      if (process.env.AUTH_BYPASS_ALLOW_IN_PROD === 'true') {
        console.warn(
          '[tokenboard] ⚠  INSECURE: AUTH_BYPASS is ACTIVE in production ' +
            '(AUTH_BYPASS_ALLOW_IN_PROD=true). Every request is treated as the mock company ' +
            'user. Use only for a temporary demo — wire real Auth Desk SSO before real use.',
        );
      } else {
        console.warn(
          '[tokenboard] AUTH_BYPASS=true is set in production and is being IGNORED ' +
            '(AUTH_BYPASS_ALLOW_IN_PROD is not true).',
        );
      }
    }
    const { startLeaderboardCron } = await import('@/lib/cron');
    startLeaderboardCron();
  }
}
