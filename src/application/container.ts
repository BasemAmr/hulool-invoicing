import type { Database } from "@/infrastructure/database";
import { IdempotencyStoreImpl } from "@/infrastructure/database/repositories/idempotency-store";
import { CompanyRepositoryImpl } from "@/infrastructure/database/repositories/company-repository";
import { CustomerRepositoryImpl } from "@/infrastructure/database/repositories/customer-repository";
import { InvoiceRepositoryImpl } from "@/infrastructure/database/repositories/invoice-repository";
import { PostgresSequenceService } from "@/infrastructure/database/repositories/postgres-sequence-service";
import { SystemClock } from "@/infrastructure/system-clock";
import type { Clock } from "./ports/clock";
import type { CompanyRepository } from "./ports/company-repository";
import type { CustomerRepository } from "./ports/customer-repository";
import type { IdempotencyStore } from "./ports/idempotency-store";
import type { InvoiceRepository } from "./ports/invoice-repository";
import type { SequencePort } from "./ports/sequence-port";

export interface AppContainer {
  companyRepository: CompanyRepository;
  customerRepository: CustomerRepository;
  invoiceRepository: InvoiceRepository;
  sequenceService: SequencePort;
  clock: Clock;
  idempotencyStore: IdempotencyStore;
  db: Database;
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
    sequenceService: new PostgresSequenceService(),
    clock: new SystemClock(),
    idempotencyStore: new IdempotencyStoreImpl(),
    db,
  };
}
