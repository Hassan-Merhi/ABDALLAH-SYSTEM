/**
 * Phase 8 regression tests for Claude's independent verification run.
 * Source committed only; NOT executed by this implementation session.
 */
import { describe, expect, it } from "vitest";
import {
  historicalUsdFromNativeZmw,
  valueZmwPurchaseAtLockedRate,
} from "../server/services/accounting/zambiaPurchaseCosting";

describe("Zambia Phase 8 purchase historical inventory basis", () => {
  it("stores native price and landed charges separately from locked USD base", () => {
    const valued = valueZmwPurchaseAtLockedRate({
      date: "2026-10-20",
      historicalRate: "25",
      lines: [{ quantity: "2", rate: "125.00" }],
      charges: { freight: "50.00", otherCharges: "0", discount: "0" },
    });
    expect(valued).toMatchObject({
      historicalExchangeRate: "25",
      historicalRateDate: "2026-10-20",
      nativeLineCount: 1,
      nativeItemsTotal: "250.00",
      itemsTotal: "10.00",
      nativeFreight: "50.00",
      freight: "2.00",
      nativeGrandTotal: "300.00",
      grandTotal: "12.00",
    });
    expect(valued.lines[0]).toMatchObject({
      quantity: "2.000", nativeRate: "125.00", rate: "5.00",
      nativeLineTotal: "250.00", lineTotal: "10.00",
    });
  });

  it("retains the purchase's stored FX on edits after an unrelated rate change", () => {
    const old = historicalUsdFromNativeZmw("250.00", "25");
    const current = historicalUsdFromNativeZmw("250.00", "28");
    expect(old).toBe("10.00");
    expect(current).not.toBe(old);
    const edited = valueZmwPurchaseAtLockedRate({
      date: "2026-10-20", historicalRate: "25",
      lines: [{ quantity: "1", rate: "250.00" }],
      charges: {},
    });
    expect(edited.itemsTotal).toBe(old);
  });

  it("allows independent line-cent rounding but keeps exact native total", () => {
    const value = valueZmwPurchaseAtLockedRate({
      date: "2026-10-20", historicalRate: "27",
      lines: [{ quantity: "1", rate: "1.00" }, { quantity: "1", rate: "1.00" }],
      charges: {},
    });
    expect(value.nativeItemsTotal).toBe("2.00");
    expect(value.itemsTotal).toBe("0.08");
    expect(value.lines).toHaveLength(2);
  });

  it("rejects invalid rates, negative native charges, and fractional-unit quantities", () => {
    expect(() => historicalUsdFromNativeZmw("5", "0")).toThrow();
    expect(() => historicalUsdFromNativeZmw("-1", "25")).toThrow();
    expect(() => valueZmwPurchaseAtLockedRate({
      date: "2026-10-20", historicalRate: "25",
      lines: [{ quantity: "1.0001", rate: "5" }], charges: {},
    })).toThrow();
  });
});
