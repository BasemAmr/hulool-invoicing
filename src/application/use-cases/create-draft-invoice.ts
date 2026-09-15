import { asCompanyId, asCustomerId } from "@/domain/branding";
import { halalas, priceStringToHalalas, toDecimalString } from "@/domain/value-objects/money";
import { CURRENCY } from "@/domain/constants";
import { invoiceCreateSchema } from "@/domain/contracts";
import { calculateTotalsExact } from "@/domain/services/totals-calculator";
import { ValidationError } from "@/domain/errors";
import { toInvoiceDto } from "../dto";
import type { InvoiceDto } from "../dto";
import type {
  InvoiceItemRecord,
  InvoiceRepository,
} from "../ports/invoice-repository";

/**
 * Create a draft invoice (no invoice number, no QR).
 * Validates input via Zod, computes totals via the pure TotalsCalculator,
 * and persists the draft with its line items.
 */
export class CreateDraftInvoice {
  constructor(private readonly invoiceRepository: InvoiceRepository) {}

  async execute(input: unknown): Promise<InvoiceDto> {
    const parsed = invoiceCreateSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }
    const data = parsed.data;

    // Exact totals: string SAR prices multiply BEFORE rounding (round once
    // per line inside calculateTotalsExact — identical to the wizard display
    // helper lineSubtotalHalalasExact). Legacy halalas integers are lifted
    // back to a 2-decimal SAR string so both input shapes share one path.
    // The persisted unit_price column stays numeric(15,2): rounded half-up
    // via priceStringToHalalas at the DB boundary below.
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
    const record = await this.invoiceRepository.createDraft(
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
      },
      now,
    );

    return toInvoiceDto(record);
  }
}
