import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton as SkeletonLine } from "@/components/ui/skeleton";

export default function RequestDetailLoading() {
  return (
    <main className="w-full max-w-[1180px] mx-auto px-4 py-6">
      <SkeletonLine className="h-4 w-24 mb-3" />

      <div className="mb-4">
        <SkeletonLine className="h-7 w-64 mb-1" />
        <SkeletonLine className="h-4 w-32" />
      </div>

      {/* Summary skeleton */}
      <Card>
        <CardContent className="p-4">
          <div className="grid sm:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="grid gap-1">
                <SkeletonLine className="h-3 w-20" />
                <SkeletonLine className="h-5 w-28" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Action center skeleton */}
      <Card className="mt-4">
        <CardHeader>
          <SkeletonLine className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <SkeletonLine className="h-8 w-28 rounded-full" />
            <SkeletonLine className="h-8 w-24 rounded-full" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <SkeletonLine className="h-10" />
            <SkeletonLine className="h-10" />
            <div className="sm:col-span-2"><SkeletonLine className="h-24" /></div>
          </div>
        </CardContent>
      </Card>

      {/* Details skeleton */}
      <Card className="mt-4">
        <CardHeader>
          <SkeletonLine className="h-5 w-24" />
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i}>
                <SkeletonLine className="h-3 w-24 mb-1" />
                <SkeletonLine className="h-4 w-36" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
