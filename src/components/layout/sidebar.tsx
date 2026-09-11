"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Users,
  Package,
  Menu,
  X,
  PlusCircle,
  LogOut,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { logoutAction } from "@/app/actions/auth";

export const NAV_ITEMS = [
  { href: "/companies", labelAr: "الشركات والمؤسسات", icon: Building2 },
  { href: "/customers", labelAr: "سجل العملاء", icon: Users },
  { href: "/products", labelAr: "المنتجات والخدمات", icon: Package },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-l border-border bg-card">
      {/* Brand Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <Link href="/companies" className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg tracking-tight text-primary">
              حلول
            </span>
            <span className="text-[11px] text-muted-foreground font-medium">
              للفواتير
            </span>
          </div>
        </Link>
      </div>

      {/* Quick Action Button */}
      <div className="p-3 border-b border-border bg-muted/20">
        <Link
          href="/companies/new"
          className="flex items-center justify-center gap-2 w-full py-2 px-3 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
        >
          <PlusCircle className="size-3.5" />
          إضافة منشأة جديدة
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1 p-3">
        {NAV_ITEMS.map((item) => {
          const active =
            "exact" in item && item.exact
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

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

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
        <Link href="/companies" className="flex items-center gap-1.5">
          <span className="font-bold text-base text-primary">حلول</span>
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href="/companies/new"
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-primary text-primary-foreground font-medium"
        >
          <PlusCircle className="size-3.5" />
          <span>منشأة</span>
        </Link>
        <ThemeToggle />
      </div>

      {/* Drawer backdrop */}
      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setOpen(false)}
          />
          <div className="relative flex w-72 max-w-[80vw] flex-1 flex-col bg-card border-l border-border p-4 shadow-xl z-10 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-primary">حلول</span>
                <span className="text-xs text-muted-foreground">الفواتير</span>
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
              {NAV_ITEMS.map((item) => {
                const active =
                  "exact" in item && item.exact
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
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  المظهر الحالي
                </span>
                <ThemeToggle />
              </div>
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
