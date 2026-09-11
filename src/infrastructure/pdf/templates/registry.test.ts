import { describe, it, expect } from "vitest";
import {
  TEMPLATES_REGISTRY,
  TEMPLATES_LIST,
  getTemplateById,
  DEFAULT_TEMPLATE,
} from "./registry";

describe("Templates Registry", () => {
  it("contains exactly 17 registered templates", () => {
    expect(Object.keys(TEMPLATES_REGISTRY)).toHaveLength(17);
    expect(TEMPLATES_LIST).toHaveLength(17);
  });

  it("contains all requested template IDs", () => {
    const expectedIds = [
      "simple_red",
      "simple_gray",
      "simple_clean",
      "modern_red",
      "classic",
      "pos_color",
      "bilingual_zatca",
      "modern_positive_red",
      "modern_sky_blue",
      "simple_blue",
      "simple_white",
      "simple_yellow",
      "modern_green",
      "pos_monochrome",
      "simple_black",
      "modern_orange",
      "modern_gray",
    ];

    for (const id of expectedIds) {
      expect(TEMPLATES_REGISTRY[id]).toBeDefined();
      expect(TEMPLATES_REGISTRY[id]?.id).toBe(id);
      expect(TEMPLATES_REGISTRY[id]?.nameAr).toBeDefined();
      expect(TEMPLATES_REGISTRY[id]?.primaryColor).toBeDefined();
    }
  });

  it("resolves default template for missing or unknown ID", () => {
    expect(getTemplateById(null)).toEqual(DEFAULT_TEMPLATE);
    expect(getTemplateById(undefined)).toEqual(DEFAULT_TEMPLATE);
    expect(getTemplateById("unknown_template")).toEqual(DEFAULT_TEMPLATE);
    expect(getTemplateById("simple_red").id).toBe("simple_red");
    expect(getTemplateById("modern_sky_blue").id).toBe("modern_sky_blue");
  });
});
