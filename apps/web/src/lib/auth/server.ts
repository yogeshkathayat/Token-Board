import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import 'server-only';

import { getAuthDeskUrl, isAuthBypassed, mockSession } from '@/lib/auth/shared';
import { Logger } from '@/lib/logger';
import { Session, User } from '@/types/auth';

const logger = new Logger('lib/auth/server');

// Get Laravel backend API URL from environment variables
function getAuthDeskApiUrl() {
  const url = process.env.NEXT_PUBLIC_AUTH_DESK_API_URL || process.env.AUTH_DESK_API_URL;
  if (!url) {
    throw new Error('AUTH_DESK_API_URL or NEXT_PUBLIC_AUTH_DESK_API_URL must be configured');
  }
  return url;
}

/**
 * Create a signed JWT token from session data
 */
export function createSignedJWT(session: Session): string | null {
  try {
    if (!session?.user) {
      logger.debug({ message: 'NO_SESSION_USER_DATA_FOR_JWT_CREATION' });
      return null;
    }

    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      logger.error('NEXTAUTH_SECRET not found for JWT signing');
      return null;
    }

    const payload = {
      email: session.user.email,
      name: session.user.name,
      sub: session.user.id || session.user.email,
      picture: session.user.image,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 hours
    };

    const token = jwt.sign(payload, secret, { algorithm: 'HS256' });
    logger.debug({
      message: 'Created signed JWT token',
      metadata: { email: session.user.email },
    });
    return token;
  } catch (error) {
    logger.error({ message: 'Error creating signed JWT', logInfo: { error } });
    return null;
  }
}

/**
 * Get current user session by calling auth desk directly
 */
export async function getSession(cookieHeader?: string): Promise<Session | null> {
  // Return mock session if auth is bypassed
  if (isAuthBypassed) {
    logger.debug('Auth bypassed - returning mock session');
    return mockSession;
  }
  try {
    const authDeskUrl = getAuthDeskUrl();

    // Get cookies from server context if available, or use provided cookie header
    let cookieString = cookieHeader;
    if (!cookieString) {
      try {
        const cookieStore = await cookies();
        cookieString = cookieStore.toString();
      } catch {
        // Not in server context or import failed - fallback to client-side approach
      }
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };

    if (cookieString) {
      headers['Cookie'] = cookieString;
    }

    logger.debug('Making fresh session API call');
    const response = await fetch(`${authDeskUrl}/api/auth/session`, {
      headers,
      credentials: cookieString ? undefined : 'include', // Only use credentials for client-side
    });

    if (!response.ok) {
      return null;
    }

    const session = await response.json();
    const result = session && session.user ? session : null;

    logger.debug({
      message: 'Session API result',
      metadata: { email: result?.user?.email },
    });
    return result;
  } catch (error) {
    logger.error({ message: 'Error getting session', logInfo: { error } });
    return null;
  }
}

/**
 * Get current user data
 */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  return session?.user || null;
}

/**
 * Get current user with full desk access information
 */
export async function getCurrentUserWithAccess(): Promise<User | null> {
  if (isAuthBypassed) return mockSession.user;

  try {
    // First get the session to create a proper JWT
    const session = await getSession();
    if (!session) {
      logger.debug('No session found for Auth Desk API call');
      return null;
    }

    // Create a signed JWT token from the session
    const jwtToken = createSignedJWT(session);
    if (!jwtToken) {
      logger.debug('Could not create JWT token from session');
      return null;
    }

    // Call the Auth Desk API using the proper environment variable
    const authDeskApi = getAuthDeskApiUrl();
    logger.debug({
      message: 'Calling Auth Desk API /me endpoint',
      metadata: { url: authDeskApi },
    });

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwtToken}`,
    };

    // Call the Auth Desk API /me endpoint
    const response = await fetch(`${authDeskApi}/me`, { headers });

    logger.debug({
      message: 'Auth Desk API /me response',
      metadata: { status: response.status },
    });

    if (!response.ok) {
      logger.debug({
        message: 'Failed to fetch user data from Auth Desk API',
        metadata: { status: response.status, statusText: response.statusText },
      });
      return null;
    }

    const responseJson = await response.json();

    if (responseJson?.status !== 'success' || !responseJson.data) {
      logger.debug({
        message: 'Failed to fetch user data from Auth Desk API',
        logInfo: { responseJson },
        metadata: { status: response.status },
      });
      return null;
    }

    const user: User = responseJson.data;
    if (!user) return null;
    user.image = user.image || session.user.image;
    return user;
  } catch (error) {
    logger.error({
      message: 'Error getting current user with access from Auth Desk API',
      logInfo: { error },
    });
    return null;
  }
}

/**
 * Check if current user has access to a specific desk
 */
export async function checkUserHasAccessToDesk(deskSlug: string) {
  const currentUser = await getCurrentUserWithAccess();

  logger.debug({ message: 'Checking access for desk', metadata: { deskSlug } });

  if (!currentUser) {
    logger.debug('No current user found');
    return false;
  }

  if (!currentUser.desk_access || !Array.isArray(currentUser.desk_access)) {
    logger.debug('No desk access array found');
    return false;
  }

  const hasAccess = currentUser.desk_access.some((access: unknown) => {
    if (
      access &&
      typeof access === 'object' &&
      'desk' in access &&
      access.desk &&
      typeof access.desk === 'object' &&
      'slug' in access.desk
    ) {
      const apiDeskSlug = access.desk.slug as string;
      // Case-insensitive comparison to handle potential casing differences
      return apiDeskSlug.toLowerCase() === deskSlug.toLowerCase();
    }
    return false;
  });

  logger.debug({ message: 'Access check result', metadata: { hasAccess } });
  return hasAccess;
}
