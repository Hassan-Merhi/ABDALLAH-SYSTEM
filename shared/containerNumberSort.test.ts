import { describe, expect, it } from "vitest";
import { compareContainerNumbersAZ } from "./containerNumberSort";

describe("compareContainerNumbersAZ", () => {
  it("sorts container identifiers A–Z with natural numeric order without changing the original", () => {
    const original = ["C-10", "b-10", "a-3", "B-2", "A-11"];
    expect([...original].sort(compareContainerNumbersAZ)).toEqual(["a-3", "A-11", "B-2", "b-10", "C-10"]);
    expect(original).toEqual(["C-10", "b-10", "a-3", "B-2", "A-11"]);
  });
  it("treats missing numbers as empty and ignores casing", () => {
    expect(compareContainerNumbersAZ(null, "A-1")).toBeLessThan(0);
    expect(compareContainerNumbersAZ(" ab-2 ", "AB-2")).toBe(0);
  });
});
