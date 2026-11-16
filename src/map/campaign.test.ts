import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_SCHEMA_VERSION,
  SATIETY_MAX,
  ITEMS,
  combatLoadout,
  consumeFood,
  createCampaign,
  parseCampaign,
  sceneItemTakeMode,
  serializeCampaign,
  setEquipped,
  setPlayerGender,
  setSceneItemTakeMode,
  tryAddItem,
  tryTakeSceneItem,
  type SceneItemDefinition,
} from "./campaign";

describe("kampanjatila", () => {
  it("luo 20 × 20 maailman, kahdeksan tavarapaikkaa ja kolme aloitusrieskaa", () => {
    const state = createCampaign();
    expect(state.schemaVersion).toBe(CAMPAIGN_SCHEMA_VERSION);
    expect(state.world).toMatchObject({ width: 20, height: 20, worldMinutes: 0 });
    expect(state.world.discovered).toHaveLength(400);
    expect(state.world.knownSiteIds).toEqual([]);
    expect(state.world.sceneItems).toEqual({
      takenInstanceIds: [], takeModeOverrides: [], thefts: [], droppedItems: [], nextDroppedItemId: 1,
    });
    expect(state.player.inventory.capacity).toBe(8);
    expect(state.player.inventory.stacks).toEqual([
      { itemId: "barley_flatbread", quantity: 3 },
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
    start.player.inventory.stacks = [{ itemId: "dried_fish", quantity: 1 }];
    expect(consumeFood(start, "dried_fish").state.player.satiety).toBe(SATIETY_MAX);
    const empty = createCampaign();
    empty.player.inventory.stacks = [];
    const result = consumeFood(empty, "dried_fish");
    expect(result).toEqual({ state: empty, consumed: false });
    const sated = createCampaign();
    expect(consumeFood(sated, "barley_flatbread")).toEqual({ state: sated, consumed: false });
  });

  it("täyttää vajaat pinot ja luo tarvittaessa useita saman esineen pinoja", () => {
    const inventory = createCampaign().player.inventory;
    const added = tryAddItem(inventory, "barley_flatbread", 8);
    expect(added?.stacks).toEqual([
      { itemId: "barley_flatbread", quantity: 6 },
      { itemId: "barley_flatbread", quantity: 5 },
    ]);
    expect(inventory.stacks).toEqual([{ itemId: "barley_flatbread", quantity: 3 }]);
  });

  it("lisää vain koko määrän eikä muuta täyttä inventaariota", () => {
    const inventory = createCampaign().player.inventory;
    inventory.stacks = Array.from({ length: 8 }, () => ({ itemId: "birch_bark_pack" as const, quantity: 1 }));
    expect(tryAddItem(inventory, "dried_fish", 1)).toBeNull();
    expect(inventory.stacks).toHaveLength(8);
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

describe("maailmanesineet", () => {
  const pack: SceneItemDefinition = {
    instanceId: "lakeside.sage-pack",
    siteId: "lakeside",
    itemId: "birch_bark_pack",
    quantity: 1,
    takeMode: "theft",
    ownerId: "tietaja",
  };

  it("ottaa sallitun esineen, lisää inventaarioon ja merkitsee instanssin poistetuksi", () => {
    const state = setSceneItemTakeMode(createCampaign(), pack.instanceId, "allowed");
    const result = tryTakeSceneItem(state, pack);
    expect(result.status).toBe("taken");
    if (result.status !== "taken") return;
    expect(result.takeMode).toBe("allowed");
    expect(result.theft).toBeNull();
    expect(result.state.player.inventory.stacks).toContainEqual({ itemId: "birch_bark_pack", quantity: 1 });
    expect(result.state.world.sceneItems.takenInstanceIds).toContain(pack.instanceId);
    expect(state.player.inventory.stacks).not.toContainEqual({ itemId: "birch_bark_pack", quantity: 1 });
  });

  it("ottaa varkausesineen mutta kirjaa omistajan, paikan ja ajan seurauksia varten", () => {
    const state = createCampaign();
    state.world.worldMinutes = 42;
    const result = tryTakeSceneItem(state, pack);
    expect(result.status).toBe("taken");
    if (result.status !== "taken") return;
    expect(result.takeMode).toBe("theft");
    expect(result.theft).toEqual({
      type: "theft", instanceId: pack.instanceId, siteId: "lakeside", itemId: "birch_bark_pack",
      quantity: 1, ownerId: "tietaja", atWorldMinutes: 42,
    });
    expect(result.state.world.sceneItems.thefts).toEqual([result.theft]);
  });

  it("lupamuutos ohittaa staattisen oletuksen ja saman instanssin voi ottaa vain kerran", () => {
    const allowed = setSceneItemTakeMode(createCampaign(), pack.instanceId, "allowed");
    expect(sceneItemTakeMode(allowed, pack)).toBe("allowed");
    const first = tryTakeSceneItem(allowed, pack);
    expect(first.status).toBe("taken");
    const second = tryTakeSceneItem(first.state, pack);
    expect(second).toEqual({ state: first.state, status: "already-taken" });
  });

  it("jättää esineen ja kampanjan koskematta, jos koko määrä ei mahdu", () => {
    const state = createCampaign();
    state.player.inventory.stacks = Array.from({ length: 8 }, () => ({ itemId: "birch_bark_pack" as const, quantity: 1 }));
    const food: SceneItemDefinition = {
      instanceId: "yard.table-fish", siteId: "yard", itemId: "dried_fish", quantity: 3,
      takeMode: "theft", ownerId: "yard-household",
    };
    expect(tryTakeSceneItem(state, food)).toEqual({ state, status: "inventory-full" });
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
    expect(loaded!.world.knownSiteIds).not.toBe(state.world.knownSiteIds);
    expect(loaded!.world.sceneItems).not.toBe(state.world.sceneItems);
  });

  it("hylkää rikkinäisen JSONin, väärän version ja kartan koon", () => {
    expect(parseCampaign("{" )).toBeNull();
    expect(parseCampaign({ schemaVersion: 99 })).toBeNull();
    const state = createCampaign();
    state.world.discovered.pop();
    expect(parseCampaign(state)).toBeNull();
  });

  it("hylkää epäkelvon tai kahteen kertaan tallennetun paikkatiedon", () => {
    const duplicate = createCampaign();
    duplicate.world.knownSiteIds = ["yard", "yard"];
    expect(parseCampaign(duplicate)).toBeNull();
    const malformed = createCampaign();
    malformed.world.knownSiteIds = [""];
    expect(parseCampaign(malformed)).toBeNull();
  });

  it("migroi version 3 tallennuksen tyhjään paikkatietoon", () => {
    const legacy = JSON.parse(serializeCampaign(createCampaign({ x: 8, y: 9 })));
    legacy.schemaVersion = 3;
    delete legacy.world.knownSiteIds;
    const migrated = parseCampaign(legacy);
    expect(migrated).not.toBeNull();
    expect(migrated!.schemaVersion).toBe(CAMPAIGN_SCHEMA_VERSION);
    expect(migrated!.world.knownSiteIds).toEqual([]);
    expect(migrated!.world.sceneItems.takenInstanceIds).toEqual([]);
  });

  it("migroi version 4 tallennuksen tyhjään maailmanesinetilaan", () => {
    const legacy = JSON.parse(serializeCampaign(createCampaign({ x: 8, y: 9 })));
    legacy.schemaVersion = 4;
    delete legacy.world.sceneItems;
    const migrated = parseCampaign(legacy);
    expect(migrated?.schemaVersion).toBe(CAMPAIGN_SCHEMA_VERSION);
    expect(migrated?.world.sceneItems).toEqual({
      takenInstanceIds: [], takeModeOverrides: [], thefts: [], droppedItems: [], nextDroppedItemId: 1,
    });
  });

  it("migroi version 1 nälän version 2 kylläisyydeksi ja säilyttää etenemisen", () => {
    const current = createCampaign({ x: 7, y: 9 });
    current.world.worldMinutes = 345;
    current.world.discovered[0] = true;
    const legacy = {
      ...current,
      schemaVersion: 1,
      world: { ...current.world, knownSiteIds: undefined },
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
    delete legacy.world.knownSiteIds;
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

  it("sallii useita kelvollisia saman esineen pinoja", () => {
    const state = createCampaign();
    state.player.inventory.stacks = [
      { itemId: "dried_fish", quantity: 4 },
      { itemId: "dried_fish", quantity: 2 },
    ];
    expect(parseCampaign(state)?.player.inventory.stacks).toEqual(state.player.inventory.stacks);
  });

  it("hylkää rikkinäisen maailmanesinetilan ja epäkelvon pudotuksen", () => {
    const duplicate = createCampaign();
    duplicate.world.sceneItems.takenInstanceIds = ["yard.food", "yard.food"];
    expect(parseCampaign(duplicate)).toBeNull();

    const invalidDrop = createCampaign();
    invalidDrop.world.sceneItems.droppedItems.push({
      instanceId: "drop.1", siteId: "yard", itemId: "barley_flatbread", quantity: 1,
      x: Number.NaN, y: 0, z: 0, yaw: 0, takeMode: "allowed",
    });
    expect(parseCampaign(invalidDrop)).toBeNull();
  });

  it("hylkää varusteyhdistelmän, jota nykyinen 3D-hahmo ei tue", () => {
    const state = createCampaign();
    state.player.equipment = { mainHand: "spear", offHand: "round_shield" };
    expect(parseCampaign(state)).toBeNull();
  });
});

describe("moottoriosio (engine)", () => {
  it("uusi kampanja alkaa tyhjällä, versioidulla lohkolla", () => {
    expect(createCampaign().engine).toEqual({ version: 1, flags: {}, counters: {} });
  });

  it("liput ja laskurit säilyvät tallennuksen läpi", () => {
    const state = createCampaign();
    state.engine = { version: 1, flags: { "sage.robbed": true }, counters: { "thefts.noticed": 2 } };
    expect(parseCampaign(serializeCampaign(state))?.engine).toEqual(state.engine);
  });

  it("salliva luku: tuntematon lippu ja roskakentät pudotetaan, mutta kampanja ja kelvolliset liput säilyvät", () => {
    const raw = JSON.parse(serializeCampaign(createCampaign()));
    raw.engine = {
      version: 99,
      flags: { "sage.robbed": true, "poistettu.lippu": true, "sage.permission": "kyllä", "rumor.heard": false },
      counters: { "thefts.noticed": 5000, "tuntematon": 3, "thefts.noticed2": 1 },
      extra: "ei tunneta",
    };
    const parsed = parseCampaign(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.engine).toEqual({ version: 1, flags: { "sage.robbed": true }, counters: { "thefts.noticed": 999 } });
    expect(parsed?.player.inventory.stacks).toEqual([{ itemId: "barley_flatbread", quantity: 3 }]);
  });

  it("puuttuva tai rikkinäinen lohko ei hylkää tallennusta (vanha v5 ennen moottoria)", () => {
    for (const engine of [undefined, null, "roska", 7, [], { flags: "x", counters: [] }]) {
      const raw = JSON.parse(serializeCampaign(createCampaign()));
      if (engine === undefined) delete raw.engine; else raw.engine = engine;
      expect(parseCampaign(raw)?.engine).toEqual({ version: 1, flags: {}, counters: {} });
    }
  });
});

describe("tryRemoveItem", () => {
  it("ottaa määrän useasta pinosta ja poistaa tyhjät pinot", async () => {
    const { tryRemoveItem } = await import("./campaign");
    const inv = { capacity: 8 as const, stacks: [{ itemId: "dried_fish" as const, quantity: 4 }, { itemId: "barley_flatbread" as const, quantity: 3 }, { itemId: "dried_fish" as const, quantity: 2 }] };
    expect(tryRemoveItem(inv, "dried_fish", 3)?.stacks).toEqual([
      { itemId: "dried_fish", quantity: 3 }, { itemId: "barley_flatbread", quantity: 3 },
    ]);
    expect(tryRemoveItem(inv, "dried_fish", 6)?.stacks).toEqual([{ itemId: "barley_flatbread", quantity: 3 }]);
    expect(tryRemoveItem(inv, "dried_fish", 7)).toBeNull();
    expect(tryRemoveItem(inv, "dried_fish", 0)).toBeNull();
  });
});
