import { describe, expect, it } from "vitest";
import { compareItemNamesAZ } from "./itemNameSort";

describe("compareItemNamesAZ", () => {
  it("alphabetizes names independent of insertion order and case", () => {
    const names = ["CorseT", "Bath Mat", "army uniform", "Fishing Vest"];
    expect([...names].sort(compareItemNamesAZ)).toEqual(["army uniform", "Bath Mat", "CorseT", "Fishing Vest"]);
    expect(names[0]).toBe("CorseT");
  });
  it("uses natural numeric order", () => {
    expect(["Bale 10", "bale 2", "Bale 1"].sort(compareItemNamesAZ)).toEqual(["Bale 1", "bale 2", "Bale 10"]);
  });
});
