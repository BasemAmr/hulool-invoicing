import { describe, expect, it } from "vitest";

import {
  assertCanTransitionTo,
  canTransitionTo,
  isDocumentStatus,
} from "@/domain/value-objects/document-status";
import { InvalidTransitionError } from "@/domain/errors";

describe("document-status — type guard", () => {
  it("recognises valid statuses", () => {
    expect(isDocumentStatus("draft")).toBe(true);
    expect(isDocumentStatus("issued")).toBe(true);
    expect(isDocumentStatus("cancelled")).toBe(true);
  });

  it("rejects invalid values", () => {
    expect(isDocumentStatus("paid")).toBe(false);
    expect(isDocumentStatus(123)).toBe(false);
    expect(isDocumentStatus(null)).toBe(false);
    expect(isDocumentStatus(undefined)).toBe(false);
  });
});

describe("document-status — canTransitionTo", () => {
  it("allows draft → issued", () => {
    expect(canTransitionTo("draft", "issued")).toBe(true);
  });

  it("allows draft → cancelled", () => {
    expect(canTransitionTo("draft", "cancelled")).toBe(true);
  });

  it("rejects issued → draft", () => {
    expect(canTransitionTo("issued", "draft")).toBe(false);
  });

  it("rejects issued → cancelled", () => {
    expect(canTransitionTo("issued", "cancelled")).toBe(false);
  });

  it("rejects cancelled → draft", () => {
    expect(canTransitionTo("cancelled", "draft")).toBe(false);
  });

  it("rejects cancelled → issued", () => {
    expect(canTransitionTo("cancelled", "issued")).toBe(false);
  });

  it("rejects draft → draft (no-op)", () => {
    expect(canTransitionTo("draft", "draft")).toBe(false);
  });
});

describe("document-status — assertCanTransitionTo", () => {
  it("does not throw for legal transitions", () => {
    expect(() => assertCanTransitionTo("draft", "issued")).not.toThrow();
    expect(() => assertCanTransitionTo("draft", "cancelled")).not.toThrow();
  });

  it("throws InvalidTransitionError for illegal transitions", () => {
    expect(() => assertCanTransitionTo("issued", "draft")).toThrow(
      InvalidTransitionError,
    );
    expect(() => assertCanTransitionTo("cancelled", "issued")).toThrow(
      InvalidTransitionError,
    );
  });
});
