/** A–Z (natural, case-insensitive) purchase-item display order. */
const itemCollator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export function compareItemNamesAZ(
  a: string | null | undefined,
  b: string | null | undefined
): number {
  return itemCollator.compare((a ?? "").trim(), (b ?? "").trim());
}
