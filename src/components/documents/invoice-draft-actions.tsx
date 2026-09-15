"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { deleteDraftInvoiceAction } from "@/app/actions/invoices";

interface InvoiceDraftActionsProps {
  invoice: {
    id: string;
    invoiceNumber: string | null;
    status: string;
  };
  companyId?: string;
  redirectAfterDelete?: boolean;
}

export function InvoiceDraftActions({
  invoice,
  companyId,
  redirectAfterDelete = false,
}: InvoiceDraftActionsProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Business rule (2026-09): every invoice is published and fully
  // editable/deletable. Component name kept for merge compatibility.
  // Cancelled invoices stay read-only.
  if (invoice.status === "cancelled") {
    return null;
  }

  const editHref = companyId
    ? `/c/${companyId}/invoices/${invoice.id}/edit`
    : `/invoices/${invoice.id}/edit`;

  return (
    <>
      <div className="flex items-center gap-1">
        <Link href={editHref}>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Edit2 className="size-3.5" />
            <span>تعديل الفاتورة</span>
          </Button>
        </Link>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setDeleteOpen(true)}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive text-xs gap-1.5 border-destructive/30"
        >
          <Trash2 className="size-3.5" />
          <span>حذف الفاتورة</span>
        </Button>
      </div>

      <DeleteConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="تأكيد حذف الفاتورة"
        description="هل أنت متأكد من رغبتك في حذف هذه الفاتورة؟ سيتم حذف سند القبض المرتبط بها أيضاً. لا يمكن التراجع عن هذا الإجراء."
        itemName={invoice.invoiceNumber ?? `فاتورة #${invoice.id.slice(0, 8)}`}
        onConfirm={() => deleteDraftInvoiceAction(invoice.id, companyId)}
        onSuccess={() => {
          if (redirectAfterDelete) {
            router.push(companyId ? `/c/${companyId}/invoices` : "/invoices");
          } else {
            router.refresh();
          }
        }}
      />
    </>
  );
}
