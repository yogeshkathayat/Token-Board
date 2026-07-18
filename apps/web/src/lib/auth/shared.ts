import { Logger } from '@/lib/logger';
import { RolesEnum, Session, User } from '@/types/auth';

const logger = new Logger('lib/auth/shared');

// Auth bypass for development. In production it is IGNORED unless the operator also sets an
// explicit AUTH_BYPASS_ALLOW_IN_PROD=true acknowledgment — so a stray AUTH_BYPASS=true in a
// copied .env can never silently disable auth on a real deploy.
export const isAuthBypassed =
  process.env.AUTH_BYPASS === 'true' &&
  (process.env.NODE_ENV !== 'production' ||
    process.env.AUTH_BYPASS_ALLOW_IN_PROD === 'true');

// Mock session for auth bypass mode
export const mockSession: Session = {
  user: {
    id: 'dev-user',
    email: process.env.AUTH_BYPASS_EMAIL || 'dev@example.com',
    name: 'Dev User',
    image: 'https://github.com/shadcn.png',
    role: 'admin',
    desk_access: [
      {
        desk: {
          name: process.env.NEXT_PUBLIC_DESK_NAME || 'Starter Kit',
          slug: process.env.NEXT_PUBLIC_DESK_SLUG || 'starter-kit',
          url: process.env.NEXT_PUBLIC_AUTH_DESK_URL || 'https://localhost:3000',
          icon: 'ToolCase',
        },
        role: { slug: RolesEnum.ADMIN, name: 'Admin' },
      },
    ],
  },
};

// Get auth desk URL from environment variables
export function getAuthDeskUrl() {
  const url = process.env.NEXT_PUBLIC_AUTH_DESK_URL || process.env.AUTH_DESK_URL;
  if (!url) {
    throw new Error('AUTH_DESK_URL or NEXT_PUBLIC_AUTH_DESK_URL must be configured');
  }
  return url;
}

export function isAuthorized(user: User, allowedRoles?: RolesEnum[]): boolean {
  if (isAuthBypassed) user = mockSession.user;

  if (!allowedRoles || allowedRoles.length === 0) return true;

  if (!user) return false;

  const deskSlug = process.env.NEXT_PUBLIC_DESK_SLUG || process.env.DESK_SLUG;

  if (!deskSlug) {
    logger.error('NEXT_PUBLIC_DESK_SLUG or DESK_SLUG environment variable is not set');
    return false;
  }

  const userDeskAccess = user.desk_access?.find((access) => access.desk?.slug === deskSlug);
  const userRole = userDeskAccess?.role?.slug;

  if (!userRole) return false;

  return allowedRoles.includes(userRole);
}
