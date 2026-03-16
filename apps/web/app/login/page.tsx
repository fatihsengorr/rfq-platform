import { redirect } from "next/navigation";
import { getSession } from "../../lib/session";
import { LoginForm } from "./login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, ShieldCheck } from "lucide-react";
import Link from "next/link";

type LoginSearchParams = Promise<{ callbackUrl?: string; error?: string }>;

function resolveLoginError(error?: string) {
  if (!error) return null;
  if (error === "CredentialsSignin") return "Invalid email or password.";
  if (error === "AccessDenied") return "This account is inactive or access is denied.";
  return "Sign in failed. Please try again.";
}

export default async function LoginPage({ searchParams }: { searchParams: LoginSearchParams }) {
  const session = await getSession();

  if (session.accessToken) {
    redirect("/requests");
  }

  const params = await searchParams;
  const callbackUrl = params.callbackUrl && params.callbackUrl.startsWith("/") ? params.callbackUrl : "/requests";
  const errorMessage = resolveLoginError(params.error);

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-5xl grid lg:grid-cols-[1.15fr_minmax(340px,420px)] gap-6 items-stretch">
        {/* ── Showcase ─────────────────────────── */}
        <Card className="p-6 bg-gradient-to-br from-white via-background to-[#fff5e8] max-lg:hidden">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            RFQ Platform
          </p>
          <h1 className="mt-2 text-4xl font-bold leading-tight max-w-[12ch]">
            Quote workflow for London and Istanbul
          </h1>
          <p className="mt-2 text-muted-foreground">
            Track requests, pricing assignments, approvals, and final quotes in one clear internal workspace.
          </p>

          <div className="mt-6 grid gap-3">
            <Card className="bg-white/70 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Users className="size-5 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-sm">London Team</p>
                  <p className="text-sm text-muted-foreground">Create RFQs, upload request files, and monitor approved offers.</p>
                </div>
              </div>
            </Card>
            <Card className="bg-white/70 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-accent/20 p-2">
                  <FileText className="size-5 text-accent" />
                </div>
                <div>
                  <p className="font-bold text-sm">Istanbul Pricing</p>
                  <p className="text-sm text-muted-foreground">Work assigned requests, upload quote files, and submit revisions for approval.</p>
                </div>
              </div>
            </Card>
            <Card className="bg-white/70 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-success/10 p-2">
                  <ShieldCheck className="size-5 text-success" />
                </div>
                <div>
                  <p className="font-bold text-sm">Managers & Admin</p>
                  <p className="text-sm text-muted-foreground">Assign workload, approve submissions, and manage users and permissions.</p>
                </div>
              </div>
            </Card>
          </div>
        </Card>

        {/* ── Login Form ───────────────────────── */}
        <Card className="self-center">
          <CardHeader>
            <CardTitle className="text-xl">Sign In</CardTitle>
            <CardDescription>
              Use your assigned company account to access the platform.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm callbackUrl={callbackUrl} initialError={errorMessage} />
            <p className="mt-4 text-sm">
              <Link href="/forgot-password" className="text-muted-foreground hover:text-primary transition-colors">
                Forgot password?
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
