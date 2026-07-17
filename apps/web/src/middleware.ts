import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { Logger } from '@/lib/logger';

// Auth bypass for development. In production, requires AUTH_BYPASS_ALLOW_IN_PROD=true too.
const isAuthBypassed =
  process.env.AUTH_BYPASS === 'true' &&
  (process.env.NODE_ENV !== 'production' ||
    process.env.AUTH_BYPASS_ALLOW_IN_PROD === 'true');

const logger = new Logger('middleware');

// Get auth desk URL from environment variables
function getAuthDeskUrl() {
  const url = process.env.NEXT_PUBLIC_AUTH_DESK_URL || process.env.AUTH_DESK_URL;
  if (!url) {
    throw new Error('AUTH_DESK_URL or NEXT_PUBLIC_AUTH_DESK_URL must be configured');
  }
  return url;
}

function getDeskUrl() {
  const url = process.env.NEXT_PUBLIC_NEXTAUTH_URL || process.env.NEXTAUTH_URL;
  if (!url) {
    throw new Error('NEXTAUTH_URL or NEXT_PUBLIC_NEXTAUTH_URL must be configured');
  }
  return url;
}

/**
 * Check if user has valid session and desk access
 */
async function hasValidSessionAndAccess(request: NextRequest): Promise<boolean> {
  try {
    const cookieHeader = request.headers.get('cookie') || '';

    logger.debug({
      message: 'Making session and access check for',
      metadata: { path: request.nextUrl.pathname, hasCookie: Boolean(cookieHeader) },
    });

    const authDeskUrl = getAuthDeskUrl();

    // Get session
    const sessionResponse = await fetch(`${authDeskUrl}/api/auth/session`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(cookieHeader && { Cookie: cookieHeader }),
      },
    });

    if (!sessionResponse.ok) {
      return false;
    }

    const session = await sessionResponse.json();
    if (!session?.user) {
      return false;
    }

    // Simple desk access check via API endpoint
    const accessResponse = await fetch(`${getDeskUrl()}/api/auth/check-access`, {
      headers: { Cookie: cookieHeader },
    });

    const accessResult = accessResponse.ok ? await accessResponse.json() : { hasAccess: false };
    const hasAccess = accessResult.hasAccess;

    logger.debug({ message: 'Session and access check result', metadata: { hasAccess } });
    return hasAccess;
  } catch (error) {
    logger.error({ message: 'Session and access check error', metadata: { error } });
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname, href } = request.nextUrl;

  // Auth bypass mode - skip all auth checks
  if (isAuthBypassed) {
    logger.debug({ message: 'Auth bypassed via AUTH_BYPASS flag' });
    return NextResponse.next();
  }

  logger.debug({ message: 'Processing', metadata: { path: pathname, href } });

  // Allow auth-related paths, API routes, and static files
  if (
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    logger.debug({ message: 'Allowing static/auth/api path' });
    return NextResponse.next();
  }

  // Check for valid session and desk access
  const hasAccess = await hasValidSessionAndAccess(request);

  if (!hasAccess) {
    // Check if user has a session but no desk access
    const authDeskUrl = getAuthDeskUrl();
    const sessionResponse = await fetch(`${authDeskUrl}/api/auth/session`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Cookie: request.headers.get('cookie') || '',
      },
    });

    const session = sessionResponse.ok ? await sessionResponse.json() : null;

    if (session?.user) {
      // User is authenticated but has no desk access
      logger.debug({
        message: 'User authenticated but no desk access, redirecting to unauthorized',
        metadata: { email: session?.user?.email },
      });
      return NextResponse.redirect(new URL('/auth/unauthorized', request.url));
    } else {
      // User is not authenticated
      const deskUrl = href.replace(request.nextUrl.origin, getDeskUrl());
      const authUrl = `${authDeskUrl}/auth/signin?callbackUrl=${encodeURIComponent(deskUrl)}`;
      logger.debug({ message: 'No session, redirecting to auth', metadata: { authUrl } });
      return NextResponse.redirect(authUrl);
    }
  }

  logger.debug({ message: 'Session and access valid, allowing access' });
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
