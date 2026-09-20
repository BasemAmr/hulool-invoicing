import type { Clock } from "../ports/clock";
import type { CompanyRepository } from "../ports/company-repository";
import { companyUpdateSchema } from "@/domain/contracts";
import { asCompanyId } from "@/domain/branding";
import { ValidationError } from "@/domain/errors";

export interface UpdateCompanyResult {
  id: string;
  prefix: string;
}

export class UpdateCompany {
  constructor(
    private readonly companyRepository: CompanyRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: unknown): Promise<UpdateCompanyResult> {
    const parsed = companyUpdateSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message);
    }
    const data = parsed.data;
    const now = this.clock.now();
    const record = await this.companyRepository.update(
      asCompanyId(data.id),
      {
        nameAr: data.nameAr,
        nameEn: data.nameEn ?? null,
        vatNumber: data.vatNumber,
        crNumber: data.crNumber ?? null,
        prefix: data.prefix,
        clientEmployee: data.clientEmployee ?? null,
        organizationType: data.organizationType ?? null,
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
