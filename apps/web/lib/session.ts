import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth";

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: "LONDON_SALES" | "ISTANBUL_PRICING" | "ISTANBUL_MANAGER" | "ADMIN";
};
export async function getSession() {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken || !session.user?.id || !session.user.email || !session.user.fullName || !session.user.role) {
    return { accessToken: null, user: null as SessionUser | null };
  }

  return {
    accessToken: session.accessToken,
    user: {
      id: session.user.id,
      email: session.user.email,
      fullName: session.user.fullName,
      role: session.user.role
    }
  };
}
