import { timingSafeEqual } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';

import { getCompanyUser } from '@/lib/auth/company';
import { refreshLeaderboard } from '@/lib/leaderboard';

// Debounce: at most one recompute per window, no matter how many callers hit the endpoint.
const MIN_INTERVAL_MS = 30_000;
let lastRefreshAt = 0;

function secretsMatch(a: string | null, b: string | undefined): boolean {
  if (!a || !b) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function POST(req: NextRequest) {
  const bySecret = secretsMatch(
    req.headers.get('x-refresh-secret'),
    process.env.LEADERBOARD_REFRESH_SECRET,
  );

  if (!bySecret) {
    const user = await getCompanyUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const now = Date.now();
  if (now - lastRefreshAt < MIN_INTERVAL_MS) {
    return NextResponse.json({ refreshed: null, debounced: true }, { status: 429 });
  }
  lastRefreshAt = now;

  const result = await refreshLeaderboard();
  return NextResponse.json({ refreshed: result });
}
