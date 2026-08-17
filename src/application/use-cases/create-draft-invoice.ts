import { asCompanyId, asCustomerId } from "@/domain/branding";
import { halalas } from "@/domain/value-objects/money";
import { CURRENCY } from "@/domain/constants";
import { invoiceCreateSchema } from "@/domain/contracts";
import { calculateTotals } from "@/domain/services/totals-calculator";
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

    const totalsInput = data.items.map((item) => ({
      unitPrice: halalas(item.unitPrice),
      quantity: item.quantity,
      vatRate: item.vatRate,
    }));
    const totals = calculateTotals(totalsInput);

    const items: InvoiceItemRecord[] = data.items.map((item, i) => {
      const line = totals.lines[i];
      if (line === undefined) {
        throw new Error("Totals line count mismatch â€” internal error");
      }
      return {
        position: i + 1,
        description: item.description,
        quantity: item.quantity,
        unitPrice: halalas(item.unitPrice),
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
        issueDate: data.issueDate,
        dueDate: data.dueDate ?? null,
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
