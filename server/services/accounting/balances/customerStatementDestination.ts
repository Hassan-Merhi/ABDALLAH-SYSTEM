/**
 * Read-only destination projection for Factory customer account statements.
 *
 * Destinations live on customer_orders, not voucher_entries. Only associate an
 * accounting row with an order when its posted invoice/order reference matches
 * the customer's own order; never infer destination from a free-text container
 * number or another customer's records. No accounting entries are changed.
 */
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../../db";
import { customerOrders } from "@shared/schema";

type DestinationStatementRow = {
  voucherNumber?: string | null;
  voucherDescription?: string | null;
  narration?: string | null;
};

export async function enrichCustomerLedgerDestinations<T extends DestinationStatementRow>(
  companyId: number,
  customerId: number,
  rows: T[]
): Promise<Array<T & { destination: string | null }>> {
  if (!rows.length) return [];

  const orders = await db
    .select({
      id: customerOrders.id,
      invoiceNumber: customerOrders.invoiceNumber,
      destination: customerOrders.destination,
    })
    .from(customerOrders)
    .where(and(
      eq(customerOrders.companyId, companyId),
      eq(customerOrders.customerId, customerId),
      isNull(customerOrders.deletedAt)
    ));

  const byOrderId = new Map<number, string>();
  const byInvoiceNumber = new Map<string, string>();
  for (const order of orders) {
    const destination = order.destination?.trim();
    if (!destination) continue;
    byOrderId.set(order.id, destination);
    if (order.invoiceNumber) byInvoiceNumber.set(order.invoiceNumber.trim().toUpperCase(), destination);
  }

  return rows.map((row) => {
    const voucherNumber = (row.voucherNumber ?? "").trim().toUpperCase();
    const description = (row.voucherDescription ?? "").trim().toUpperCase();
    const narration = (row.narration ?? "").trim().toUpperCase();

    // Canonical perpetual-inventory invoice voucher: INV-GL-{companyId}-{orderId}
    const glInvoice = /^INV-GL-(\d+)-(\d+)$/.exec(voucherNumber);
    const canonicalDestination = glInvoice && Number(glInvoice[1]) === companyId
      ? byOrderId.get(Number(glInvoice[2]))
      : undefined;

    // Customer invoice descriptions (including historical invoice memos) and
    // invoice-specific charge voucher IDs. Match the exact invoice reference.
    const invoiceReference = [voucherNumber, description, narration]
      .filter((value) =>
        value.startsWith("FACTORY INVOICE") ||
        value.startsWith("INVOICE INV-") ||
        value.startsWith("INV-") ||
        value.startsWith("CHARGE-")
      )
      .join(" ");
    const invoiceIds = invoiceReference.match(/INV-\d+/g) ?? [];
    const matchedDestinations = new Set(
      invoiceIds.map((id) => byInvoiceNumber.get(id)).filter((v): v is string => !!v)
    );
    const destination = canonicalDestination ??
      (matchedDestinations.size === 1 ? [...matchedDestinations][0] : null);
    return { ...row, destination: destination ?? null };
  });
}
