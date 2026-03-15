"use client";

import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <button
      type="button"
      className="secondary-btn"
      onClick={() => {
        void signOut({ callbackUrl: "/login" });
      }}
    >
      Sign Out
    </button>
  );
}
