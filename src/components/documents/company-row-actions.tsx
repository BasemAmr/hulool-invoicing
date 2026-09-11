"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { deleteCompanyAction } from "@/app/actions/companies";

interface CompanyRowActionsProps {
  company: {
    id: string;
    nameAr: string;
  };
}

export function CompanyRowActions({ company }: CompanyRowActionsProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className="flex items-center justify-end gap-1">
      <Link href={`/companies/${company.id}/edit`}>
        <Button variant="outline" size="xs" className="gap-1 text-xs">
          <Edit2 className="size-3" />
          <span>تعديل</span>
        </Button>
      </Link>

      <Button
        variant="ghost"
        size="xs"
        onClick={() => setDeleteOpen(true)}
        className="text-destructive hover:bg-destructive/10 hover:text-destructive text-xs gap-1"
      >
        <Trash2 className="size-3" />
        <span>حذف</span>
      </Button>

      <DeleteConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="تأكيد حذف المنشأة"
        description="هل أنت متأكد من رغبتك في حذف هذه المنشأة؟ لا يمكن التراجع عن هذا الإجراء."
        itemName={company.nameAr}
        onConfirm={() => deleteCompanyAction(company.id)}
      />
    </div>
  );
}
