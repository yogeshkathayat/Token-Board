import { NextResponse } from 'next/server';

import { checkUserHasAccessToDesk } from '@/lib/auth/server';

export async function GET() {
  try {
    const deskSlug = process.env.DESK_SLUG || 'starter';
    const hasAccess = await checkUserHasAccessToDesk(deskSlug);
    return NextResponse.json({ hasAccess });
  } catch {
    return NextResponse.json({ hasAccess: false });
  }
}
