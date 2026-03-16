import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "../../lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function SessionDebugPage() {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const session = await getSession();

  if (!session.accessToken || !session.user || session.user.role !== "ADMIN") {
    redirect("/login");
  }
  const secureNextAuthToken = cookieStore.get("__Secure-next-auth.session-token")?.value ?? null;
  const nextAuthToken = cookieStore.get("next-auth.session-token")?.value ?? null;
  const probeInsecure = cookieStore.get("probe_insecure")?.value ?? null;
  const probeSecure = cookieStore.get("probe_secure")?.value ?? null;
  const probeHttpOnly = cookieStore.get("probe_http_only")?.value ?? null;

  const rows: [string, string][] = [
    ["host", headerStore.get("host") ?? "-"],
    ["x-forwarded-host", headerStore.get("x-forwarded-host") ?? "-"],
    ["x-forwarded-proto", headerStore.get("x-forwarded-proto") ?? "-"],
    ["cookie header present", headerStore.get("cookie") ? "yes" : "no"],
    ["__Secure-next-auth.session-token present", secureNextAuthToken ? "yes" : "no"],
    ["__Secure-next-auth.session-token length", secureNextAuthToken ? String(secureNextAuthToken.length) : "0"],
    ["next-auth.session-token present", nextAuthToken ? "yes" : "no"],
    ["next-auth.session-token length", nextAuthToken ? String(nextAuthToken.length) : "0"],
    ["probe_insecure present", probeInsecure ? "yes" : "no"],
    ["probe_secure present", probeSecure ? "yes" : "no"],
    ["probe_http_only present", probeHttpOnly ? "yes" : "no"],
    ["session access token", session.accessToken ? "yes" : "no"],
    ["session user email", session.user?.email ?? "-"],
    ["session user role", session.user?.role ?? "-"],
    ["user agent", headerStore.get("user-agent") ?? "-"],
  ];

  return (
    <main className="w-full max-w-[860px] mx-auto px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle>Session Debug</CardTitle>
          <p className="text-sm text-muted-foreground">
            Temporary diagnostics page for production sign-in troubleshooting.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[220px]">Field</TableHead>
                <TableHead>Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(([label, value]) => (
                <TableRow key={label}>
                  <TableCell className="font-medium">{label}</TableCell>
                  <TableCell className="break-all">{value}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
