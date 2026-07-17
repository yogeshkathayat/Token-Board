import { NextRequest, NextResponse } from 'next/server';

import { getCompanyUser } from '@/lib/auth/company';
import { refreshLeaderboard } from '@/lib/leaderboard';

export async function POST(req: NextRequest) {
  const refreshSecret = req.headers.get('x-refresh-secret');
  const expectedSecret = process.env.LEADERBOARD_REFRESH_SECRET;

  if (expectedSecret && refreshSecret === expectedSecret) {
    const result = await refreshLeaderboard();
    return NextResponse.json({ refreshed: result });
  }

  const user = await getCompanyUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await refreshLeaderboard();
  return NextResponse.json({ refreshed: result });
}
