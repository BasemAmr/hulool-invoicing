import type { Clock } from "../ports/clock";
import type { CustomerRepository } from "../ports/customer-repository";
import { customerUpdateSchema } from "@/domain/contracts";
import { asCustomerId } from "@/domain/branding";
import { ValidationError } from "@/domain/errors";

export interface UpdateCustomerResult {
  id: string;
}

export class UpdateCustomer {
  constructor(
    private readonly customerRepository: CustomerRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: unknown): Promise<UpdateCustomerResult> {
    const parsed = customerUpdateSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }
    const data = parsed.data;
    const now = this.clock.now();
    const record = await this.customerRepository.update(
      asCustomerId(data.id),
      {
        nameAr: data.nameAr,
        nameEn: data.nameEn ?? null,
        vatNumber: data.vatNumber ?? null,
        unifiedNumber: data.unifiedNumber ?? null,
        phone: data.phone ?? null,
        email: data.email ?? null,
        addressCity: data.addressCity ?? null,
        addressDistrict: data.addressDistrict ?? null,
        addressStreet: data.addressStreet ?? null,
        addressBuildingNumber: data.addressBuildingNumber ?? null,
        addressPostalCode: data.addressPostalCode ?? null,
        addressAdditionalNumber: data.addressAdditionalNumber ?? null,
      },
      now,
    );
    return { id: record.id };
  }
}
