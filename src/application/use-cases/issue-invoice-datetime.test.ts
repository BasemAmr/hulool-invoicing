import { describe, expect, it } from "vitest";

import {
  asCompanyId,
  asCustomerId,
  asInvoiceId,
  type CompanyId,
  type InvoiceId,
} from "@/domain/branding";
import { halalas } from "@/domain/value-objects/money";
import type { Database, Tx } from "@/application/tx";
import type { Clock } from "@/application/ports/clock";
import type {
  CompanyRecord,
  CompanyRepository,
} from "@/application/ports/company-repository";
import type { IdempotencyStore } from "@/application/ports/idempotency-store";
import type {
  InvoiceRecord,
  InvoiceRepository,
  MarkIssuedInput,
} from "@/application/ports/invoice-repository";
import type { SequencePort } from "@/application/ports/sequence-port";
import { IssueInvoice } from "@/application/use-cases/issue-invoice";
import { invoiceDateTimeToUtcIso } from "@/domain/services/invoice-datetime";

/**
 * Golden test: issuing an invoice with datetime D produces a QR whose
 * Tag 3 decodes to D (decoded from the TLV bytes in-test — never by
 * string-matching the base64).
 */

const COMPANY = asCompanyId("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
const CUSTOMER = asCustomerId("cccccccc-cccc-4ccc-8ccc-cccccccccccc");

function record(overrides: Partial<InvoiceRecord> & { id: InvoiceId }): InvoiceRecord {
  const now = new Date("2026-09-15T10:00:00.000Z").toISOString();
  return {
    companyId: COMPANY,
    customerId: CUSTOMER,
    templateId: "simple_red",
    invoiceType: "standard",
    invoiceNumber: null,
    status: "draft",
    issueDate: "2026-09-15",
    // Note: no issueTime key — proves legacy rows (optional field) still issue.
    dueDate: null,
    currency: "SAR",
    subtotal: halalas(1000),
    vatAmount: halalas(150),
    total: halalas(1150),
    terms: null,
    notes: null,
    qrPayload: null,
    issuedAt: null,
    createdAt: now,
    updatedAt: now,
    items: [],
    ...overrides,
  };
}

class FakeInvoices implements InvoiceRepository {
  readonly rows = new Map<string, InvoiceRecord>();
  async createDraft(): Promise<InvoiceRecord> {
    throw new Error("not used");
  }
  async updateDraft(): Promise<InvoiceRecord> {
    throw new Error("not used");
  }
  async deleteDraft(): Promise<void> {
    throw new Error("not used");
  }
  async findByIdWithItems(id: InvoiceId): Promise<InvoiceRecord | null> {
    return this.rows.get(String(id)) ?? null;
  }
  async findByNumber(): Promise<InvoiceRecord | null> {
    return null;
  }
  async markIssued(id: InvoiceId, input: MarkIssuedInput): Promise<InvoiceRecord> {
    const existing = this.rows.get(String(id));
    if (!existing) throw new Error("Invoice not found");
    const updated: InvoiceRecord = {
      ...existing,
      invoiceNumber: input.invoiceNumber,
      status: "issued",
      qrPayload: input.qrPayload,
      issuedAt: input.issuedAt,
    };
    this.rows.set(String(id), updated);
    return updated;
  }
  async listByCompany(): Promise<InvoiceRecord[]> {
    throw new Error("not used");
  }
  async listAll(): Promise<InvoiceRecord[]> {
    throw new Error("not used");
  }
}

function companyRecord(): CompanyRecord {
  const now = new Date("2026-09-15T10:00:00.000Z").toISOString();
  return {
    id: COMPANY,
    nameAr: "شركة الاختبار",
    nameEn: null,
    vatNumber: "300000000000003",
    crNumber: null,
    prefix: "INV",
    clientEmployee: null,
    phone: null,
    email: null,
    website: null,
    logoUrl: null,
    logoFileId: null,
    backgroundFileId: null,
    signatureFileId: null,
    footerText: null,
    templateConfig: null,
    addressBuildingNumber: null,
    addressStreet: null,
    addressDistrict: null,
    addressCity: null,
    addressPostalCode: null,
    addressAdditionalNumber: null,
    createdAt: now,
    updatedAt: now,
  };
}

// Decode TLV Tag 3 (timestamp) from a base64 QR payload.
function decodeQrTimestamp(payload: string): string {
  const binary = Buffer.from(payload, "base64");
  const bytes = new Uint8Array(binary);
  const decoder = new TextDecoder();
  let offset = 0;
  while (offset + 2 <= bytes.length) {
    const tag = bytes[offset]!;
    const len = bytes[offset + 1]!;
    const value = decoder.decode(bytes.slice(offset + 2, offset + 2 + len));
    if (tag === 3) return value;
    offset += 2 + len;
  }
  throw new Error("Tag 3 (timestamp) not found in QR payload");
}

function harness() {
  const invoices = new FakeInvoices();
  const companyRepo = {
    findById: async () => companyRecord(),
  } as unknown as CompanyRepository;
  // Clock fixed at 10:00Z — deliberately DIFFERENT from the invoice datetime
  // so the test discriminates: server-now must NOT leak into the QR.
  const clock: Clock = { now: () => new Date("2026-09-15T10:00:00.000Z") };
  const idempotency: IdempotencyStore = {
    tryClaim: async () => ({ claimed: true, existingInvoiceId: null }),
  };
  const db = {
    transaction: async <T>(fn: (tx: Tx) => Promise<T>): Promise<T> =>
      fn({} as Tx),
  } as unknown as Database;
  const sequence = {
    nextInvoiceNumber: async (
      _tx: Tx,
      _c: CompanyId,
      prefix: string,
    ) => `${prefix}-00001`,
    ensureSequenceAtLeast: async () => {},
  } as unknown as SequencePort;
  const issue = new IssueInvoice(
    invoices,
    companyRepo,
    sequence,
    clock,
    idempotency,
    db,
  );
  return { invoices, issue };
}

describe("IssueInvoice QR timestamp comes from the invoice datetime", () => {
  it("picked 14:30 Riyadh wall-time lands in Tag 3 as 11:30Z (not server-now)", async () => {
    const { invoices, issue } = harness();
    const id = asInvoiceId("dddddddd-dddd-4ddd-8ddd-000000000001");
    invoices.rows.set(
      String(id),
      record({ id, issueDate: "2026-09-15", issueTime: "14:30" }),
    );

    const dto = await issue.execute({ invoiceId: String(id) });
    expect(dto.qrPayload).toBeTruthy();
    expect(decodeQrTimestamp(dto.qrPayload!)).toBe(
      invoiceDateTimeToUtcIso(
        "2026-09-15",
        "14:30",
        new Date("2026-09-15T10:00:00.000Z"),
      ),
    );
    expect(decodeQrTimestamp(dto.qrPayload!)).toBe(
      "2026-09-15T11:30:00.000Z",
    );
  });

  it("legacy rows without a time issue at midnight (00:00 Riyadh → 21:00Z prev day)", async () => {
    const { invoices, issue } = harness();
    const id = asInvoiceId("dddddddd-dddd-4ddd-8ddd-000000000002");
    invoices.rows.set(
      String(id),
      record({ id, issueDate: "2026-09-15", issueTime: undefined }),
    );

    const dto = await issue.execute({ invoiceId: String(id) });
    expect(decodeQrTimestamp(dto.qrPayload!)).toBe(
      "2026-09-14T21:00:00.000Z",
    );
  });

  it("issuedAt still records the system issuance moment (separate concept)", async () => {
    const { invoices, issue } = harness();
    const id = asInvoiceId("dddddddd-dddd-4ddd-8ddd-000000000003");
    invoices.rows.set(
      String(id),
      record({ id, issueDate: "2026-09-15", issueTime: "14:30" }),
    );

    const dto = await issue.execute({ invoiceId: String(id) });
    // Server-now (10:00Z) ≠ invoice instant (11:30Z): proves the two concepts split.
    expect(dto.issuedAt).toBe("2026-09-15T10:00:00.000Z");
    expect(decodeQrTimestamp(dto.qrPayload!)).toBe(
      "2026-09-15T11:30:00.000Z",
    );
  });
});
