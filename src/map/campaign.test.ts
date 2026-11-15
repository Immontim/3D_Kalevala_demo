import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_SCHEMA_VERSION,
  HUNGER_MAX,
  ITEMS,
  combatLoadout,
  consumeFood,
  createCampaign,
  parseCampaign,
  serializeCampaign,
  setEquipped,
} from "./campaign";

describe("kampanjatila", () => {
  it("luo 20 × 20 maailman, kahdeksan pinon tuohikontin ja kaksi ruokaa", () => {
    const state = createCampaign();
    expect(state.schemaVersion).toBe(CAMPAIGN_SCHEMA_VERSION);
    expect(state.world).toMatchObject({ width: 20, height: 20, worldMinutes: 0 });
    expect(state.world.discovered).toHaveLength(400);
    expect(state.player.inventory.capacity).toBe(8);
    expect(state.player.inventory.stacks).toEqual([
      { itemId: "barley_flatbread", quantity: 3 },
      { itemId: "dried_fish", quantity: 2 },
    ]);
    expect(ITEMS.barley_flatbread.hungerRelief).toBeGreaterThan(0);
    expect(ITEMS.dried_fish.hungerRelief).toBeGreaterThan(ITEMS.barley_flatbread.hungerRelief!);
  });

  it("syö yhden ruuan, vähentää nälkää ja poistaa tyhjän pinon", () => {
    const start = createCampaign();
    start.player.hunger = 30;
    start.player.inventory.stacks = [{ itemId: "barley_flatbread", quantity: 1 }];
    const result = consumeFood(start, "barley_flatbread");
    expect(result.consumed).toBe(true);
    expect(result.state.player.hunger).toBe(6);
    expect(result.state.player.inventory.stacks).toEqual([]);
    expect(start.player.hunger).toBe(30);
  });

  it("ei laske nälkää alle nollan eikä syö puuttuvaa ruokaa", () => {
    const start = createCampaign();
    start.player.hunger = 5;
    expect(consumeFood(start, "dried_fish").state.player.hunger).toBe(0);
    const empty = createCampaign();
    empty.player.inventory.stacks = [];
    const result = consumeFood(empty, "dried_fish");
    expect(result).toEqual({ state: empty, consumed: false });
    const sated = createCampaign();
    expect(consumeFood(sated, "barley_flatbread")).toEqual({ state: sated, consumed: false });
  });

  it("johtaa vain tuetut pää- ja sivukäden yhdistelmät 3D-varustukseksi", () => {
    expect(combatLoadout({ mainHand: "sword", offHand: "round_shield" })).toBe("sword_shield");
    expect(combatLoadout({ mainHand: "sword", offHand: null })).toBe("sword");
    expect(combatLoadout({ mainHand: "spear", offHand: null })).toBe("spear");
    expect(combatLoadout({ mainHand: "spear", offHand: "round_shield" })).toBeNull();
    expect(combatLoadout({ mainHand: null, offHand: null })).toBeNull();
  });

  it("vaihtaa vain esineen tukemaan paperinuken paikkaan", () => {
    const state = createCampaign();
    const spear = setEquipped(setEquipped(state, "offHand", null), "mainHand", "spear");
    expect(spear.player.equipment).toEqual({ mainHand: "spear", offHand: null });
    expect(setEquipped(spear, "offHand", "sword")).toBe(spear);
  });
});

describe("kampanjatallennus", () => {
  it("serialisoi ja lukee turvallisen kopion", () => {
    const state = createCampaign({ x: 2, y: 4 });
    state.player.hunger = HUNGER_MAX;
    const loaded = parseCampaign(serializeCampaign(state));
    expect(loaded).toEqual(state);
    expect(loaded).not.toBe(state);
    expect(loaded!.world.discovered).not.toBe(state.world.discovered);
  });

  it("hylkää rikkinäisen JSONin, väärän version ja kartan koon", () => {
    expect(parseCampaign("{" )).toBeNull();
    expect(parseCampaign({ schemaVersion: 2 })).toBeNull();
    const state = createCampaign();
    state.world.discovered.pop();
    expect(parseCampaign(state)).toBeNull();
  });

  it("hylkää tuntemattomat ja liian suuret esinepinot", () => {
    const unknown = createCampaign() as unknown as { player: { inventory: { stacks: unknown[] } } };
    unknown.player.inventory.stacks = [{ itemId: "taikajuoma", quantity: 1 }];
    expect(parseCampaign(unknown)).toBeNull();

    const excessive = createCampaign();
    excessive.player.inventory.stacks = [{ itemId: "dried_fish", quantity: ITEMS.dried_fish.stackMax + 1 }];
    expect(parseCampaign(excessive)).toBeNull();
  });

  it("hylkää varusteyhdistelmän, jota nykyinen 3D-hahmo ei tue", () => {
    const state = createCampaign();
    state.player.equipment = { mainHand: "spear", offHand: "round_shield" };
    expect(parseCampaign(state)).toBeNull();
  });
});
