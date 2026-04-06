import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton, SkeletonCard, SkeletonTable } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <main className="w-full max-w-[1180px] mx-auto px-4 py-6">
      {/* Hero skeleton */}
      <Card className="p-6 space-y-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80" />
        <div className="flex gap-2 mt-2">
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-lg" />
          <Skeleton className="h-10 w-36 rounded-lg" />
        </div>
      </Card>

      {/* KPI cards skeleton */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      {/* Priority queue skeleton */}
      <Card className="mt-4">
        <CardHeader className="flex-row items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </CardHeader>
        <CardContent>
          <SkeletonTable rows={5} cols={3} />
        </CardContent>
      </Card>
    </main>
  );
}
