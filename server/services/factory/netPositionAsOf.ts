import { eq, sql, type SQL } from "drizzle-orm";
import { companySettings } from "@shared/schema";
import {
  isValidNetPositionTimezone,
  netPositionBusinessDay,
  resolveFactoryNetPositionDay,
  type FactoryNetPositionAsOf,
} from "@shared/factoryNetPositionAsOf";
import { db, type DatabaseOrTransaction } from "../../db";

/**
 * Resolve the report's date exactly once AFTER the factory company has been
 * resolved. The requesting browser's X-Client-Date header does not define a
 * shared financial cutoff. An unconfigured/invalid timezone falls back to UTC.
 */
export async function resolveFactoryNetPositionAsOf(
  companyId: number,
  requestedAsOf: unknown,
  executor: DatabaseOrTransaction = db,
  now: Date = new Date(),
): Promise<FactoryNetPositionAsOf> {
  const [settings] = await executor
    .select({ timezone: companySettings.timezone })
    .from(companySettings)
    .where(eq(companySettings.companyId, companyId))
    .limit(1);
  const configuredTimezone = settings?.timezone;
  const timeZone = isValidNetPositionTimezone(configuredTimezone) ? configuredTimezone : "UTC";
  const businessToday = netPositionBusinessDay(now, timeZone);
  const asOf = resolveFactoryNetPositionDay(requestedAsOf, businessToday);
  return {
    asOf,
    businessToday,
    timeZone,
    isHistorical: asOf < businessToday,
    historyBasis: "known-at-cutoff",
  };
}

/** Inclusive effective/business date. Safe on a PostgreSQL DATE or date expression. */
export function netPositionEffectiveThrough(bookedOn: SQL, scope: FactoryNetPositionAsOf): SQL {
  return sql`${bookedOn}::date <= ${scope.asOf}::date`;
}

/**
 * Exclusive start of the NEXT company-local day; handles daylight-saving
 * boundaries without assuming that one business day always lasts 24 hours.
 *
 * For PostgreSQL TIMESTAMPTZ columns, compare directly to this expression.
 * For timestamp-without-timezone columns which persist UTC-naive timestamps,
 * convert this instant back into a UTC-naive timestamp (see next helper).
 */
export function netPositionRecordedThrough(
  recordedAt: SQL,
  scope: FactoryNetPositionAsOf,
  storedAs: "timestamptz" | "utc-naive-timestamp",
): SQL {
  const nextBusinessDayInstant = sql`((${scope.asOf}::date + INTERVAL '1 day') AT TIME ZONE ${scope.timeZone})`;
  return storedAs === "timestamptz"
    ? sql`${recordedAt} < ${nextBusinessDayInstant}`
    : sql`${recordedAt} < (${nextBusinessDayInstant} AT TIME ZONE 'UTC')`;
}

/** The mandatory TWO-axis test for any transaction with trustworthy recorded time. */
export function netPositionKnownTransactionThrough(
  bookedOn: SQL,
  recordedAt: SQL,
  scope: FactoryNetPositionAsOf,
  storedAs: "timestamptz" | "utc-naive-timestamp",
): SQL {
  return sql`(${netPositionEffectiveThrough(bookedOn, scope)} AND ${netPositionRecordedThrough(recordedAt, scope, storedAs)})`;
}
