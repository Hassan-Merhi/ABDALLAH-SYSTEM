/**
 * Phase 5 Net Position historical pipeline acceptance cases.
 * Authored only; execution is explicitly deferred to Claude.
 */
import { describe, it, expect } from "vitest";
import { historicalOtwRemaining, orderStageAt } from "../server/services/factory/netPositionHistoricalPipeline";

describe("Historical order status cutoffs", () => {
  it("never counts a not-yet-created future order", () => {
    expect(orderStageAt({
      created: false, loadingStarted: true, verified: true,
      invoiced: false, currentStatus: "VERIFIED",
    })).toBe("UNKNOWN");
  });

  it("keeps an Oct 19 LOADING order despite it being verified on Oct 21", () => {
    expect(orderStageAt({
      created: true, loadingStarted: true, verified: false,
      invoiced: false, currentStatus: "FINALIZED",
    })).toBe("LOADING");
  });

  it("distinguishes verified and finalized cutoffs without trusting current status", () => {
    expect(orderStageAt({
      created: true, loadingStarted: true, verified: true,
      invoiced: false, currentStatus: "FINALIZED",
      loadingStartedAt: "2026-10-18 08:00:00",
      verifiedAt: "2026-10-19 12:00:00",
    })).toBe("VERIFIED");
    expect(orderStageAt({
      created: true, loadingStarted: true, verified: true,
      invoiced: true, currentStatus: "FINALIZED",
    })).toBe("FINALIZED");
  });

  it("reopened LOADING overrides an earlier VERIFIED timestamp", () => {
    const common = {
      created: true, loadingStarted: true, verified: true, invoiced: false,
      currentStatus: "VERIFIED",
      loadingStartedAt: "2026-10-20 09:00:00",
    };
    expect(orderStageAt({
      ...common, verifiedAt: "2026-10-19 10:00:00",
    })).toBe("LOADING");
    expect(orderStageAt({
      ...common, verifiedAt: "2026-10-21 11:00:00",
    })).toBe("VERIFIED");
  });

  it("requires evidence that a pending status already existed on the selected date", () => {
    expect(orderStageAt({
      created: true, loadingStarted: false, verified: false,
      invoiced: false, currentStatus: "PENDING_VERIFICATION",
      currentStateKnown: false,
    })).toBe("UNKNOWN");
    expect(orderStageAt({
      created: true, loadingStarted: false, verified: false,
      invoiced: false, currentStatus: "PENDING_VERIFICATION",
      currentStateKnown: true,
    })).toBe("PENDING_VERIFICATION");
  });

  it("refuses to infer missing transitions from today's verified status", () => {
    expect(orderStageAt({
      created: true, loadingStarted: false, verified: false,
      invoiced: false, currentStatus: "VERIFIED",
    })).toBe("UNKNOWN");
  });
});

describe("Historical factory OTW partial offloads", () => {
  it("keeps the full shipment OTW before any receipt", () => {
    const snapshot = historicalOtwRemaining("10000", "0");
    expect(snapshot.remainingKg.toString()).toBe("10000");
    expect(snapshot.share.toString()).toBe("1");
  });

  it("only subtracts receipts recorded through the selected business day", () => {
    // This helper receives the SUM of qualifying receipt events. The loader
    // filters recorded_at AND receipt_date; Oct 21 receipts never enter Oct 19.
    const beforeOffload = historicalOtwRemaining("10000", "0");
    const afterPartial = historicalOtwRemaining("10000", "4000");
    const afterSecondReceipt = historicalOtwRemaining("10000", "10000");
    expect(beforeOffload.share.toString()).toBe("1");
    expect(afterPartial.remainingKg.toString()).toBe("6000");
    expect(afterPartial.share.toString()).toBe("0.6");
    expect(afterSecondReceipt.share.toString()).toBe("0");
  });

  it("caps over-receipts and does not create a negative OTW asset", () => {
    const over = historicalOtwRemaining("10000", "11000");
    expect(over.remainingKg.toNumber()).toBe(0);
    expect(over.exceeded).toBe(true);
  });
});
