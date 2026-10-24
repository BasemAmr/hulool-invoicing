import { describe, expect, it, vi } from "vitest";
import { DeleteCompany } from "./delete-company";
import { asCompanyId } from "@/domain/branding";
import { DomainError, NotFoundError } from "@/domain/errors";
import type { CompanyRepository, CompanyRecord } from "../ports/company-repository";

describe("DeleteCompany", () => {
  const dummyCompany: CompanyRecord = {
    id: asCompanyId("00000000-0000-0000-0000-000000000001"),
    nameAr: "شركة الهدى",
    nameEn: null,
    vatNumber: "300000000000003",
    crNumber: null,
    prefix: "HOD",
    clientEmployee: null,
    organizationType: null,
    phone: null,
    email: null,
    website: null,
    logoUrl: null,
    logoFileId: null,
    backgroundFileId: null,
    signatureFileId: null,
    footerText: null,
    templateConfig: null,
    addressBuildingNumber: null,
    addressStreet: null,
    addressDistrict: null,
    addressCity: null,
    addressPostalCode: null,
    addressAdditionalNumber: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it("throws NotFoundError when company does not exist", async () => {
    const repo: CompanyRepository = {
      findById: vi.fn().mockResolvedValue(null),
      countInvoices: vi.fn().mockResolvedValue(0),
      countReceiptVouchers: vi.fn().mockResolvedValue(0),
      delete: vi.fn().mockResolvedValue(undefined),
      create: vi.fn(),
      update: vi.fn(),
      list: vi.fn(),
    };

    const useCase = new DeleteCompany(repo);
    await expect(useCase.execute({ id: dummyCompany.id })).rejects.toThrow(NotFoundError);
  });

  it("throws DomainError when invoices exist", async () => {
    const repo: CompanyRepository = {
      findById: vi.fn().mockResolvedValue(dummyCompany),
      countInvoices: vi.fn().mockResolvedValue(3),
      countReceiptVouchers: vi.fn().mockResolvedValue(0),
      delete: vi.fn().mockResolvedValue(undefined),
      create: vi.fn(),
      update: vi.fn(),
      list: vi.fn(),
    };

    const useCase = new DeleteCompany(repo);
    await expect(useCase.execute({ id: dummyCompany.id })).rejects.toThrow(DomainError);
    await expect(useCase.execute({ id: dummyCompany.id })).rejects.toThrow(
      "لا يمكن حذف المنشأة «شركة الهدى» لوجود 3 فاتورة مرتبطة بها.",
    );
  });

  it("throws DomainError when receipt vouchers exist", async () => {
    const repo: CompanyRepository = {
      findById: vi.fn().mockResolvedValue(dummyCompany),
      countInvoices: vi.fn().mockResolvedValue(0),
      countReceiptVouchers: vi.fn().mockResolvedValue(2),
      delete: vi.fn().mockResolvedValue(undefined),
      create: vi.fn(),
      update: vi.fn(),
      list: vi.fn(),
    };

    const useCase = new DeleteCompany(repo);
    await expect(useCase.execute({ id: dummyCompany.id })).rejects.toThrow(DomainError);
    await expect(useCase.execute({ id: dummyCompany.id })).rejects.toThrow(
      "لا يمكن حذف المنشأة «شركة الهدى» لوجود 2 سند قبض مرتبط بها.",
    );
  });

  it("deletes successfully when company has no invoices or receipt vouchers", async () => {
    const repo: CompanyRepository = {
      findById: vi.fn().mockResolvedValue(dummyCompany),
      countInvoices: vi.fn().mockResolvedValue(0),
      countReceiptVouchers: vi.fn().mockResolvedValue(0),
      delete: vi.fn().mockResolvedValue(undefined),
      create: vi.fn(),
      update: vi.fn(),
      list: vi.fn(),
    };

    const useCase = new DeleteCompany(repo);
    await useCase.execute({ id: dummyCompany.id });
    expect(repo.delete).toHaveBeenCalledWith(dummyCompany.id);
  });
});
