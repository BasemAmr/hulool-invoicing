import { beforeEach, describe, expect, it } from "vitest";

import {
  asCompanyId,
  asCustomerId,
  asInvoiceId,
  type CompanyId,
  type InvoiceId,
} from "@/domain/branding";
import {
  DUPLICATE_INVOICE_NUMBER_MESSAGE,
  INVOICE_NUMBER_TOO_LONG_MESSAGE,
  MISSING_INVOICE_NUMBER_MESSAGE,
} from "@/domain/value-objects/invoice-number";
import { halalas } from "@/domain/value-objects/money";
import type { Tx } from "@/application/tx";
import type { Database } from "@/application/tx";
import type { Clock } from "@/application/ports/clock";
import type { CompanyRepository, CompanyRecord } from "@/application/ports/company-repository";
import type { IdempotencyStore } from "@/application/ports/idempotency-store";
import type {
  InvoiceRecord,
  InvoiceRepository,
  MarkIssuedInput,
  UpdateDraftInvoiceInput,
} from "@/application/ports/invoice-repository";
import type { SequencePort } from "@/application/ports/sequence-port";
import { IssueInvoice } from "@/application/use-cases/issue-invoice";
import { UpdateDraftInvoice } from "@/application/use-cases/update-draft-invoice";

// ─── fakes ───────────────────────────────────────────────────────────────
// In-memory seams: no live DB. The fake invoice store mimics Postgres
// semantics that matter here — per-company exact-match lookup and the
// unique(company_id, invoice_number) constraint — including a "hidden"
// mode that simulates the concurrency race (row invisible to the pre-check
// lookup but still enforced at write time, i.e. a duplicate committed
// between our pre-check and our write).

const COMPANY_A = asCompanyId("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
const COMPANY_B = asCompanyId("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
const CUSTOMER = asCustomerId("cccccccc-cccc-4ccc-8ccc-cccccccccccc");

function pgUniqueViolation(): Error {
  return Object.assign(new Error("duplicate key value violates unique constraint"), {
    code: "23505",
    constraint: "invoices_company_invoice_number_unique",
    detail: "Key (company_id, invoice_number)=(x, y) already exists.",
  });
}

function record(overrides: Partial<InvoiceRecord> & { id: InvoiceId; companyId: CompanyId }): InvoiceRecord {
  const now = new Date("2026-09-15T10:00:00.000Z").toISOString();
  return {
    customerId: CUSTOMER,
    templateId: "simple_red",
    invoiceType: "standard",
    invoiceNumber: null,
    status: "draft",
    issueDate: "2026-09-15",
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

class FakeInvoiceRepository implements InvoiceRepository {
  readonly rows = new Map<string, InvoiceRecord>();
  /** Ids invisible to findByNumber but still enforced at write time (race simulation). */
  readonly hiddenFromLookup = new Set<string>();

  async createDraft(): Promise<InvoiceRecord> {
    throw new Error("not used in these tests");
  }

  async updateDraft(id: InvoiceId, input: UpdateDraftInvoiceInput, now: Date): Promise<InvoiceRecord> {
    const existing = this.rows.get(String(id));
    if (!existing) throw new Error("Invoice not found");
    // Mirror the real impl: SET the number only when provided…
    const nextNumber = input.invoiceNumber !== undefined ? input.invoiceNumber : existing.invoiceNumber;
    // …and enforce the per-company unique constraint like Postgres would.
    if (nextNumber !== null && nextNumber !== undefined) {
      for (const other of this.rows.values()) {
        if (
          String(other.id) !== String(id) &&
          String(other.companyId) === String(input.companyId) &&
          other.invoiceNumber === nextNumber
        ) {
          throw pgUniqueViolation();
        }
      }
    }
    const updated: InvoiceRecord = {
      ...existing,
      companyId: input.companyId,
      customerId: input.customerId,
      templateId: input.templateId || existing.templateId,
      invoiceNumber: nextNumber ?? existing.invoiceNumber,
      updatedAt: now.toISOString(),
      items: input.items.map((item, i) => ({
        savedProductId: item.savedProductId ?? null,
        position: i + 1,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountAmount: item.discountAmount,
        vatRate: item.vatRate,
        lineSubtotal: item.lineSubtotal,
        lineVat: item.lineVat,
        lineTotal: item.lineTotal,
      })),
    };
    this.rows.set(String(id), updated);
    return updated;
  }

  async deleteDraft(): Promise<void> {
    throw new Error("not used in these tests");
  }

  async findByIdWithItems(id: InvoiceId, _tx?: Tx): Promise<InvoiceRecord | null> {
    return this.rows.get(String(id)) ?? null;
  }

  async findByNumber(companyId: CompanyId, invoiceNumber: string, _tx?: Tx): Promise<InvoiceRecord | null> {
    for (const row of this.rows.values()) {
      if (this.hiddenFromLookup.has(String(row.id))) continue;
      if (String(row.companyId) === String(companyId) && row.invoiceNumber === invoiceNumber) {
        return row;
      }
    }
    return null;
  }

  async markIssued(id: InvoiceId, input: MarkIssuedInput, _tx: Tx): Promise<InvoiceRecord> {
    const existing = this.rows.get(String(id));
    if (!existing) throw new Error("Invoice not found");
    for (const other of this.rows.values()) {
      if (
        String(other.id) !== String(id) &&
        String(other.companyId) === String(existing.companyId) &&
        other.invoiceNumber === input.invoiceNumber
      ) {
        throw pgUniqueViolation();
      }
    }
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
    throw new Error("not used in these tests");
  }

  async listAll(): Promise<InvoiceRecord[]> {
    throw new Error("not used in these tests");
  }
}

class FakeSequence implements SequencePort {
  next = 1;
  readonly ensureCalls: number[] = [];
  async nextInvoiceNumber(_tx: Tx, _companyId: CompanyId, prefix: string, _year: number): Promise<string> {
    const v = this.next++;
    return `${prefix}${String(v).padStart(5, "0")}`;
  }
  async ensureSequenceAtLeast(_tx: Tx, _companyId: CompanyId, seq: number): Promise<void> {
    this.ensureCalls.push(seq);
    if (seq >= this.next) this.next = seq + 1;
  }
}

function companyRecord(id: CompanyId, prefix: string): CompanyRecord {
  const now = new Date("2026-09-15T10:00:00.000Z").toISOString();
  return {
    id,
    nameAr: "شركة الاختبار",
    nameEn: null,
    vatNumber: "300000000000003",
    crNumber: null,
    prefix,
    clientEmployee: null,
    organizationType: null,
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

const COMPANY_A_RECORD = companyRecord(COMPANY_A, "INV");
const COMPANY_B_RECORD = companyRecord(COMPANY_B, "INV");

const companyRepo = {
  findById: async (id: CompanyId) =>
    String(id) === String(COMPANY_A) ? COMPANY_A_RECORD : String(id) === String(COMPANY_B) ? COMPANY_B_RECORD : null,
} as unknown as CompanyRepository;

const clock: Clock = { now: () => new Date("2026-09-15T10:00:00.000Z") };

const idempotency: IdempotencyStore = {
  tryClaim: async () => ({ claimed: true, existingInvoiceId: null }),
};

const db = {
  transaction: async <T>(fn: (tx: Tx) => Promise<T>): Promise<T> => fn({} as Tx),
} as unknown as Database;

const lineItem = {
  description: "بند اختبار",
  quantity: 1,
  unitPrice: "10.00" as string | number,
  discountAmount: 0,
  vatRate: 0.15,
};

let invoices: FakeInvoiceRepository;
let sequence: FakeSequence;
let issue: IssueInvoice;
let update: UpdateDraftInvoice;

function draftId(n: number): InvoiceId {
  return asInvoiceId(`dddddddd-dddd-4ddd-8ddd-0000000000${String(n).padStart(2, "0")}`);
}

beforeEach(() => {
  invoices = new FakeInvoiceRepository();
  sequence = new FakeSequence();
  issue = new IssueInvoice(invoices, companyRepo, sequence, clock, idempotency, db);
  update = new UpdateDraftInvoice(invoices);
});

// ─── IssueInvoice (create path) ──────────────────────────────────────────

describe("IssueInvoice with custom numbers", () => {
  it("issues with a free-text custom number and skips sentinel catch-up", async () => {
    const id = draftId(1);
    invoices.rows.set(String(id), record({ id, companyId: COMPANY_A }));
    const dto = await issue.execute({ invoiceId: String(id), customInvoiceNumber: "فاتورة-خاصة-١" });
    expect(dto.invoiceNumber).toBe("فاتورة-خاصة-١");
    expect(dto.status).toBe("issued");
    expect(sequence.ensureCalls).toEqual([]);
  });

  it("a custom high-seq PREFIXnnnnn advances the sentinel so the next auto skips past it", async () => {
    const first = draftId(1);
    invoices.rows.set(String(first), record({ id: first, companyId: COMPANY_A }));
    const dto = await issue.execute({ invoiceId: String(first), customInvoiceNumber: "INV00100" });
    expect(dto.invoiceNumber).toBe("INV00100");
    expect(sequence.ensureCalls).toEqual([100]);

    const second = draftId(2);
    invoices.rows.set(String(second), record({ id: second, companyId: COMPANY_A }));
    const auto = await issue.execute({ invoiceId: String(second) });
    expect(auto.invoiceNumber).toBe("INV00101");
  });

  it("rejects a duplicate custom number in the SAME company, leaving the draft untouched", async () => {
    const taken = draftId(1);
    invoices.rows.set(
      String(taken),
      record({ id: taken, companyId: COMPANY_A, invoiceNumber: "INV00007", status: "issued" }),
    );
    const draft = draftId(2);
    invoices.rows.set(String(draft), record({ id: draft, companyId: COMPANY_A }));

    await expect(
      issue.execute({ invoiceId: String(draft), customInvoiceNumber: "INV00007" }),
    ).rejects.toThrowError(DUPLICATE_INVOICE_NUMBER_MESSAGE);

    const untouched = await invoices.findByIdWithItems(draft);
    expect(untouched?.status).toBe("draft");
    expect(untouched?.invoiceNumber).toBeNull();
    // The conflicting invoice is intact too.
    expect((await invoices.findByNumber(COMPANY_A, "INV00007"))?.id).toBe(String(taken));
  });

  it("allows the same number across DIFFERENT companies", async () => {
    const other = draftId(1);
    invoices.rows.set(
      String(other),
      record({ id: other, companyId: COMPANY_B, invoiceNumber: "INV00007", status: "issued" }),
    );
    const draft = draftId(2);
    invoices.rows.set(String(draft), record({ id: draft, companyId: COMPANY_A }));
    const dto = await issue.execute({ invoiceId: String(draft), customInvoiceNumber: "INV00007" });
    expect(dto.invoiceNumber).toBe("INV00007");
  });

  it("blank custom input falls back to auto-allocation (auto path untouched)", async () => {
    const id = draftId(1);
    invoices.rows.set(String(id), record({ id, companyId: COMPANY_A }));
    const dto = await issue.execute({ invoiceId: String(id), customInvoiceNumber: "   " });
    expect(dto.invoiceNumber).toBe("INV00001");
    expect(sequence.ensureCalls).toEqual([]);
  });

  it("rejects an over-long custom number", async () => {
    const id = draftId(1);
    invoices.rows.set(String(id), record({ id, companyId: COMPANY_A }));
    await expect(
      issue.execute({ invoiceId: String(id), customInvoiceNumber: "x".repeat(65) }),
    ).rejects.toThrowError(INVOICE_NUMBER_TOO_LONG_MESSAGE);
  });

  it("maps a concurrent-duplicate constraint violation (pre-check passed, write lost the race) to the friendly message", async () => {
    // Hidden row: invisible to the pre-check — exactly what a concurrent
    // committer looks like — but still enforced at write time. True
    // concurrency needs live Postgres (two overlapping transactions); the
    // DB unique constraint plus this mapping is the backstop, and this test
    // pins the mapping half of it.
    const rival = draftId(1);
    invoices.rows.set(
      String(rival),
      record({ id: rival, companyId: COMPANY_A, invoiceNumber: "INV00009", status: "issued" }),
    );
    invoices.hiddenFromLookup.add(String(rival));

    const draft = draftId(2);
    invoices.rows.set(String(draft), record({ id: draft, companyId: COMPANY_A }));
    await expect(
      issue.execute({ invoiceId: String(draft), customInvoiceNumber: "INV00009" }),
    ).rejects.toThrowError(DUPLICATE_INVOICE_NUMBER_MESSAGE);

    // Nothing was written for the loser.
    const loser = await invoices.findByIdWithItems(draft);
    expect(loser?.status).toBe("draft");
    expect(loser?.invoiceNumber).toBeNull();
  });
});

// ─── UpdateDraftInvoice (edit path) ──────────────────────────────────────

describe("UpdateDraftInvoice with invoice numbers", () => {
  function updateInput(id: InvoiceId, companyId: CompanyId, extra: Record<string, unknown> = {}) {
    return {
      id: String(id),
      companyId: String(companyId),
      customerId: String(CUSTOMER),
      templateId: "simple_red",
      invoiceType: "standard" as const,
      issueDate: "2026-09-15",
      items: [lineItem],
      ...extra,
    };
  }

  it("renames to a free number", async () => {
    const id = draftId(1);
    invoices.rows.set(
      String(id),
      record({ id, companyId: COMPANY_A, invoiceNumber: "INV00001", status: "issued" }),
    );
    const dto = await update.execute(updateInput(id, COMPANY_A, { invoiceNumber: "INV00050" }));
    expect(dto.invoiceNumber).toBe("INV00050");
  });

  it("keeping the current number (self) is not a conflict", async () => {
    const id = draftId(1);
    invoices.rows.set(
      String(id),
      record({ id, companyId: COMPANY_A, invoiceNumber: "INV00001", status: "issued" }),
    );
    const dto = await update.execute(updateInput(id, COMPANY_A, { invoiceNumber: "INV00001" }));
    expect(dto.invoiceNumber).toBe("INV00001");
  });

  it("rejects a number taken by ANOTHER invoice of the same company, old number intact", async () => {
    const first = draftId(1);
    const second = draftId(2);
    invoices.rows.set(
      String(first),
      record({ id: first, companyId: COMPANY_A, invoiceNumber: "INV00001", status: "issued" }),
    );
    invoices.rows.set(
      String(second),
      record({ id: second, companyId: COMPANY_A, invoiceNumber: "INV00002", status: "issued" }),
    );
    await expect(
      update.execute(updateInput(first, COMPANY_A, { invoiceNumber: "INV00002" })),
    ).rejects.toThrowError(DUPLICATE_INVOICE_NUMBER_MESSAGE);

    expect((await invoices.findByIdWithItems(first))?.invoiceNumber).toBe("INV00001");
  });

  it("allows the same number across DIFFERENT companies", async () => {
    const inB = draftId(1);
    invoices.rows.set(
      String(inB),
      record({ id: inB, companyId: COMPANY_B, invoiceNumber: "INV00002", status: "issued" }),
    );
    const inA = draftId(2);
    invoices.rows.set(
      String(inA),
      record({ id: inA, companyId: COMPANY_A, invoiceNumber: "INV00001", status: "issued" }),
    );
    const dto = await update.execute(updateInput(inA, COMPANY_A, { invoiceNumber: "INV00002" }));
    expect(dto.invoiceNumber).toBe("INV00002");
  });

  it("rejects an explicitly cleared number (an issued invoice cannot go numberless)", async () => {
    const id = draftId(1);
    invoices.rows.set(
      String(id),
      record({ id, companyId: COMPANY_A, invoiceNumber: "INV00001", status: "issued" }),
    );
    // Zod keeps "" as "" (trim, no min) so the use case owns this message.
    await expect(
      update.execute(updateInput(id, COMPANY_A, { invoiceNumber: "   " })),
    ).rejects.toThrowError(MISSING_INVOICE_NUMBER_MESSAGE);
    expect((await invoices.findByIdWithItems(id))?.invoiceNumber).toBe("INV00001");
  });

  it("omitted number preserves the stored number (auto path untouched)", async () => {
    const id = draftId(1);
    invoices.rows.set(
      String(id),
      record({ id, companyId: COMPANY_A, invoiceNumber: "INV00001", status: "issued" }),
    );
    const dto = await update.execute(updateInput(id, COMPANY_A));
    expect(dto.invoiceNumber).toBe("INV00001");
  });

  it("maps a concurrent-duplicate constraint violation to the friendly message, old number intact", async () => {
    const rival = draftId(1);
    invoices.rows.set(
      String(rival),
      record({ id: rival, companyId: COMPANY_A, invoiceNumber: "INV00009", status: "issued" }),
    );
    invoices.hiddenFromLookup.add(String(rival));

    const id = draftId(2);
    invoices.rows.set(
      String(id),
      record({ id, companyId: COMPANY_A, invoiceNumber: "INV00001", status: "issued" }),
    );
    await expect(
      update.execute(updateInput(id, COMPANY_A, { invoiceNumber: "INV00009" })),
    ).rejects.toThrowError(DUPLICATE_INVOICE_NUMBER_MESSAGE);
    expect((await invoices.findByIdWithItems(id))?.invoiceNumber).toBe("INV00001");
  });

  it("full-precision unit prices still flow through untouched alongside a rename", async () => {
    // Guards the exact-totals path: adding the number must not disturb money.
    // "17.95319" rounds half-up once at the DB boundary → stored "17.95".
    const id = draftId(1);
    invoices.rows.set(
      String(id),
      record({ id, companyId: COMPANY_A, invoiceNumber: "INV00001", status: "issued" }),
    );
    const dto = await update.execute(
      updateInput(id, COMPANY_A, {
        invoiceNumber: "my-001",
        items: [{ ...lineItem, unitPrice: "17.95319" }],
      }),
    );
    expect(dto.invoiceNumber).toBe("my-001");
    expect(dto.items[0]?.unitPrice).toBe("17.95");
  });
});
