import { Card, CardContent, CardHeader } from "@/components/ui/card";

function SkeletonLine({ className }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded ${className ?? "h-4 w-full"}`} />;
}

export default function AccountLoading() {
  return (
    <main className="w-full max-w-[720px] mx-auto px-4 py-6">
      <div className="mb-4">
        <SkeletonLine className="h-7 w-48 mb-2" />
        <SkeletonLine className="h-4 w-64" />
      </div>

      <Card>
        <CardHeader>
          <SkeletonLine className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <SkeletonLine className="h-4 w-28" />
              <SkeletonLine className="h-10 w-full" />
            </div>
            <div className="grid gap-2">
              <SkeletonLine className="h-4 w-28" />
              <SkeletonLine className="h-10 w-full" />
            </div>
            <div className="sm:col-span-2 grid gap-2">
              <SkeletonLine className="h-4 w-36" />
              <SkeletonLine className="h-10 w-full" />
            </div>
            <SkeletonLine className="h-10 w-36" />
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
