"use client";

/**
 * Faz 3 — Feature 3: Follow-up section for the Action Center "Follow-up" tab.
 *
 * Shows:
 *  - Current stall status (days since last activity + urgency badge)
 *  - A "Log follow-up" form (optional note)
 *  - History of prior follow-ups, newest first
 *
 * History is passed in as `initialActivities` (server-side preloaded) and the
 * form action triggers a revalidate so fresh data comes back on the next
 * render.
 */

import { useActionState } from "react";
import type { FollowUpActivityRecord, RfqRecord } from "@crm/shared";
import { computeStallLevel } from "@crm/shared";
import { IDLE_RESULT } from "../../../../lib/action-result";
import { logFollowUpAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormMessage } from "@/components/ui/form-message";
import { Loader2, MessageSquareText, Phone } from "lucide-react";
import { formatDateTime } from "@/lib/format";

type Props = {
  record: RfqRecord;
  initialActivities: FollowUpActivityRecord[];
};

export function FollowUpSection({ record, initialActivities }: Props) {
  const [state, action, pending] = useActionState(logFollowUpAction, IDLE_RESULT);
  const { level, daysSilent } = computeStallLevel(record.status, record.lastCustomerActivityAt);

  return (
    <div className="space-y-4">
      {/* Current stall status */}
      <div className={`rounded-lg border p-3 text-sm ${stallBannerClasses(level)}`}>
        <div className="flex items-start gap-2">
          <Phone className="size-4 mt-0.5 shrink-0" />
          <div className="min-w-0">
            {record.status !== "QUOTED" ? (
              <>
                <p className="font-semibold">Follow-up tracking starts after approval</p>
                <p className="text-xs opacity-80 mt-0.5">
                  Once the quote is approved and sent to the customer, silence will be tracked here.
                </p>
              </>
            ) : daysSilent === null ? (
              <p className="font-semibold">No activity recorded yet.</p>
            ) : level === "stale" ? (
              <>
                <p className="font-semibold">🕸️ {daysSilent} days silent — this quote has gone cold</p>
                <p className="text-xs opacity-80 mt-0.5">
                  Time to make a decision: chase the customer or mark as Lost.
                </p>
              </>
            ) : level === "warning" ? (
              <>
                <p className="font-semibold">⏱️ {daysSilent} days since last activity</p>
                <p className="text-xs opacity-80 mt-0.5">
                  Managers have been reminded. Follow up with the customer to reset the timer.
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold">
                  Active — last activity {daysSilent === 0 ? "today" : `${daysSilent} days ago`}
                </p>
                <p className="text-xs opacity-80 mt-0.5">
                  We&apos;ll alert managers if this goes silent for 10 days.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Log follow-up form */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <MessageSquareText className="size-4" /> Log a follow-up
        </h3>
        <form action={action} className="grid gap-3">
          <input type="hidden" name="rfqId" value={record.id} />
          <div className="grid gap-2">
            <Label htmlFor="follow-up-note">Note (optional)</Label>
            <Textarea
              id="follow-up-note"
              name="note"
              rows={2}
              maxLength={500}
              placeholder="e.g. Called Ahmet — he's waiting on budget approval, will revert by Friday"
            />
          </div>
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Log follow-up"
              )}
            </Button>
          </div>
        </form>
        <FormMessage state={state} />
      </div>

      {/* Activity history */}
      <div>
        <h3 className="text-sm font-semibold mb-2">History</h3>
        {initialActivities.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No follow-ups logged yet.</p>
        ) : (
          <div className="space-y-2">
            {initialActivities.map((a) => (
              <div key={a.id} className="rounded-md border border-border bg-card p-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-sm font-semibold">{a.performedBy}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(a.performedAt)}</p>
                </div>
                {a.note && <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">{a.note}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function stallBannerClasses(level: "fresh" | "warning" | "stale"): string {
  if (level === "stale") return "bg-[#fdeaea] border-[#ebb2b2] text-[#882f2f]";
  if (level === "warning") return "bg-[#fff1d7] border-[#ebcc8f] text-[#855615]";
  return "bg-[#e7f7ed] border-[#98d4af] text-[#2d6a1e]";
}
