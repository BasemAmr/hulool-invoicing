"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { deleteCustomerAction } from "@/app/actions/customers";

interface CustomerRowActionsProps {
  customer: {
    id: string;
    nameAr: string;
  };
}

export function CustomerRowActions({ customer }: CustomerRowActionsProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className="flex items-center justify-end gap-1">
      <Link href={`/customers/${customer.id}/edit`}>
        <Button variant="outline" size="xs" className="gap-1 text-xs">
          <Edit2 className="size-3" />
          <span>تعديل</span>
        </Button>
      </Link>

      <Button
        variant="ghost"
        size="xs"
        onClick={() => setDeleteOpen(false || true)}
        className="text-destructive hover:bg-destructive/10 hover:text-destructive text-xs gap-1"
      >
        <Trash2 className="size-3" />
        <span>حذف</span>
      </Button>

      <DeleteConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="تأكيد حذف العميل"
        description="هل أنت متأكد من رغبتك في حذف بيانات هذا العميل؟ لا يمكن التراجع عن هذا الإجراء."
        itemName={customer.nameAr}
        onConfirm={() => deleteCustomerAction(customer.id)}
      />
    </div>
  );
}
