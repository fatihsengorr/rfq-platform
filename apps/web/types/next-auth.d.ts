import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    user: DefaultSession["user"] & {
      id: string;
      email: string;
      fullName: string;
      role: "LONDON_SALES" | "ISTANBUL_PRICING" | "ISTANBUL_MANAGER" | "ADMIN";
    };
  }

  interface User {
    id: string;
    email: string;
    fullName: string;
    role: "LONDON_SALES" | "ISTANBUL_PRICING" | "ISTANBUL_MANAGER" | "ADMIN";
    accessToken: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    email?: string;
    fullName?: string;
    role?: "LONDON_SALES" | "ISTANBUL_PRICING" | "ISTANBUL_MANAGER" | "ADMIN";
    accessToken?: string;
  }
}
