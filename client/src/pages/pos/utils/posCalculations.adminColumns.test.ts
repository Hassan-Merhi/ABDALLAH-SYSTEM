import { describe, expect, it } from "vitest";
import { ADMIN_POS_COLUMNS, POS_COLUMNS, canSeePosReferencePrices } from "./posCalculations";

describe("POS reference columns", () => {
  it("puts Bale Cost and Config Price immediately before P/L", () => {
    expect(ADMIN_POS_COLUMNS.map((column) => column.key)).toEqual([
      "itemName",
      "quantity",
      "rate",
      "amount",
      "baleCost",
      "configPrice",
      "plBale",
      "totalPL",
      "delete",
    ]);
    expect(POS_COLUMNS.map((column) => column.key)).not.toContain("baleCost");
    expect(POS_COLUMNS.map((column) => column.key)).not.toContain("configPrice");
  });
  it("shows confidential columns only to Admin and Developer", () => {
    expect(canSeePosReferencePrices("Admin")).toBe(true);
    expect(canSeePosReferencePrices("Developer")).toBe(true);
    for (const role of ["POS", "Tester", "Manager", "Owner", "View-Only", null, undefined]) {
      expect(canSeePosReferencePrices(role)).toBe(false);
    }
  });
});
