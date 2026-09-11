import type { InvoiceId } from "./branding";

/**
 * Domain error hierarchy.
 *
 * No string error codes — the class identity IS the discriminator.
 * Callers use `instanceof` to branch on error type.
 */

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export class InvalidTransitionError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTransitionError";
  }
}

export class SequenceError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = "SequenceError";
  }
}

export class IdempotencyReplayError extends DomainError {
  readonly existingInvoiceId: InvoiceId | null;
  constructor(message: string, existingInvoiceId: InvoiceId | null) {
    super(message);
    this.name = "IdempotencyReplayError";
    this.existingInvoiceId = existingInvoiceId;
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class ForbiddenError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

