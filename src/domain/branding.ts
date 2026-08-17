/**
 * Branded nominal types for the domain layer.
 *
 * Effective TypeScript Item 40: push type constraints to the boundary.
 * These branded types prevent accidentally mixing a raw string/number with
 * a semantically distinct identifier. The `as` assertions live ONLY in these
 * boundary helpers — nowhere else in the codebase may use `as`.
 */

export type Brand<T, B extends string> = T & { readonly __brand: B };

export type CompanyId = Brand<string, "CompanyId">;
export type CustomerId = Brand<string, "CustomerId">;
export type InvoiceId = Brand<string, "InvoiceId">;
export type Halalas = Brand<number, "Halalas">;

export function asCompanyId(value: string): CompanyId {
  return value as CompanyId;
}

export function asCustomerId(value: string): CustomerId {
  return value as CustomerId;
}

export function asInvoiceId(value: string): InvoiceId {
  return value as InvoiceId;
}
