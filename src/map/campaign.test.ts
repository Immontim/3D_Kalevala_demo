import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_SCHEMA_VERSION,
  SATIETY_MAX,
  ITEMS,
  combatLoadout,
  consumeFood,
  createCampaign,
  parseCampaign,
  serializeCampaign,
  setEquipped,
  setPlayerGender,
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
    expect(state.player.satiety).toBe(SATIETY_MAX);
    expect(state.player.gender).toBe("male");
    expect(ITEMS.barley_flatbread.satietyGain).toBeGreaterThan(0);
    expect(ITEMS.dried_fish.satietyGain).toBeGreaterThan(ITEMS.barley_flatbread.satietyGain!);
  });

  it("syö yhden ruuan, kasvattaa kylläisyyttä ja poistaa tyhjän pinon", () => {
    const start = createCampaign();
    start.player.satiety = 70;
    start.player.inventory.stacks = [{ itemId: "barley_flatbread", quantity: 1 }];
    const result = consumeFood(start, "barley_flatbread");
    expect(result.consumed).toBe(true);
    expect(result.state.player.satiety).toBe(94);
    expect(result.state.player.inventory.stacks).toEqual([]);
    expect(start.player.satiety).toBe(70);
  });

  it("ei nosta kylläisyyttä yli sadan eikä syö puuttuvaa tai täysin kylläisenä", () => {
    const start = createCampaign();
    start.player.satiety = 95;
    expect(consumeFood(start, "dried_fish").state.player.satiety).toBe(SATIETY_MAX);
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

  it("vaihtaa sankarin sukupuolen muuttamatta muuta kampanjatilaa", () => {
    const state = createCampaign();
    const female = setPlayerGender(state, "female");
    expect(female.player.gender).toBe("female");
    expect(female.world).toBe(state.world);
    expect(female.player.inventory).toBe(state.player.inventory);
    expect(setPlayerGender(female, "female")).toBe(female);
  });
});

describe("kampanjatallennus", () => {
  it("serialisoi ja lukee turvallisen kopion", () => {
    const state = createCampaign({ x: 2, y: 4 });
    state.player.satiety = 0;
    const loaded = parseCampaign(serializeCampaign(state));
    expect(loaded).toEqual(state);
    expect(loaded).not.toBe(state);
    expect(loaded!.world.discovered).not.toBe(state.world.discovered);
  });

  it("hylkää rikkinäisen JSONin, väärän version ja kartan koon", () => {
    expect(parseCampaign("{" )).toBeNull();
    expect(parseCampaign({ schemaVersion: 99 })).toBeNull();
    const state = createCampaign();
    state.world.discovered.pop();
    expect(parseCampaign(state)).toBeNull();
  });

  it("migroi version 1 nälän version 2 kylläisyydeksi ja säilyttää etenemisen", () => {
    const current = createCampaign({ x: 7, y: 9 });
    current.world.worldMinutes = 345;
    current.world.discovered[0] = true;
    const legacy = {
      ...current,
      schemaVersion: 1,
      player: { ...current.player, hunger: 73, satiety: undefined },
    };
    const migrated = parseCampaign(JSON.parse(JSON.stringify(legacy)));
    expect(migrated).not.toBeNull();
    expect(migrated!.schemaVersion).toBe(CAMPAIGN_SCHEMA_VERSION);
    expect(migrated!.player.satiety).toBe(27);
    expect(migrated!.world).toEqual(current.world);
    expect(migrated!.player.inventory).toEqual(current.player.inventory);
    expect(migrated!.player.equipment).toEqual(current.player.equipment);
    expect(migrated!.player.gender).toBe("male");
  });

  it("migroi version 2 tallennuksen miesoletukseen", () => {
    const current = createCampaign({ x: 6, y: 8 });
    current.player.satiety = 42;
    const legacy = JSON.parse(serializeCampaign(current));
    legacy.schemaVersion = 2;
    legacy.player.gender = "female";
    const migrated = parseCampaign(legacy);
    expect(migrated).not.toBeNull();
    expect(migrated!.schemaVersion).toBe(CAMPAIGN_SCHEMA_VERSION);
    expect(migrated!.player.gender).toBe("male");
    expect(migrated!.player.satiety).toBe(42);
    expect(migrated!.world).toEqual(current.world);
  });

  it("hylkää kylläisyyden ja vanhan nälän sallitun alueen ulkopuolelta", () => {
    const invalidCurrent = createCampaign();
    invalidCurrent.player.satiety = 101;
    expect(parseCampaign(invalidCurrent)).toBeNull();

    const legacy = JSON.parse(serializeCampaign(createCampaign()));
    legacy.schemaVersion = 1;
    delete legacy.player.satiety;
    legacy.player.hunger = -1;
    expect(parseCampaign(legacy)).toBeNull();
  });

  it("hylkää tuntemattoman sankarin sukupuolen", () => {
    const invalid = JSON.parse(serializeCampaign(createCampaign()));
    invalid.player.gender = "unknown";
    expect(parseCampaign(invalid)).toBeNull();
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
