"use client";

import React, { useState } from "react";
import Link from "next/link";
import { PlusCircle, UserPlus, Receipt, PackagePlus, ArrowLeft } from "lucide-react";
import { CustomerDrawer } from "@/components/drawers/customer-drawer";
import { ProductDrawer } from "@/components/drawers/product-drawer";
import { ReceiptVoucherDrawer } from "@/components/drawers/receipt-voucher-drawer";
import type { ClientOption } from "@/components/forms/client-combobox";

export function DashboardQuickActions({
  companyId,
  customers,
}: {
  companyId: string;
  customers: ClientOption[];
}) {
  const [customerDrawerOpen, setCustomerDrawerOpen] = useState(false);
  const [productDrawerOpen, setProductDrawerOpen] = useState(false);
  const [voucherDrawerOpen, setVoucherDrawerOpen] = useState(false);

  const cPath = `/c/${companyId}`;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Action 1: New Invoice */}
        <Link
          href={`${cPath}/invoices/new`}
          className="group border border-border bg-card hover:border-primary/60 hover:bg-primary/5 p-4 flex flex-col justify-between gap-3 shadow-2xs transition-all"
        >
          <div className="flex items-start justify-between">
            <div className="size-10 rounded bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <PlusCircle className="size-5" />
            </div>
            <ArrowLeft className="size-4 text-muted-foreground group-hover:text-primary group-hover:-translate-x-1 transition-all" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
              إنشاء فاتورة جديدة
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              إصدار فاتورة ضريبية أو مبسطة للعميل
            </p>
          </div>
        </Link>

        {/* Action 2: New Customer Drawer */}
        <button
          type="button"
          onClick={() => setCustomerDrawerOpen(true)}
          className="group border border-border bg-card hover:border-primary/60 hover:bg-primary/5 p-4 flex flex-col justify-between gap-3 shadow-2xs transition-all text-start cursor-pointer"
        >
          <div className="flex items-start justify-between">
            <div className="size-10 rounded bg-emerald-500/10 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <UserPlus className="size-5" />
            </div>
            <ArrowLeft className="size-4 text-muted-foreground group-hover:text-emerald-600 group-hover:-translate-x-1 transition-all" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground group-hover:text-emerald-600 transition-colors">
              إضافة عميل جديد
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              تسجيل بيانات عميل في الدليل العام
            </p>
          </div>
        </button>

        {/* Action 3: New Receipt Voucher Drawer */}
        <button
          type="button"
          onClick={() => setVoucherDrawerOpen(true)}
          className="group border border-border bg-card hover:border-primary/60 hover:bg-primary/5 p-4 flex flex-col justify-between gap-3 shadow-2xs transition-all text-start cursor-pointer"
        >
          <div className="flex items-start justify-between">
            <div className="size-10 rounded bg-amber-500/10 text-amber-600 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <Receipt className="size-5" />
            </div>
            <ArrowLeft className="size-4 text-muted-foreground group-hover:text-amber-600 group-hover:-translate-x-1 transition-all" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground group-hover:text-amber-600 transition-colors">
              إصدار سند قبض
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              توثيق استلام دفعة مالية أو حوالة
            </p>
          </div>
        </button>

        {/* Action 4: New Product Drawer */}
        <button
          type="button"
          onClick={() => setProductDrawerOpen(true)}
          className="group border border-border bg-card hover:border-primary/60 hover:bg-primary/5 p-4 flex flex-col justify-between gap-3 shadow-2xs transition-all text-start cursor-pointer"
        >
          <div className="flex items-start justify-between">
            <div className="size-10 rounded bg-blue-500/10 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <PackagePlus className="size-5" />
            </div>
            <ArrowLeft className="size-4 text-muted-foreground group-hover:text-blue-600 group-hover:-translate-x-1 transition-all" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground group-hover:text-blue-600 transition-colors">
              إضافة بند أو خدمة
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              حفظ منتج أو خدمة للتعبئة السريعة
            </p>
          </div>
        </button>
      </div>

      {/* Drawers */}
      <CustomerDrawer
        open={customerDrawerOpen}
        onClose={() => setCustomerDrawerOpen(false)}
      />

      <ReceiptVoucherDrawer
        open={voucherDrawerOpen}
        onClose={() => setVoucherDrawerOpen(false)}
        companyId={companyId}
        customers={customers}
      />

      <ProductDrawer
        open={productDrawerOpen}
        onClose={() => setProductDrawerOpen(false)}
      />
    </>
  );
}
