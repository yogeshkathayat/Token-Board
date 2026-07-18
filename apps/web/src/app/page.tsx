import { redirect } from 'next/navigation';

// Must run per-request: prerendering baked in a build-time redirect to a non-existent signin page.
export const dynamic = 'force-dynamic';

export default async function Home() {
  // /dashboard guards itself (company user or access-denied); middleware handles the
  // unauthenticated -> Auth Desk redirect in non-bypass mode.
  redirect('/dashboard');
}
