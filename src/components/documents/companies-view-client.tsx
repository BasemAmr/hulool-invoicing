"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Plus,
  ArrowLeft,
  Search,
  X,
  Edit2,
  FilePlus,
  Settings,
  Copy,
  Check,
  Download,
  Pin,
  Building,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CompanyDrawer } from "@/components/drawers/company-drawer";
import { useToast } from "@/components/ui/toaster";
import type { CompanyRecord } from "@/application/ports/company-repository";

export function CompaniesViewClient({
  initialCompanies,
}: {
  initialCompanies: CompanyRecord[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [companies, setCompanies] = useState<CompanyRecord[]>(initialCompanies);
  const [search, setSearch] = useState("");
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [copiedVatId, setCopiedVatId] = useState<string | null>(null);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyRecord | null>(null);

  useEffect(() => {
    setCompanies(initialCompanies);
  }, [initialCompanies]);

  // Load pinned from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("hulool_pinned_companies");
      if (saved) setPinnedIds(JSON.parse(saved));
    } catch {
      // Ignore
    }
  }, []);

  // Keyboard shortcut: Press '/' to focus search, 'Esc' to clear
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "Escape" && document.activeElement === searchInputRef.current) {
        setSearch("");
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const togglePin = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPinnedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      try {
        localStorage.setItem("hulool_pinned_companies", JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });
  };

  const handleCopyVat = (vat: string, id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(vat);
    setCopiedVatId(id);
    toast({ title: "تم نسخ الرقم الضريبي", message: vat });
    setTimeout(() => setCopiedVatId(null), 2000);
  };

  const handleExportCsv = () => {
    const headers = [
      "اسم المنشأة",
      "الاسم الإنجليزي",
      "نوع المنشأة",
      "تابع للعميل",
      "الرقم الضريبي",
      "السجل التجاري",
      "بادئة الترقيم",
      "المدينة",
      "الهاتف",
      "البريد",
    ];
    const rows = filteredCompanies.map((c) => [
      `"${c.nameAr}"`,
      `"${c.nameEn || ""}"`,
      `"${c.organizationType || ""}"`,
      `"${c.clientEmployee || ""}"`,
      `"${c.vatNumber}"`,
      `"${c.crNumber || ""}"`,
      `"${c.prefix}"`,
      `"${c.addressCity || ""}"`,
      `"${c.phone || ""}"`,
      `"${c.email || ""}"`,
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `companies-export-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredCompanies = useMemo(() => {
    let list = [...companies];

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.nameAr.toLowerCase().includes(q) ||
          (c.nameEn && c.nameEn.toLowerCase().includes(q)) ||
          (c.organizationType && c.organizationType.toLowerCase().includes(q)) ||
          (c.clientEmployee && c.clientEmployee.toLowerCase().includes(q)) ||
          c.vatNumber.includes(q) ||
          (c.crNumber && c.crNumber.includes(q)) ||
          c.prefix.toLowerCase().includes(q) ||
          (c.addressCity && c.addressCity.toLowerCase().includes(q))
      );
    }

    // Move pinned to top
    return list.sort((a, b) => {
      const aPinned = pinnedIds.includes(a.id) ? 1 : 0;
      const bPinned = pinnedIds.includes(b.id) ? 1 : 0;
      return bPinned - aPinned;
    });
  }, [companies, search, pinnedIds]);

  const getMonogram = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0]?.slice(0, 2) || "من";
    return `${parts[0]?.charAt(0) || ""}${parts[1]?.charAt(0) || ""}`;
  };

  return (
    <div className="flex flex-col gap-2.5 w-full max-w-7xl mx-auto py-1">
      {/* Unified Single-Row Header & Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border pb-2 bg-card p-2 shadow-2xs">
        {/* Left: Title & Count */}
        <div className="flex items-center gap-2 shrink-0">
          <Building className="size-4.5 text-primary" />
          <h1 className="text-base font-bold tracking-tight text-foreground">
            الشركات والمنشآت
          </h1>
          <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-muted text-muted-foreground border border-border">
            {filteredCompanies.length === companies.length
              ? companies.length
              : `${filteredCompanies.length} / ${companies.length}`}
          </span>
        </div>

        {/* Center: Search Input */}
        <div className="relative flex-1 max-w-sm min-w-[200px]">
          <Search className="size-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم، الضريبي، السجل، البادئة... (/)"
            className="text-xs h-8 pr-8 pl-8 bg-background"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              title="مسح البحث"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="outline"
            size="xs"
            onClick={handleExportCsv}
            className="gap-1 text-xs h-8 font-medium"
            title="تصدير بيانات المنشآت إلى CSV"
          >
            <Download className="size-3.5" />
            <span className="hidden sm:inline">تصدير CSV</span>
          </Button>

          <Button
            size="xs"
            onClick={() => {
              setEditingCompany(null);
              setDrawerOpen(true);
            }}
            className="gap-1.5 font-semibold text-xs h-8 bg-primary text-primary-foreground shadow-xs cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>إضافة منشأة</span>
          </Button>
        </div>
      </div>

      {/* Centered High-Density Data Table */}
      {filteredCompanies.length === 0 ? (
        <div className="border border-border bg-card p-6 text-center flex flex-col items-center justify-center gap-2 max-w-sm mx-auto my-4 shadow-2xs">
          <Building2 className="size-7 text-muted-foreground" />
          <div>
            <h3 className="font-bold text-xs">
              {search ? "لا توجد نتائج مطابقة لبحثك" : "لا توجد منشآت مسجلة بعد"}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {search
                ? "جرب البحث بكلمات أخرى أو امسح شريط البحث"
                : "ابدأ بإضافة أول منشأة لتتمكن من إصدار الفواتير"}
            </p>
          </div>
          {search ? (
            <Button
              size="xs"
              variant="outline"
              onClick={() => setSearch("")}
              className="text-xs"
            >
              مسح شريط البحث
            </Button>
          ) : (
            <Button
              size="xs"
              onClick={() => {
                setEditingCompany(null);
                setDrawerOpen(true);
              }}
              className="gap-1.5 text-xs font-semibold"
            >
              <Plus className="size-3.5" />
              <span>إضافة أول منشأة</span>
            </Button>
          )}
        </div>
      ) : (
        <div className="border border-border bg-card overflow-x-auto shadow-2xs">
          <table className="w-full text-xs text-start border-collapse">
            <thead className="bg-muted/50 border-b border-border font-semibold text-muted-foreground text-[11px]">
              <tr>
                <th className="p-2 text-start min-w-[200px]">اسم المنشأة</th>
                <th className="p-2 text-start min-w-[120px]">نوع المنشأة</th>
                <th className="p-2 text-start min-w-[130px]">تابع للعميل</th>
                <th className="p-2 text-start w-20">البادئة</th>
                <th className="p-2 text-start w-28">السجل التجاري</th>
                <th className="p-2 text-start w-24">المدينة</th>
                <th className="p-2 text-start w-48">الإجراءات السريعة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredCompanies.map((company) => {
                const isPinned = pinnedIds.includes(company.id);

                return (
                  <tr
                    key={company.id}
                    onClick={() => router.push(`/c/${company.id}`)}
                    className={`hover:bg-primary/[0.04] transition-colors cursor-pointer group ${
                      isPinned ? "bg-primary/[0.02]" : "odd:bg-card even:bg-muted/15"
                    }`}
                  >
                    {/* 1. Company Name */}
                    <td className="p-2 text-start">
                      <div className="flex flex-col items-start min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-foreground group-hover:text-primary transition-colors truncate">
                            {company.nameAr}
                          </span>
                          {isPinned && (
                            <span title="منشأة مثبتة">
                              <Pin className="size-3 text-primary fill-primary shrink-0 rotate-45" />
                            </span>
                          )}
                        </div>
                        {company.nameEn && (
                          <span
                            className="text-[10px] font-mono text-muted-foreground truncate"
                            dir="ltr"
                          >
                            {company.nameEn}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 2. Organization Type (نوع المنشأة) */}
                    <td className="p-2 text-start">
                      {company.organizationType ? (
                        <span className="inline-block px-2 py-0.5 bg-primary/5 text-primary font-medium text-[11px] border border-primary/20">
                          {company.organizationType}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40 font-mono">—</span>
                      )}
                    </td>

                    {/* 3. Client Employee / Representative (تابع للعميل) */}
                    <td className="p-2 text-start">
                      {company.clientEmployee ? (
                        <span className="inline-block px-2 py-0.5 bg-muted/70 text-foreground font-semibold text-[11px] border border-border/60">
                          {company.clientEmployee}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40 font-mono">—</span>
                      )}
                    </td>

                    {/* 4. Prefix */}
                    <td className="p-2 text-start font-mono font-bold text-[11px]">
                      <span className="px-1.5 py-0.5 bg-muted border border-border">
                        {company.prefix}
                      </span>
                    </td>

                    {/* 5. CR Number */}
                    <td
                      className="p-2 text-start font-mono tabular-nums text-muted-foreground"
                      dir="ltr"
                    >
                      {company.crNumber || "—"}
                    </td>

                    {/* 6. City */}
                    <td className="p-2 text-start text-muted-foreground">
                      {company.addressCity || "—"}
                    </td>

                    {/* 7. Quick Action Buttons */}
                    <td
                      className="p-2 text-start"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-1">
                        {/* Accessible Pin Button */}
                        <button
                          type="button"
                          onClick={(e) => togglePin(company.id, e)}
                          className={`p-1 transition-colors cursor-pointer ${
                            isPinned
                              ? "text-primary bg-primary/10 hover:bg-primary/20"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          }`}
                          title={isPinned ? "إلغاء التثبيت" : "تثبيت المنشأة في المقدمة"}
                        >
                          <Pin className={`size-3.5 ${isPinned ? "fill-primary" : ""}`} />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingCompany(company);
                            setDrawerOpen(true);
                          }}
                          className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                          title="تعديل بيانات المنشأة"
                        >
                          <Edit2 className="size-3" />
                        </button>

                        <Link
                          href={`/c/${company.id}/settings`}
                          className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title="إعدادات المنشأة"
                        >
                          <Settings className="size-3" />
                        </Link>

                        <Link
                          href={`/c/${company.id}/invoices/new`}
                          className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          title="إصدار فاتورة جديدة للمنشأة"
                        >
                          <FilePlus className="size-3" />
                        </Link>

                        <Link
                          href={`/c/${company.id}`}
                          className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[11px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-2xs"
                        >
                          <span>دخول</span>
                          <ArrowLeft className="size-3" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawer for Adding & Editing Companies */}
      <CompanyDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        company={editingCompany}
        onSaved={(saved) => {
          setCompanies((prev) => {
            const index = prev.findIndex((c) => c.id === saved.id);
            if (index >= 0) {
              const updated = [...prev];
              updated[index] = saved;
              return updated;
            }
            return [saved, ...prev];
          });
        }}
      />
    </div>
  );
}
