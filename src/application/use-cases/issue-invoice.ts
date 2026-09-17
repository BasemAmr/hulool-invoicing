import { asInvoiceId } from "@/domain/branding";
import {
  IdempotencyReplayError,
  InvalidTransitionError,
  NotFoundError,
  ValidationError,
} from "@/domain/errors";
import { buildQrPayload } from "@/domain/services/zatca-qr-service";
import {
  applyQrTimestampJitter,
  invoiceDateTimeToUtcIso,
} from "@/domain/services/invoice-datetime";
import {
  DUPLICATE_INVOICE_NUMBER_MESSAGE,
  INVOICE_NUMBER_TOO_LONG_MESSAGE,
  MAX_CUSTOM_INVOICE_NUMBER_LENGTH,
  extractSequenceForCatchUp,
  isInvoiceNumberUniqueViolation,
} from "@/domain/value-objects/invoice-number";
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
  /**
   * User-typed number from the editable wizard field. Undefined/blank falls
   * back to atomic auto-allocation (today's behavior, byte-identical).
   * Never trusted beyond the requested string: re-validated below.
   */
  customInvoiceNumber?: string;
}

/**
 * Issue a draft invoice — the core transactional use case.
 *
 * Runs ONE transaction that:
 *   1. Loads the draft invoice (must be status 'draft').
 *   2. Loads the company (for seller name + VAT number + prefix).
 *   3. Claims the idempotency key if provided (replay → error).
 *   4. Resolves the invoice number: user custom value (validated +
 *      same-company uniqueness pre-check + sentinel catch-up) or atomic
 *      auto-allocation when blank.
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

      // 4. Resolve the invoice number: custom (user-edited) or auto.
      // Blank custom input falls through to auto-allocation — this keeps the
      // "leave the suggestion as-is / clear the field on create" path
      // byte-for-byte identical to today's behavior.
      const customTrimmed =
        typeof input.customInvoiceNumber === "string"
          ? input.customInvoiceNumber.trim()
          : "";
      let invoiceNumber: string;
      if (customTrimmed.length > 0) {
        if (customTrimmed.length > MAX_CUSTOM_INVOICE_NUMBER_LENGTH) {
          throw new ValidationError(INVOICE_NUMBER_TOO_LONG_MESSAGE);
        }
        // Friendly pre-check, same-company scope only (findByNumber predicates
        // on companyId, so cross-company reuse never clashes here). Excludes
        // the row being issued itself: a draft edited to a custom number
        // already carries it from the preceding updateDraft in the edit flow.
        // This is the user-facing path; the unique constraint is the race
        // backstop around markIssued below.
        const clash = await this.invoiceRepository.findByNumber(
          invoice.companyId,
          customTrimmed,
          tx,
        );
        if (clash && String(clash.id) !== String(invoice.id)) {
          throw new ValidationError(DUPLICATE_INVOICE_NUMBER_MESSAGE);
        }
        // Counter catch-up: a custom `PREFIX-nnnnn` above the sentinel would
        // otherwise be re-issued later by auto-allocation and collide. Non
        // pattern input skips this (still uniqueness-enforced above).
        const catchUpSeq = extractSequenceForCatchUp(
          customTrimmed,
          company.prefix,
        );
        if (catchUpSeq !== null) {
          await this.sequenceService.ensureSequenceAtLeast(
            tx,
            invoice.companyId,
            catchUpSeq,
          );
        }
        invoiceNumber = customTrimmed;
      } else {
        // 4a. Allocate next invoice number (year derived from issue date)
        const year = new Date(invoice.issueDate + "T00:00:00Z").getFullYear();
        invoiceNumber = await this.sequenceService.nextInvoiceNumber(
          tx,
          invoice.companyId,
          company.prefix,
          year,
        );
      }

      // 5. Build ZATCA QR payload
      // Base instant is the INVOICE's own datetime (date + Riyadh wall-time
      // → UTC instant), never server-now. `issuedAt` below stays the system
      // issuance moment — a different concept. now() survives only as the
      // corrupt-data fallback inside invoiceDateTimeToUtcIso, not the normal
      // path.
      //
      // CLIENT REQUEST (2026-09-17): Tag 3 does NOT embed the base instant
      // verbatim. Per client instruction the QR carries a randomized time:
      // base instant ± a random 180–560 minutes (see applyQrTimestampJitter).
      // Stored issueDate/issueTime, the printed PDF, and issuedAt keep the
      // true datetime — ONLY the QR payload is jittered. This deviates from
      // the ZATCA spec; remove the jitter line to restore compliance.
      const now = this.clock.now();
      const baseTimestampIso = invoiceDateTimeToUtcIso(
        invoice.issueDate,
        invoice.issueTime ?? "00:00",
        now,
      );
      const timestampIso = applyQrTimestampJitter(baseTimestampIso);
      const qrPayload = buildQrPayload({
        sellerName: company.nameAr,
        vatNumber: company.vatNumber,
        timestampIso,
        invoiceTotal: invoice.total,
        vatTotal: invoice.vatAmount,
      });

      // 6. Mark issued (constraint backstop: two concurrent issues with the
      // same custom number both pass the pre-check above; the loser's UPDATE
      // hits unique(company_id, invoice_number) and must surface the friendly
      // message — never a 500. Throwing here rolls back the whole tx:
      // sequence bump, idempotency claim, and number assignment included.
      let updated;
      try {
        updated = await this.invoiceRepository.markIssued(
          invoice.id,
          {
            invoiceNumber,
            qrPayload,
            issuedAt: now.toISOString(),
          },
          tx,
        );
      } catch (err) {
        // Deliberate mapping: only the invoice-number unique violation is
        // translated; every other DB failure rethrows untouched so real
        // outages stay loud instead of masquerading as a duplicate number.
        if (isInvoiceNumberUniqueViolation(err)) {
          throw new ValidationError(DUPLICATE_INVOICE_NUMBER_MESSAGE);
        }
        throw err;
      }

      // 7. Auto-create linked receipt voucher
      if (this.receiptVoucherRepository) {
        await this.receiptVoucherRepository.create(
          {
            companyId: invoice.companyId,
            customerId: invoice.customerId,
            invoiceId: invoice.id,
            // Receipt vouchers stay date-only: feed the date part, not the time.
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
