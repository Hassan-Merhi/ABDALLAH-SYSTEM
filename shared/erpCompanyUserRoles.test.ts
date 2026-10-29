import { describe, expect, it } from "vitest";
import { canChangeCompanyUserRole, ERP_COMPANY_USER_ROLES, isErpCompanyUserRole } from "./erpCompanyUserRoles";

describe("ERP company user roles", () => {
  it("excludes Developer and non-ERP POS roles from company admin selection", () => {
    expect(ERP_COMPANY_USER_ROLES).toContain("Admin");
    expect(ERP_COMPANY_USER_ROLES).toContain("Manager");
    expect(isErpCompanyUserRole("View Only")).toBe(true);
    expect(isErpCompanyUserRole("Developer")).toBe(false);
    expect(isErpCompanyUserRole("POS")).toBe(false);
    expect(isErpCompanyUserRole("invalid")).toBe(false);
  });

  it("only permits edits to another user within the active company", () => {
    expect(canChangeCompanyUserRole("admin", "staff", 7, 7, ["Manager"])).toBe(true);
    expect(canChangeCompanyUserRole("admin", "staff", 7, 8, ["Manager"])).toBe(false);
    expect(canChangeCompanyUserRole("admin", "admin", 7, 7, ["Admin"])).toBe(false);
    expect(canChangeCompanyUserRole("admin", "staff", 7, 7, ["Normal User", "Developer"])).toBe(false);
  });
});
