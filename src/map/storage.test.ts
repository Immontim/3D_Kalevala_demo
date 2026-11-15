import { describe, expect, it } from "vitest";
import { CAMPAIGN_STORE, clearCampaign, loadCampaign, saveCampaign, type CampaignStorage } from "./storage";

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
  it("tallentaa ja palauttaa karttaruudun, ajan, nälän ja varusteet", () => {
    const storage = memoryStorage();
    const state = loadCampaign(storage);
    state.world.x = 3;
    state.world.worldMinutes = 95;
    state.player.hunger = 14;
    state.player.equipment = { mainHand: "spear", offHand: null };
    expect(saveCampaign(state, storage)).toBe(true);
    expect(loadCampaign(storage)).toEqual(state);
  });

  it("korvaa rikkinäisen tallennuksen turvallisella uudella kampanjalla", () => {
    const state = loadCampaign(memoryStorage("{not-json"));
    expect(state.schemaVersion).toBe(1);
    expect(state.world).toMatchObject({ mapId: "kalevala-prototype", width: 20, height: 20 });
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
    storage.data.set("other", "keep");
    expect(clearCampaign(storage)).toBe(true);
    expect(storage.data.get(CAMPAIGN_STORE)).toBeUndefined();
    expect(storage.data.get("other")).toBe("keep");
  });
});
