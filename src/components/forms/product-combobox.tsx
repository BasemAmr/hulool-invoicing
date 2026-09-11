"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Package, Search, Plus, Check } from "lucide-react";
import { formatMoney } from "@/lib/format";
import type { SavedProductRecord } from "@/application/ports/saved-product-repository";

export interface ProductComboboxProps {
  value: string;
  onChange: (description: string) => void;
  onSelectProduct: (product: SavedProductRecord) => void;
  products: SavedProductRecord[];
  saveToProducts?: boolean;
  onToggleSaveToProducts?: (save: boolean) => void;
  isSavedProduct?: boolean;
}

function normalizeArabic(text: string): string {
  if (!text) return "";
  return text
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[\u064B-\u065F]/g, "") // remove tashkeel
    .toLowerCase()
    .trim();
}

export function ProductCombobox({
  value,
  onChange,
  onSelectProduct,
  products = [],
  saveToProducts,
  onToggleSaveToProducts,
  isSavedProduct,
}: ProductComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredProducts = useMemo(() => {
    if (!products || products.length === 0) return [];
    if (!value || !value.trim()) return products;

    const query = normalizeArabic(value);
    return products.filter((p) => {
      const nameAr = normalizeArabic(p.nameAr);
      const nameEn = p.nameEn ? p.nameEn.toLowerCase() : "";
      const desc = p.description ? normalizeArabic(p.description) : "";

      return (
        nameAr.includes(query) ||
        nameEn.includes(query) ||
        desc.includes(query)
      );
    });
  }, [products, value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setIsOpen(true);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredProducts.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredProducts.length - 1
      );
    } else if (e.key === "Enter" && highlightedIndex >= 0) {
      e.preventDefault();
      const chosen = filteredProducts[highlightedIndex];
      if (chosen) {
        onSelectProduct(chosen);
        setIsOpen(false);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => {
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="اكتب اسم أو وصف الصنف..."
          className="w-full text-xs h-7 px-2 bg-background border border-input text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          required
        />
        {isSavedProduct ? (
          <span
            className="absolute left-2 text-[9px] px-1 py-0.2 bg-primary/10 text-primary font-medium pointer-events-none"
            title="منتج مسجل في الدليل"
          >
            مسجل
          </span>
        ) : null}
      </div>

      {/* Dropdown Suggestions Menu */}
      {isOpen && (
        <div className="absolute top-8 right-0 left-0 bg-popover border border-border shadow-lg z-50 max-h-56 overflow-y-auto flex flex-col p-1 text-xs">
          {filteredProducts.length > 0 ? (
            filteredProducts.slice(0, 10).map((product, idx) => {
              const priceSar = product.unitPrice
                ? (product.unitPrice / 100).toFixed(2)
                : "0.00";
              const isSelected =
                value.trim().toLowerCase() === product.nameAr.toLowerCase();
              const isHighlighted = idx === highlightedIndex;

              return (
                <button
                  key={product.id}
                  type="button"
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onClick={() => {
                    onSelectProduct(product);
                    setIsOpen(false);
                  }}
                  className={`flex items-center justify-between p-1.5 hover:bg-muted text-start text-foreground transition-colors cursor-pointer ${
                    isHighlighted || isSelected
                      ? "bg-primary/10 font-semibold text-primary"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Package className="size-3 text-muted-foreground shrink-0" />
                    <span className="truncate">{product.nameAr}</span>
                    {product.nameEn ? (
                      <span className="text-[10px] text-muted-foreground font-mono truncate">
                        ({product.nameEn})
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-muted-foreground text-[11px]">
                      {formatMoney(priceSar)} SAR
                    </span>
                    <span className="text-[10px] px-1 py-0.5 bg-muted text-muted-foreground">
                      {(product.vatRate * 100).toFixed(0)}%
                    </span>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="p-2 text-center text-muted-foreground text-[11px]">
              {products.length === 0
                ? "لا توجد منتجات مسجلة في الدليل حتى الآن"
                : "لا يوجد منتج مطابق للبحث"}
            </div>
          )}

          {/* Quick Option to Save new description to Catalog */}
          {!isSavedProduct && value.trim().length > 0 && onToggleSaveToProducts && (
            <div className="border-t border-border pt-1 mt-1 px-1.5 py-1 flex items-center justify-between bg-muted/30">
              <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-foreground">
                <input
                  type="checkbox"
                  checked={saveToProducts}
                  onChange={(e) => onToggleSaveToProducts(e.target.checked)}
                  className="size-3"
                />
                <span>حفظ &ldquo;{value}&rdquo; كمنتج دائم في الدليل</span>
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
