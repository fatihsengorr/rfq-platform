import { redirect } from "next/navigation";
import { getSession } from "../../lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { ChangePasswordForm } from "./change-password-form";

export default async function AccountPage() {
  const session = await getSession();

  if (!session.accessToken || !session.user) {
    redirect("/login");
  }

  return (
    <main className="w-full max-w-[720px] mx-auto px-4 py-6">
      <PageHeader
        title="Account Security"
        description="Update your own password here. This does not affect other users."
      />
      <ChangePasswordForm />
    </main>
  );
}
