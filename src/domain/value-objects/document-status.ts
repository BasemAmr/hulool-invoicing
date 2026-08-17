import { INVOICE_STATUSES } from "../constants";
import { InvalidTransitionError } from "../errors";

export type DocumentStatus = (typeof INVOICE_STATUSES)[number];

export function isDocumentStatus(v: unknown): v is DocumentStatus {
  return (
    typeof v === "string" &&
    (INVOICE_STATUSES as readonly string[]).includes(v)
  );
}

/**
 * Legal transitions: only `draft → issued` and `draft → cancelled`.
 * Once issued or cancelled, the document is terminal.
 */
export function canTransitionTo(from: DocumentStatus, to: DocumentStatus): boolean {
  if (from === "draft") {
    return to === "issued" || to === "cancelled";
  }
  return false;
}

export function assertCanTransitionTo(
  from: DocumentStatus,
  to: DocumentStatus,
): void {
  if (!canTransitionTo(from, to)) {
    throw new InvalidTransitionError(
      `Illegal document transition: ${from} → ${to}`,
    );
  }
}
