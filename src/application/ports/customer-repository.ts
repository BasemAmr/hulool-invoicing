import type { CustomerId } from "@/domain/branding";

export interface CustomerRecord {
  id: CustomerId;
  nameAr: string;
  nameEn: string | null;
  vatNumber: string | null;
  unifiedNumber: string | null;
  phone: string | null;
  email: string | null;
  addressCity: string | null;
  addressStreet: string | null;
  addressPostalCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerRepository {
  create(
    input: {
      nameAr: string;
      nameEn: string | null;
      vatNumber: string | null;
      unifiedNumber?: string | null;
      phone: string | null;
      email: string | null;
      addressCity: string | null;
      addressStreet: string | null;
      addressPostalCode?: string | null;
    },
    now: Date,
  ): Promise<CustomerRecord>;
  update(
    id: CustomerId,
    input: {
      nameAr: string;
      nameEn: string | null;
      vatNumber: string | null;
      unifiedNumber?: string | null;
      phone: string | null;
      email: string | null;
      addressCity: string | null;
      addressStreet: string | null;
      addressPostalCode?: string | null;
    },
    now: Date,
  ): Promise<CustomerRecord>;
  delete(id: CustomerId): Promise<void>;
  countInvoices(id: CustomerId): Promise<number>;
  findById(id: CustomerId): Promise<CustomerRecord | null>;
  list(search: string | null, limit: number, offset: number): Promise<CustomerRecord[]>;
}

export type { CustomerId };
