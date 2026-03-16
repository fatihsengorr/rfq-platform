import { redirect } from "next/navigation";
import Link from "next/link";
import { getPricingUsers, getRfqById, isApiClientError } from "../../api";
import { FlashNotice } from "../../components/flash-notice";
import { getSession } from "../../../lib/session";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { SummaryCard } from "./components/summary-card";
import { ActionCenter } from "./components/action-center";
import { DetailsCard } from "./components/details-card";

type Params = { id: string };
type ActionTab = "revise" | "upload" | "quote" | "assign" | "approval";

/* Cross-page flash notices (e.g. after creating a new RFQ and redirecting here).
   In-page form feedback is now handled inline via useActionState. */
const detailNotices = {
  rfq_created: { tone: "success", text: "RFQ request has been created." },
  rfq_created_with_files: { tone: "success", text: "RFQ request has been created with request files." },
  rfq_created_file_upload_failed: { tone: "warn", text: "RFQ created, but request file upload failed." },
} as const;

export default async function RequestDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const session = await getSession();

  if (!session.accessToken || !session.user) redirect("/login");

  const role = session.user.role;
  const canReviseRequest = role === "LONDON_SALES" || role === "ADMIN";
  const canCreateQuote = role === "ISTANBUL_PRICING" || role === "ADMIN";
  const canManageAssignmentAndApproval = role === "ISTANBUL_MANAGER" || role === "ADMIN";

  let record = null;
  try {
    record = await getRfqById(id);
  } catch (error) {
    if (isApiClientError(error) && error.code === "UNAUTHORIZED") redirect("/login");
    record = null;
  }

  if (!record) {
    return (
      <main className="w-full max-w-[1180px] mx-auto px-4 py-6">
        <Card className="p-6">
          <h1 className="text-xl font-bold">Record not found</h1>
          <Button asChild className="mt-3"><Link href="/requests">Back to list</Link></Button>
        </Card>
      </main>
    );
  }

  let pricingUsers: Array<{ id: string; fullName: string; email: string }> = [];
  if (canManageAssignmentAndApproval) {
    try {
      pricingUsers = await getPricingUsers();
    } catch (error) {
      if (isApiClientError(error) && error.code === "UNAUTHORIZED") redirect("/login");
    }
  }

  const availableActions: Array<{ key: ActionTab; label: string }> = [];
  if (canReviseRequest) {
    availableActions.push({ key: "revise", label: "Revise Request" });
    availableActions.push({ key: "upload", label: "Upload Files" });
  }
  if (canCreateQuote) {
    availableActions.push({ key: "quote", label: "Create Quote" });
  }
  if (canManageAssignmentAndApproval) {
    availableActions.push({ key: "assign", label: "Assign Pricing" });
    availableActions.push({ key: "approval", label: "Approval" });
  }

  return (
    <main className="w-full max-w-[1180px] mx-auto px-4 py-6">
      <Link href="/requests" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-3">
        <ArrowLeft className="size-3" /> Back to list
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{record.projectName}</h1>
          <p className="text-sm text-muted-foreground">RFQ #{record.id}</p>
        </div>
      </div>

      <FlashNotice path={`/requests/${id}`} notices={detailNotices} />

      <SummaryCard record={record} />
      <ActionCenter record={record} pricingUsers={pricingUsers} availableActions={availableActions} />
      <DetailsCard record={record} />
    </main>
  );
}
