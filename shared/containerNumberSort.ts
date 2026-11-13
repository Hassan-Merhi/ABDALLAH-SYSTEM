/** Natural, case-insensitive A–Z ordering for displayed container identifiers. */
const containerCollator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

export function compareContainerNumbersAZ(a: string | null | undefined, b: string | null | undefined): number {
  return containerCollator.compare((a ?? "").trim(), (b ?? "").trim());
}
