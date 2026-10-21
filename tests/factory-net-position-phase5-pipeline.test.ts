/**
 * Phase 5 Net Position historical pipeline acceptance cases.
 * Authored only; execution is explicitly deferred to Claude.
 */
import { describe, it, expect } from "vitest";
import { orderStageAt } from "../server/services/factory/netPositionHistoricalPipeline";

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

  it("refuses to infer missing transitions from today's verified status", () => {
    expect(orderStageAt({
      created: true, loadingStarted: false, verified: false,
      invoiced: false, currentStatus: "VERIFIED",
    })).toBe("UNKNOWN");
  });
});
