import { describe, expect, it } from "vitest";
import type { APIInventoryItem } from "../pos-components/posTypes";
import { buildPosInventory } from "./posInventory";

const inventory: APIInventoryItem = {
  inventoryId: 10,
  locationId: 1,
  stockItemId: 7,
  quantity: "10",
  averageRate: "3.25",
  totalValue: "32.50",
  lastSellingPrice: "5.50",
  stockItemCode: "AA-7",
  stockItemName: "Bale",
  stockItemUom: "Bale",
  stockGroupId: null,
  stockGroupName: null,
  stockGroupCode: null,
};

describe("POS admin reference prices", () => {
  it("shows actual inventory cost separately from configured selling price", () => {
    const [item] = buildPosInventory([inventory], [], false, 1);
    expect(item).toMatchObject({ price: 5.5, costPrice: 3.25, configuredPrice: 5.5 });
  });
  it("never treats a redacted cost as zero or a selling price as cost", () => {
    const [item] = buildPosInventory([{ ...inventory, averageRate: null }], [], false, 1);
    expect(item.configuredPrice).toBe(5.5);
    expect(item.costPrice).toBeUndefined();
  });
  it("uses the final SP bale cost when there are movements", () => {
    const [item] = buildPosInventory(
      [inventory],
      [
        {
          id: 1,
          articleCode: "AA-7",
          description: "Bale",
          stockItemId: 7,
          locationId: 1,
          qtyRemaining: "2",
          finalUnitCostUsd: "4.00",
        },
        {
          id: 2,
          articleCode: "AA-7",
          description: "Bale",
          stockItemId: 7,
          locationId: 1,
          qtyRemaining: "3",
          finalUnitCostUsd: "6.00",
        },
      ],
      true,
      1
    );
    expect(item.costPrice).toBeCloseTo(5.2);
    expect(item.configuredPrice).toBeCloseTo(5.2);
  });
  it("does not invent an SP cost if no movement or inventory cost exists", () => {
    const [item] = buildPosInventory([{ ...inventory, averageRate: null }], [], true, 1);
    expect(item.costPrice).toBeUndefined();
  });
});
