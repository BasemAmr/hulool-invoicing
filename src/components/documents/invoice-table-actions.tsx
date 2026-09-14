"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Eye, Edit2, Trash2 } from "lucide-react";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { deleteDraftInvoiceAction } from "@/app/actions/invoices";
import { PdfActionButtons } from "./pdf-action-buttons";

interface InvoiceTableActionsProps {
  invoice: {
    id: string;
    invoiceNumber: string | null;
    status: string;
    companyId?: string;
  };
  companyId?: string;
}

export function InvoiceTableActions({ invoice, companyId }: InvoiceTableActionsProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
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

      {/* 2. Draft Actions: Edit & Delete (Icons Only) */}
      {invoice.status === "draft" && (
        <>
          <Link
            href={`${basePath}/${invoice.id}/edit`}
            className="p-1 text-muted-foreground hover:text-primary hover:bg-muted transition-colors rounded-sm"
            title="تعديل مسودة الفاتورة"
          >
            <Edit2 className="size-3.5" />
          </Link>

          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors rounded-sm"
            title="حذف مسودة الفاتورة"
          >
            <Trash2 className="size-3.5" />
          </button>

          <DeleteConfirmDialog
            open={deleteOpen}
            onClose={() => setDeleteOpen(false)}
            title="تأكيد حذف مسودة الفاتورة"
            description="هل أنت متأكد من رغبتك في حذف مسودة الفاتورة؟"
            itemName={invoice.invoiceNumber ?? `مسودة #${invoice.id.slice(0, 8)}`}
            onConfirm={() => deleteDraftInvoiceAction(invoice.id)}
          />
        </>
      )}

      {/* 3. Issued Actions: Direct Download Icon & Shareable Signed Link Icon (Icons Only) */}
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
