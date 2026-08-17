"use client";

import { useActionState } from "react";

import { issueInvoiceAction } from "@/app/actions/invoices";
import { idleState, type ActionState } from "@/app/actions/types";
import { Button } from "@/components/ui/button";

/**
 * Issues a draft invoice. Confirm-style single-purpose button;
 * disabled while pending to guard double-submit.
 */
export function IssueInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const [state, formAction, pending]: [ActionState, (fd: FormData) => void, boolean] =
    useActionState(issueInvoiceAction, idleState);

  return (
    <form action={formAction} className="flex items-center gap-3">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <Button type="submit" disabled={pending}>
        {pending ? "جارٍ الإصدار..." : "إصدار الفاتورة"}
      </Button>
      {state.status === "error" && (
        <p aria-live="polite" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
    </form>
  );
}
