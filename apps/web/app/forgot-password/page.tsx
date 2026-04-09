import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "../../lib/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { ForgotPasswordForm } from "./forgot-password-form";

type ForgotSearchParams = Promise<{ status?: string; token?: string }>;

export default async function ForgotPasswordPage({ searchParams }: { searchParams: ForgotSearchParams }) {
  const session = await getSession();

  if (session.accessToken) {
    redirect("/account");
  }

  const params = await searchParams;

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-xl">Forgot Password</CardTitle>
          <CardDescription>
            Enter your email address and we'll send you a link to reset your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm />

          {/* Dev-only: show token for local testing */}
          {params.token && (
            <Card className="mt-4 bg-muted">
              <CardContent className="p-4">
                <p className="font-bold text-sm">Development Token</p>
                <p className="text-sm text-muted-foreground">This is only visible in development mode.</p>
                <code className="mt-1 block text-sm bg-card border border-border rounded px-2 py-1 break-all">
                  {params.token}
                </code>
                <Link
                  href={`/reset-password?token=${encodeURIComponent(params.token)}`}
                  className="mt-2 inline-block text-sm text-primary hover:underline"
                >
                  Click here to reset password with this token
                </Link>
              </CardContent>
            </Card>
          )}

          <div className="mt-4">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
              <ArrowLeft className="size-3" />
              Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
