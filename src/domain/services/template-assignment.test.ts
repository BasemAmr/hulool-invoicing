import { describe, it, expect } from "vitest";
import { getNextAvailableTemplateId } from "./template-assignment";
import { TEMPLATES_LIST } from "@/infrastructure/pdf/templates/registry";

describe("getNextAvailableTemplateId", () => {
  it("assigns template 1 (first template) when no companies have templates", async () => {
    const fakeDb = {
      select: (fields: any) => ({
        from: (table: any) => {
          return Promise.resolve([]);
        },
      }),
      selectDistinct: (fields: any) => ({
        from: (table: any) => {
          return Promise.resolve([]);
        },
      }),
    } as any;

    const templateId = await getNextAvailableTemplateId(fakeDb);
    expect(templateId).toBe(TEMPLATES_LIST[0]!.id);
  });

  it("assigns template 5 when templates 1, 2, 3, 4 are used by 4 companies", async () => {
    const used = [
      TEMPLATES_LIST[0]!.id,
      TEMPLATES_LIST[1]!.id,
      TEMPLATES_LIST[2]!.id,
      TEMPLATES_LIST[3]!.id,
    ];

    const fakeDb = {
      select: () => ({
        from: () => Promise.resolve(used.map((templateId) => ({ templateId }))),
      }),
      selectDistinct: () => ({
        from: () => Promise.resolve([]),
      }),
    } as any;

    const templateId = await getNextAvailableTemplateId(fakeDb);
    expect(templateId).toBe(TEMPLATES_LIST[4]!.id);
  });

  it("handles 30 companies with non-sequential templates and finds the next unused in sequence", async () => {
    // Suppose existing 30 companies used templates at indices: 1, 3, 5, 7, 9 ... 57
    const usedIndices = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37, 39, 41, 43, 45, 47, 49, 51, 53, 55, 57];
    const usedTemplates = usedIndices.map((idx) => TEMPLATES_LIST[idx]!.id);

    const fakeDb = {
      select: () => ({
        from: () => Promise.resolve(usedTemplates.map((templateId) => ({ templateId }))),
      }),
      selectDistinct: () => ({
        from: () => Promise.resolve([]),
      }),
    } as any;

    // Index 0 was not used, so it must return TEMPLATES_LIST[0]
    const templateId = await getNextAvailableTemplateId(fakeDb);
    expect(templateId).toBe(TEMPLATES_LIST[0]!.id);
  });

  it("gracefully cycles when all templates in TEMPLATES_LIST are exhausted", async () => {
    const allUsed = TEMPLATES_LIST.map((t) => ({ templateId: t.id }));

    const fakeDb = {
      select: (fields: any) => ({
        from: (table: any) => {
          // If querying companies table for total count
          return Promise.resolve(new Array(60).fill({ id: "comp-id" }));
        },
      }),
      selectDistinct: () => ({
        from: () => Promise.resolve(allUsed),
      }),
    } as any;

    const templateId = await getNextAvailableTemplateId(fakeDb);
    const expectedCycleIndex = 60 % TEMPLATES_LIST.length;
    expect(templateId).toBe(TEMPLATES_LIST[expectedCycleIndex]!.id);
  });
});
