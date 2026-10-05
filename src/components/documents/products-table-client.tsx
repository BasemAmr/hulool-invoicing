"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Package, Search, Edit2, Trash2, X, Loader2 } from "lucide-react";
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
import {
  deleteSavedProductAction,
  listSavedProductsAction,
} from "@/app/actions/products";
import { formatMoney } from "@/lib/format";
import { halalas } from "@/domain/value-objects/money";
import type { SavedProductRecord } from "@/application/ports/saved-product-repository";

const PAGE_SIZE = 40;

export function ProductsTableClient({
  products: initialProducts,
}: {
  products: SavedProductRecord[];
}) {
  const [products, setProducts] = useState<SavedProductRecord[]>(initialProducts);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialProducts.length >= PAGE_SIZE);
  const [offset, setOffset] = useState(initialProducts.length);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SavedProductRecord | null>(null);

  // Delete state
  const [deletingProduct, setDeletingProduct] = useState<SavedProductRecord | null>(null);

  // Sentinel ref for infinite scroll
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const isInitialMount = useRef(true);

  // Server-side search with debounce
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const q = searchTerm.trim() || null;
        const results = await listSavedProductsAction(q, PAGE_SIZE, 0);
        setProducts(results);
        setOffset(results.length);
        setHasMore(results.length >= PAGE_SIZE);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Infinite scroll auto-fetch on scroll
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || isSearching) return;
    setIsLoadingMore(true);
    try {
      const q = searchTerm.trim() || null;
      const more = await listSavedProductsAction(q, PAGE_SIZE, offset);
      if (more.length === 0) {
        setHasMore(false);
      } else {
        setProducts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const filteredNew = more.filter((p) => !existingIds.has(p.id));
          return [...prev, ...filteredNew];
        });
        setOffset((prev) => prev + more.length);
        setHasMore(more.length >= PAGE_SIZE);
      }
    } catch (err) {
      console.error("Failed to load more products:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, isSearching, searchTerm, offset]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "250px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

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
          {isSearching ? (
            <Loader2 className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground animate-spin pointer-events-none" />
          ) : (
            <Search className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground pointer-events-none" />
          )}
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
      {products.length === 0 && !isSearching ? (
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
              {products.map((product) => (
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

      {/* Sentinel for infinite scroll auto-fetch */}
      <div ref={sentinelRef} className="py-2 flex items-center justify-center min-h-[32px]">
        {isLoadingMore && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            <span>جارٍ تحميل المزيد من المنتجات...</span>
          </div>
        )}
        {!hasMore && products.length > 0 && !isSearching && (
          <div className="text-[11px] text-muted-foreground py-1">
            تم عرض كافة النتائج ({products.length} بند)
          </div>
        )}
      </div>

      {/* Product Drawer (Create & Edit) */}
      <ProductDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setEditingProduct(null);
        }}
        product={editingProduct}
        onSaved={(savedItem) => {
          setProducts((prev) => {
            const index = prev.findIndex((p) => p.id === savedItem.id);
            const existing = prev[index];
            if (index >= 0 && existing) {
              const updated = [...prev];
              updated[index] = {
                ...existing,
                nameAr: savedItem.nameAr,
                unitPrice: savedItem.unitPrice !== null ? halalas(savedItem.unitPrice) : null,
                vatRate: savedItem.vatRate,
                description: savedItem.description,
              };
              return updated;
            } else {
              const newItem: SavedProductRecord = {
                id: savedItem.id,
                nameAr: savedItem.nameAr,
                nameEn: null,
                description: savedItem.description,
                unitPrice: savedItem.unitPrice !== null ? halalas(savedItem.unitPrice) : null,
                vatRate: savedItem.vatRate,
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              return [newItem, ...prev];
            }
          });
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
