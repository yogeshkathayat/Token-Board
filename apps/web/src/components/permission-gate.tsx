'use client';

import { ReactNode } from 'react';
import useSWR from 'swr';

interface PermissionGateProps {
  children: ReactNode;
  requiredRole?: 'admin' | 'editor' | 'viewer';
  requiredRoles?: string[];
  fallback?: ReactNode;
  showForRoles?: string[];
  deskSlug: string; // Required - set to your desk's slug from env
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function PermissionGate({
  children,
  requiredRole,
  requiredRoles = [],
  fallback = null,
  showForRoles = [],
  deskSlug,
}: PermissionGateProps) {
  const { data: session } = useSWR('/api/auth/session', fetcher);

  // If no session, don't show content
  if (!session?.user) {
    return <>{fallback}</>;
  }

  // Get user's role for this specific desk
  const userDeskAccess = (
    session.user as { desk_access?: Array<{ desk?: { slug: string }; role?: { slug: string } }> }
  ).desk_access?.find((access) => access.desk?.slug === deskSlug);

  const userRole = userDeskAccess?.role?.slug || 'viewer';

  // Build the list of allowed roles
  const allowedRoles = [...(requiredRole ? [requiredRole] : []), ...requiredRoles, ...showForRoles];

  // If no roles specified, show content
  if (allowedRoles.length === 0) {
    return <>{children}</>;
  }

  // Check if user's role is in allowed roles
  const hasPermission = allowedRoles.includes(userRole);

  return hasPermission ? <>{children}</> : <>{fallback}</>;
}

// Example usage:
// <PermissionGate requiredRole="admin">
//   <AdminOnlyButton />
// </PermissionGate>
//
// <PermissionGate requiredRoles={['admin', 'editor']} fallback={<div>Not authorized</div>}>
//   <EditButton />
// </PermissionGate>
