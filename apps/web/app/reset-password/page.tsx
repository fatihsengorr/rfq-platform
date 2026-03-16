import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "../../lib/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { ResetPasswordForm } from "./reset-password-form";

type ResetSearchParams = Promise<{ token?: string }>;

export default async function ResetPasswordPage({ searchParams }: { searchParams: ResetSearchParams }) {
  const session = await getSession();

  if (session.accessToken) {
    redirect("/account");
  }

  const params = await searchParams;

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-xl">Reset Password</CardTitle>
          <CardDescription>
            Use the reset token and set a new password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResetPasswordForm defaultToken={params.token} />

          <div className="mt-4 grid gap-1">
            <Link href="/forgot-password" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              I need a reset token
            </Link>
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
