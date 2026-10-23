import type { Express, NextFunction, Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { companies, vouchers } from "@shared/schema";
import { db } from "../db";

/**
 * Retail-only HTTP boundary for manually constructed voucher types.
 *
 * System-created Retail sales, refund, inventory and tax journals are written
 * directly through the central posting engine and do not cross this HTTP
 * boundary. Read-only voucher and Daybook routes also remain accessible.
 */
const hiddenManualVoucherTypes = new Set([
  "journal",
  "creditnote",
  "debitnote",
  "adjustment",
  "stockadjustment",
  "consumption",
  "production",
  "mixed",
  "stocktransferorder",
  "transferorder",
]);

function blockedType(type: unknown): boolean {
  // The legacy API uses e.g. "Credit Note", "CreditNote" and "credit_note"
  // in different routes. All aliases must share the same Retail refusal.
  return typeof type === "string" &&
    hiddenManualVoucherTypes.has(type.trim().toLowerCase().replace(/[\s_-]+/g, ""));
}

export function registerRetailManualVoucherBoundary(app: Express): void {
  app.use(/^\/api\/vouchers(?:\/|$)/, async (req: Request, res: Response, next: NextFunction) => {
    const method = req.method.toUpperCase();
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return next();
    if (!req.session?.userId) return next(); // Existing handlers perform authentication.

    const companyId = Number(req.session.currentCompanyId);
    if (!Number.isSafeInteger(companyId) || companyId <= 0) return next();

    try {
      const [company] = await db
        .select({ companyType: companies.companyType })
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1);
      if (company?.companyType !== "retail") return next();

      const path = req.originalUrl.split("?", 1)[0];
      const journalCreate = method === "POST" &&
        /^\/api\/vouchers\/journal\/?$/i.test(path);
      const proposed = req.body?.voucher?.voucherType ?? req.body?.voucherType;
      const create = method === "POST" &&
        (/^\/api\/vouchers\/?$/i.test(path) || /^\/api\/vouchers\/with-entries\/?$/i.test(path));

      if (journalCreate || (create && blockedType(proposed))) {
        return res.status(403).json({
          code: "RETAIL_MANUAL_VOUCHER_TYPE_BLOCKED",
          message: "Retail system journals, adjustment/credit-note and Transfer Order vouchers cannot be created manually.",
        });
      }

      // Generic edit/update/delete routes must not change an existing Retail
      // system journal, even when the caller supplies a different voucherType.
      // No data is modified by this lookup.
      const match = path.match(/^\/api\/vouchers\/(\d+)(?:\/|$)/i);
      if (!match) return next();
      const voucherId = Number(match[1]);
      if (!Number.isSafeInteger(voucherId) || voucherId <= 0) return next();

      const [existing] = await db
        .select({ voucherType: vouchers.voucherType })
        .from(vouchers)
        .where(and(eq(vouchers.id, voucherId), eq(vouchers.companyId, companyId)))
        .limit(1);

      if (blockedType(existing?.voucherType) || blockedType(proposed)) {
        return res.status(403).json({
          code: "RETAIL_SYSTEM_VOUCHER_READ_ONLY",
          message: "This Retail system voucher is read-only. Use the posted voucher detail and Daybook for audit.",
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  });
}
