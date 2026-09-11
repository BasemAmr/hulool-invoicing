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
  redirectAfterDelete?: boolean;
}

export function InvoiceDraftActions({
  invoice,
  redirectAfterDelete = false,
}: InvoiceDraftActionsProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Only draft invoices can be edited or deleted
  if (invoice.status !== "draft") {
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <Link href={`/invoices/${invoice.id}/edit`}>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Edit2 className="size-3.5" />
            <span>تعديل المسودة</span>
          </Button>
        </Link>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setDeleteOpen(true)}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive text-xs gap-1.5 border-destructive/30"
        >
          <Trash2 className="size-3.5" />
          <span>حذف المسودة</span>
        </Button>
      </div>

      <DeleteConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="تأكيد حذف مسودة الفاتورة"
        description="هل أنت متأكد من رغبتك في حذف مسودة الفاتورة هذه؟ لا يمكن التراجع عن هذا الإجراء."
        itemName={invoice.invoiceNumber ?? `مسودة #${invoice.id.slice(0, 8)}`}
        onConfirm={() => deleteDraftInvoiceAction(invoice.id)}
        onSuccess={() => {
          if (redirectAfterDelete) {
            router.push("/invoices");
          }
        }}
      />
    </>
  );
}
