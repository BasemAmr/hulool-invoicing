import { cn } from "@/lib/utils";
import type { DocumentStatus } from "@/domain/value-objects/document-status";
import { STATUS_LABELS_AR } from "@/lib/format";

const STATUS_STYLES: Record<DocumentStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  issued: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  cancelled: "bg-destructive/10 text-destructive",
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        STATUS_STYLES[status],
      )}
    >
      {STATUS_LABELS_AR[status]}
    </span>
  );
}
