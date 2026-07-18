import { NextRequest, NextResponse } from 'next/server';

import { resolveActingUserId } from '@/lib/auth/company';
import { getUsageSummary } from '@/lib/usage';

export async function GET(req: NextRequest) {
  // Accepts either a browser session (dashboard) or a device-token Bearer (CLI / menu bar).
  const userId = await resolveActingUserId(req.headers.get('authorization'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const tz = searchParams.get('tz') || 'UTC';

  const summary = await getUsageSummary(userId, tz);
  return NextResponse.json(summary);
}
