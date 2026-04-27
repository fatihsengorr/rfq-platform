import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "../../lib/session";
import { searchCompanies, isApiClientError } from "../api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

type SearchParams = Promise<{ q?: string }>;

export default async function CompaniesPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();
  if (!session.accessToken || !session.user) redirect("/login");

  const { q } = await searchParams;
  const trimmed = q?.trim() ?? "";

  let companies: Awaited<ReturnType<typeof searchCompanies>> = [];
  try {
    companies = await searchCompanies(trimmed.length > 0 ? trimmed : undefined);
  } catch (error) {
    if (isApiClientError(error) && error.code === "UNAUTHORIZED") redirect("/login");
  }

  return (
    <main className="w-full max-w-[1180px] mx-auto px-4 py-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Companies</h1>
          <p className="text-sm text-muted-foreground">
            {companies.length} {companies.length === 1 ? "company" : "companies"}
            {trimmed ? ` matching "${trimmed}"` : ""}
          </p>
        </div>
      </div>

      <Card className="p-4 mb-4">
        <form className="flex items-center gap-2" action="/companies" method="get">
          <Search className="size-4 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={trimmed}
            placeholder="Search by company name…"
            className="flex-1"
          />
        </form>
      </Card>

      {companies.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {trimmed ? "No companies match this search." : "No companies yet."}
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/40">
              <tr className="text-xs text-muted-foreground">
                <th className="text-left font-semibold px-4 py-2">Name</th>
                <th className="text-left font-semibold px-4 py-2 hidden md:table-cell">Sector</th>
                <th className="text-left font-semibold px-4 py-2 hidden md:table-cell">Location</th>
                <th className="text-right font-semibold px-4 py-2">RFQs</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/companies/${c.id}`} className="font-semibold hover:text-primary">
                      {c.name}
                    </Link>
                    {c.contacts.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {c.contacts[0]!.fullName}
                        {c.contacts.length > 1 ? ` +${c.contacts.length - 1}` : ""}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                    {c.sector ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                    {[c.city, c.country].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold">{c.rfqCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </main>
  );
}
