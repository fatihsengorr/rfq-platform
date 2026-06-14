"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  PROJECT_STAGES,
  PROJECT_STAGE_LABELS,
  LOSS_REASONS,
  LOSS_REASON_LABELS,
  type ProjectStage,
  type LossReason,
} from "@crm/shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { moveStageAction } from "./actions";
import { ArrowRightLeft, Loader2 } from "lucide-react";

type Props = {
  projectId: string;
  currentStage: ProjectStage;
  /** Render as a compact button (board card) or a normal one (detail page). */
  compact?: boolean;
};

export function MoveStageDialog({ projectId, currentStage, compact }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<ProjectStage | null>(null);
  const [lossCode, setLossCode] = useState<LossReason>("PRICE");
  const [lossNote, setLossNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(stage: ProjectStage) {
    setError(null);
    startTransition(async () => {
      const result = await moveStageAction({
        projectId,
        stage,
        lostReasonCode: stage === "LOST" ? lossCode : undefined,
        lostReason: stage === "LOST" && lossNote.trim() ? lossNote.trim() : undefined,
      });
      if (result.status === "error") {
        setError(result.message ?? "Could not move stage.");
        return;
      }
      setOpen(false);
      setTarget(null);
      setLossNote("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {compact ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowRightLeft className="size-3" /> Move
          </button>
        ) : (
          <Button variant="outline" size="sm">
            <ArrowRightLeft className="size-4" /> Move stage
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move project stage</DialogTitle>
        </DialogHeader>

        {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}

        <div className="grid grid-cols-2 gap-2">
          {PROJECT_STAGES.map((stage) => {
            const isCurrent = stage === currentStage;
            const isSelected = target === stage;
            return (
              <button
                key={stage}
                type="button"
                disabled={isCurrent || pending}
                onClick={() => {
                  if (stage === "LOST") {
                    setTarget("LOST");
                  } else {
                    submit(stage);
                  }
                }}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  isSelected ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40"
                }`}
              >
                {PROJECT_STAGE_LABELS[stage]}
                {isCurrent && <span className="ml-1 text-xs text-muted-foreground">(current)</span>}
              </button>
            );
          })}
        </div>

        {target === "LOST" && (
          <div className="space-y-3 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3">
            <div className="grid gap-1.5">
              <Label htmlFor="lossCode">Loss reason (required)</Label>
              <select
                id="lossCode"
                value={lossCode}
                onChange={(e) => setLossCode(e.target.value as LossReason)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {LOSS_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {LOSS_REASON_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="lossNote">Details (optional)</Label>
              <Textarea
                id="lossNote"
                rows={2}
                value={lossNote}
                onChange={(e) => setLossNote(e.target.value)}
                placeholder="e.g. Lost to competitor on price by ~8%"
              />
            </div>
            <Button variant="destructive" size="sm" disabled={pending} onClick={() => submit("LOST")}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Mark as lost
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
