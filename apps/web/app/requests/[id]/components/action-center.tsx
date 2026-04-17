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
  markRfqWonAction,
  markRfqLostAction,
  reopenRfqAction,
} from "../actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FormMessage } from "@/components/ui/form-message";
import { FileDropZone } from "@/components/ui/file-drop-zone";
import { Paperclip, Receipt, Loader2, Trophy, XCircle, RotateCcw } from "lucide-react";
import { PillTabList, PillTab } from "@/components/ui/pill-tabs";

type ActionTab = "revise" | "upload" | "quote" | "assign" | "approval" | "outcome";

type ActionCenterProps = {
  record: RfqRecord;
  pricingUsers: Array<{ id: string; fullName: string; email: string }>;
  availableActions: Array<{ key: ActionTab; label: string }>;
};

const selectClasses = "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";


function SubmitBtn({ pending, children, pendingText }: { pending: boolean; children: React.ReactNode; pendingText?: string }) {
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          {pendingText ?? "Processing..."}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

function UploadProgress({ pending, label }: { pending: boolean; label: string }) {
  if (!pending) return null;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 mt-3">
      <Loader2 className="size-5 animate-spin text-primary shrink-0" />
      <div>
        <p className="text-sm font-semibold text-primary">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Please wait, this may take a moment for large files.</p>
      </div>
    </div>
  );
}

export function ActionCenter({ record, pricingUsers, availableActions }: ActionCenterProps) {
  const [activeAction, setActiveAction] = useState<ActionTab | null>(availableActions[0]?.key ?? null);

  const [reviseState, reviseAction, revisePending] = useActionState(reviseRequestAction, IDLE_RESULT);
  const [assignState, assignAction, assignPending] = useActionState(assignPricingUserAction, IDLE_RESULT);
  const [uploadState, uploadAction, uploadPending] = useActionState(uploadRequestAttachmentsAction, IDLE_RESULT);
  const [quoteState, quoteAction, quotePending] = useActionState(createQuoteRevisionAction, IDLE_RESULT);
  const [approvalState, approvalAction, approvalPending] = useActionState(decideApprovalAction, IDLE_RESULT);
  const [wonState, wonAction, wonPending] = useActionState(markRfqWonAction, IDLE_RESULT);
  const [lostState, lostAction, lostPending] = useActionState(markRfqLostAction, IDLE_RESULT);
  const [reopenState, reopenAction, reopenPending] = useActionState(reopenRfqAction, IDLE_RESULT);

  const isResolved = record.status === "WON" || record.status === "LOST" || record.status === "CLOSED";

  const pendingRevisions = record.quoteRevisions.filter((r: QuoteRevision) => r.status === "SUBMITTED");
  const isoDeadlineLocal = new Date(record.deadline).toISOString().slice(0, 16);

  // Faz 3 — Feature 2: quote v2+ must carry a changeReason. Count existing quotes to decide.
  const existingQuoteCount = record.quoteRevisions.length;
  const isQuoteRevision = existingQuoteCount > 0;
  const nextQuoteVersion = existingQuoteCount + 1;

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
        <PillTabList className="mb-4">
          {availableActions.map((item) => (
            <PillTab
              key={item.key}
              active={activeAction === item.key}
              onClick={() => setActiveAction(item.key)}
            >
              {item.label}
            </PillTab>
          ))}
        </PillTabList>

        {activeAction === "revise" && (
          <>
            <FormMessage state={reviseState} />
            <form action={reviseAction} className="grid sm:grid-cols-2 gap-4">
              <input type="hidden" name="rfqId" value={record.id} />
              <div className="grid gap-2"><Label>Project Name</Label><Input name="projectName" minLength={2} required defaultValue={record.projectName} /></div>
              <div className="grid gap-2"><Label>Requested By</Label><Input name="requestedBy" minLength={2} required defaultValue={record.requestedBy} /></div>
              <div className="grid gap-2"><Label>Deadline</Label><Input name="deadline" type="datetime-local" required defaultValue={isoDeadlineLocal} /></div>
              <div className="sm:col-span-2 grid gap-2"><Label>Project Details</Label><Textarea name="projectDetails" rows={4} minLength={10} required defaultValue={record.projectDetails} /></div>
              {/* Faz 3 — Feature 2: changeReason required so revisions have an audit trail */}
              <div className="sm:col-span-2 grid gap-2">
                <Label htmlFor="changeReason">
                  Reason for revision <span className="text-danger">*</span>
                </Label>
                <Textarea
                  id="changeReason"
                  name="changeReason"
                  rows={2}
                  minLength={10}
                  maxLength={500}
                  required
                  placeholder="e.g. Architect added 5 more guestrooms and a bar area"
                />
                <p className="text-xs text-muted-foreground">This note is saved in the revision history so everyone can see what changed and why.</p>
              </div>
              <SubmitBtn pending={revisePending} pendingText="Saving...">Save Request Revision</SubmitBtn>
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
                <FileDropZone name="requestFiles" required />
              </div>
              <SubmitBtn pending={uploadPending} pendingText="Uploading files...">
                <Paperclip className="size-4" />Upload Request Files
              </SubmitBtn>
            </form>
            <UploadProgress pending={uploadPending} label="Uploading files to storage..." />
          </>
        )}

        {activeAction === "quote" && (
          <>
            <FormMessage state={quoteState} />
            {isQuoteRevision && (
              <div className="mb-3 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                This will be <strong>Quote v{nextQuoteVersion}</strong>. Please tell us what changed vs. the previous quote.
              </div>
            )}
            <form action={quoteAction} className="grid sm:grid-cols-2 gap-4">
              <input type="hidden" name="rfqId" value={record.id} />
              <input type="hidden" name="isRevision" value={isQuoteRevision ? "true" : "false"} />
              <div className="grid gap-2"><Label>Currency</Label><select name="currency" defaultValue="GBP" required className={selectClasses}><option value="GBP">GBP</option><option value="EUR">EUR</option><option value="USD">USD</option><option value="TRY">TRY</option></select></div>
              <div className="grid gap-2"><Label>Total Amount</Label><Input name="totalAmount" type="number" step="0.01" min="0.01" required /></div>
              <div className="sm:col-span-2 grid gap-2"><Label>Notes</Label><Textarea name="notes" rows={3} minLength={2} required /></div>
              {/* Faz 3 — Feature 2: reason + optional RFQ-revision link on v2+ quotes */}
              {isQuoteRevision && (
                <>
                  <div className="sm:col-span-2 grid gap-2">
                    <Label htmlFor="quote-changeReason">
                      Reason for this revision <span className="text-danger">*</span>
                    </Label>
                    <Textarea
                      id="quote-changeReason"
                      name="changeReason"
                      rows={2}
                      minLength={10}
                      maxLength={500}
                      required
                      placeholder="e.g. Reflected new room count; added bar unit; updated hardware spec"
                    />
                  </div>
                  {/* pricingRfqRevisions dropdown removed for v1 — only relevant when prior RFQ revisions exist */}
                </>
              )}
              <div className="sm:col-span-2 grid gap-2">
                <Label>Quote Files (optional)</Label>
                <FileDropZone name="quoteFiles" />
              </div>
              <div className="flex items-center gap-2"><input name="autoSubmitForApproval" type="checkbox" defaultChecked className="size-4 accent-primary" /><Label className="cursor-pointer">Submit For Approval</Label></div>
              <div className="sm:col-span-2">
                <SubmitBtn pending={quotePending} pendingText="Creating quote & uploading...">
                  <Receipt className="size-4" />Create Quote {isQuoteRevision ? `Revision v${nextQuoteVersion}` : "Revision"}
                </SubmitBtn>
              </div>
            </form>
            <UploadProgress pending={quotePending} label="Creating quote revision and uploading files..." />
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
                <div className="flex items-end"><SubmitBtn pending={assignPending} pendingText="Saving...">Save Assignment</SubmitBtn></div>
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
                <SubmitBtn pending={approvalPending} pendingText="Saving decision...">Save Manager Decision</SubmitBtn>
              </form>
            )}
          </>
        )}

        {activeAction === "outcome" && (
          <div className="space-y-4">
            {/* Current outcome banner (only if already resolved) */}
            {isResolved && (
              <div className={`rounded-lg border p-3 text-sm ${record.status === "WON" ? "bg-[#d9f4e3] border-[#6fbd89] text-[#165c2a]" : "bg-[#e0e0e0] border-[#b8b8b8] text-[#4a4a4a]"}`}>
                <p className="font-semibold">
                  {record.status === "WON" && `✓ Marked as Won${record.wonAt ? ` on ${new Date(record.wonAt).toLocaleDateString("en-GB")}` : ""}`}
                  {record.status === "LOST" && `✗ Marked as Lost${record.lostAt ? ` on ${new Date(record.lostAt).toLocaleDateString("en-GB")}` : ""}`}
                  {record.status === "CLOSED" && "Closed (legacy status)"}
                </p>
                {record.status === "LOST" && record.lostReason && (
                  <p className="text-xs mt-1 opacity-80">Reason: {record.lostReason}</p>
                )}
                <form action={reopenAction} className="mt-3">
                  <input type="hidden" name="rfqId" value={record.id} />
                  <input type="hidden" name="status" value="QUOTED" />
                  <Button type="submit" variant="outline" size="sm" disabled={reopenPending}>
                    {reopenPending ? <><Loader2 className="size-3 animate-spin" />Re-opening...</> : <><RotateCcw className="size-3" />Re-open RFQ</>}
                  </Button>
                </form>
                <FormMessage state={reopenState} />
              </div>
            )}

            {/* Mark as Won — single-click confirm */}
            {!isResolved && (
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Trophy className="size-4 text-[#2d6a1e]" />
                      Mark as Won
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">Customer accepted the quote. Records the win date.</p>
                  </div>
                  <form action={wonAction}>
                    <input type="hidden" name="rfqId" value={record.id} />
                    <Button type="submit" disabled={wonPending} className="bg-[#2d6a1e] hover:bg-[#215416] text-white">
                      {wonPending ? <><Loader2 className="size-4 animate-spin" />Saving...</> : <>Mark Won</>}
                    </Button>
                  </form>
                </div>
                <FormMessage state={wonState} />
              </div>
            )}

            {/* Mark as Lost — requires reason */}
            {!isResolved && (
              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <XCircle className="size-4 text-[#882f2f]" />
                  Mark as Lost
                </h3>
                <p className="text-xs text-muted-foreground mt-1 mb-3">
                  Customer rejected or went with competitor. A short reason is required so we can learn from it.
                </p>
                <form action={lostAction} className="grid gap-3">
                  <input type="hidden" name="rfqId" value={record.id} />
                  <div className="grid gap-2">
                    <Label htmlFor="lostReason">Reason for loss</Label>
                    <Textarea
                      id="lostReason"
                      name="lostReason"
                      rows={3}
                      minLength={3}
                      maxLength={500}
                      placeholder="e.g. Price too high; customer went with competitor; project cancelled"
                      required
                    />
                  </div>
                  <div>
                    <Button type="submit" variant="destructive" disabled={lostPending}>
                      {lostPending ? <><Loader2 className="size-4 animate-spin" />Saving...</> : <>Mark Lost</>}
                    </Button>
                  </div>
                </form>
                <FormMessage state={lostState} />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
