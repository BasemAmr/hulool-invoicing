"use client";

import { useState, useEffect } from "react";
import { UploadCloud, X, CheckCircle2, Loader2 } from "lucide-react";

import { uploadFileAction } from "@/app/actions/files";
import { useToast } from "@/components/ui/toaster";

export function ImageUploadInput({
  label,
  name,
  hint,
  initialFileId,
  value,
  onFileChange,
}: {
  label: string;
  name: string;
  hint?: string;
  initialFileId?: string | null;
  value?: string | null;
  onFileChange?: (fileId: string | null) => void;
}) {
  const { error } = useToast();
  const effectiveFileId = value !== undefined ? value : initialFileId ?? null;
  const [fileId, setFileId] = useState<string | null>(effectiveFileId);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    effectiveFileId ? `/api/files/${effectiveFileId}` : null,
  );
  const [isUploading, setIsUploading] = useState(false);

  // Sync if controlled value changes
  useEffect(() => {
    if (value !== undefined) {
      setFileId(value);
      setPreviewUrl(value ? `/api/files/${value}` : null);
    }
  }, [value]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setPreviewUrl(null);
    setFileId(null);
    onFileChange?.(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await uploadFileAction(formData);
      if (res.status === "success") {
        setFileId(res.fileId);
        setPreviewUrl(res.url);
        onFileChange?.(res.fileId);
      } else {
        error(res.message, "فشل الرفع");
      }
    } catch {
      error("حدث خطأ أثناء الرفع", "فشل الرفع");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  }

  function handleRemove() {
    setFileId(null);
    setPreviewUrl(null);
    onFileChange?.(null);
  }


  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        {label}
      </span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      
      <input type="hidden" name={name} value={fileId || ""} />

      {previewUrl ? (
        <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={label}
            className="h-full w-full object-contain"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label className="flex h-24 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-card px-4 py-2 transition-colors hover:bg-muted/50">
          <input
            type="file"
            accept="image/png, image/jpeg, image/webp, image/svg+xml"
            className="hidden"
            onChange={handleFileChange}
            disabled={isUploading}
          />
          {isUploading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">جارٍ الرفع...</span>
            </>
          ) : (
            <>
              <UploadCloud className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground text-center">
                اضغط لرفع صورة
              </span>
            </>
          )}
        </label>
      )}
    </div>
  );
}
