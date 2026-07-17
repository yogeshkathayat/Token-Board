import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ReactNode } from 'react';

import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppTopbar } from '@/components/layout/app-topbar';
import { CommandPaletteWrapper } from '@/components/layout/command-palette-wrapper';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { getCurrentUserWithAccess } from '@/lib/auth/server';

interface AppShellProps {
  children: ReactNode;
}

export async function AppShell({ children }: AppShellProps) {
  const user = await getCurrentUserWithAccess();

  if (!user) {
    redirect('/auth/signin');
  }

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get('sidebar_state')?.value !== 'false';

  return (
    <SidebarProvider defaultOpen={defaultOpen} className="!min-h-0 h-svh overflow-hidden">
      <AppSidebar user={user} />
      <SidebarInset>
        <AppTopbar user={user} />
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto max-w-full p-6">{children}</div>
        </div>
        <CommandPaletteWrapper />
      </SidebarInset>
    </SidebarProvider>
  );
}
