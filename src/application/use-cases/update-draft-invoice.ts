import { asCompanyId, asCustomerId, asInvoiceId } from "@/domain/branding";
import { halalas, priceStringToHalalas, toDecimalString } from "@/domain/value-objects/money";
import { CURRENCY } from "@/domain/constants";
import { invoiceUpdateSchema } from "@/domain/contracts";
import { calculateTotalsExact } from "@/domain/services/totals-calculator";
import { ValidationError } from "@/domain/errors";
import {
  DUPLICATE_INVOICE_NUMBER_MESSAGE,
  INVOICE_NUMBER_TOO_LONG_MESSAGE,
  MAX_CUSTOM_INVOICE_NUMBER_LENGTH,
  MISSING_INVOICE_NUMBER_MESSAGE,
  isInvoiceNumberUniqueViolation,
} from "@/domain/value-objects/invoice-number";
import { toInvoiceDto } from "../dto";
import type { InvoiceDto } from "../dto";
import type {
  InvoiceItemRecord,
  InvoiceRepository,
} from "../ports/invoice-repository";

/**
 * Update an existing invoice (draft or published).
 * Re-validates input via Zod, re-computes totals, and updates the invoice.
 * The invoice number is preserved unless `invoiceNumber` is explicitly
 * provided (editable wizard field): undefined keeps today's behavior
 * byte-identical; a value renames after a same-company uniqueness pre-check
 * that excludes the invoice itself. Name kept as UpdateDraftInvoice so
 * existing imports keep working.
 */
export class UpdateDraftInvoice {
  constructor(private readonly invoiceRepository: InvoiceRepository) {}

  async execute(input: unknown): Promise<InvoiceDto> {
    const parsed = invoiceUpdateSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }
    const data = parsed.data;

    // Optional rename tri-state: undefined = preserve (legacy/auto callers);
    // "" (explicitly cleared) = reject — an issued invoice cannot go
    // numberless, and a draft cleared here would break the invariant the
    // edit form shows; the action layer maps draft+empty to the auto path
    // before reaching us, so "" arriving here is always a real error.
    // Length is re-checked here (not just Zod) because input is `unknown`
    // and this use case is also called directly in tests/other flows.
    let invoiceNumber: string | undefined;
    if (data.invoiceNumber !== undefined) {
      const trimmed = data.invoiceNumber.trim();
      if (trimmed.length === 0) {
        throw new ValidationError(MISSING_INVOICE_NUMBER_MESSAGE);
      }
      if (trimmed.length > MAX_CUSTOM_INVOICE_NUMBER_LENGTH) {
        throw new ValidationError(INVOICE_NUMBER_TOO_LONG_MESSAGE);
      }
      invoiceNumber = trimmed;

      // Friendly pre-check excluding self: keeping the current number (the
      // common "save without touching the field" case) never conflicts with
      // itself. Cross-company reuse is invisible here by construction.
      const clash = await this.invoiceRepository.findByNumber(
        asCompanyId(data.companyId),
        invoiceNumber,
      );
      if (clash && String(clash.id) !== String(data.id)) {
        throw new ValidationError(DUPLICATE_INVOICE_NUMBER_MESSAGE);
      }
    }

    // Same exact-totals path as CreateDraftInvoice (see its WHY comment):
    // string SAR prices multiply before rounding; stored unit_price stays
    // numeric(15,2) via priceStringToHalalas.
    const totals = calculateTotalsExact(
      data.items.map((item) => ({
        unitPrice:
          typeof item.unitPrice === "string"
            ? item.unitPrice
            : toDecimalString(halalas(item.unitPrice)),
        quantity: item.quantity,
        discountAmount: halalas(item.discountAmount ?? 0),
        vatRate: item.vatRate,
      })),
    );

    const items: InvoiceItemRecord[] = data.items.map((item, i) => {
      const line = totals.lines[i];
      if (line === undefined) {
        throw new Error("Totals line count mismatch — internal error");
      }
      return {
        savedProductId: item.savedProductId ?? null,
        position: i + 1,
        description: item.description,
        quantity: item.quantity,
        unitPrice:
          typeof item.unitPrice === "string"
            ? priceStringToHalalas(item.unitPrice)
            : halalas(item.unitPrice),
        discountAmount: halalas(item.discountAmount ?? 0),
        vatRate: item.vatRate,
        lineSubtotal: line.lineSubtotal,
        lineVat: line.lineVat,
        lineTotal: line.lineTotal,
      };
    });

    const now = new Date();
    // Race backstop: a concurrent rename to the same number can slip past
    // the pre-check above; the unique constraint aborts the repo transaction
    // (parent UPDATE precedes the item swap, so nothing is half-written) and
    // is mapped here to the same friendly message instead of a 500.
    // Deliberate narrow mapping: non-unique DB failures rethrow untouched.
    let record;
    try {
      record = await this.invoiceRepository.updateDraft(
        asInvoiceId(data.id),
        {
          companyId: asCompanyId(data.companyId),
          customerId: asCustomerId(data.customerId),
          templateId: data.templateId || "simple_red",
          invoiceType: data.invoiceType,
          issueDate: data.issueDate,
          dueDate: data.dueDate ?? null,
          terms: data.terms ?? null,
          notes: data.notes ?? null,
          currency: CURRENCY,
          subtotal: totals.subtotal,
          vatAmount: totals.vatTotal,
          total: totals.total,
          items,
          invoiceNumber,
        },
        now,
      );
    } catch (err) {
      if (
        invoiceNumber !== undefined &&
        isInvoiceNumberUniqueViolation(err)
      ) {
        throw new ValidationError(DUPLICATE_INVOICE_NUMBER_MESSAGE);
      }
      throw err;
    }

    return toInvoiceDto(record);
  }
}
