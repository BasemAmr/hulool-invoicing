import { describe, expect, it } from "vitest";

import { invoiceCreateSchema } from "@/domain/contracts";
import {
  DEFAULT_ISSUE_TIME,
  invoiceDateTimeToUtcIso,
  isValidIssueTime,
  normalizeIssueTime,
} from "@/domain/services/invoice-datetime";

const FALLBACK_NOW = new Date("2026-01-01T00:00:00.000Z");

describe("invoice-datetime — Riyadh wall-time → UTC instant", () => {
  it("converts a picked 14:30 Riyadh wall-time to 11:30Z (fixed UTC+3, DST-free)", () => {
    expect(
      invoiceDateTimeToUtcIso("2026-09-15", "14:30", FALLBACK_NOW),
    ).toBe("2026-09-15T11:30:00.000Z");
  });

  it("midnight wall-time maps to the previous day 21:00Z", () => {
    expect(invoiceDateTimeToUtcIso("2026-09-15", "00:00", FALLBACK_NOW)).toBe(
      "2026-09-14T21:00:00.000Z",
    );
  });

  it("late-evening wall-time stays on the same UTC day", () => {
    expect(invoiceDateTimeToUtcIso("2026-09-15", "23:59", FALLBACK_NOW)).toBe(
      "2026-09-15T20:59:00.000Z",
    );
  });

  it("missing/unparseable time falls back to midnight (legacy rows), never throws", () => {
    expect(invoiceDateTimeToUtcIso("2026-09-15", undefined, FALLBACK_NOW)).toBe(
      "2026-09-14T21:00:00.000Z",
    );
    expect(invoiceDateTimeToUtcIso("2026-09-15", "garbage", FALLBACK_NOW)).toBe(
      "2026-09-14T21:00:00.000Z",
    );
  });

  it("corrupt date falls back to server-now (corrupt-data guard, not the normal path)", () => {
    expect(invoiceDateTimeToUtcIso("not-a-date", "14:30", FALLBACK_NOW)).toBe(
      FALLBACK_NOW.toISOString(),
    );
  });

  it("always emits a valid ISO instant (parseable, UTC)", () => {
    const iso = invoiceDateTimeToUtcIso("2026-09-15", "14:30", FALLBACK_NOW);
    expect(iso.endsWith("Z")).toBe(true);
    expect(Number.isNaN(new Date(iso).getTime())).toBe(false);
  });
});

describe("invoice-datetime — HH:MM validation", () => {
  it.each(["00:00", "09:05", "14:30", "23:59"])(
    "accepts %s",
    (t) => {
      expect(isValidIssueTime(t)).toBe(true);
      expect(normalizeIssueTime(t)).toBe(t);
    },
  );

  it.each(["24:00", "25:00", "9:5", "9:05", "14:60", "", "noon", null, undefined, 1430])(
    "rejects %s",
    (t) => {
      expect(isValidIssueTime(t)).toBe(false);
      // Rejection normalizes to the midnight default with a comment-worthy why:
      // legacy/corrupt rows must still yield a valid QR.
      expect(normalizeIssueTime(t)).toBe(DEFAULT_ISSUE_TIME);
    },
  );
});

describe("invoice contracts — issueTime", () => {
  const base = {
    companyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    customerId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    issueDate: "2026-09-15",
    items: [
      {
        description: "بند",
        quantity: 1,
        unitPrice: "10.00",
        discountAmount: 0,
        vatRate: 0.15,
      },
    ],
  };

  it("accepts a valid HH:MM issueTime", () => {
    expect(
      invoiceCreateSchema.safeParse({ ...base, issueTime: "14:30" }).success,
    ).toBe(true);
  });

  it("accepts a missing issueTime (legacy callers → midnight default in the use case)", () => {
    const parsed = invoiceCreateSchema.safeParse(base);
    expect(parsed.success).toBe(true);
  });

  it.each(["25:00", "9:5", "noon"])("rejects issueTime %s", (issueTime) => {
    const parsed = invoiceCreateSchema.safeParse({ ...base, issueTime });
    expect(parsed.success).toBe(false);
  });

  it("keeps issueDate on strict YYYY-MM-DD and dueDate date-only", () => {
    expect(
      invoiceCreateSchema.safeParse({ ...base, issueDate: "15-09-2026" })
        .success,
    ).toBe(false);
    expect(
      invoiceCreateSchema.safeParse({ ...base, dueDate: "14:30" }).success,
    ).toBe(false);
  });
});
