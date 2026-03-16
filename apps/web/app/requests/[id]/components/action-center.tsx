"use client";

import { useState, useActionState } from "react";
import type { RfqRecord, QuoteRevision } from "../../../data";
import { IDLE_RESULT } from "../../../../lib/action-result";
import {
  reviseRequestAction,
  assignPricingUserAction,
  uploadRequestAttachmentsAction,
  createQuoteRevisionAction,
  decideApprovalAction,
} from "../actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FormMessage } from "@/components/ui/form-message";
import { Paperclip, Receipt, Loader2, Upload } from "lucide-react";

type ActionTab = "revise" | "upload" | "quote" | "assign" | "approval";

type ActionCenterProps = {
  record: RfqRecord;
  pricingUsers: Array<{ id: string; fullName: string; email: string }>;
  availableActions: Array<{ key: ActionTab; label: string }>;
};

const selectClasses = "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";


function SubmitBtn({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {children}
    </Button>
  );
}

export function ActionCenter({ record, pricingUsers, availableActions }: ActionCenterProps) {
  const [activeAction, setActiveAction] = useState<ActionTab | null>(availableActions[0]?.key ?? null);

  const [reviseState, reviseAction, revisePending] = useActionState(reviseRequestAction, IDLE_RESULT);
  const [assignState, assignAction, assignPending] = useActionState(assignPricingUserAction, IDLE_RESULT);
  const [uploadState, uploadAction, uploadPending] = useActionState(uploadRequestAttachmentsAction, IDLE_RESULT);
  const [quoteState, quoteAction, quotePending] = useActionState(createQuoteRevisionAction, IDLE_RESULT);
  const [approvalState, approvalAction, approvalPending] = useActionState(decideApprovalAction, IDLE_RESULT);

  const pendingRevisions = record.quoteRevisions.filter((r: QuoteRevision) => r.status === "SUBMITTED");
  const isoDeadlineLocal = new Date(record.deadline).toISOString().slice(0, 16);

  if (availableActions.length === 0) {
    return (
      <Card className="mt-4">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Action Center</CardTitle>
          <Badge variant="outline">Role-based actions</Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No available actions for your role.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-4">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Action Center</CardTitle>
        <Badge variant="outline">Role-based actions</Badge>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-4">
          {availableActions.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveAction(item.key)}
              className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold border transition-colors ${
                activeAction === item.key
                  ? "bg-primary/10 border-primary text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {activeAction === "revise" && (
          <>
            <FormMessage state={reviseState} />
            <form action={reviseAction} className="grid sm:grid-cols-2 gap-4">
              <input type="hidden" name="rfqId" value={record.id} />
              <div className="grid gap-2"><Label>Project Name</Label><Input name="projectName" minLength={2} required defaultValue={record.projectName} /></div>
              <div className="grid gap-2"><Label>Requested By</Label><Input name="requestedBy" minLength={2} required defaultValue={record.requestedBy} /></div>
              <div className="grid gap-2"><Label>Deadline</Label><Input name="deadline" type="datetime-local" required defaultValue={isoDeadlineLocal} /></div>
              <div className="sm:col-span-2 grid gap-2"><Label>Project Details</Label><Textarea name="projectDetails" rows={4} minLength={10} required defaultValue={record.projectDetails} /></div>
              <SubmitBtn pending={revisePending}>Save Request Revision</SubmitBtn>
            </form>
          </>
        )}

        {activeAction === "upload" && (
          <>
            <FormMessage state={uploadState} />
            <form action={uploadAction} className="grid gap-4">
              <input type="hidden" name="rfqId" value={record.id} />
              <div className="grid gap-2">
                <Label>Request Files</Label>
                <label className="relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/30 px-6 py-6 text-center transition-colors hover:border-primary/50 hover:bg-muted/50 cursor-pointer">
                  <Upload className="size-6 text-muted-foreground/60" />
                  <span className="text-sm"><span className="font-medium text-foreground">Click to upload</span> <span className="text-muted-foreground">or drag and drop</span></span>
                  <p className="text-xs text-muted-foreground">PDF, images, CAD — max 10 files, 50 MB each</p>
                  <input name="requestFiles" type="file" required multiple accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.svg,.dwg,.dxf,.step,.stp,.igs,.iges,application/pdf,image/*" className="sr-only" />
                </label>
              </div>
              <SubmitBtn pending={uploadPending}><Paperclip className="size-4" />Upload Request Files</SubmitBtn>
            </form>
          </>
        )}

        {activeAction === "quote" && (
          <>
            <FormMessage state={quoteState} />
            <form action={quoteAction} className="grid sm:grid-cols-2 gap-4">
              <input type="hidden" name="rfqId" value={record.id} />
              <div className="grid gap-2"><Label>Currency</Label><select name="currency" defaultValue="GBP" required className={selectClasses}><option value="GBP">GBP</option><option value="EUR">EUR</option><option value="USD">USD</option><option value="TRY">TRY</option></select></div>
              <div className="grid gap-2"><Label>Total Amount</Label><Input name="totalAmount" type="number" step="0.01" min="0.01" required /></div>
              <div className="sm:col-span-2 grid gap-2"><Label>Notes</Label><Textarea name="notes" rows={3} minLength={2} required /></div>
              <div className="sm:col-span-2 grid gap-2">
                <Label>Quote Files (optional)</Label>
                <label className="relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/30 px-6 py-6 text-center transition-colors hover:border-primary/50 hover:bg-muted/50 cursor-pointer">
                  <Upload className="size-6 text-muted-foreground/60" />
                  <span className="text-sm"><span className="font-medium text-foreground">Click to upload</span> <span className="text-muted-foreground">or drag and drop</span></span>
                  <input name="quoteFiles" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.svg,.dwg,.dxf,.step,.stp,.igs,.iges,application/pdf,image/*" className="sr-only" />
                </label>
              </div>
              <div className="flex items-center gap-2"><input name="autoSubmitForApproval" type="checkbox" defaultChecked className="size-4 accent-primary" /><Label className="cursor-pointer">Submit For Approval</Label></div>
              <div className="sm:col-span-2"><SubmitBtn pending={quotePending}><Receipt className="size-4" />Create Quote Revision</SubmitBtn></div>
            </form>
          </>
        )}

        {activeAction === "assign" && (
          <>
            <FormMessage state={assignState} />
            {pricingUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active Istanbul pricing users found.</p>
            ) : (
              <form action={assignAction} className="grid sm:grid-cols-2 gap-4">
                <input type="hidden" name="rfqId" value={record.id} />
                <div className="grid gap-2">
                  <Label>Assign To</Label>
                  <select name="assignedPricingUserId" required defaultValue={record.assignedPricingUserId ?? ""} className={selectClasses}>
                    <option value="" disabled>Select pricing user</option>
                    {pricingUsers.map((u) => <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>)}
                  </select>
                </div>
                <div className="flex items-end"><SubmitBtn pending={assignPending}>Save Assignment</SubmitBtn></div>
              </form>
            )}
          </>
        )}

        {activeAction === "approval" && (
          <>
            <FormMessage state={approvalState} />
            {pendingRevisions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No submitted quote revisions waiting for approval.</p>
            ) : (
              <form action={approvalAction} className="grid sm:grid-cols-2 gap-4">
                <input type="hidden" name="rfqId" value={record.id} />
                <div className="grid gap-2"><Label>Revision</Label><select name="quoteRevisionId" required className={selectClasses}>{pendingRevisions.map((r) => <option key={r.id} value={r.id}>V{r.versionNumber} - {r.currency} {r.totalAmount.toLocaleString("en-GB")}</option>)}</select></div>
                <div className="grid gap-2"><Label>Decision</Label><select name="decision" defaultValue="APPROVED" required className={selectClasses}><option value="APPROVED">APPROVED</option><option value="REJECTED">REJECTED</option></select></div>
                <div className="sm:col-span-2 grid gap-2"><Label>Comment</Label><Textarea name="comment" rows={3} minLength={2} required /></div>
                <SubmitBtn pending={approvalPending}>Save Manager Decision</SubmitBtn>
              </form>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
