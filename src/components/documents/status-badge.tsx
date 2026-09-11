import { cn } from "@/lib/utils";
import type { DocumentStatus } from "@/domain/value-objects/document-status";
import { STATUS_LABELS_AR } from "@/lib/format";

const STATUS_CONFIG: Record<
  DocumentStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  draft: {
    label: "مسودة",
    bg: "bg-slate-500/10 dark:bg-slate-400/10",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-500/30",
  },
  issued: {
    label: "صادرة",
    bg: "bg-emerald-500/15 dark:bg-emerald-400/15",
    text: "text-emerald-700 dark:text-emerald-300 font-semibold",
    border: "border-emerald-500/40",
  },
  cancelled: {
    label: "ملغاة",
    bg: "bg-destructive/15",
    text: "text-destructive font-medium",
    border: "border-destructive/30",
  },
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  const config = STATUS_CONFIG[status] || {
    label: STATUS_LABELS_AR[status] || status,
    bg: "bg-muted",
    text: "text-muted-foreground",
    border: "border-border",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center border px-2.5 py-0.5 text-xs font-medium",
        config.bg,
        config.text,
        config.border
      )}
    >
      {config.label}
    </span>
  );
}
