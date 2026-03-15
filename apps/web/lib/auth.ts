import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const API_BASE_URL = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

type LoginResponsePayload = {
  accessToken?: string;
  user?: {
    id: string;
    email: string;
    fullName: string;
    role: "LONDON_SALES" | "ISTANBUL_PRICING" | "ISTANBUL_MANAGER" | "ADMIN";
  };
};

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_JWT_SECRET ?? "dev-secret-change-me",
  pages: {
    signIn: "/login"
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 12
  },
  providers: [
    CredentialsProvider({
      name: "Company Account",
      credentials: {
        email: {
          label: "Email",
          type: "email"
        },
        password: {
          label: "Password",
          type: "password"
        }
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim();
        const password = String(credentials?.password ?? "").trim();

        if (!email || !password) {
          return null;
        }

        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ email, password }),
          cache: "no-store"
        });

        if (!response.ok) {
          return null;
        }

        const payload = (await response.json()) as LoginResponsePayload;

        if (!payload.accessToken || !payload.user) {
          return null;
        }

        return {
          id: payload.user.id,
          email: payload.user.email,
          fullName: payload.user.fullName,
          role: payload.user.role,
          accessToken: payload.accessToken
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.email = user.email;
        token.fullName = user.fullName;
        token.role = user.role;
        token.accessToken = user.accessToken;
      }

      return token;
    },
    async session({ session, token }) {
      if (!token.accessToken || !token.userId || !token.email || !token.fullName || !token.role) {
        return session;
      }

      session.accessToken = token.accessToken;
      session.user = {
        id: token.userId,
        email: token.email,
        fullName: token.fullName,
        role: token.role,
        name: token.fullName
      };

      return session;
    }
  }
};
