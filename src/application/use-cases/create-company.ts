import type { Clock } from "../ports/clock";
import type { CompanyRepository } from "../ports/company-repository";
import { companyCreateSchema } from "@/domain/contracts";
import { ValidationError } from "@/domain/errors";

export interface CreateCompanyResult {
  id: string;
  prefix: string;
}

/**
 * Create a new company.
 * Validates input via the Zod contract, delegates persistence, returns
 * a minimal DTO `{ id, prefix }`.
 */
export class CreateCompany {
  constructor(
    private readonly companyRepository: CompanyRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: unknown): Promise<CreateCompanyResult> {
    const parsed = companyCreateSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }
    const data = parsed.data;
    const now = this.clock.now();
    const record = await this.companyRepository.create(
      {
        nameAr: data.nameAr,
        nameEn: data.nameEn ?? null,
        vatNumber: data.vatNumber,
        crNumber: data.crNumber ?? null,
        prefix: data.prefix,
        phone: data.phone ?? null,
        email: data.email ?? null,
        website: data.website ?? null,
        logoUrl: data.logoUrl ?? null,
        logoFileId: data.logoFileId ?? null,
        backgroundFileId: data.backgroundFileId ?? null,
        signatureFileId: data.signatureFileId ?? null,
        footerText: data.footerText ?? null,
        addressBuildingNumber: data.addressBuildingNumber ?? null,
        addressStreet: data.addressStreet ?? null,
        addressDistrict: data.addressDistrict ?? null,
        addressCity: data.addressCity ?? null,
        addressPostalCode: data.addressPostalCode ?? null,
        addressAdditionalNumber: data.addressAdditionalNumber ?? null,
      },
      now,
    );

    return { id: record.id, prefix: record.prefix };
  }
}
