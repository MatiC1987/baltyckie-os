import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function DashboardSkeleton() {
  return (
    <div className="space-y-6" data-testid="skeleton-dashboard">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-md loading-shimmer" />
        <div>
          <Skeleton className="h-8 w-48 loading-shimmer" />
          <Skeleton className="h-4 w-64 mt-1 loading-shimmer" />
        </div>
      </div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardContent className="pt-4 pb-3">
              <Skeleton className="h-4 w-24 mb-2 loading-shimmer" />
              <Skeleton className="h-7 w-20 mb-1 loading-shimmer" />
              <Skeleton className="h-3 w-32 loading-shimmer" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="py-3">
          <div className="flex gap-2">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-8 w-28 loading-shimmer" />)}
          </div>
        </CardContent>
      </Card>
      <Skeleton className="h-64 w-full rounded-lg loading-shimmer" />
    </div>
  );
}

export function TablePageSkeleton({ columns = 6, rows = 8 }: { columns?: number; rows?: number }) {
  return (
    <div className="space-y-6" data-testid="skeleton-table">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-md loading-shimmer" />
        <div>
          <Skeleton className="h-8 w-48 loading-shimmer" />
          <Skeleton className="h-4 w-64 mt-1 loading-shimmer" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-64 loading-shimmer" />
        <Skeleton className="h-9 w-32 loading-shimmer" />
        <Skeleton className="h-9 w-32 loading-shimmer" />
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="border-b px-4 py-3 flex gap-4">
            {Array.from({ length: columns }).map((_, i) => (
              <Skeleton key={i} className="h-4 flex-1 loading-shimmer" />
            ))}
          </div>
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="border-b last:border-b-0 px-4 py-3 flex gap-4">
              {Array.from({ length: columns }).map((_, j) => (
                <Skeleton key={j} className="h-4 flex-1 loading-shimmer" />
              ))}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-6" data-testid="skeleton-analytics">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-md loading-shimmer" />
        <div>
          <Skeleton className="h-8 w-48 loading-shimmer" />
          <Skeleton className="h-4 w-64 mt-1 loading-shimmer" />
        </div>
      </div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardContent className="pt-4 pb-3">
              <Skeleton className="h-4 w-20 mb-2 loading-shimmer" />
              <Skeleton className="h-7 w-16 loading-shimmer" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-80 w-full rounded-lg loading-shimmer" />
    </div>
  );
}

export function FormPageSkeleton() {
  return (
    <div className="space-y-6" data-testid="skeleton-form">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-md loading-shimmer" />
        <div>
          <Skeleton className="h-8 w-48 loading-shimmer" />
          <Skeleton className="h-4 w-64 mt-1 loading-shimmer" />
        </div>
      </div>
      <Card>
        <CardContent className="pt-6 space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24 loading-shimmer" />
              <Skeleton className="h-10 w-full loading-shimmer" />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-4">
            {[1, 2].map(i => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-20 loading-shimmer" />
                <Skeleton className="h-10 w-full loading-shimmer" />
              </div>
            ))}
          </div>
          <Skeleton className="h-10 w-32 mt-4 loading-shimmer" />
        </CardContent>
      </Card>
    </div>
  );
}

export function CardsGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-6" data-testid="skeleton-cards-grid">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-md loading-shimmer" />
        <div>
          <Skeleton className="h-8 w-48 loading-shimmer" />
          <Skeleton className="h-4 w-64 mt-1 loading-shimmer" />
        </div>
      </div>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6 space-y-3">
              <Skeleton className="h-5 w-32 loading-shimmer" />
              <Skeleton className="h-4 w-full loading-shimmer" />
              <Skeleton className="h-4 w-3/4 loading-shimmer" />
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-8 w-20 loading-shimmer" />
                <Skeleton className="h-8 w-20 loading-shimmer" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function HubPageSkeleton() {
  return (
    <div className="space-y-6" data-testid="skeleton-hub">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-md loading-shimmer" />
        <div>
          <Skeleton className="h-8 w-48 loading-shimmer" />
          <Skeleton className="h-4 w-64 mt-1 loading-shimmer" />
        </div>
      </div>
      <div className="flex gap-1 border-b pb-1">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-9 w-28 rounded-md loading-shimmer" />
        ))}
      </div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardContent className="pt-4 pb-3">
              <Skeleton className="h-4 w-20 mb-2 loading-shimmer" />
              <Skeleton className="h-7 w-16 loading-shimmer" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="border-b last:border-b-0 px-4 py-3 flex gap-4">
              {Array.from({ length: 5 }).map((_, j) => (
                <Skeleton key={j} className="h-4 flex-1 loading-shimmer" />
              ))}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function ChartPageSkeleton() {
  return (
    <div className="space-y-6" data-testid="skeleton-chart">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-md loading-shimmer" />
        <div>
          <Skeleton className="h-8 w-48 loading-shimmer" />
          <Skeleton className="h-4 w-64 mt-1 loading-shimmer" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-40 loading-shimmer" />
        <Skeleton className="h-9 w-32 loading-shimmer" />
      </div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardContent className="pt-4 pb-3">
              <Skeleton className="h-4 w-20 mb-2 loading-shimmer" />
              <Skeleton className="h-7 w-16 loading-shimmer" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-80 w-full rounded-lg loading-shimmer" />
      <Skeleton className="h-60 w-full rounded-lg loading-shimmer" />
    </div>
  );
}
