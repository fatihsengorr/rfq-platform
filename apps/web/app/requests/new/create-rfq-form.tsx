"use client";

import { useActionState, useEffect } from "react";
import { IDLE_RESULT } from "../../../lib/action-result";
import { createRfqAction } from "./actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormMessage } from "@/components/ui/form-message";
import { FileDropZone } from "@/components/ui/file-drop-zone";
import { ArrowLeft, Plus, Loader2 } from "lucide-react";
import Link from "next/link";

type CreateRfqFormProps = {
  requestedBy: string;
};

export function CreateRfqForm({ requestedBy }: CreateRfqFormProps) {
  const [state, formAction, pending] = useActionState(createRfqAction, IDLE_RESULT);

  useEffect(() => {
    if (state.status === "success" && state.redirectTo) {
      window.location.href = state.redirectTo;
    }
  }, [state]);

  return (
    <Card className="mt-4">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Request Details</CardTitle>
        <Badge variant="outline">Visible to London users and admin</Badge>
      </CardHeader>
      <CardContent>
        <FormMessage state={state} />

        <form action={formAction} className="grid sm:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="projectName">Project Name</Label>
            <Input id="projectName" name="projectName" type="text" required minLength={2} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="requestedBy">Requested By</Label>
            <Input
              id="requestedBy"
              name="requestedBy"
              type="text"
              value={requestedBy}
              readOnly
              className="bg-muted"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="deadline">Deadline</Label>
            <Input id="deadline" name="deadline" type="datetime-local" required />
          </div>
          <div className="sm:col-span-2 grid gap-2">
            <Label htmlFor="projectDetails">Project Details</Label>
            <Textarea
              id="projectDetails"
              name="projectDetails"
              required
              minLength={10}
              rows={4}
              placeholder="Describe the project requirements..."
            />
          </div>
          <div className="sm:col-span-2 grid gap-2">
            <Label>Request Files (Optional)</Label>
            <FileDropZone name="requestFiles" />
          </div>
          <div className="sm:col-span-2 flex items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Creating & uploading...
                </>
              ) : (
                <>
                  <Plus className="size-4" />
                  Create RFQ
                </>
              )}
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/requests">
                <ArrowLeft className="size-4" />
                Back to Requests
              </Link>
            </Button>
          </div>

          {/* Overlay during submission */}
          {pending && (
            <div className="sm:col-span-2 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <Loader2 className="size-5 animate-spin text-primary shrink-0" />
              <div>
                <p className="text-sm font-semibold text-primary">Creating RFQ and uploading files...</p>
                <p className="text-xs text-muted-foreground mt-0.5">Please wait, this may take a moment for large files.</p>
              </div>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
