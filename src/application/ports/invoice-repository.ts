import type { CompanyId, CustomerId, Halalas, InvoiceId } from "@/domain/branding";
import type { DocumentStatus } from "@/domain/value-objects/document-status";
import type { Tx } from "../tx";

export interface InvoiceItemRecord {
  savedProductId?: string | null;
  position: number;
  description: string;
  quantity: number;
  unitPrice: Halalas;
  discountAmount: Halalas;
  vatRate: number;
  lineSubtotal: Halalas;
  lineVat: Halalas;
  lineTotal: Halalas;
}

export interface InvoiceRecord {
  id: InvoiceId;
  companyId: CompanyId;
  customerId: CustomerId;
  templateId: string;
  invoiceType: 'standard' | 'simplified';
  invoiceNumber: string | null;
  status: DocumentStatus;
  issueDate: string;
  /**
   * HH:MM Riyadh wall-time (see invoice-datetime.ts). Optional so legacy
   * in-memory fakes/tests omitting it keep compiling — readers normalize
   * missing to "00:00" (midnight). The DB column itself is NOT NULL.
   */
  issueTime?: string;
  dueDate: string | null;
  currency: string;
  subtotal: Halalas;
  vatAmount: Halalas;
  total: Halalas;
  discountAmount?: Halalas;
  terms: string | null;
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
  templateId?: string;
  invoiceType: 'standard' | 'simplified';
  issueDate: string;
  /** Optional on input: missing (legacy callers/tests) normalizes to "00:00". */
  issueTime?: string;
  dueDate: string | null;
  terms: string | null;
  notes: string | null;
  currency: string;
  subtotal: Halalas;
  vatAmount: Halalas;
  total: Halalas;
  discountAmount?: Halalas;
  items: InvoiceItemRecord[];
}


export interface MarkIssuedInput {
  invoiceNumber: string;
  qrPayload: string;
  issuedAt: string;
}

/**
 * Update input = draft fields plus an OPTIONAL rename. Undefined (the
 * default for all legacy/auto callers) preserves the stored number
 * byte-for-byte; a defined non-empty string renames after a uniqueness
 * pre-check (see UpdateDraftInvoice). Empty-string rejection lives in the
 * use case, not here.
 */
export interface UpdateDraftInvoiceInput extends CreateDraftInvoiceInput {
  invoiceNumber?: string;
}

export interface InvoiceListFilters {
  status: DocumentStatus | null;
}

export interface InvoiceRepository {
  createDraft(
    input: CreateDraftInvoiceInput,
    now: Date,
  ): Promise<InvoiceRecord>;
  updateDraft(
    id: InvoiceId,
    input: UpdateDraftInvoiceInput,
    now: Date,
  ): Promise<InvoiceRecord>;
  deleteDraft(id: InvoiceId): Promise<void>;
  /** Pass a Tx inside use-case transactions; omit for plain reads. */
  findByIdWithItems(id: InvoiceId, tx?: Tx): Promise<InvoiceRecord | null>;
  /**
   * Exact per-company number lookup for the custom-number uniqueness
   * pre-check.
   */
  findByNumber(
    companyId: CompanyId,
    invoiceNumber: string,
    tx?: Tx,
  ): Promise<InvoiceRecord | null>;
  /**
   * Universal / cross-company invoice number lookup to guard against duplicates globally.
   */
  findByGlobalNumber(
    invoiceNumber: string,
    excludeInvoiceId?: string,
    tx?: Tx,
  ): Promise<InvoiceRecord | null>;
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
  /** Listing by customer across ALL companies. */
  listByCustomer(
    customerId: CustomerId | string,
    limit: number,
    offset: number,
  ): Promise<InvoiceRecord[]>;
  countByCustomer(
    customerId: CustomerId | string,
  ): Promise<number>;
  /** Cross-company listing for the dashboard. */
  listAll(
    filters: InvoiceListFilters,
    limit: number,
    offset: number,
  ): Promise<InvoiceRecord[]>;
}

export type { CompanyId, CustomerId, Halalas, InvoiceId };
