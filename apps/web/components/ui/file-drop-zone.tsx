"use client";

import { useState, useRef, type ChangeEvent, type DragEvent } from "react";
import { Upload, X, FileText, Image as ImageIcon, Cuboid } from "lucide-react";

function fileIcon(fileName: string, mimeType: string) {
  if (mimeType.startsWith("image/")) return <ImageIcon className="size-4 text-blue-500" />;
  if (/\.(dwg|dxf|step|stp|igs|iges)$/i.test(fileName)) return <Cuboid className="size-4 text-purple-500" />;
  return <FileText className="size-4 text-orange-500" />;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type FileDropZoneProps = {
  name: string;
  required?: boolean;
  multiple?: boolean;
};

export function FileDropZone({ name, required, multiple = true }: FileDropZoneProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    const arr = Array.from(newFiles);
    setFiles((prev) => multiple ? [...prev, ...arr] : arr);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    handleFiles(e.target.files);
    // Reset input so re-selecting the same file works
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div>
      {/* Drop zone */}
      <label
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-6 text-center transition-colors cursor-pointer ${
          dragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/30 bg-muted/30 hover:border-primary/50 hover:bg-muted/50"
        }`}
      >
        <Upload className={`size-6 ${dragging ? "text-primary" : "text-muted-foreground/60"}`} />
        <span className="text-sm">
          <span className="font-medium text-foreground">Click to upload</span>{" "}
          <span className="text-muted-foreground">or drag and drop</span>
        </span>
        <p className="text-xs text-muted-foreground">PDF, images, CAD — max 10 files, 50 MB each</p>
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.svg,.dwg,.dxf,.step,.stp,.igs,.iges,application/pdf,image/*"
          onChange={handleChange}
          className="sr-only"
        />
      </label>

      {/* Hidden inputs for form submission */}
      {files.length > 0 && (
        <input
          type="file"
          name={name}
          multiple={multiple}
          required={required}
          className="sr-only"
          // This won't work for setting files programmatically, so we use a DataTransfer trick
          ref={(el) => {
            if (!el) return;
            const dt = new DataTransfer();
            files.forEach((f) => dt.items.add(f));
            el.files = dt.files;
          }}
        />
      )}

      {/* Empty hidden input if required and no files yet */}
      {files.length === 0 && required && (
        <input type="file" name={name} required className="sr-only" />
      )}
      {files.length === 0 && !required && (
        <input type="file" name={name} className="sr-only" />
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">
            {files.length} file{files.length > 1 ? "s" : ""} selected — {formatSize(files.reduce((sum, f) => sum + f.size, 0))} total
          </p>
          <ul className="space-y-1.5">
            {files.map((file, i) => (
              <li key={`${file.name}-${i}`} className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
                {fileIcon(file.name, file.type)}
                <span className="truncate flex-1 font-medium">{file.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatSize(file.size)}</span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
