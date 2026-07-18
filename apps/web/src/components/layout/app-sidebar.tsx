'use client';

import {
  ChevronsUpDown,
  LayoutDashboard,
  MonitorSmartphone,
  ShieldUserIcon,
  Trophy,
  icons,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { User } from '@/types/auth';

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'Leaderboard',
    href: '/leaderboard',
    icon: Trophy,
  },
  {
    name: 'Connect Device',
    href: '/settings',
    icon: MonitorSmartphone,
  },
];

interface AppSidebarProps {
  user: User;
}

function DeskIcon({ name, fallback, className }: { name?: string | null; fallback: string; className?: string }) {
  if (name) {
    const Icon = icons[name as keyof typeof icons];
    if (Icon) return <Icon className={className} />;
  }
  const initials = fallback
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return <span className="text-xs font-semibold">{initials}</span>;
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const authDeskUrl = process.env.NEXT_PUBLIC_AUTH_DESK_URL || 'https://auth-desk.mumzdesk.com';
  const currentDeskSlug = process.env.NEXT_PUBLIC_DESK_SLUG;

  const deskName = process.env.NEXT_PUBLIC_DESK_NAME || 'TokenBoard';

  // Find current desk icon from user's desk access
  const currentDeskAccess = user.desk_access?.find((access) => access.desk?.slug === currentDeskSlug);
  const currentDeskIcon = currentDeskAccess?.desk?.icon || 'LayoutDashboard';

  // Filter user desks: exclude current desk and auth desk
  const otherDesks =
    user.desk_access?.filter((access) => {
      if (!access.desk) return false;
      if (access.desk.slug === currentDeskSlug) return false;
      if (access.desk.slug === 'auth-desk') return false;
      return true;
    }) ?? [];

  return (
    <Sidebar side="left" variant="sidebar" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  tooltip={deskName}
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:mx-auto"
                >
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logomark.svg" alt="TokenBoard" className="size-5" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{deskName}</span>
                    <span className="truncate text-xs text-muted-foreground">Usage &amp; leaderboard</span>
                  </div>
                  <ChevronsUpDown className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-64 rounded-lg p-2"
                align="start"
                side={isMobile ? 'bottom' : 'right'}
                sideOffset={4}
              >
                <DropdownMenuLabel className="text-xs text-muted-foreground px-2">Desks</DropdownMenuLabel>
                {/* Current desk */}
                <DropdownMenuItem asChild className="bg-accent text-accent-foreground">
                  <Link href="/dashboard" className="gap-3 p-3">
                    <div className="flex size-8 items-center justify-center rounded-sm border">
                      <DeskIcon name={currentDeskIcon} fallback={deskName} className="size-5 shrink-0" />
                    </div>
                    <span className="font-medium">{deskName}</span>
                  </Link>
                </DropdownMenuItem>
                {/* Other desks from user access */}
                {otherDesks.map((access) => (
                  <DropdownMenuItem key={access.desk!.slug} asChild>
                    <a href={access.desk!.url} className="gap-3 p-3">
                      <div className="flex size-8 items-center justify-center rounded-sm border">
                        <DeskIcon name={access.desk!.icon} fallback={access.desk!.name} className="size-5 shrink-0" />
                      </div>
                      <span className="font-medium">{access.desk!.name}</span>
                    </a>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                {/* Auth desk - always at bottom */}
                <DropdownMenuItem asChild>
                  <a href={authDeskUrl} className="gap-3 p-3">
                    <div className="flex size-8 items-center justify-center rounded-sm border">
                      <ShieldUserIcon className="size-5 shrink-0" />
                    </div>
                    <span className="font-medium">Auth Desk</span>
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarMenu>
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton
                    tooltip={item.name}
                    isActive={isActive}
                    asChild
                    className="h-10 transition-none [&>svg]:size-5 group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!p-2.5"
                  >
                    <Link href={item.href} onClick={() => setOpenMobile(false)}>
                      <item.icon />
                      <span>{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
