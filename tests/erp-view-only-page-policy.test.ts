import { describe, expect, it } from "vitest";
import { FEATURE_KEYS, insertUserCompanyRoleSchema } from "../shared/schema";
import { effectiveErpPageKeys } from "../server/services/security/erpViewerPagePolicy";

describe("ERP View Only company-role page access", () => {
  it("uses the existing company role without an additional database role", () => {
    expect(insertUserCompanyRoleSchema.shape.role.safeParse("View Only").success).toBe(true);
  });

  it("grants ERP data pages but not Settings or Create when no allow-list was configured", () => {
    const pages = effectiveErpPageKeys("View Only", []);
    expect(pages).toEqual([...FEATURE_KEYS].filter((key) => key !== "settings" && key !== "create"));
    expect(pages).toContain("accounts");
    expect(pages).toContain("daybook");
    expect(pages).not.toContain("settings");
    expect(pages).not.toContain("create");
  });

  it("respects explicit View Only page restrictions", () => {
    expect(effectiveErpPageKeys("View Only", ["accounts"])).toEqual(["accounts"]);
  });

  it("does not change page access defaults for other roles", () => {
    expect(effectiveErpPageKeys("Manager", [])).toEqual([]);
    expect(effectiveErpPageKeys("Normal User", ["vouchers"])).toEqual(["vouchers"]);
  });
});
