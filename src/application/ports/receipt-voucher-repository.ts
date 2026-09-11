import type { CompanyId, CustomerId, Halalas } from "@/domain/branding";
import type { ReceiptVoucherCreateInput } from "@/domain/contracts";
import type { Tx } from "../tx";

export interface ReceiptVoucherRecord {
  id: string;
  companyId: string;
  customerId: string;
  invoiceId: string | null;
  voucherNumber: string;
  voucherDate: string;
  amount: Halalas;
  paymentMethod: "cash" | "bank_transfer" | "other";
  reference: string | null;
  notes: string | null;
  qrPayload: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReceiptVoucherRepository {
  create(input: ReceiptVoucherCreateInput, tx?: Tx): Promise<ReceiptVoucherRecord>;
  findById(id: string, tx?: Tx): Promise<ReceiptVoucherRecord | null>;
  findByInvoiceId(invoiceId: string, tx?: Tx): Promise<ReceiptVoucherRecord | null>;
  listByCompany(
    companyId: CompanyId | string,
    limit?: number,
    offset?: number
  ): Promise<ReceiptVoucherRecord[]>;
  delete(id: string, tx?: Tx): Promise<void>;
}
