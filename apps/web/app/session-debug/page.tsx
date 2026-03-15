import { cookies, headers } from "next/headers";
import { getSession } from "../../lib/session";

export default async function SessionDebugPage() {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const session = await getSession();
  const secureNextAuthToken = cookieStore.get("__Secure-next-auth.session-token")?.value ?? null;
  const nextAuthToken = cookieStore.get("next-auth.session-token")?.value ?? null;
  const probeInsecure = cookieStore.get("probe_insecure")?.value ?? null;
  const probeSecure = cookieStore.get("probe_secure")?.value ?? null;
  const probeHttpOnly = cookieStore.get("probe_http_only")?.value ?? null;

  return (
    <main className="shell">
      <section className="panel" style={{ maxWidth: 860, margin: "2rem auto" }}>
        <h1>Session Debug</h1>
        <p>Temporary diagnostics page for production sign-in troubleshooting.</p>

        <div className="data-table" style={{ marginTop: "1rem" }}>
          <div className="data-head" style={{ gridTemplateColumns: "220px 1fr" }}>
            <span>Field</span>
            <span>Value</span>
          </div>

          {[
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
            ["user agent", headerStore.get("user-agent") ?? "-"]
          ].map(([label, value]) => (
            <div key={label} className="data-row" style={{ gridTemplateColumns: "220px 1fr" }}>
              <span>{label}</span>
              <span style={{ wordBreak: "break-word" }}>{value}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
