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
import { ArrowLeft, Plus, Upload, Loader2 } from "lucide-react";
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
            <Label htmlFor="requestFiles">Request Files (Optional)</Label>
            <label
              htmlFor="requestFiles"
              className="relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/30 px-6 py-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/50 cursor-pointer"
            >
              <Upload className="size-8 text-muted-foreground/60" />
              <div>
                <span className="font-medium text-sm text-foreground">Click to upload files</span>
                <span className="text-sm text-muted-foreground"> or drag and drop</span>
              </div>
              <p className="text-xs text-muted-foreground">
                PDF, images, CAD files — max 10 files, 50 MB each
              </p>
              <input
                id="requestFiles"
                name="requestFiles"
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.svg,.dwg,.dxf,.step,.stp,.igs,.iges,application/pdf,image/*"
                className="sr-only"
              />
            </label>
          </div>
          <div className="sm:col-span-2 flex items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Create RFQ
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/requests">
                <ArrowLeft className="size-4" />
                Back to Requests
              </Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
