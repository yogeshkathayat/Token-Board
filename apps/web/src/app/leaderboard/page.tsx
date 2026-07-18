// Auth-guarded: must render per-request so the session guard runs on every request.
export const dynamic = 'force-dynamic';

import { AlertCircle } from 'lucide-react';
import Link from 'next/link';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { getCompanyUser } from '@/lib/auth/company';

import { LeaderboardClient } from './leaderboard-client';

export default async function LeaderboardPage() {
  const user = await getCompanyUser();

  if (!user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-6">
        <Alert className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Required</AlertTitle>
          <AlertDescription>
            Please sign in with your company email address (@mumzworld.com) to access the leaderboard.
          </AlertDescription>
        </Alert>
        <Button asChild>
          <Link href="/auth/signin">Sign In</Link>
        </Button>
      </div>
    );
  }

  return <LeaderboardClient />;
}