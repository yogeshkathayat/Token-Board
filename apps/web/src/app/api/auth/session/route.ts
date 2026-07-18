import { NextResponse } from 'next/server';

import { getCurrentUserWithAccess } from '@/lib/auth/server';
import { Logger } from '@/lib/logger';

const logger = new Logger('api/auth/session');

export async function GET() {
  try {
    const user = await getCurrentUserWithAccess();

    if (!user) {
      return NextResponse.json({});
    }

    return NextResponse.json({
      user,
    });
  } catch (error) {
    logger.error({ message: 'Session API error', logInfo: { err: error } });
    return NextResponse.json({});
  }
}
