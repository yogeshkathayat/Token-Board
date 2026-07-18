import { NextRequest, NextResponse } from 'next/server';

import { resolveActingUserId } from '@/lib/auth/company';
import { getUsageHeatmap } from '@/lib/usage';

export async function GET(req: NextRequest) {
  const userId = await resolveActingUserId(req.headers.get('authorization'));
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const tz = searchParams.get('tz') || 'UTC';
  const days = Number(searchParams.get('days') || '112');

  const heatmap = await getUsageHeatmap(userId, tz, days);
  return NextResponse.json(heatmap);
}
