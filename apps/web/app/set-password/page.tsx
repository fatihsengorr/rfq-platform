import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "../../lib/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { SetPasswordForm } from "./set-password-form";

type SetPasswordSearchParams = Promise<{ token?: string }>;

export default async function SetPasswordPage({ searchParams }: { searchParams: SetPasswordSearchParams }) {
  const session = await getSession();

  if (session.accessToken) {
    redirect("/requests");
  }

  const params = await searchParams;

  if (!params.token) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="text-xl">Invalid Invitation</CardTitle>
            <CardDescription>
              This invitation link is missing the required token. Please ask your administrator to resend the invitation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login" className="text-sm text-primary hover:underline flex items-center gap-1">
              <ArrowLeft className="size-3" />
              Go to sign in
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-xl">Welcome to RFQ Platform</CardTitle>
          <CardDescription>
            Set your password to activate your account and start using the platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SetPasswordForm token={params.token} />

          <div className="mt-4">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
              <ArrowLeft className="size-3" />
              Already have an account? Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
