import { Card, CardContent, CardHeader } from "@/components/ui/card";

function Skeleton({ className }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded ${className ?? "h-4 w-full"}`} />;
}

export default function NewRequestLoading() {
  return (
    <main className="w-full max-w-[1180px] mx-auto px-4 py-6">
      <div className="mb-4">
        <Skeleton className="h-7 w-52 mb-2" />
        <Skeleton className="h-4 w-80" />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-5 w-52 rounded-full" />
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="grid gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="grid gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="sm:col-span-2 grid gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-24 w-full" />
            </div>
            <div className="sm:col-span-2 grid gap-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-28 w-full" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
