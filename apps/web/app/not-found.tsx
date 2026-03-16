import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="w-full max-w-[600px] mx-auto px-4 py-16 text-center">
      <Card>
        <CardContent className="py-12">
          <h1 className="text-4xl font-bold text-primary mb-2">404</h1>
          <p className="text-lg font-semibold mb-1">Page Not Found</p>
          <p className="text-sm text-muted-foreground mb-6">
            The page you are looking for does not exist or has been moved.
          </p>
          <Button asChild>
            <Link href="/requests">Go to Requests</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
