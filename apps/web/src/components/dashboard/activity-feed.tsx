'use client';

import * as React from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Get relative time string from a date
 * @param date - Date to format
 * @returns Relative time string (e.g., "2 hours ago", "yesterday")
 */
function getRelativeTime(date: Date | string): string {
  const now = new Date();
  const past = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return diffInMinutes === 1 ? '1 minute ago' : `${diffInMinutes} minutes ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return diffInHours === 1 ? '1 hour ago' : `${diffInHours} hours ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) {
    return 'yesterday';
  }
  if (diffInDays < 7) {
    return `${diffInDays} days ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return diffInWeeks === 1 ? '1 week ago' : `${diffInWeeks} weeks ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return diffInMonths === 1 ? '1 month ago' : `${diffInMonths} months ago`;
  }

  const diffInYears = Math.floor(diffInDays / 365);
  return diffInYears === 1 ? '1 year ago' : `${diffInYears} years ago`;
}

interface ActivityItem {
  id: string;
  user: {
    name: string;
    avatar?: string;
    initials?: string;
  };
  action: string;
  target: string;
  timestamp: Date | string;
  metadata?: Record<string, unknown>;
}

interface ActivityFeedProps {
  items: ActivityItem[];
  maxItems?: number;
  showTimestamp?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  onViewAll?: () => void;
  viewAllHref?: string;
  className?: string;
}

function ActivityItemSkeleton() {
  return (
    <div className="flex gap-3">
      <div className="relative flex flex-col items-center">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="absolute top-10 h-full w-px bg-border" />
      </div>
      <div className="flex-1 pb-8">
        <Skeleton className="h-4 w-3/4 mb-1" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

function ActivityFeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-0">
      {Array.from({ length: count }).map((_, i) => (
        <ActivityItemSkeleton key={i} />
      ))}
    </div>
  );
}

function ActivityFeedEmpty({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="rounded-full bg-muted p-3 mb-3">
        <svg
          className="h-6 w-6 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function ActivityFeedItem({
  item,
  showTimestamp,
  isLast,
}: {
  item: ActivityItem;
  showTimestamp: boolean;
  isLast: boolean;
}) {
  const initials =
    item.user.initials ||
    item.user.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  return (
    <div className="flex gap-3">
      {/* Avatar and timeline connector */}
      <div className="relative flex flex-col items-center">
        <Avatar className="h-8 w-8 border bg-background">
          {item.user.avatar && <AvatarImage src={item.user.avatar} alt={item.user.name} />}
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        {/* Timeline connector line */}
        {!isLast && <div className="absolute top-10 h-[calc(100%-2rem)] w-px bg-border" />}
      </div>

      {/* Content */}
      <div className={cn('flex-1 min-w-0', !isLast && 'pb-6')}>
        <p className="text-sm">
          <span className="font-medium text-foreground">{item.user.name}</span>
          <span className="text-muted-foreground"> {item.action} </span>
          <span className="font-medium text-foreground">{item.target}</span>
        </p>
        {showTimestamp && <p className="text-xs text-muted-foreground mt-0.5">{getRelativeTime(item.timestamp)}</p>}
      </div>
    </div>
  );
}

function ActivityFeed({
  items,
  maxItems,
  showTimestamp = true,
  loading = false,
  emptyMessage = 'No recent activity',
  onViewAll,
  viewAllHref,
  className,
}: ActivityFeedProps) {
  if (loading) {
    return (
      <div className={className}>
        <ActivityFeedSkeleton count={maxItems || 3} />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={className}>
        <ActivityFeedEmpty message={emptyMessage} />
      </div>
    );
  }

  const displayItems = maxItems ? items.slice(0, maxItems) : items;
  const hasMore = maxItems && items.length > maxItems;

  return (
    <div className={className}>
      <div className="space-y-0">
        {displayItems.map((item, index) => (
          <ActivityFeedItem
            key={item.id}
            item={item}
            showTimestamp={showTimestamp}
            isLast={index === displayItems.length - 1}
          />
        ))}
      </div>

      {/* View all link */}
      {(hasMore || onViewAll || viewAllHref) && (
        <div className="mt-4 pt-4 border-t">
          {viewAllHref ? (
            <a href={viewAllHref} className="text-sm text-primary hover:underline">
              View all activity
            </a>
          ) : onViewAll ? (
            <Button variant="ghost" size="sm" className="w-full text-primary hover:text-primary" onClick={onViewAll}>
              View all activity
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

export {
  ActivityFeed,
  ActivityFeedSkeleton,
  ActivityFeedEmpty,
  getRelativeTime,
  type ActivityItem,
  type ActivityFeedProps,
};
