"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Attachment } from "@crm/shared";
import { uploadCrmFilePresigned } from "../../../lib/upload";
import { removeProjectFileAction } from "../actions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Trash2, Loader2, Download } from "lucide-react";

export function FilesSection({ projectId, files }: { projectId: string; files: Attachment[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of picked) {
        await uploadCrmFilePresigned("project", projectId, file);
      }
      router.refresh();
    } catch {
      setError("Upload failed. Check the file type and size (max 50 MB).");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function remove(attachmentId: string) {
    startTransition(async () => {
      const result = await removeProjectFileAction(projectId, attachmentId);
      if (result.status === "error") setError(result.message ?? "Could not remove file.");
      else router.refresh();
    });
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm">Files ({files.length})</h3>
        <Button variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          Upload
        </Button>
        <input ref={inputRef} type="file" multiple className="hidden" onChange={onPick} />
      </div>

      {error && <p className="text-xs font-semibold text-rose-600 mb-2">{error}</p>}

      {files.length === 0 ? (
        <p className="text-sm text-muted-foreground">No files yet — tender drawings, site photos, contracts.</p>
      ) : (
        <ul className="space-y-2">
          {files.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 text-sm">
              <a
                href={f.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 min-w-0 hover:text-primary"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{f.fileName}</span>
                <Download className="size-3 shrink-0 text-muted-foreground" />
              </a>
              <button
                type="button"
                disabled={pending}
                onClick={() => remove(f.id)}
                className="text-muted-foreground hover:text-rose-600 transition-colors shrink-0"
                aria-label="Remove file"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
