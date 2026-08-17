import type { Clock } from "../ports/clock";
import type { CustomerRepository } from "../ports/customer-repository";
import { customerCreateSchema } from "@/domain/contracts";
import { ValidationError } from "@/domain/errors";

export interface CreateCustomerResult {
  id: string;
}

/**
 * Create a new customer in the bureau-wide customer book.
 */
export class CreateCustomer {
  constructor(
    private readonly customerRepository: CustomerRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: unknown): Promise<CreateCustomerResult> {
    const parsed = customerCreateSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }
    const data = parsed.data;
    const now = this.clock.now();
    const record = await this.customerRepository.create(
      {
        nameAr: data.nameAr,
        nameEn: data.nameEn ?? null,
        vatNumber: data.vatNumber ?? null,
        phone: data.phone ?? null,
        email: data.email ?? null,
        addressCity: data.addressCity ?? null,
        addressStreet: data.addressStreet ?? null,
      },
      now,
    );
    return { id: record.id };
  }
}
