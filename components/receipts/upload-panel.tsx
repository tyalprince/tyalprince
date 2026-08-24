"use client";

import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

export function UploadPanel({
  onFiles,
  busy,
}: {
  onFiles: (files: File[]) => void;
  busy: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function pick(files: FileList | null) {
    if (!files) return;
    const accepted = Array.from(files).filter((f) => ACCEPTED_TYPES.includes(f.type));
    if (accepted.length > 0) onFiles(accepted);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        pick(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors",
        dragOver
          ? "border-neutral-500 bg-neutral-50 dark:bg-neutral-900"
          : "border-neutral-300 dark:border-neutral-700",
        busy && "pointer-events-none opacity-60",
      )}
    >
      <UploadCloud className="h-8 w-8 text-neutral-400" />
      <p className="text-sm font-medium">
        {busy ? "Uploading..." : "Drop receipts here, or tap to choose files/photos"}
      </p>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        JPG, PNG, HEIC, or PDF — multiple files supported
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        multiple
        capture="environment"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
