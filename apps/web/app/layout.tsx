import type { Metadata } from "next";
import { getSession } from "../lib/session";
import { AppShell } from "./components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "RFQ & Quote Tracking",
  description: "Quote operations platform for London and Istanbul teams",
  manifest: "/manifest.webmanifest"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <html lang="en">
      <body>
        {session.user ? <AppShell user={session.user}>{children}</AppShell> : children}
      </body>
    </html>
  );
}
