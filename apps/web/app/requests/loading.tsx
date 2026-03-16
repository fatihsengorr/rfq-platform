import { Card, CardContent, CardHeader } from "@/components/ui/card";

function SkeletonLine({ className }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded ${className ?? "h-4 w-full"}`} />;
}

export default function RequestsLoading() {
  return (
    <main className="w-full max-w-[1180px] mx-auto px-4 py-6">
      <div className="mb-4">
        <SkeletonLine className="h-7 w-48 mb-2" />
        <SkeletonLine className="h-4 w-72" />
      </div>

      <Card>
        <CardHeader>
          <SkeletonLine className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <SkeletonLine className="h-4 w-24" />
                <SkeletonLine className="h-4 w-48" />
                <SkeletonLine className="h-4 w-20" />
                <SkeletonLine className="h-4 w-32" />
                <SkeletonLine className="h-4 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
