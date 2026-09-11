"use client";

import React, { useState, useMemo } from "react";
import { Plus, Users, Search, Edit2, Trash2, X } from "lucide-react";
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
import { CustomerDrawer } from "@/components/drawers/customer-drawer";
import { DeleteConfirmDialog } from "@/components/documents/delete-confirm-dialog";
import { deleteCustomerAction } from "@/app/actions/customers";
import type { CustomerRecord } from "@/application/ports/customer-repository";

export function CustomersTableClient({
  customers: initialCustomers,
  title = "سجل العملاء",
  subtitle,
}: {
  customers: CustomerRecord[];
  title?: string;
  subtitle?: string;
}) {
  const [customers, setCustomers] = useState<CustomerRecord[]>(initialCustomers);
  const [searchTerm, setSearchTerm] = useState("");

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRecord | null>(null);

  // Delete state
  const [deletingCustomer, setDeletingCustomer] = useState<CustomerRecord | null>(null);

  const filteredCustomers = useMemo(() => {
    if (!searchTerm.trim()) return customers;
    const query = searchTerm.trim().toLowerCase();
    return customers.filter((c) => {
      return (
        (c.nameAr ?? "").toLowerCase().includes(query) ||
        (c.nameEn ?? "").toLowerCase().includes(query) ||
        (c.vatNumber ?? "").toLowerCase().includes(query) ||
        (c.unifiedNumber ?? "").toLowerCase().includes(query) ||
        (c.addressCity ?? "").toLowerCase().includes(query) ||
        (c.phone ?? "").toLowerCase().includes(query)
      );
    });
  }, [customers, searchTerm]);

  const handleOpenCreate = () => {
    setEditingCustomer(null);
    setDrawerOpen(true);
  };

  const handleOpenEdit = (c: CustomerRecord) => {
    setEditingCustomer(c);
    setDrawerOpen(true);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
        <Button
          size="sm"
          onClick={handleOpenCreate}
          className="gap-1.5 font-semibold text-xs bg-primary text-primary-foreground shadow-xs"
        >
          <Plus className="size-3.5" />
          <span>عميل جديد</span>
        </Button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-2 max-w-md">
        <div className="relative flex-1">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث بالاسم، الرقم الضريبي، الرقم الموحد، المدينة، الجوال..."
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
      {filteredCustomers.length === 0 ? (
        <div className="border border-border bg-card p-8 text-center flex flex-col items-center justify-center gap-2 shadow-2xs">
          <Users className="size-7 text-muted-foreground" />
          <p className="font-semibold text-xs text-foreground">
            {searchTerm ? "لا توجد نتائج مطابقة لبحثك" : "لا يوجد عملاء مسجلين بعد"}
          </p>
          <Button
            size="sm"
            onClick={handleOpenCreate}
            className="text-xs mt-1"
          >
            + إضافة عميل الآن
          </Button>
        </div>
      ) : (
        <div className="border border-border bg-card shadow-2xs">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="text-start">اسم العميل</TableHead>
                <TableHead className="w-32 text-start">الرقم الضريبي</TableHead>
                <TableHead className="w-28 text-start">الرقم الموحد</TableHead>
                <TableHead className="w-28 text-start">المدينة</TableHead>
                <TableHead className="w-28 text-start">الجوال</TableHead>
                <TableHead className="w-32 text-end">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.map((customer) => (
                <TableRow key={customer.id} className="text-xs">
                  <TableCell className="text-start py-2.5">
                    <div className="font-semibold text-foreground">{customer.nameAr}</div>
                    {customer.nameEn && (
                      <span className="block text-[11px] text-muted-foreground font-mono" dir="ltr">
                        {customer.nameEn}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground py-2.5">
                    {customer.vatNumber ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground py-2.5">
                    {customer.unifiedNumber ?? "—"}
                  </TableCell>
                  <TableCell className="py-2.5 text-muted-foreground">
                    {customer.addressCity ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground py-2.5">
                    {customer.phone ?? "—"}
                  </TableCell>
                  <TableCell className="text-end py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleOpenEdit(customer)}
                        className="gap-1 text-xs text-foreground hover:bg-muted"
                      >
                        <Edit2 className="size-3" />
                        <span>تعديل</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setDeletingCustomer(customer)}
                        className="text-destructive hover:bg-destructive/10 text-xs p-1"
                        title="حذف العميل"
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

      {/* Customer Drawer (Create & Edit) */}
      <CustomerDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setEditingCustomer(null);
        }}
        customer={editingCustomer}
        onSaved={() => {
          // Re-trigger server action or page state will refresh via revalidatePath
        }}
      />

      {/* Delete Dialog */}
      <DeleteConfirmDialog
        open={Boolean(deletingCustomer)}
        onClose={() => setDeletingCustomer(null)}
        title="تأكيد حذف العميل"
        description="هل أنت متأكد من رغبتك في حذف بيانات هذا العميل؟"
        itemName={deletingCustomer?.nameAr}
        onConfirm={async () => {
          if (!deletingCustomer) return { status: "error", message: "معرف العميل مفقود" };
          const res = await deleteCustomerAction(deletingCustomer.id);
          if (res.status === "success") {
            setCustomers((prev) => prev.filter((c) => c.id !== deletingCustomer.id));
          }
          return res;
        }}
      />
    </div>
  );
}
