"use client";

import React, { useState, useMemo } from "react";
import { Plus, Package, Search, Edit2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProductDrawer } from "@/components/drawers/product-drawer";
import { DeleteConfirmDialog } from "@/components/documents/delete-confirm-dialog";
import { deleteSavedProductAction } from "@/app/actions/products";
import { formatMoney } from "@/lib/format";
import type { SavedProductRecord } from "@/application/ports/saved-product-repository";

export function ProductsTableClient({
  products: initialProducts,
}: {
  products: SavedProductRecord[];
}) {
  const [products, setProducts] = useState<SavedProductRecord[]>(initialProducts);
  const [searchTerm, setSearchTerm] = useState("");

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SavedProductRecord | null>(null);

  // Delete state
  const [deletingProduct, setDeletingProduct] = useState<SavedProductRecord | null>(null);

  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return products;
    const query = searchTerm.trim().toLowerCase();
    return products.filter((p) => {
      return (
        (p.nameAr ?? "").toLowerCase().includes(query) ||
        (p.nameEn ?? "").toLowerCase().includes(query) ||
        (p.description ?? "").toLowerCase().includes(query)
      );
    });
  }, [products, searchTerm]);

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setDrawerOpen(true);
  };

  const handleOpenEdit = (p: SavedProductRecord) => {
    setEditingProduct(p);
    setDrawerOpen(true);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            المنتجات والخدمات
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            دليل البنود والخدمات المحفوظة للتعبئة السريعة في الفواتير
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleOpenCreate}
          className="gap-1.5 font-semibold text-xs bg-primary text-primary-foreground shadow-xs"
        >
          <Plus className="size-3.5" />
          <span>إضافة بند / منتج</span>
        </Button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-2 max-w-md">
        <div className="relative flex-1">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث باسم البند أو الوصف..."
            className="pl-8 text-xs h-8.5 bg-card"
          />
          <Search className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground pointer-events-none" />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              aria-label="مسح البحث"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Data Table */}
      {filteredProducts.length === 0 ? (
        <div className="border border-border bg-card p-8 text-center flex flex-col items-center justify-center gap-2 shadow-2xs">
          <Package className="size-7 text-muted-foreground" />
          <p className="font-semibold text-xs text-foreground">
            {searchTerm ? "لا توجد نتائج مطابقة للبحث" : "لا توجد منتجات أو خدمات مسجلة بعد"}
          </p>
          <Button
            size="sm"
            onClick={handleOpenCreate}
            className="text-xs mt-1"
          >
            + إضافة بند جديد
          </Button>
        </div>
      ) : (
        <div className="border border-border bg-card shadow-2xs">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="text-start">اسم البند / الخدمة</TableHead>
                <TableHead className="text-start">الوصف الافتراضي</TableHead>
                <TableHead className="w-28 text-end">السعر الافتراضي</TableHead>
                <TableHead className="w-24 text-center">الضريبة</TableHead>
                <TableHead className="w-32 text-end">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id} className="text-xs">
                  <TableCell className="font-medium text-foreground py-2.5">
                    {product.nameAr}
                    {product.nameEn && (
                      <span className="block text-[11px] font-mono text-muted-foreground" dir="ltr">
                        {product.nameEn}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs py-2.5 max-w-xs truncate">
                    {product.description || "—"}
                  </TableCell>
                  <TableCell className="text-end tabular-nums font-mono py-2.5">
                    {product.unitPrice !== null
                      ? `${formatMoney((product.unitPrice / 100).toFixed(2))} SAR`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-center tabular-nums font-mono py-2.5">
                    {(product.vatRate * 100).toFixed(0)}%
                  </TableCell>
                  <TableCell className="text-end py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleOpenEdit(product)}
                        className="gap-1 text-xs text-foreground hover:bg-muted"
                      >
                        <Edit2 className="size-3" />
                        <span>تعديل</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setDeletingProduct(product)}
                        className="text-destructive hover:bg-destructive/10 text-xs p-1"
                        title="حذف البند"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Product Drawer (Create & Edit) */}
      <ProductDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setEditingProduct(null);
        }}
        product={editingProduct}
        onSaved={() => {
          // Revalidated
        }}
      />

      {/* Delete Dialog */}
      <DeleteConfirmDialog
        open={Boolean(deletingProduct)}
        onClose={() => setDeletingProduct(null)}
        title="تأكيد حذف البند / الخدمة"
        description="هل أنت متأكد من رغبتك في حذف هذا البند من الدليل العام؟"
        itemName={deletingProduct?.nameAr}
        onConfirm={async () => {
          if (!deletingProduct) return { status: "error", message: "معرف البند مفقود" };
          const res = await deleteSavedProductAction(deletingProduct.id);
          if (res.status === "ok") {
            setProducts((prev) => prev.filter((p) => p.id !== deletingProduct.id));
            return { status: "success" };
          }
          return { status: "error", message: res.status === "error" ? res.message : "فشل الحذف" };
        }}
      />
    </div>
  );
}
