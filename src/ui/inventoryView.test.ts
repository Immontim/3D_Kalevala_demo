import { describe, expect, it } from "vitest";
import { createCampaign, tryAddItem, tryEquipItem } from "../map/campaign";
import { inventoryViewModel } from "./inventoryView";

describe("inventoryViewModel", () => {
  it("antaa seitsemän varustepaikkaa, reppupaikan ja kuusi peruspaikkaa ilman DOM-riippuvuutta", () => {
    const model = inventoryViewModel(createCampaign());
    expect(model.equipment.map((entry) => entry.slot)).toEqual([
      "head", "torso", "hands", "legs", "feet", "mainHand", "offHand",
    ]);
    expect(model.backpack).toBeNull();
    expect(model.baseStacks).toHaveLength(6);
    expect(model.extraStacks).toHaveLength(0);
    expect(model.baseStacks.slice(0, 2)).toEqual([
      { itemId: "barley_flatbread", quantity: 3 }, null,
    ]);
  });

  it("näyttää tuohikontin erillisessä reppupaikassa ja avaa kuusi lisäpaikkaa", () => {
    const state = createCampaign();
    state.player.inventory = tryAddItem(state.player.inventory, "birch_bark_pack", 1)!;
    const model = inventoryViewModel(state);
    expect(model.backpack).toBe("birch_bark_pack");
    expect(model.extraCapacity).toBe(6);
    expect(model.extraStacks).toEqual([null, null, null, null, null, null]);
  });

  it("heijastaa atomisen varustevaihdon malliin", () => {
    const state = createCampaign();
    state.player.inventory = tryAddItem(state.player.inventory, "spear", 1)!;
    const changed = tryEquipItem(state, "spear").state;
    const model = inventoryViewModel(changed);
    expect(model.equipment.find((entry) => entry.slot === "mainHand")?.itemId).toBe("spear");
    expect(model.equipment.find((entry) => entry.slot === "offHand")?.itemId).toBeNull();
    expect([...model.baseStacks, ...model.extraStacks]).toContainEqual({ itemId: "sword", quantity: 1 });
    expect([...model.baseStacks, ...model.extraStacks]).toContainEqual({ itemId: "round_shield", quantity: 1 });
  });
});
