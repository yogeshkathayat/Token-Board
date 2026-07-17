import { NextRequest, NextResponse } from 'next/server';

import { getCompanyUser, userIdFor } from '@/lib/auth/company';
import { getUsageSummary } from '@/lib/usage';

export async function GET(req: NextRequest) {
  const user = await getCompanyUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const tz = searchParams.get('tz') || 'UTC';

  const userId = userIdFor(user);
  const summary = await getUsageSummary(userId, tz);

  return NextResponse.json(summary);
}
