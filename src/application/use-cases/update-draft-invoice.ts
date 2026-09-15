import { asCompanyId, asCustomerId, asInvoiceId } from "@/domain/branding";
import { halalas, priceStringToHalalas, toDecimalString } from "@/domain/value-objects/money";
import { CURRENCY } from "@/domain/constants";
import { invoiceUpdateSchema } from "@/domain/contracts";
import { calculateTotalsExact } from "@/domain/services/totals-calculator";
import { ValidationError } from "@/domain/errors";
import { toInvoiceDto } from "../dto";
import type { InvoiceDto } from "../dto";
import type {
  InvoiceItemRecord,
  InvoiceRepository,
} from "../ports/invoice-repository";

/**
 * Update an existing invoice (draft or published).
 * Re-validates input via Zod, re-computes totals, and updates the invoice
 * while preserving its invoiceNumber/status (repository layer).
 * Name kept as UpdateDraftInvoice so existing imports keep working.
 */
export class UpdateDraftInvoice {
  constructor(private readonly invoiceRepository: InvoiceRepository) {}

  async execute(input: unknown): Promise<InvoiceDto> {
    const parsed = invoiceUpdateSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }
    const data = parsed.data;

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
    const record = await this.invoiceRepository.updateDraft(
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
      },
      now,
    );

    return toInvoiceDto(record);
  }
}
