import { ArrowLeft, ShieldX } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function NoAccessPage() {
  const deskName = process.env.NEXT_PUBLIC_DESK_NAME || 'this desk';
  const authDeskUrl = process.env.NEXT_PUBLIC_AUTH_DESK_URL || 'https://auth-desk.mumzdesk.com';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldX className="w-8 h-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl font-bold">Access Denied</CardTitle>
          <CardDescription>
            You don&apos;t have permission to access {deskName}. Please contact your administrator to request access.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center text-sm text-muted-foreground">
            If you believe this is an error, please contact your system administrator.
          </div>
          <div className="flex flex-col gap-2">
            <Button asChild className="w-full">
              <Link href={authDeskUrl}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Auth Desk
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
