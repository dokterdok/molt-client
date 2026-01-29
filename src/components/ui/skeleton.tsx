import { cn } from "../../lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-md bg-muted/50 animate-shimmer overflow-hidden",
        className,
      )}
      aria-hidden="true"
    />
  );
}

export function ConversationSkeleton() {
  return (
    <div className="px-2 py-2 rounded-lg space-y-1 animate-in fade-in duration-300">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-3/4" />
      </div>
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

export function MessageSkeleton({ isUser = false }: { isUser?: boolean }) {
  return (
    <div
      className={cn(
        "flex gap-3 animate-in fade-in duration-300",
        isUser && "flex-row-reverse",
      )}
    >
      {/* Avatar */}
      <Skeleton className="flex-shrink-0 w-9 h-9 rounded-xl" />

      {/* Content */}
      <div
        className={cn(
          "flex-1 min-w-0 space-y-2",
          isUser && "flex flex-col items-end",
        )}
      >
        <Skeleton className="h-4 w-16" />
        <div className="space-y-2 max-w-2xl">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
      </div>
    </div>
  );
}

export function WelcomeSkeletonCard() {
  return (
    <div className="p-4 rounded-xl border border-border space-y-2">
      <div className="flex items-start gap-3">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
        </div>
      </div>
    </div>
  );
}
