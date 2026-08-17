import { toDecimalString } from "@/domain/value-objects/money";
import type { InvoiceRecord } from "./ports/invoice-repository";

/**
 * Plain DTOs returned by use cases to the boundary layer.
 * Halalas values are serialized as 2-decimal strings — the domain-internal
 * branded integer never leaks past this point.
 */

export interface InvoiceItemDto {
  position: number;
  description: string;
  quantity: number;
  unitPrice: string;
  vatRate: number;
  lineSubtotal: string;
  lineVat: string;
  lineTotal: string;
}

export interface InvoiceDto {
  id: string;
  companyId: string;
  customerId: string;
  invoiceNumber: string | null;
  status: "draft" | "issued" | "cancelled";
  issueDate: string;
  dueDate: string | null;
  currency: string;
  subtotal: string;
  vatAmount: string;
  total: string;
  notes: string | null;
  qrPayload: string | null;
  issuedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: InvoiceItemDto[];
}

export function toInvoiceDto(record: InvoiceRecord): InvoiceDto {
  return {
    id: record.id,
    companyId: record.companyId,
    customerId: record.customerId,
    invoiceNumber: record.invoiceNumber,
    status: record.status,
    issueDate: record.issueDate,
    dueDate: record.dueDate,
    currency: record.currency,
    subtotal: toDecimalString(record.subtotal),
    vatAmount: toDecimalString(record.vatAmount),
    total: toDecimalString(record.total),
    notes: record.notes,
    qrPayload: record.qrPayload,
    issuedAt: record.issuedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    items: record.items.map((item) => ({
      position: item.position,
      description: item.description,
      quantity: item.quantity,
      unitPrice: toDecimalString(item.unitPrice),
      vatRate: item.vatRate,
      lineSubtotal: toDecimalString(item.lineSubtotal),
      lineVat: toDecimalString(item.lineVat),
      lineTotal: toDecimalString(item.lineTotal),
    })),
  };
}
