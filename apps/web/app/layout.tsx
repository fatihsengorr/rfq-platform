import type { Metadata } from "next";
import { Sora } from "next/font/google";
import { Toaster } from "sonner";
import { getSession } from "../lib/session";
import { AppShell } from "./components/app-shell";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
});

export const metadata: Metadata = {
  title: "RFQ & Quote Tracking",
  description: "Quote operations platform for London and Istanbul teams",
  manifest: "/manifest.webmanifest"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <html lang="en" className={sora.variable}>
      <body className="font-[family-name:var(--font-sora)] antialiased">
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            style: {
              fontFamily: "var(--font-sora), sans-serif",
            },
          }}
        />
        {session.user ? <AppShell user={session.user}>{children}</AppShell> : children}
      </body>
    </html>
  );
}
