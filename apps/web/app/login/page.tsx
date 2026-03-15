import { redirect } from "next/navigation";
import { getSession } from "../../lib/session";

export default async function LoginPage() {
  const session = await getSession();

  if (session.accessToken) {
    redirect("/requests");
  }

  redirect("/api/auth/signin?callbackUrl=%2Frequests");
}
