import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_STORE,
  EARLIEST_CAMPAIGN_STORE,
  LEGACY_CAMPAIGN_STORE,
  PREVIOUS_CAMPAIGN_STORE,
  VERSION5_CAMPAIGN_STORE,
  VERSION4_CAMPAIGN_STORE,
  VERSION3_CAMPAIGN_STORE,
  REJECTED_CAMPAIGN_STORE,
  clearCampaign,
  loadCampaign,
  loadCampaignReport,
  saveCampaign,
  type CampaignStorage,
} from "./storage";
import { CAMPAIGN_SCHEMA_VERSION, inventoryCapacity } from "./campaign";
import { LEGACY_YARD_POSITION } from "./sites";
import { HUNT_RULES } from "./huntGrounds";

function memoryStorage(initial?: string): CampaignStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(CAMPAIGN_STORE, initial);
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    removeItem: (key) => { data.delete(key); },
  };
}

function legacyPlayer(state: ReturnType<typeof loadCampaign>) {
  return {
    gender: state.player.gender,
    satiety: state.player.satiety,
    inventory: {
      capacity: 8,
      stacks: state.player.inventory.stacks.filter((stack) => stack.itemId !== "spear").map((stack) => ({ ...stack })),
    },
    equipment: { mainHand: state.player.equipment.mainHand, offHand: state.player.equipment.offHand },
  };
}

describe("kampanjan selainvarasto", () => {
  it("tallentaa ja palauttaa karttaruudun, ajan, kylläisyyden ja varusteet", () => {
    const storage = memoryStorage();
    const state = loadCampaign(storage);
    state.world.x = 3;
    state.world.worldMinutes = 95;
    state.player.satiety = 86;
    state.player.equipment = { ...state.player.equipment, mainHand: "spear", offHand: null };
    expect(saveCampaign(state, storage)).toBe(true);
    expect(loadCampaign(storage)).toEqual(state);
  });

  it("korvaa rikkinäisen tallennuksen turvallisella uudella kampanjalla", () => {
    const state = loadCampaign(memoryStorage("{not-json"));
    expect(state.schemaVersion).toBe(CAMPAIGN_SCHEMA_VERSION);
    expect(state.world).toMatchObject({ mapId: "kalevala-prototype", width: 20, height: 20 });
  });

  it("kopioi hylätyn tallennuksen talteen ennen uutta matkaa ja kertoo siitä", () => {
    const storage = memoryStorage("{not-json");
    const errors: unknown[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => { errors.push(args); };
    try {
      const report = loadCampaignReport(storage);
      expect(report.rejected).toBe(true);
      expect(report.campaign.schemaVersion).toBe(CAMPAIGN_SCHEMA_VERSION);
    } finally {
      console.error = original;
    }
    expect(errors).toHaveLength(1);
    const backup = JSON.parse(storage.data.get(REJECTED_CAMPAIGN_STORE)!);
    expect(backup).toMatchObject({ store: CAMPAIGN_STORE, raw: "{not-json" });
    expect(typeof backup.version).toBe("string");
    // Uudelleenaloitus ei pyyhi talteen otettua.
    clearCampaign(storage);
    expect(storage.data.has(REJECTED_CAMPAIGN_STORE)).toBe(true);
  });

  it("kelvollinen tai puuttuva tallennus ei tee kopiota", () => {
    const empty = memoryStorage();
    expect(loadCampaignReport(empty).rejected).toBe(false);
    saveCampaign(loadCampaign(empty), empty);
    expect(loadCampaignReport(empty).rejected).toBe(false);
    expect(empty.data.has(REJECTED_CAMPAIGN_STORE)).toBe(false);
  });

  it("migroi v1-avaimen nykyiseen avaimeen menettämättä etenemistä", () => {
    const storage = memoryStorage();
    const current = loadCampaign(storage);
    current.world.x = 4;
    current.world.worldMinutes = 210;
    const legacy = JSON.parse(JSON.stringify(current));
    legacy.schemaVersion = 1;
    delete legacy.world.knownSiteIds;
    legacy.player = { ...legacyPlayer(current), hunger: 65 };
    delete legacy.player.satiety;
    storage.data.set(EARLIEST_CAMPAIGN_STORE, JSON.stringify(legacy));

    const migrated = loadCampaign(storage);
    // Vanha tallennus ei tunne pihainstansseja: kiinteä piha "yard" säilyy, "yard-b" arvotaan kerran.
    // Mökki ja Louhen kalmisto jäävät entisille paikoilleen, uhrikalmisto arvotaan.
    // Samalla arvotaan metsästysapajat kerran (huntCycle asettuu nykyiseen jaksoon).
    expect(migrated.world.siteInstances.filter((i) => i.kind !== "hunt").map((i) => i.id))
      .toEqual(["yard", "lakeside", "cairnfield", "yard-b", "camp", "cairn-b"]);
    expect(migrated.world.siteInstances.filter((i) => i.kind === "hunt").length).toBeGreaterThanOrEqual(HUNT_RULES.initial[0]);
    expect(migrated.world.siteInstances[0]).toMatchObject({ x: LEGACY_YARD_POSITION.x, y: LEGACY_YARD_POSITION.y, archer: true });
    expect(migrated.world.worldSeed).toBeGreaterThan(0);
    expect(migrated.world).toEqual({
      ...current.world,
      worldSeed: migrated.world.worldSeed,
      siteInstances: migrated.world.siteInstances,
      huntCycle: migrated.world.huntCycle,
    });
    // Arvonta tallentui: seuraava lataus ei muuta pihoja.
    expect(loadCampaign(storage).world.siteInstances).toEqual(migrated.world.siteInstances);
    expect(migrated.player.satiety).toBe(35);
    expect(migrated.player.gender).toBe("male");
    expect(storage.data.has(CAMPAIGN_STORE)).toBe(true);
    expect(storage.data.has(EARLIEST_CAMPAIGN_STORE)).toBe(false);
  });

  it("migroi v2-avaimen miesoletuksella nykyiseen avaimeen", () => {
    const storage = memoryStorage();
    const legacy = JSON.parse(JSON.stringify(loadCampaign(storage)));
    legacy.schemaVersion = 2;
    legacy.player = legacyPlayer(loadCampaign(storage));
    delete legacy.player.gender;
    delete legacy.world.knownSiteIds;
    legacy.world.worldMinutes = 360;
    storage.data.delete(CAMPAIGN_STORE);
    storage.data.set(LEGACY_CAMPAIGN_STORE, JSON.stringify(legacy));

    const migrated = loadCampaign(storage);
    expect(migrated.schemaVersion).toBe(CAMPAIGN_SCHEMA_VERSION);
    expect(migrated.player.gender).toBe("male");
    expect(migrated.world.worldMinutes).toBe(360);
    expect(storage.data.has(CAMPAIGN_STORE)).toBe(true);
    expect(storage.data.has(LEGACY_CAMPAIGN_STORE)).toBe(false);
  });

  it("migroi v3:sta tunnetuiksi vain todella löydetyt vanhat paikat", () => {
    const storage = memoryStorage();
    const legacy = JSON.parse(JSON.stringify(loadCampaign(storage)));
    legacy.schemaVersion = 3;
    legacy.player = legacyPlayer(loadCampaign(storage));
    delete legacy.world.knownSiteIds;
    const yard = LEGACY_YARD_POSITION;
    legacy.world.discovered[yard.y * legacy.world.width + yard.x] = true;
    storage.data.delete(CAMPAIGN_STORE);
    storage.data.set(VERSION3_CAMPAIGN_STORE, JSON.stringify(legacy));

    const migrated = loadCampaign(storage);
    expect(migrated.world.knownSiteIds).toEqual(["yard"]);
    expect(storage.data.has(CAMPAIGN_STORE)).toBe(true);
    expect(storage.data.has(VERSION3_CAMPAIGN_STORE)).toBe(false);
  });

  it("migroi v4-avaimen nykyiseen avaimeen tyhjällä maailmanesinetilalla", () => {
    const storage = memoryStorage();
    const current = loadCampaign(storage);
    const legacy = JSON.parse(JSON.stringify(current));
    legacy.schemaVersion = 4;
    delete legacy.world.sceneItems;
    legacy.player = legacyPlayer(current);
    legacy.world.x = 5;
    storage.data.delete(CAMPAIGN_STORE);
    storage.data.set(VERSION4_CAMPAIGN_STORE, JSON.stringify(legacy));

    const migrated = loadCampaign(storage);
    expect(migrated.schemaVersion).toBe(CAMPAIGN_SCHEMA_VERSION);
    expect(migrated.world.x).toBe(5);
    expect(migrated.world.sceneItems.takenInstanceIds).toEqual([]);
    expect(storage.data.has(CAMPAIGN_STORE)).toBe(true);
    expect(storage.data.has(VERSION4_CAMPAIGN_STORE)).toBe(false);
  });

  it("migroi v5-avaimen nykyiseen avaimeen ilman että paikkatietoa päätellään uudelleen", () => {
    const storage = memoryStorage();
    const current = loadCampaign(storage);
    const legacy = JSON.parse(JSON.stringify(current));
    legacy.schemaVersion = 5;
    legacy.player = legacyPlayer(current);
    legacy.world.knownSiteIds = [];
    storage.data.delete(CAMPAIGN_STORE);
    storage.data.set(VERSION5_CAMPAIGN_STORE, JSON.stringify(legacy));

    const migrated = loadCampaign(storage);
    expect(migrated.schemaVersion).toBe(CAMPAIGN_SCHEMA_VERSION);
    expect(migrated.world.knownSiteIds).toEqual([]);
    expect(inventoryCapacity(migrated.player.inventory)).toBe(6);
    expect(migrated.player.inventory.stacks).toContainEqual({ itemId: "spear", quantity: 1 });
    expect(storage.data.has(VERSION5_CAMPAIGN_STORE)).toBe(false);
  });

  it("migroi v6-avaimen tuohikontin erilliseen reppupaikkaan", () => {
    const storage = memoryStorage();
    const current = loadCampaign(storage);
    const legacy = JSON.parse(JSON.stringify(current));
    legacy.schemaVersion = 6;
    legacy.player.inventory = {
      capacity: 12,
      stacks: [...current.player.inventory.stacks, { itemId: "birch_bark_pack", quantity: 1 }],
    };
    storage.data.delete(CAMPAIGN_STORE);
    storage.data.set(PREVIOUS_CAMPAIGN_STORE, JSON.stringify(legacy));

    const migrated = loadCampaign(storage);
    expect(migrated.player.inventory.backpack).toBe("birch_bark_pack");
    expect(migrated.player.inventory.stacks).not.toContainEqual({ itemId: "birch_bark_pack", quantity: 1 });
    expect(inventoryCapacity(migrated.player.inventory)).toBe(12);
    expect(storage.data.has(PREVIOUS_CAMPAIGN_STORE)).toBe(false);
  });

  it("palauttaa kelvollisen v1-tallennuksen vaikka migraation kirjoitus estetään", () => {
    const source = loadCampaign(memoryStorage());
    source.world.x = 7;
    const yard = LEGACY_YARD_POSITION;
    source.world.discovered[yard.y * source.world.width + yard.x] = true;
    const legacy = JSON.parse(JSON.stringify(source));
    legacy.schemaVersion = 1;
    delete legacy.world.knownSiteIds;
    legacy.player = { ...legacyPlayer(source), hunger: 25 };
    delete legacy.player.satiety;
    const serialized = JSON.stringify(legacy);
    const blocked: CampaignStorage = {
      getItem: (key) => key === EARLIEST_CAMPAIGN_STORE ? serialized : null,
      setItem: () => { throw new DOMException("blocked", "SecurityError"); },
      removeItem: () => { throw new DOMException("blocked", "SecurityError"); },
    };

    const migrated = loadCampaign(blocked);
    expect(migrated.world.x).toBe(7);
    expect(migrated.player.satiety).toBe(75);
    expect(migrated.world.knownSiteIds).toEqual(["yard"]);
  });

  it("korvaa turvallisesti myös eri karttaversiolle kuuluvan tallennuksen", () => {
    const old = loadCampaign(memoryStorage());
    old.world.mapId = "old-world";
    old.world.width = 10;
    old.world.height = 10;
    old.world.x = 2;
    old.world.y = 2;
    old.world.discovered = Array<boolean>(100).fill(false);
    const storage = memoryStorage(JSON.stringify(old));
    expect(loadCampaign(storage).world).toMatchObject({ mapId: "kalevala-prototype", width: 20, height: 20 });
  });

  it("poistaa vain kampanjan oman avaimen", () => {
    const storage = memoryStorage("saved");
    storage.data.set(LEGACY_CAMPAIGN_STORE, "old");
    storage.data.set(PREVIOUS_CAMPAIGN_STORE, "previous");
    storage.data.set(VERSION5_CAMPAIGN_STORE, "version5");
    storage.data.set(VERSION4_CAMPAIGN_STORE, "version4");
    storage.data.set(VERSION3_CAMPAIGN_STORE, "version3");
    storage.data.set(EARLIEST_CAMPAIGN_STORE, "oldest");
    storage.data.set("other", "keep");
    expect(clearCampaign(storage)).toBe(true);
    expect(storage.data.get(CAMPAIGN_STORE)).toBeUndefined();
    expect(storage.data.get(PREVIOUS_CAMPAIGN_STORE)).toBeUndefined();
    expect(storage.data.get(VERSION5_CAMPAIGN_STORE)).toBeUndefined();
    expect(storage.data.get(VERSION4_CAMPAIGN_STORE)).toBeUndefined();
    expect(storage.data.get(VERSION3_CAMPAIGN_STORE)).toBeUndefined();
    expect(storage.data.get(LEGACY_CAMPAIGN_STORE)).toBeUndefined();
    expect(storage.data.get(EARLIEST_CAMPAIGN_STORE)).toBeUndefined();
    expect(storage.data.get("other")).toBe("keep");
  });
});
