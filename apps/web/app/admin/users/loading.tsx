import { Card, CardContent, CardHeader } from "@/components/ui/card";

function SkeletonLine({ className }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded ${className ?? "h-4 w-full"}`} />;
}

export default function AdminUsersLoading() {
  return (
    <main className="w-full max-w-[1180px] mx-auto px-4 py-6">
      <div className="mb-4">
        <SkeletonLine className="h-7 w-40 mb-2" />
        <SkeletonLine className="h-4 w-80" />
      </div>

      {/* Create user form skeleton */}
      <Card className="mt-4">
        <CardHeader>
          <SkeletonLine className="h-5 w-28" />
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            <SkeletonLine className="h-10" />
            <SkeletonLine className="h-10" />
            <SkeletonLine className="h-10" />
            <SkeletonLine className="h-10" />
          </div>
        </CardContent>
      </Card>

      {/* User directory skeleton */}
      <Card className="mt-4">
        <CardHeader>
          <SkeletonLine className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <SkeletonLine className="h-4 w-32" />
                <SkeletonLine className="h-4 w-40" />
                <SkeletonLine className="h-4 w-24" />
                <SkeletonLine className="h-4 w-16" />
                <SkeletonLine className="h-4 w-48" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
