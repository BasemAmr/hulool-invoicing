import { describe, it, expect } from "vitest";
import { getTemplateById, TEMPLATES_REGISTRY } from "./registry";
import { resolveTemplateName, applyTemplateNames } from "./template-names";

describe("Template Names Resolver & Kenan Template", () => {
  it("registers kenan_company with default name نموذج شركة كنان", () => {
    const kenan = getTemplateById("kenan_company");
    expect(kenan).toBeDefined();
    expect(kenan.id).toBe("kenan_company");
    expect(kenan.nameAr).toBe("نموذج شركة كنان");
    expect(kenan.nameEn).toBe("Kenan Company Template");
    expect(kenan.primaryColor).toBe("#064343");
  });

  it("resolves default template name when no overrides exist", () => {
    const kenan = getTemplateById("kenan_company");
    const resolved = resolveTemplateName(kenan, {});
    expect(resolved.nameAr).toBe("نموذج شركة كنان");
    expect(resolved.nameEn).toBe("Kenan Company Template");
    expect(resolved.isOverridden).toBe(false);
  });

  it("resolves custom overridden name when provided", () => {
    const kenan = getTemplateById("kenan_company");
    const overrides = {
      kenan_company: {
        ar: "فاتورة مؤسسة كنان المعتمدة",
        en: "Official Kenan Est. Tax Invoice",
      },
    };
    const resolved = resolveTemplateName(kenan, overrides);
    expect(resolved.nameAr).toBe("فاتورة مؤسسة كنان المعتمدة");
    expect(resolved.nameEn).toBe("Official Kenan Est. Tax Invoice");
    expect(resolved.isOverridden).toBe(true);
  });

  it("applies overrides across template lists", () => {
    const list = [getTemplateById("kenan_company"), getTemplateById("simple_red")];
    const overrides = {
      kenan_company: { ar: "كنان مخصص" },
    };
    const updated = applyTemplateNames(list, overrides);
    expect(updated[0]?.nameAr).toBe("كنان مخصص");
    expect(updated[1]?.nameAr).toBe("نموذج بسيط أحمر");
  });
});
