"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        void signOut({ callbackUrl: "/login" });
      }}
    >
      <LogOut className="size-4" />
      Sign Out
    </Button>
  );
}
