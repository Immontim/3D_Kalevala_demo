import { describe, expect, it } from "vitest";
import { createCampaign, tryEquipItem } from "../map/campaign";
import { inventoryViewModel } from "./inventoryView";

describe("inventoryViewModel", () => {
  it("antaa seitsemän varustepaikkaa ja 12 tavarapaikkaa ilman DOM-riippuvuutta", () => {
    const model = inventoryViewModel(createCampaign());
    expect(model.equipment.map((entry) => entry.slot)).toEqual([
      "head", "torso", "hands", "legs", "feet", "mainHand", "offHand",
    ]);
    expect(model.stacks).toHaveLength(12);
    expect(model.stacks.slice(0, 2)).toEqual([
      { itemId: "barley_flatbread", quantity: 3 }, { itemId: "spear", quantity: 1 },
    ]);
  });

  it("heijastaa atomisen varustevaihdon malliin", () => {
    const changed = tryEquipItem(createCampaign(), "spear").state;
    const model = inventoryViewModel(changed);
    expect(model.equipment.find((entry) => entry.slot === "mainHand")?.itemId).toBe("spear");
    expect(model.equipment.find((entry) => entry.slot === "offHand")?.itemId).toBeNull();
    expect(model.stacks).toContainEqual({ itemId: "sword", quantity: 1 });
    expect(model.stacks).toContainEqual({ itemId: "round_shield", quantity: 1 });
  });
});
