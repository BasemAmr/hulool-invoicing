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
  dueDate: string | null;
  currency: string;
  subtotal: Halalas;
  vatAmount: Halalas;
  total: Halalas;
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
  dueDate: string | null;
  terms: string | null;
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
   * pre-check. Same-company scope only by construction (companyId is part
   * of the predicate), so cross-company reuse never shows up here.
   */
  findByNumber(
    companyId: CompanyId,
    invoiceNumber: string,
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
  /** Cross-company listing for the dashboard. */
  listAll(
    filters: InvoiceListFilters,
    limit: number,
    offset: number,
  ): Promise<InvoiceRecord[]>;
}

export type { CompanyId, CustomerId, Halalas, InvoiceId };
