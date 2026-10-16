"use client";

import { AlertTriangle, Inbox, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function ErrorState({ error, onRetry, className }: { error?: Error; onRetry?: () => void; className?: string }) {
  return (
    <Card role="alert" className={cn("flex flex-col items-center gap-3 p-8 text-center", className)}>
      <div className="rounded-full bg-risk-soft p-3 text-risk">
        <AlertTriangle className="size-5" />
      </div>
      <div>
        <p className="font-medium">Something went wrong</p>
        <p className="text-sm text-muted-foreground">{error?.message ?? "We couldn't load this data."}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw /> Try again
        </Button>
      )}
    </Card>
  );
}

export function EmptyState({ title, description, action, icon, className }: { title: string; description?: string; action?: React.ReactNode; icon?: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("flex flex-col items-center gap-3 border-dashed p-8 text-center", className)}>
      <div className="rounded-full bg-muted p-3 text-muted-foreground">{icon ?? <Inbox className="size-5" />}</div>
      <div>
        <p className="font-medium">{title}</p>
        {description && <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </Card>
  );
}

export function CardSkeleton({ className, lines = 3 }: { className?: string; lines?: number }) {
  return (
    <Card className={cn("space-y-3 p-5", className)} aria-busy="true" aria-label="Loading">
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-3", i % 2 ? "w-2/3" : "w-full")} />
      ))}
    </Card>
  );
}

export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("p-5", className)} aria-busy="true" aria-label="Loading chart">
      <Skeleton className="mb-4 h-4 w-40" />
      <div className="flex h-56 items-end gap-2">
        {[40, 65, 50, 80, 60, 75, 55, 90, 70, 85, 60, 78].map((h, i) => (
          <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
        ))}
      </div>
    </Card>
  );
}
