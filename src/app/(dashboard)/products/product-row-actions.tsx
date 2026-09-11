"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/documents/delete-confirm-dialog";
import { deleteSavedProductAction } from "@/app/actions/products";
import type { SavedProductRecord } from "@/application/ports/saved-product-repository";

export function ProductRowActions({ product }: { product: SavedProductRecord }) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className="flex items-center justify-end gap-1">
      <Link href={`/products/${product.id}/edit`}>
        <Button variant="ghost" size="xs" className="gap-1 text-xs">
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
        title="تأكيد حذف المنتج / الخدمة"
        description="هل أنت متأكد من رغبتك في حذف هذا البند من الدليل العام؟"
        itemName={product.nameAr}
        onConfirm={async () => {
          const res = await deleteSavedProductAction(product.id);
          if (res.status === "ok") {
            return { status: "success" };
          }
          return {
            status: "error",
            message: res.status === "error" ? res.message : "فشل الحذف",
          };
        }}

      />
    </div>
  );
}