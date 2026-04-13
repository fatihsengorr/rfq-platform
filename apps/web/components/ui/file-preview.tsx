"use client";

import { useState } from "react";
import { FileText, Image as ImageIcon, Cuboid, X, Eye, Download } from "lucide-react";

function isImage(mimeType: string) {
  return mimeType.startsWith("image/");
}

function isPdf(mimeType: string) {
  return mimeType === "application/pdf";
}

function isCad(fileName: string) {
  return /\.(dwg|dxf|step|stp|igs|iges)$/i.test(fileName);
}

function FileIcon({ fileName, mimeType, className }: { fileName: string; mimeType: string; className?: string }) {
  if (isImage(mimeType)) return <ImageIcon className={className} />;
  if (isCad(fileName)) return <Cuboid className={className} />;
  return <FileText className={className} />;
}

function formatFileSize(mimeType: string) {
  if (isImage(mimeType)) return "Image";
  if (isPdf(mimeType)) return "PDF";
  if (mimeType.includes("dwg") || mimeType.includes("dxf")) return "CAD";
  return mimeType.split("/").pop()?.toUpperCase() ?? "File";
}

type FilePreviewProps = {
  attachment: {
    id: string;
    fileName: string;
    mimeType: string;
    uploadedBy: string;
  };
  versionLabel?: string;
};

export function FilePreviewItem({ attachment, versionLabel }: FilePreviewProps) {
  const [showPreview, setShowPreview] = useState(false);
  const downloadUrl = `/attachments/${attachment.id}`;
  const canPreview = isImage(attachment.mimeType) || isPdf(attachment.mimeType);

  return (
    <>
      <div className="group flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/40">
        {/* Thumbnail / Icon */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted">
          {isImage(attachment.mimeType) ? (
            <img
              src={downloadUrl}
              alt={attachment.fileName}
              className="h-12 w-12 rounded-lg object-cover"
            />
          ) : (
            <FileIcon fileName={attachment.fileName} mimeType={attachment.mimeType} className="size-5 text-muted-foreground" />
          )}
        </div>

        {/* File info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{versionLabel ? `${versionLabel} · ` : ""}{attachment.fileName}</p>
          <p className="text-xs text-muted-foreground">{formatFileSize(attachment.mimeType)} · {attachment.uploadedBy}</p>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {canPreview && (
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
              title="Preview"
            >
              <Eye className="size-4" />
            </button>
          )}
          <a
            href={downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
            title="Download"
          >
            <Download className="size-4" />
          </a>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="relative w-full max-w-4xl max-h-[90vh] rounded-xl bg-white shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <FileIcon fileName={attachment.fileName} mimeType={attachment.mimeType} className="size-4 text-muted-foreground shrink-0" />
                <span className="truncate text-sm font-semibold">{attachment.fileName}</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted transition-colors"
                  title="Download"
                >
                  <Download className="size-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setShowPreview(false)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex items-center justify-center overflow-auto" style={{ maxHeight: "calc(90vh - 56px)" }}>
              {isImage(attachment.mimeType) ? (
                    <img
                  src={downloadUrl}
                  alt={attachment.fileName}
                  className="max-w-full max-h-[80vh] object-contain"
                />
              ) : isPdf(attachment.mimeType) ? (
                <iframe
                  src={downloadUrl}
                  title={attachment.fileName}
                  className="w-full"
                  style={{ height: "calc(90vh - 56px)" }}
                />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
