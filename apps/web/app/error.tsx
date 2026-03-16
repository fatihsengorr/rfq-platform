"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="w-full max-w-[600px] mx-auto px-4 py-16 text-center">
      <Card>
        <CardContent className="py-12">
          <h1 className="text-4xl font-bold text-danger mb-2">Error</h1>
          <p className="text-lg font-semibold mb-1">Something went wrong</p>
          <p className="text-sm text-muted-foreground mb-6">
            An unexpected error occurred. Please try again.
          </p>
          <div className="flex justify-center gap-3">
            <Button onClick={reset}>Try Again</Button>
            <Button variant="outline" onClick={() => (window.location.href = "/requests")}>
              Go to Requests
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
