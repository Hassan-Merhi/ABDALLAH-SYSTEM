/**
 * Phase 4: project verified live monetary USD translations onto a Net Position
 * response. Report-only: NEVER mutate a voucher, company currency or book data.
 *
 * Matching is by canonical ownership kind:id (not code/name). An account row
 * is replaced only when its signed book USD equals the valuation's historical
 * USD base to within display rounding. Unknown/mismatched rows are retained.
 */
import Decimal from "decimal.js";
import type { MonetaryFxValuationResult, MonetaryFxValuationRow } from "./monetaryFxValuationService";

export type MonetaryNetPositionAccount = {
  id?: number;
  bankAccountId?: number;
  partyKind?: string;
  partyId?: number | null;
  name: string;
  code?: string | null;
  category?: string;
  value: number;
  currencyRevalued?: boolean;
  [key: string]: unknown;
};

export type MonetaryNetPositionSide = {
  accounts: MonetaryNetPositionAccount[];
  total: number;
  breakdown?: Array<{ name: string; value: number }>;
};

export type MonetaryNetPositionPayload = {
  forUs?: MonetaryNetPositionSide;
  onUs?: MonetaryNetPositionSide;
  forUsTotal?: number;
  onUsTotal?: number;
  netPosition?: number;
  netWorth?: number;
  netPositionLabel?: string;
  equity?: { total?: number; includedInNetPosition?: boolean };
  netPositionBreakdown?: Record<string, unknown>;
  currency?: Record<string, unknown>;
  currencyRevaluation?: Record<string, unknown>;
  [key: string]: unknown;
};

type PositionSide = "forUs" | "onUs";
export function monetaryReportRowKey(row: MonetaryNetPositionAccount): string | null {
  if (row.partyKind === "customer" && Number.isSafeInteger(row.partyId)) return `customer:${row.partyId}`;
  if (row.partyKind === "bank" && Number.isSafeInteger(row.partyId)) return `bank:${row.partyId}`;
  if (row.bankAccountId != null && Number.isSafeInteger(row.bankAccountId)) return `bank:${row.bankAccountId}`;
  // A linked customer may also carry an id, but that ledger belongs to the
  // customer. Never match customer/employee/supplier parties to a ledger id.
  if (row.partyKind) return null;
  if (row.id != null && Number.isSafeInteger(row.id)) return `ledger:${row.id}`;
  return null;
}

const money = (x: Decimal.Value) => new Decimal(x).toDecimalPlaces(2).toNumber();
function sumBreakdown(rows: MonetaryNetPositionAccount[]) {
  const categories = new Map<string, Decimal>();
  for (const row of rows) {
    const category = row.category || "Other";
    categories.set(category, (categories.get(category) ?? new Decimal(0)).plus(row.value));
  }
  return [...categories].map(([name, value]) => ({ name, value: money(value) }))
    .filter((row) => Math.abs(row.value) >= 0.005)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

export interface MonetaryReportOverlayDiagnostic {
  key: string;
  reason: "unresolved" | "missing_in_report" | "duplicate_report_row" | "historical_usd_mismatch";
}
export interface MonetaryReportOverlayResult {
  payload: MonetaryNetPositionPayload;
  appliedKeys: string[];
  skipped: MonetaryReportOverlayDiagnostic[];
  currentMonetaryTranslationDifferenceUsd: string;
  ledgerForUsDelta: number;
  ledgerOnUsDelta: number;
}

/** Mutates only the caller's disposable/JSON-cloned report, not its cached source. */
export function applyVerifiedMonetaryFxOverlay(
  payload: MonetaryNetPositionPayload,
  valuation: MonetaryFxValuationResult
): MonetaryReportOverlayResult {
  const appliedKeys: string[] = [];
  const skipped: MonetaryReportOverlayDiagnostic[] = [];
  if (!payload?.forUs || !payload.onUs) {
    return { payload, appliedKeys, skipped, currentMonetaryTranslationDifferenceUsd: "0.000000", ledgerForUsDelta: 0, ledgerOnUsDelta: 0 };
  }
  const sides = { forUs: payload.forUs, onUs: payload.onUs };
  const totals = {
    forUs: new Decimal(payload.forUs.total ?? payload.forUsTotal ?? 0),
    onUs: new Decimal(payload.onUs.total ?? payload.onUsTotal ?? 0),
  };
  let appliedDifference = new Decimal(0);
  let ledgerForUsDelta = new Decimal(0);
  let ledgerOnUsDelta = new Decimal(0);
  for (const val of valuation.accounts) {
    if (val.eligibility === "needs_review") continue;
    const current = val.currentTranslatedUsd;
    if (val.provisional || current === null || val.historicalBaseUsd === null) {
      skipped.push({ key: val.accountKey, reason: "unresolved" });
      continue;
    }
    const matches: Array<{ side: PositionSide; row: MonetaryNetPositionAccount }> = [];
    for (const side of ["forUs", "onUs"] as const) {
      for (const row of sides[side].accounts) {
        if (monetaryReportRowKey(row) === val.accountKey) matches.push({ side, row });
      }
    }
    if (matches.length !== 1) {
      skipped.push({ key: val.accountKey, reason: matches.length ? "duplicate_report_row" : "missing_in_report" });
      continue;
    }
    const { side: oldSide, row: oldRow } = matches[0];
    const signedOld = new Decimal(oldRow.value).mul(oldSide === "forUs" ? 1 : -1);
    const historical = new Decimal(val.historicalBaseUsd);
    // Net Position can use different book attribution for old unmatched rows
    // or supplier-partner custom exclusions. Never silently overwrite those.
    if (!signedOld.isFinite() || historical.minus(signedOld).abs().gt("0.03")) {
      skipped.push({ key: val.accountKey, reason: "historical_usd_mismatch" });
      continue;
    }
    const translated = new Decimal(current);
    if (!translated.isFinite()) {
      skipped.push({ key: val.accountKey, reason: "unresolved" });
      continue;
    }
    sides[oldSide].accounts = sides[oldSide].accounts.filter((row) => row !== oldRow);
    totals[oldSide] = totals[oldSide].minus(oldRow.value);
    if (val.accountKind !== "customer") {
      if (oldSide === "forUs") ledgerForUsDelta = ledgerForUsDelta.minus(oldRow.value);
      else ledgerOnUsDelta = ledgerOnUsDelta.minus(oldRow.value);
    }
    if (!translated.isZero()) {
      const targetSide: PositionSide = translated.gte(0) ? "forUs" : "onUs";
      const value = money(translated.abs());
      sides[targetSide].accounts.push({
        ...oldRow,
        value,
        currencyRevalued: true,
        monetaryFxCategory: val.category,
        nativeBalancesByCurrency: val.nativeBalancesByCurrency,
        historicalBaseBalance: val.historicalBaseUsd,
        currentTranslatedBaseBalance: current,
        translationDifference: val.translationDifferenceUsd,
      });
      totals[targetSide] = totals[targetSide].plus(value);
      if (val.accountKind !== "customer") {
        if (targetSide === "forUs") ledgerForUsDelta = ledgerForUsDelta.plus(value);
        else ledgerOnUsDelta = ledgerOnUsDelta.plus(value);
      }
    }
    appliedDifference = appliedDifference.plus(translated.minus(historical));
    appliedKeys.push(val.accountKey);
  }

  // No successful replacements: preserve the source report exactly, including
  // specialized operational breakdowns, labels and signed category rules.
  if (appliedKeys.length === 0) {
    return { payload, appliedKeys, skipped, currentMonetaryTranslationDifferenceUsd: "0.000000", ledgerForUsDelta: 0, ledgerOnUsDelta: 0 };
  }
  for (const side of ["forUs", "onUs"] as const) {
    const entry = sides[side];
    entry.total = money(totals[side]);
    entry.accounts = entry.accounts
      .filter((row) => Math.abs(row.value) >= 0.005)
      .sort((a, b) => b.value - a.value);
    entry.breakdown = sumBreakdown(entry.accounts);
  }
  payload.forUsTotal = sides.forUs.total;
  payload.onUsTotal = sides.onUs.total;
  const equity = payload.equity?.includedInNetPosition === true
    ? new Decimal(payload.equity.total ?? 0) : new Decimal(0);
  payload.netPosition = money(totals.forUs.minus(totals.onUs).plus(equity));
  payload.netWorth = payload.netPosition;
  payload.netPositionLabel = payload.netPosition >= 0 ? "Net Assets" : "Net Liabilities";
  if (payload.netPositionBreakdown) {
    for (const [side, breakdownKey] of [["forUs", "assets"], ["onUs", "liabilities"]] as const) {
      const breakdown = payload.netPositionBreakdown[breakdownKey];
      if (breakdown && typeof breakdown === "object" && !Array.isArray(breakdown)) {
        Object.assign(breakdown, { total: sides[side].total, breakdown: sides[side].breakdown });
      }
    }
    payload.netPositionBreakdown.netPosition = payload.netPosition;
  }
  return {
    payload,
    appliedKeys,
    skipped,
    currentMonetaryTranslationDifferenceUsd: appliedDifference.toDecimalPlaces(6).toFixed(6),
    ledgerForUsDelta: money(ledgerForUsDelta),
    ledgerOnUsDelta: money(ledgerOnUsDelta),
  };
}

/**
 * Decorate current Accounts-list rows with translated USD, preserving the
 * native/report metadata. Do not transform date-scoped or period rows.
 * linked-customer ledgers use customer:id; noncash fixed assets are excluded.
 */
export function applyCurrentAccountsFxOverlay<
  T extends { type: string; accountId: number; customerId?: number | null; balance: string; balanceSide: string }
>(
  rows: T[],
  valuation: MonetaryFxValuationResult
): Array<T & {
  historicalBalanceUsd?: string;
  currentTranslatedUsd?: string;
  nativeBalancesByCurrency?: Record<string, string>;
  monetaryFxProvisional?: boolean;
  currencyRevalued?: boolean;
}> {
  const valuations = new Map(valuation.accounts.map((v) => [v.accountKey, v]));
  return rows.map((row) => {
    const key = row.type === "bank" ? `bank:${row.accountId}`
      : row.type === "ledger" && row.customerId != null ? `customer:${row.customerId}`
      : row.type === "ledger" ? `ledger:${row.accountId}` : null;
    if (!key) return row;
    const val: MonetaryFxValuationRow | undefined = valuations.get(key);
    if (!val || val.eligibility === "needs_review") return row;
    if (val.provisional || val.currentTranslatedUsd === null || val.historicalBaseUsd === null) {
      return { ...row, monetaryFxProvisional: true };
    }
    const book = new Decimal(row.balance).mul(row.balanceSide === "Cr" ? -1 : 1);
    if (!book.isFinite() || book.minus(val.historicalBaseUsd).abs().gt("0.03")) {
      return { ...row, monetaryFxProvisional: true };
    }
    const current = new Decimal(val.currentTranslatedUsd);
    return {
      ...row,
      historicalBalanceUsd: book.toDecimalPlaces(6).toFixed(6),
      balance: current.abs().toDecimalPlaces(2).toFixed(2),
      balanceSide: current.isNegative() ? "Cr" : "Dr",
      currentTranslatedUsd: val.currentTranslatedUsd,
      nativeBalancesByCurrency: val.nativeBalancesByCurrency,
      currencyRevalued: true,
    };
  });
}

/**
 * Customer-list/Factory Parties presentation projection. It cannot reprice
 * nonledger operational memos or held-unfinalized charges; those rows keep
 * their existing historical USD and expose provisional metadata.
 */
export function applyCurrentCustomerFxOverlay<
  T extends { id: number; balance: number; balanceSide: string; notInLedgerTotal?: number; heldUnfinalizedCharges?: number }
>(
  rows: T[],
  valuation: MonetaryFxValuationResult
): Array<T & {
  historicalBalanceUsd?: string;
  currentTranslatedUsd?: string;
  nativeBalancesByCurrency?: Record<string, string>;
  monetaryFxProvisional?: boolean;
  currencyRevalued?: boolean;
}> {
  const customers = new Map(
    valuation.accounts.filter((val) => val.accountKind === "customer")
      .map((val) => [val.id, val])
  );
  return rows.map((row) => {
    const val = customers.get(row.id);
    if (!val) return row;
    if (
      val.provisional || val.currentTranslatedUsd === null || val.historicalBaseUsd === null ||
      Math.abs(row.notInLedgerTotal ?? 0) >= 0.005 ||
      Math.abs(row.heldUnfinalizedCharges ?? 0) >= 0.005
    ) return { ...row, monetaryFxProvisional: true };
    const signedBook = new Decimal(row.balance).mul(row.balanceSide === "Cr" ? -1 : 1);
    if (!signedBook.isFinite() || signedBook.minus(val.historicalBaseUsd).abs().gt("0.03")) {
      return { ...row, monetaryFxProvisional: true };
    }
    const translated = new Decimal(val.currentTranslatedUsd);
    const nextBalance = translated.abs().toDecimalPlaces(2).toNumber();
    const nextSide = translated.isNegative() ? "Cr" : "Dr";
    return {
      ...row,
      balance: nextBalance,
      balanceSide: nextSide,
      // Factory Party ledger components share this single book ownership;
      // operational memo stays zero on the eligible path.
      ...("ledgerBalance" in row ? {
        ledgerBalance: nextBalance,
        ledgerBalanceSide: nextSide,
        generalLedgerBalance: nextBalance,
        generalLedgerBalanceSide: nextSide,
      } : {}),
      historicalBalanceUsd: signedBook.toDecimalPlaces(6).toFixed(6),
      currentTranslatedUsd: val.currentTranslatedUsd,
      nativeBalancesByCurrency: val.nativeBalancesByCurrency,
      currencyRevalued: true,
    };
  });
}
