import type { Database } from "@/infrastructure/database";
import { IdempotencyStoreImpl } from "@/infrastructure/database/repositories/idempotency-store";
import { CompanyRepositoryImpl } from "@/infrastructure/database/repositories/company-repository";
import { CustomerRepositoryImpl } from "@/infrastructure/database/repositories/customer-repository";
import { InvoiceRepositoryImpl } from "@/infrastructure/database/repositories/invoice-repository";
import { PostgresSequenceService } from "@/infrastructure/database/repositories/postgres-sequence-service";
import { SystemClock } from "@/infrastructure/system-clock";
import { ReactPdfRenderer } from "@/infrastructure/pdf/react-pdf-renderer";
import type { Clock } from "./ports/clock";
import type { CompanyRepository } from "./ports/company-repository";
import type { CustomerRepository } from "./ports/customer-repository";
import type { IdempotencyStore } from "./ports/idempotency-store";
import type { InvoiceRepository } from "./ports/invoice-repository";
import type { SequencePort } from "./ports/sequence-port";
import type { PdfRenderer } from "./ports/pdf-renderer";
import type { FileRepository } from "./ports/file-repository";
import { FileRepositoryImpl } from "@/infrastructure/database/repositories/file-repository";
import type { UserRepository } from "./ports/user-repository";
import { UserRepositoryImpl } from "@/infrastructure/database/repositories/user-repository";
import type { SessionRepository } from "./ports/session-repository";
import { SessionRepositoryImpl } from "@/infrastructure/database/repositories/session-repository";
import type { PasswordHasher } from "./ports/password-hasher";
import { ScryptPasswordHasher } from "@/infrastructure/security/password-hasher";
import type { UrlSigner } from "./ports/url-signer";
import { HmacUrlSigner } from "@/infrastructure/security/url-signer";

import type { SavedProductRepository } from "./ports/saved-product-repository";
import { SavedProductRepositoryImpl } from "@/infrastructure/database/repositories/saved-product-repository";
import type { CompanySettingsRepository } from "./ports/company-settings-repository";
import { CompanySettingsRepositoryImpl } from "@/infrastructure/database/repositories/company-settings-repository";
import type { ReceiptVoucherRepository } from "./ports/receipt-voucher-repository";
import { ReceiptVoucherRepositoryImpl } from "@/infrastructure/database/repositories/receipt-voucher-repository";

export interface AppContainer {
  companyRepository: CompanyRepository;
  customerRepository: CustomerRepository;
  invoiceRepository: InvoiceRepository;
  savedProductRepository: SavedProductRepository;
  companySettingsRepository: CompanySettingsRepository;
  receiptVoucherRepository: ReceiptVoucherRepository;
  sequenceService: SequencePort;
  clock: Clock;
  idempotencyStore: IdempotencyStore;
  db: Database;
  pdfRenderer: PdfRenderer;
  fileRepository: FileRepository;
  userRepository: UserRepository;
  sessionRepository: SessionRepository;
  passwordHasher: PasswordHasher;
  urlSigner: UrlSigner;
}

/**
 * Wire infrastructure implementations to application ports.
 * Called once at application startup (or per-request in serverless contexts).
 */
export function createContainer(db: Database): AppContainer {
  return {
    companyRepository: new CompanyRepositoryImpl(db),
    customerRepository: new CustomerRepositoryImpl(db),
    invoiceRepository: new InvoiceRepositoryImpl(db),
    savedProductRepository: new SavedProductRepositoryImpl(db),
    companySettingsRepository: new CompanySettingsRepositoryImpl(db),
    receiptVoucherRepository: new ReceiptVoucherRepositoryImpl(db),
    sequenceService: new PostgresSequenceService(),
    clock: new SystemClock(),
    idempotencyStore: new IdempotencyStoreImpl(),
    db,
    pdfRenderer: new ReactPdfRenderer(),
    fileRepository: new FileRepositoryImpl(db),
    userRepository: new UserRepositoryImpl(db),
    sessionRepository: new SessionRepositoryImpl(db),
    passwordHasher: new ScryptPasswordHasher(),
    urlSigner: new HmacUrlSigner(),
  };
}

