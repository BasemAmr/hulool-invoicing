"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, FileText, Users } from "lucide-react";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/companies", labelAr: "الشركات", icon: Building2 },
  { href: "/customers", labelAr: "العملاء", icon: Users },
  { href: "/invoices", labelAr: "الفواتير", icon: FileText },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-l bg-card">
      <div className="border-b px-4 py-5">
        <p className="font-heading text-base font-semibold">حلول</p>
        <p className="text-xs text-muted-foreground">نظام الفواتير الضريبية</p>
      </div>
      <nav className="flex flex-col gap-1 p-2">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {item.labelAr}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
