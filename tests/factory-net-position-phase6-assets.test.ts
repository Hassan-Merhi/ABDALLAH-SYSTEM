/**
 * Phase 6 acceptance tests for factory historical asset/liability projections.
 * Saved for Claude's later run; never run by this implementation stage.
 */
import { describe, expect, it } from "vitest";
import {
  remainingAdvanceAt,
  sumRentalContractPositions,
} from "../server/services/factory/netPositionHistoricalAssets";

describe("Factory Net Position Phase 6 historical worker advances", () => {
  it("replays the original advance and only the repayments selected by the caller's date cutoff", () => {
    // The query selects advances and repayments with BOTH their effective
    // dates and recorded_at <= asOf. A $30 repayment on Oct 21 cannot
    // change October 19's remaining $100.
    expect(remainingAdvanceAt("100", [])).toBe(100);
    expect(remainingAdvanceAt("100", ["20"])).toBe(80);
    expect(remainingAdvanceAt("100", ["20", "30"])).toBe(50);
  });

  it("never creates a negative asset when repayments exceed principal", () => {
    expect(remainingAdvanceAt("100", ["80", "25"])).toBe(0);
  });

  it("uses decimal money rather than binary float or current remaining_balance", () => {
    expect(remainingAdvanceAt("0.30", ["0.10", "0.10"])).toBe(0.10);
  });
});

describe("Factory Net Position Phase 6 historical rent", () => {
  it("preserves the existing per-contract absolute receivable/credit formula", () => {
    expect(sumRentalContractPositions([
      { expected: "200", paid: "150" },
      { expected: "100", paid: "120" },
    ])).toBe(70);
  });

  it("does not offset balances of different tenants before summing", () => {
    expect(sumRentalContractPositions([
      { expected: "100.00", paid: "0" },
      { expected: "0", paid: "100.00" },
    ])).toBe(200);
  });

  it("uses decimal cents for full and partial rent payments", () => {
    expect(sumRentalContractPositions([
      { expected: "0.30", paid: "0.10" },
      { expected: "0.20", paid: "0.10" },
    ])).toBe(0.30);
  });
});
