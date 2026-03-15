import type { ReactNode } from "react";
import type { SessionUser } from "../../lib/session";
import { LogoutButton } from "./logout-button";

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

function menuForRole(role: SessionUser["role"]) {
  const items: Array<{ href: string; label: string }> = [
    { href: "/", label: "Dashboard" },
    { href: "/requests", label: "Requests" },
    { href: "/quotes", label: "Quotes" },
    { href: "/account", label: "Account" }
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

export function AppShell({ user, children }: AppShellProps) {
  const items = menuForRole(user.role);

  return (
    <div className="app-frame">
      <aside className="app-sidebar">
        <div className="sidebar-brand-block">
          <p className="sidebar-eyebrow">RFQ Platform</p>
          <h1>Quote Ops</h1>
          <p className="sidebar-sub">London and Istanbul workflow in one place.</p>
        </div>

        <nav className="sidebar-nav">
          {items.map((item) => (
            <a key={item.href} href={item.href} className="sidebar-link">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="sidebar-meta">
          <p>{teamLabel(user.role)}</p>
          <strong>{roleLabel(user.role)}</strong>
        </div>
      </aside>

      <div className="app-content-wrap">
        <header className="app-topbar">
          <div>
            <p className="topbar-eyebrow">Signed In</p>
            <p className="topbar-user">
              {user.fullName} <span>({roleLabel(user.role)})</span>
            </p>
          </div>
          <LogoutButton />
        </header>
        <div className="app-content">{children}</div>
      </div>
    </div>
  );
}
