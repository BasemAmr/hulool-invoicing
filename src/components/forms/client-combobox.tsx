"use client";

import React, { useState, useRef, useEffect } from "react";
import { Search, Plus, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { CustomerDrawer } from "@/components/drawers/customer-drawer";

export interface ClientOption {
  id: string;
  nameAr: string;
  nameEn?: string | null;
  phone?: string | null;
  email?: string | null;
  vatNumber?: string | null;
  unifiedNumber?: string | null;
  addressCity?: string | null;
  addressStreet?: string | null;
  addressPostalCode?: string | null;
}

interface ClientComboboxProps {
  customers: ClientOption[];
  selectedId: string;
  onSelect: (customer: ClientOption) => void;
  className?: string;
}

export function ClientCombobox({
  customers: initialCustomers,
  selectedId,
  onSelect,
  className,
}: ClientComboboxProps) {
  const [customers, setCustomers] = useState<ClientOption[]>(initialCustomers);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCustomers(initialCustomers);
  }, [initialCustomers]);

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

  const selectedCustomer = customers.find((c) => c.id === selectedId);

  const filteredCustomers = customers.filter(
    (c) =>
      c.nameAr.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone && c.phone.includes(search)) ||
      (c.vatNumber && c.vatNumber.includes(search))
  );

  function handleCustomerSaved(newCustomer: { id: string; nameAr: string; phone?: string | null; vatNumber?: string | null; addressCity?: string | null }) {
    const option: ClientOption = {
      id: newCustomer.id,
      nameAr: newCustomer.nameAr,
      phone: newCustomer.phone,
      vatNumber: newCustomer.vatNumber,
      addressCity: newCustomer.addressCity,
    };
    setCustomers((prev) => {
      const idx = prev.findIndex((c) => c.id === newCustomer.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...option };
        return next;
      }
      return [option, ...prev];
    });
    onSelect(option);
    setIsOpen(false);
    setSearch("");
  }

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      {/* Combobox Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-9 w-full items-center justify-between border border-input bg-card px-3 py-1.5 text-xs text-foreground hover:border-primary focus:border-primary focus:outline-none transition-colors"
      >
        <span className={cn("truncate", !selectedCustomer && "text-muted-foreground")}>
          {selectedCustomer ? (
            <span className="font-medium text-foreground">
              {selectedCustomer.nameAr}
              {selectedCustomer.phone ? ` (${selectedCustomer.phone})` : ""}
            </span>
          ) : (
            "ابحث عن عميل أو أضف عميلاً جديداً..."
          )}
        </span>
        <ChevronDown className="size-4 shrink-0 opacity-50" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full start-0 z-50 mt-1 w-full border border-border bg-card shadow-xl animate-in fade-in-0 zoom-in-95 duration-100">
          {/* Always Visible First Action: Create New Client */}
          <div className="p-1 border-b border-border bg-muted/30">
            <button
              type="button"
              onClick={() => {
                setShowAddDialog(true);
                setIsOpen(false);
              }}
              className="flex w-full items-center gap-2 px-2.5 py-2 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors cursor-pointer"
            >
              <Plus className="size-4 shrink-0" />
              <span>+ إضافة عميل جديد في هذه الفاتورة</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="flex items-center border-b border-border px-2.5 py-1.5 bg-card">
            <Search className="size-3.5 text-muted-foreground shrink-0 ms-1" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم، الجوال، أو الرقم الضريبي..."
              className="w-full bg-transparent px-2 text-xs text-foreground placeholder:text-muted-foreground outline-none"
              autoFocus
            />
          </div>

          {/* Client List */}
          <div className="max-h-56 overflow-y-auto p-1 divide-y divide-border/50">
            {filteredCustomers.length === 0 ? (
              <div className="p-3 text-center text-xs text-muted-foreground">
                لم يتم العثور على عملاء مطابقين.
              </div>
            ) : (
              filteredCustomers.map((customer) => {
                const isSelected = customer.id === selectedId;
                return (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => {
                      onSelect(customer);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={cn(
                      "flex w-full items-center justify-between px-3 py-2 text-xs text-start transition-colors cursor-pointer",
                      isSelected
                        ? "bg-primary/10 font-semibold text-primary"
                        : "hover:bg-muted text-foreground"
                    )}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{customer.nameAr}</span>
                      {customer.phone && (
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          جوال: {customer.phone}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="size-4 text-primary shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Customer Drawer for Add */}
      <CustomerDrawer
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onSaved={handleCustomerSaved}
      />
    </div>
  );
}

