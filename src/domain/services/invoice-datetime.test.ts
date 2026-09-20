import { describe, expect, it } from "vitest";

import { invoiceCreateSchema } from "@/domain/contracts";
import {
  applyQrTimestampJitter,
  DEFAULT_ISSUE_TIME,
  invoiceDateTimeToUtcIso,
  isValidIssueTime,
  normalizeIssueTime,
  QR_TIMESTAMP_JITTER_MAX_MINUTES,
  QR_TIMESTAMP_JITTER_MIN_MINUTES,
} from "@/domain/services/invoice-datetime";

const FALLBACK_NOW = new Date("2026-01-01T00:00:00.000Z");

describe("invoice-datetime — Riyadh wall-time → UTC instant", () => {
  it("converts a picked 14:30 Riyadh wall-time to 11:30Z (fixed UTC+3, DST-free)", () => {
    expect(
      invoiceDateTimeToUtcIso("2026-09-15", "14:30", FALLBACK_NOW),
    ).toBe("2026-09-15T11:30:00Z");
  });

  it("midnight wall-time maps to the previous day 21:00Z", () => {
    expect(invoiceDateTimeToUtcIso("2026-09-15", "00:00", FALLBACK_NOW)).toBe(
      "2026-09-14T21:00:00Z",
    );
  });

  it("late-evening wall-time stays on the same UTC day", () => {
    expect(invoiceDateTimeToUtcIso("2026-09-15", "23:59", FALLBACK_NOW)).toBe(
      "2026-09-15T20:59:00Z",
    );
  });

  it("missing/unparseable time falls back to midnight (legacy rows), never throws", () => {
    expect(invoiceDateTimeToUtcIso("2026-09-15", undefined, FALLBACK_NOW)).toBe(
      "2026-09-14T21:00:00Z",
    );
    expect(invoiceDateTimeToUtcIso("2026-09-15", "garbage", FALLBACK_NOW)).toBe(
      "2026-09-14T21:00:00Z",
    );
  });

  it("corrupt date falls back to server-now (corrupt-data guard, not the normal path)", () => {
    expect(invoiceDateTimeToUtcIso("not-a-date", "14:30", FALLBACK_NOW)).toBe(
      FALLBACK_NOW.toISOString().replace(/\.\d+Z$/, "Z"),
    );
  });

  it("always emits a valid ISO instant (parseable, UTC)", () => {
    const iso = invoiceDateTimeToUtcIso("2026-09-15", "14:30", FALLBACK_NOW);
    expect(iso.endsWith("Z")).toBe(true);
    expect(Number.isNaN(new Date(iso).getTime())).toBe(false);
  });
});

describe("invoice-datetime — CLIENT REQUEST QR timestamp jitter (180–560 min ±)", () => {
  const BASE = "2026-09-15T11:30:00.000Z";
  const BASE_MS = new Date(BASE).getTime();

  it("subtracts the minimum (180 min) with stubbed randoms", () => {
    // First draw → magnitude floor (0 → 180), second draw → sign (0 → subtract).
    const seq = [0, 0];
    const out = applyQrTimestampJitter(BASE, () => seq.shift() ?? 0);
    expect(out).toBe(new Date(BASE_MS - 180 * 60_000).toISOString());
  });

  it("adds the maximum (560 min) with stubbed randoms", () => {
    // First draw → magnitude ceiling (~1 → 560), second draw → sign (~1 → add).
    const seq = [0.999999, 0.999999];
    const out = applyQrTimestampJitter(BASE, () => seq.shift() ?? 0.999999);
    expect(out).toBe(new Date(BASE_MS + 560 * 60_000).toISOString());
  });

  it("stays within [180, 560] minutes of drift over many random draws", () => {
    for (let i = 0; i < 200; i++) {
      const out = applyQrTimestampJitter(BASE);
      const driftMin =
        Math.abs(new Date(out).getTime() - BASE_MS) / 60_000;
      expect(driftMin).toBeGreaterThanOrEqual(
        QR_TIMESTAMP_JITTER_MIN_MINUTES,
      );
      expect(driftMin).toBeLessThanOrEqual(
        QR_TIMESTAMP_JITTER_MAX_MINUTES,
      );
      // Whole-minute offsets keep seconds at :00, matching Tag 3 precision.
      expect(new Date(out).getUTCSeconds()).toBe(0);
    }
  });

  it("rolls the date correctly when the offset crosses midnight", () => {
    // 00:30Z minus 560 min → previous day 15:10Z.
    const seq = [0.999999, 0];
    const out = applyQrTimestampJitter(
      "2026-09-15T00:30:00.000Z",
      () => seq.shift() ?? 0,
    );
    expect(out).toBe("2026-09-14T15:10:00.000Z");
  });

  it("passes corrupt input through so normalizeQrTimestamp still throws loudly", () => {
    expect(applyQrTimestampJitter("not-a-date")).toBe("not-a-date");
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
