import { asInvoiceId } from "@/domain/branding";
import {
  IdempotencyReplayError,
  InvalidTransitionError,
  NotFoundError,
  ValidationError,
} from "@/domain/errors";
import { buildQrPayload } from "@/domain/services/zatca-qr-service";
import type { Database } from "@/infrastructure/database";
import { toInvoiceDto } from "../dto";
import type { InvoiceDto } from "../dto";
import type { Clock } from "../ports/clock";
import type { CompanyRepository } from "../ports/company-repository";
import type { IdempotencyStore } from "../ports/idempotency-store";
import type { InvoiceRepository } from "../ports/invoice-repository";
import type { SequencePort } from "../ports/sequence-port";

import type { ReceiptVoucherRepository } from "../ports/receipt-voucher-repository";

export interface IssueInvoiceInput {
  invoiceId: string;
  idempotencyKey?: string;
}

/**
 * Issue a draft invoice — the core transactional use case.
 *
 * Runs ONE transaction that:
 *   1. Loads the draft invoice (must be status 'draft').
 *   2. Loads the company (for seller name + VAT number + prefix).
 *   3. Claims the idempotency key if provided (replay → error).
 *   4. Allocates the next atomic invoice number.
 *   5. Builds the ZATCA Phase 1 QR payload.
 *   6. Marks the invoice as issued.
 *   7. Auto-creates a linked receipt voucher.
 *
 * All steps share the same transaction so that a failure in any step
 * rolls back the sequence allocation, idempotency claim, and invoice update.
 */
export class IssueInvoice {
  constructor(
    private readonly invoiceRepository: InvoiceRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly sequenceService: SequencePort,
    private readonly clock: Clock,
    private readonly idempotencyStore: IdempotencyStore,
    private readonly db: Database,
    private readonly receiptVoucherRepository?: ReceiptVoucherRepository,
  ) {}

  async execute(input: IssueInvoiceInput): Promise<InvoiceDto> {
    if (!input.invoiceId) {
      throw new ValidationError("invoiceId is required");
    }
    const invoiceId = asInvoiceId(input.invoiceId);

    return this.db.transaction(async (tx) => {
      // 1. Load draft invoice with items
      const invoice = await this.invoiceRepository.findByIdWithItems(
        invoiceId,
        tx,
      );
      if (!invoice) {
        throw new NotFoundError(`Invoice ${input.invoiceId} not found`);
      }
      if (invoice.status !== "draft") {
        throw new InvalidTransitionError(
          `Invoice is ${invoice.status}, cannot issue`,
        );
      }

      // 2. Load company for QR data and prefix
      const company = await this.companyRepository.findById(
        invoice.companyId,
        tx,
      );
      if (!company) {
        throw new NotFoundError(`Company not found`);
      }

      // 3. Claim idempotency key if provided
      if (input.idempotencyKey) {
        const claim = await this.idempotencyStore.tryClaim(
          input.idempotencyKey,
          invoice.id,
          tx,
        );
        if (!claim.claimed) {
          throw new IdempotencyReplayError(
            `Idempotency key "${input.idempotencyKey}" already used`,
            claim.existingInvoiceId,
          );
        }
      }

      // 4. Allocate next invoice number (year derived from issue date)
      const year = new Date(invoice.issueDate + "T00:00:00Z").getFullYear();
      const invoiceNumber = await this.sequenceService.nextInvoiceNumber(
        tx,
        invoice.companyId,
        company.prefix,
        year,
      );

      // 5. Build ZATCA QR payload
      const now = this.clock.now();
      const qrPayload = buildQrPayload({
        sellerName: company.nameAr,
        vatNumber: company.vatNumber,
        timestampIso: now.toISOString(),
        invoiceTotal: invoice.total,
        vatTotal: invoice.vatAmount,
      });

      // 6. Mark issued
      const updated = await this.invoiceRepository.markIssued(
        invoice.id,
        {
          invoiceNumber,
          qrPayload,
          issuedAt: now.toISOString(),
        },
        tx,
      );

      // 7. Auto-create linked receipt voucher
      if (this.receiptVoucherRepository) {
        await this.receiptVoucherRepository.create(
          {
            companyId: invoice.companyId,
            customerId: invoice.customerId,
            invoiceId: invoice.id,
            voucherDate: invoice.issueDate,
            amount: invoice.total,
            paymentMethod: "other",
            reference: invoiceNumber,
            notes: `سند قبض للفاتورة رقم ${invoiceNumber}`,
          },
          tx,
        );
      }

      return toInvoiceDto(updated);
    });
  }
}
