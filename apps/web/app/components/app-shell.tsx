import type { ReactNode } from "react";
import type { SessionUser } from "../../lib/session";
import { LogoutButton } from "./logout-button";
import { MobileSidebar } from "./mobile-sidebar";
import {
  LayoutDashboard,
  FileText,
  Receipt,
  UserCog,
  Plus,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

type AppShellProps = {
  user: SessionUser;
  children: ReactNode;
};

function roleLabel(role: SessionUser["role"]) {
  if (role === "LONDON_SALES") return "London Sales";
  if (role === "ISTANBUL_PRICING") return "Istanbul Pricing";
  if (role === "ISTANBUL_MANAGER") return "Istanbul Manager";
  return "Platform Admin";
}

function teamLabel(role: SessionUser["role"]) {
  if (role === "LONDON_SALES") return "London Office";
  if (role === "ISTANBUL_PRICING" || role === "ISTANBUL_MANAGER") return "Istanbul Office";
  return "Cross Office";
}

const iconMap: Record<string, React.ReactNode> = {
  "/": <LayoutDashboard className="size-4" />,
  "/requests": <FileText className="size-4" />,
  "/quotes": <Receipt className="size-4" />,
  "/account": <UserCog className="size-4" />,
  "/requests/new": <Plus className="size-4" />,
  "/requests?focus=approval": <ShieldCheck className="size-4" />,
  "/admin/users": <Users className="size-4" />,
};

function menuForRole(role: SessionUser["role"]) {
  const items: Array<{ href: string; label: string }> = [
    { href: "/", label: "Dashboard" },
    { href: "/requests", label: "Requests" },
    { href: "/quotes", label: "Quotes" },
    { href: "/account", label: "Account" },
  ];

  if (role === "LONDON_SALES" || role === "ADMIN") {
    items.push({ href: "/requests/new", label: "New Request" });
  }

  if (role === "ISTANBUL_MANAGER" || role === "ADMIN") {
    items.push({ href: "/requests?focus=approval", label: "Manager Queue" });
  }

  if (role === "ADMIN") {
    items.push({ href: "/admin/users", label: "Admin Users" });
  }

  return items;
}

function SidebarNav({ items }: { items: Array<{ href: string; label: string }> }) {
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold border border-white/10 bg-white/[0.06] hover:bg-white/[0.14] transition-colors"
        >
          {iconMap[item.href]}
          {item.label}
        </a>
      ))}
    </nav>
  );
}

function SidebarBrand() {
  return (
    <div>
            <img src="/gorhan-logo-white.svg" alt="Gorhan" className="w-36 mb-3" />
      <p className="text-xs uppercase tracking-widest opacity-70">RFQ Platform</p>
    </div>
  );
}

export function AppShell({ user, children }: AppShellProps) {
  const items = menuForRole(user.role);

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[260px_1fr]">
      {/* ── Desktop Sidebar ──────────────────────── */}
      <aside className="hidden lg:flex bg-sidebar text-sidebar-foreground p-5 flex-col justify-between gap-4">
        <SidebarBrand />
        <SidebarNav items={items} />
        <div className="border-t border-white/15 pt-3">
          <p className="text-xs text-sidebar-foreground/60">{teamLabel(user.role)}</p>
          <p className="text-sm font-bold mt-0.5">{roleLabel(user.role)}</p>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────── */}
      <div className="min-w-0 flex flex-col">
        <header className="sticky top-0 z-10 px-5 py-3 border-b border-border bg-background/80 backdrop-blur-md flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <MobileSidebar>
              <SidebarBrand />
              <Separator className="my-3 bg-white/15" />
              <SidebarNav items={items} />
              <Separator className="my-3 bg-white/15" />
              <div>
                <p className="text-xs text-sidebar-foreground/60">{teamLabel(user.role)}</p>
                <p className="text-sm font-bold mt-0.5">{roleLabel(user.role)}</p>
              </div>
            </MobileSidebar>

            <div>
              <p className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">
                Signed In
              </p>
              <p className="font-bold text-sm">
                {user.fullName}{" "}
                <span className="font-semibold text-muted-foreground">
                  ({roleLabel(user.role)})
                </span>
              </p>
            </div>
          </div>
          <LogoutButton />
        </header>
        <main className="flex-1 pb-8">{children}</main>
      </div>
    </div>
  );
}
