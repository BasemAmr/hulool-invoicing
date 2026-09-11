"use client";

import React, { useState } from "react";
import { Share2, Printer } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ShareInvoiceModal } from "@/components/documents/share-invoice-modal";

export function InvoiceDetailClientActions({
  invoice,
  companyId,
}: {
  invoice: {
    id: string;
    invoiceNumber: string | null;
    total: string;
    customerName: string;
    customerPhone?: string | null;
    customerEmail?: string | null;
  };
  companyId?: string;
}) {
  const [shareOpen, setShareOpen] = useState(false);
  const previewPath = companyId
    ? `/c/${companyId}/invoices/${invoice.id}/preview`
    : `/invoices/${invoice.id}/preview`;

  return (
    <>
      <div className="flex items-center gap-2">
        <Link href={previewPath} target="_blank">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Printer className="size-3.5" />
            <span>طباعة / معاينة</span>
          </Button>
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShareOpen(true)}
          className="gap-1.5 text-xs"
        >
          <Share2 className="size-3.5" />
          <span>مشاركة الرابط</span>
        </Button>
      </div>

      <ShareInvoiceModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        invoice={invoice}
      />
    </>
  );
}