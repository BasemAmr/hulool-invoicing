"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Eye, Edit2, Trash2, Copy } from "lucide-react";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { DuplicateInvoiceDialog } from "./duplicate-invoice-dialog";
import { deleteDraftInvoiceAction } from "@/app/actions/invoices";
import { PdfActionButtons } from "./pdf-action-buttons";

interface InvoiceTableActionsProps {
  invoice: {
    id: string;
    invoiceNumber: string | null;
    status: string;
    companyId?: string;
    customerId?: string;
    issueTime?: string | null;
  };
  companyId?: string;
}

export function InvoiceTableActions({ invoice, companyId }: InvoiceTableActionsProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const activeCompanyId = companyId ?? invoice.companyId;
  const basePath = activeCompanyId ? `/c/${activeCompanyId}/invoices` : "/invoices";

  const downloadUrl = `/api/documents/${invoice.id}/pdf?download=true`;
  const filename = `فاتورة ضريبية رقم ${invoice.invoiceNumber ?? invoice.id}.pdf`;

  return (
    <div className="inline-flex items-center justify-end gap-1">
      {/* 1. View Detail Link (Icon Only) */}
      <Link
        href={`${basePath}/${invoice.id}`}
        className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors rounded-sm"
        title="عرض ومعاينة الفاتورة"
      >
        <Eye className="size-3.5" />
      </Link>

      {/* 2. Edit (all statuses: every invoice is published, fully editable) */}
      <Link
        href={`${basePath}/${invoice.id}/edit`}
        className="p-1 text-muted-foreground hover:text-primary hover:bg-muted transition-colors rounded-sm"
        title="تعديل الفاتورة"
      >
        <Edit2 className="size-3.5" />
      </Link>

      {/* 3. Duplicate (dialog asks for client + date, then opens create page prefilled) */}
      <button
        type="button"
        onClick={() => setDuplicateOpen(true)}
        className="p-1 text-muted-foreground hover:text-primary hover:bg-muted transition-colors rounded-sm"
        title="تكرار الفاتورة"
      >
        <Copy className="size-3.5" />
      </button>

      {/* 4. Delete (all statuses) */}
      <button
        type="button"
        onClick={() => setDeleteOpen(true)}
        className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors rounded-sm"
        title="حذف الفاتورة"
      >
        <Trash2 className="size-3.5" />
      </button>

      <DeleteConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="تأكيد حذف الفاتورة"
        description="هل أنت متأكد من رغبتك في حذف هذه الفاتورة؟ سيتم حذف سند القبض المرتبط بها أيضاً."
        itemName={invoice.invoiceNumber ?? `فاتورة #${invoice.id.slice(0, 8)}`}
        onConfirm={() => deleteDraftInvoiceAction(invoice.id, activeCompanyId)}
      />

      <DuplicateInvoiceDialog
        open={duplicateOpen}
        onClose={() => setDuplicateOpen(false)}
        invoiceId={invoice.id}
        companyId={activeCompanyId}
        defaultCustomerId={invoice.customerId}
        defaultIssueTime={invoice.issueTime ?? undefined}
        itemName={invoice.invoiceNumber ?? undefined}
      />

      {/* 5. Issued Actions: Direct Download Icon & Shareable Signed Link Icon (Icons Only) */}
      {invoice.status === "issued" && (
        <PdfActionButtons
          documentId={invoice.id}
          type="invoice"
          downloadUrl={downloadUrl}
          filename={filename}
          itemTitle={invoice.invoiceNumber ? `فاتورة ${invoice.invoiceNumber}` : "الفاتورة"}
        />
      )}
    </div>
  );
}
