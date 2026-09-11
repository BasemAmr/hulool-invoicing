"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Receipt,
  Package,
  Users,
  Settings,
  ArrowRightLeft,
  Menu,
  X,
  PlusCircle,
  LogOut,
  Building2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { logoutAction } from "@/app/actions/auth";
import type { CompanyRecord } from "@/application/ports/company-repository";

export function CompanySidebar({ company }: { company: CompanyRecord }) {
  const pathname = usePathname();
  const cPath = `/c/${company.id}`;

  const navItems = [
    { href: cPath, labelAr: "لوحة التحكم", icon: LayoutDashboard, exact: true },
    { href: `${cPath}/invoices`, labelAr: "الفواتير", icon: FileText },
    { href: `${cPath}/receipts`, labelAr: "سندات القبض", icon: Receipt },
    { href: `${cPath}/customers`, labelAr: "العملاء", icon: Users },
    { href: `${cPath}/settings`, labelAr: "إعدادات المنشأة", icon: Settings },
  ];

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-l border-border bg-card">
      {/* Active Company Header */}
      <div className="flex flex-col border-b border-border p-4 bg-muted/20">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            {company.logoFileId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/files/${company.logoFileId}`}
                alt={company.nameAr}
                className="size-9 rounded-lg object-contain"
              />
            ) : (
              <Building2 className="size-5" />
            )}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="font-bold text-sm text-foreground truncate" title={company.nameAr}>
              {company.nameAr}
            </span>
            <span className="text-[11px] font-mono text-muted-foreground">
              {company.prefix}
            </span>
          </div>
        </div>

        {/* Switch Company button */}
        <Link
          href="/companies"
          className="mt-3 flex items-center justify-center gap-1.5 w-full py-1.5 px-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors border border-border/80"
        >
          <ArrowRightLeft className="size-3.5" />
          <span>تبديل المنشأة</span>
        </Link>
      </div>

      {/* Quick Action Button */}
      <div className="p-3 border-b border-border bg-muted/10">
        <Link
          href={`${cPath}/invoices/new`}
          className="flex items-center justify-center gap-2 w-full py-2 px-3 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
        >
          <PlusCircle className="size-3.5" />
          إنشاء فاتورة جديدة
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1 p-3">
        {navItems.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-between px-3 py-2.5 text-xs font-medium transition-colors border-r-2",
                active
                  ? "bg-primary/10 border-primary text-primary font-semibold"
                  : "border-transparent text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Icon className="size-4 shrink-0" />
                <span>{item.labelAr}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer Settings, Theme Switch & Logout */}
      <div className="border-t border-border p-3 flex flex-col gap-2 bg-muted/10">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[11px] font-medium text-foreground">
              المظهر والألوان
            </span>
            <span className="text-[10px] text-muted-foreground">
              داكن / فاتح
            </span>
          </div>
          <ThemeToggle />
        </div>

        <form action={logoutAction} className="pt-2 border-t border-border/60">
          <button
            type="submit"
            className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors font-medium cursor-pointer"
          >
            <LogOut className="size-3.5" />
            <span>تسجيل الخروج</span>
          </button>
        </form>
      </div>
    </aside>
  );
}

export function CompanyMobileNav({ company }: { company: CompanyRecord }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const cPath = `/c/${company.id}`;

  const navItems = [
    { href: cPath, labelAr: "لوحة التحكم", icon: LayoutDashboard, exact: true },
    { href: `${cPath}/invoices`, labelAr: "الفواتير", icon: FileText },
    { href: `${cPath}/receipts`, labelAr: "سندات القبض", icon: Receipt },
    { href: `${cPath}/customers`, labelAr: "العملاء", icon: Users },
    { href: `${cPath}/settings`, labelAr: "إعدادات المنشأة", icon: Settings },
  ];

  return (
    <div className="md:hidden border-b border-border bg-card flex items-center justify-between px-4 py-3 sticky top-0 z-40">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(true)}
          className="p-1.5 text-foreground hover:bg-muted focus:outline-none border border-border"
          aria-label="فتح القائمة"
        >
          <Menu className="size-5" />
        </button>
        <div className="flex flex-col">
          <span className="font-bold text-sm text-foreground">{company.nameAr}</span>
          <span className="text-[10px] font-mono text-muted-foreground">{company.prefix}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href={`${cPath}/invoices/new`}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-primary text-primary-foreground font-medium"
        >
          <PlusCircle className="size-3.5" />
          <span>فاتورة</span>
        </Link>
        <ThemeToggle />
      </div>

      {/* Drawer */}
      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setOpen(false)}
          />
          <div className="relative flex w-72 max-w-[80vw] flex-1 flex-col bg-card border-l border-border p-4 shadow-xl z-10 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-primary">{company.nameAr}</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-muted-foreground hover:text-foreground border border-border"
                aria-label="إغلاق"
              >
                <X className="size-4" />
              </button>
            </div>

            <nav className="flex flex-col gap-1 flex-1">
              {navItems.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors border-r-2",
                      active
                        ? "bg-primary/10 border-primary text-primary font-semibold"
                        : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="size-4" />
                    <span>{item.labelAr}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="pt-3 border-t border-border mt-auto flex flex-col gap-2">
              <Link
                href="/companies"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium border border-border/60 text-center justify-center"
              >
                <ArrowRightLeft className="size-3.5" />
                <span>تبديل المنشأة</span>
              </Link>
              <form action={logoutAction} className="pt-2 border-t border-border">
                <button
                  type="submit"
                  className="flex items-center gap-2 w-full py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors font-medium cursor-pointer"
                >
                  <LogOut className="size-3.5" />
                  <span>تسجيل الخروج</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
