import { describe, it, expect } from "vitest";
import {
  TEMPLATES_REGISTRY,
  TEMPLATES_LIST,
  getTemplateById,
  DEFAULT_TEMPLATE,
} from "./registry";

describe("Templates Registry", () => {
  it("contains registered templates (17 system default + company chosen)", () => {
    expect(Object.keys(TEMPLATES_REGISTRY)).toHaveLength(39);
    expect(TEMPLATES_LIST).toHaveLength(39);
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
      "contracting_advance",
      "sahm_coral",
      "mahala_pos",
      "structured_bilingual",
      "kuwait_landmarks",
      "shami_trading",
      "bawazeer_plastics",
      "joy_purchase_invoice",
      "joy_sales_invoice",
      "shawager_investment",
      "madina_plastics",
      "coffee_ideas",
      "matajer_al_saif",
      "manahir_pos",
      "hasaniah_foam",
      "top_town",
      "masdar_materials_terms",
      "masdar_materials_no_terms",
      "aldail_ceramics",
      "bazrea_plastics",
      "sa_alkoufi",
      "generic_delivery_21",
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
