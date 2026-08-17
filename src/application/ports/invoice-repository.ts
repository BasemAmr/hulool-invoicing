import type { CompanyId, CustomerId, Halalas, InvoiceId } from "@/domain/branding";
import type { DocumentStatus } from "@/domain/value-objects/document-status";
import type { Tx } from "../tx";

export interface InvoiceItemRecord {
  position: number;
  description: string;
  quantity: number;
  unitPrice: Halalas;
  vatRate: number;
  lineSubtotal: Halalas;
  lineVat: Halalas;
  lineTotal: Halalas;
}

export interface InvoiceRecord {
  id: InvoiceId;
  companyId: CompanyId;
  customerId: CustomerId;
  invoiceNumber: string | null;
  status: DocumentStatus;
  issueDate: string;
  dueDate: string | null;
  currency: string;
  subtotal: Halalas;
  vatAmount: Halalas;
  total: Halalas;
  notes: string | null;
  qrPayload: string | null;
  issuedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: InvoiceItemRecord[];
}

export interface CreateDraftInvoiceInput {
  companyId: CompanyId;
  customerId: CustomerId;
  issueDate: string;
  dueDate: string | null;
  notes: string | null;
  currency: string;
  subtotal: Halalas;
  vatAmount: Halalas;
  total: Halalas;
  items: InvoiceItemRecord[];
}

export interface MarkIssuedInput {
  invoiceNumber: string;
  qrPayload: string;
  issuedAt: string;
}

export interface InvoiceListFilters {
  status: DocumentStatus | null;
}

export interface InvoiceRepository {
  createDraft(
    input: CreateDraftInvoiceInput,
    now: Date,
  ): Promise<InvoiceRecord>;
  /** Pass a Tx inside use-case transactions; omit for plain reads. */
  findByIdWithItems(id: InvoiceId, tx?: Tx): Promise<InvoiceRecord | null>;
  markIssued(
    id: InvoiceId,
    input: MarkIssuedInput,
    tx: Tx,
  ): Promise<InvoiceRecord>;
  listByCompany(
    companyId: CompanyId,
    filters: InvoiceListFilters,
    limit: number,
    offset: number,
  ): Promise<InvoiceRecord[]>;
  /** Cross-company listing for the dashboard. */
  listAll(
    filters: InvoiceListFilters,
    limit: number,
    offset: number,
  ): Promise<InvoiceRecord[]>;
}

export type { CompanyId, CustomerId, Halalas, InvoiceId };
