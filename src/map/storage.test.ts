import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_STORE,
  EARLIEST_CAMPAIGN_STORE,
  LEGACY_CAMPAIGN_STORE,
  clearCampaign,
  loadCampaign,
  saveCampaign,
  type CampaignStorage,
} from "./storage";

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

describe("kampanjan selainvarasto", () => {
  it("tallentaa ja palauttaa karttaruudun, ajan, kylläisyyden ja varusteet", () => {
    const storage = memoryStorage();
    const state = loadCampaign(storage);
    state.world.x = 3;
    state.world.worldMinutes = 95;
    state.player.satiety = 86;
    state.player.equipment = { mainHand: "spear", offHand: null };
    expect(saveCampaign(state, storage)).toBe(true);
    expect(loadCampaign(storage)).toEqual(state);
  });

  it("korvaa rikkinäisen tallennuksen turvallisella uudella kampanjalla", () => {
    const state = loadCampaign(memoryStorage("{not-json"));
    expect(state.schemaVersion).toBe(3);
    expect(state.world).toMatchObject({ mapId: "kalevala-prototype", width: 20, height: 20 });
  });

  it("migroi v1-avaimen tallennuksen v2-avaimeen menettämättä etenemistä", () => {
    const storage = memoryStorage();
    const current = loadCampaign(storage);
    current.world.x = 4;
    current.world.worldMinutes = 210;
    const legacy = JSON.parse(JSON.stringify(current));
    legacy.schemaVersion = 1;
    delete legacy.player.satiety;
    legacy.player.hunger = 65;
    storage.data.set(EARLIEST_CAMPAIGN_STORE, JSON.stringify(legacy));

    const migrated = loadCampaign(storage);
    expect(migrated.world).toEqual(current.world);
    expect(migrated.player.satiety).toBe(35);
    expect(migrated.player.gender).toBe("male");
    expect(storage.data.has(CAMPAIGN_STORE)).toBe(true);
    expect(storage.data.has(EARLIEST_CAMPAIGN_STORE)).toBe(false);
  });

  it("migroi v2-avaimen miesoletuksella v3-avaimeen", () => {
    const storage = memoryStorage();
    const legacy = JSON.parse(JSON.stringify(loadCampaign(storage)));
    legacy.schemaVersion = 2;
    delete legacy.player.gender;
    legacy.world.worldMinutes = 360;
    storage.data.delete(CAMPAIGN_STORE);
    storage.data.set(LEGACY_CAMPAIGN_STORE, JSON.stringify(legacy));

    const migrated = loadCampaign(storage);
    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.player.gender).toBe("male");
    expect(migrated.world.worldMinutes).toBe(360);
    expect(storage.data.has(CAMPAIGN_STORE)).toBe(true);
    expect(storage.data.has(LEGACY_CAMPAIGN_STORE)).toBe(false);
  });

  it("palauttaa kelvollisen v1-tallennuksen vaikka migraation kirjoitus estetään", () => {
    const source = loadCampaign(memoryStorage());
    source.world.x = 7;
    const legacy = JSON.parse(JSON.stringify(source));
    legacy.schemaVersion = 1;
    delete legacy.player.satiety;
    legacy.player.hunger = 25;
    const serialized = JSON.stringify(legacy);
    const blocked: CampaignStorage = {
      getItem: (key) => key === EARLIEST_CAMPAIGN_STORE ? serialized : null,
      setItem: () => { throw new DOMException("blocked", "SecurityError"); },
      removeItem: () => { throw new DOMException("blocked", "SecurityError"); },
    };

    const migrated = loadCampaign(blocked);
    expect(migrated.world.x).toBe(7);
    expect(migrated.player.satiety).toBe(75);
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
    storage.data.set(EARLIEST_CAMPAIGN_STORE, "oldest");
    storage.data.set("other", "keep");
    expect(clearCampaign(storage)).toBe(true);
    expect(storage.data.get(CAMPAIGN_STORE)).toBeUndefined();
    expect(storage.data.get(LEGACY_CAMPAIGN_STORE)).toBeUndefined();
    expect(storage.data.get(EARLIEST_CAMPAIGN_STORE)).toBeUndefined();
    expect(storage.data.get("other")).toBe("keep");
  });
});
