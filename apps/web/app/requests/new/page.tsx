import { redirect } from "next/navigation";
import { getSession } from "../../../lib/session";
import { setFlashNotice } from "../../../lib/flash";
import { PageHeader } from "@/components/ui/page-header";
import { CreateRfqForm } from "./create-rfq-form";

export default async function NewRequestPage() {
  const session = await getSession();

  if (!session.accessToken || !session.user) {
    redirect("/login");
  }

  const canCreateRfq = session.user.role === "LONDON_SALES" || session.user.role === "ADMIN";

  if (!canCreateRfq) {
    await setFlashNotice("/requests", "rfq_create_forbidden");
    redirect("/requests");
  }

  return (
    <main className="w-full max-w-[1180px] mx-auto px-4 py-6">
      <PageHeader
        title="New RFQ Request"
        description="Create a request for Istanbul pricing. Required fields must be completed before submission."
      />
      <CreateRfqForm requestedBy={session.user.fullName} />
    </main>
  );
}
