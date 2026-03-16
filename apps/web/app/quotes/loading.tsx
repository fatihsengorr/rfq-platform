import { Card, CardContent, CardHeader } from "@/components/ui/card";

function SkeletonLine({ className }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded ${className ?? "h-4 w-full"}`} />;
}

export default function QuotesLoading() {
  return (
    <main className="w-full max-w-[1180px] mx-auto px-4 py-6">
      <div className="mb-4">
        <SkeletonLine className="h-7 w-32 mb-2" />
        <SkeletonLine className="h-4 w-64" />
      </div>

      {/* Filter skeleton */}
      <Card className="mt-4">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <SkeletonLine className="h-9 w-32" />
            <SkeletonLine className="h-9 w-28" />
            <SkeletonLine className="h-9 w-20" />
          </div>
        </CardContent>
      </Card>

      {/* Split pane skeleton */}
      <div className="mt-4 grid lg:grid-cols-[320px_1fr] gap-4">
        <Card>
          <CardHeader className="p-4">
            <SkeletonLine className="h-5 w-20" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-lg border p-3">
                  <SkeletonLine className="h-4 w-40 mb-1" />
                  <SkeletonLine className="h-3 w-28 mb-1" />
                  <SkeletonLine className="h-3 w-32" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <SkeletonLine className="h-5 w-48 mb-4" />
            <div className="grid gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <SkeletonLine className="h-4 w-12" />
                  <SkeletonLine className="h-4 w-24" />
                  <SkeletonLine className="h-4 w-20" />
                  <SkeletonLine className="h-4 w-28" />
                  <SkeletonLine className="h-4 w-32" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
