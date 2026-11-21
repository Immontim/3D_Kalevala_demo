import { describe, expect, it } from "vitest";
import { baseStats } from "../stats";
import {
  applyMapToSceneTransition,
  campaignSatiety,
  consumeSceneReturn,
  parseSceneReturn,
  createEmptySceneReturn,
  createMapToSceneTransition,
  saveSceneReturn,
  satietyPenalty,
} from "./transition";

function actor() {
  const base = baseStats("hero");
  return { base, mods: [], stats: { ...base }, hp: base.maxHp, stamina: base.maxStamina };
}

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

describe("2D- ja 3D-kohtauksen siirtymä", () => {
  it("ei rankaise ystävällisessä kohtauksessa kylläisyydestä riippumatta", () => {
    expect(satietyPenalty(0, "friendly")).toBe(0);
    expect(createMapToSceneTransition("yard", "friendly", 0)).toMatchObject({
      maxHpPenalty: 0,
      maxStaminaPenalty: 0,
    });
    expect(createMapToSceneTransition("lakeside", "friendly", 0)).toMatchObject({
      scene: "lakeside",
      maxHpPenalty: 0,
      maxStaminaPenalty: 0,
    });
  });

  it("käyttää taistelun rajatapauksissa arvoja 50, 49 ja 0 oikein", () => {
    expect(satietyPenalty(50, "battle")).toBe(0);
    expect(satietyPenalty(49, "battle")).toBe(20);
    expect(satietyPenalty(1, "battle")).toBe(20);
    expect(satietyPenalty(0, "battle")).toBe(40);
  });

  it("alentaa sekä nykyiset että enimmäisarvot ja on idempotentti", () => {
    const hero = actor();
    const entry = createMapToSceneTransition("clearing", "battle", 20);
    applyMapToSceneTransition(hero, entry);
    applyMapToSceneTransition(hero, entry);
    expect(hero.stats.maxHp).toBe(80);
    expect(hero.stats.maxStamina).toBe(80);
    expect(hero.hp).toBe(80);
    expect(hero.stamina).toBe(80);
    expect(hero.mods).toHaveLength(2);
  });

  it("lukitsee nääntyneen arvot 40 pistettä alemmas", () => {
    const hero = actor();
    applyMapToSceneTransition(hero, createMapToSceneTransition("homestead", "battle", 0));
    expect(hero.stats.maxHp).toBe(60);
    expect(hero.stats.maxStamina).toBe(60);
  });

  it("luo tyhjän, tyypitetyn paluukuorman tulevia palkintoja varten", () => {
    expect(createEmptySceneReturn("clearing")).toEqual({
      schemaVersion: 1,
      scene: "clearing",
      rewards: [],
    });
  });

  it("kuljettaa tyhjän paluukuorman sivunlatauksen yli ja kuluttaa sen kerran", () => {
    const storage = memoryStorage();
    const payload = createEmptySceneReturn("clearing");
    expect(saveSceneReturn(payload, storage)).toBe(true);
    expect(consumeSceneReturn(storage)).toEqual(payload);
    expect(consumeSceneReturn(storage)).toBeNull();
  });

  it("hylkää ja kuluttaa rikkinäisen paluukuorman", () => {
    const storage = memoryStorage();
    storage.setItem("laulun-miekka.scene-return.v1", "{rikki");
    expect(consumeSceneReturn(storage)).toBeNull();
    expect(consumeSceneReturn(storage)).toBeNull();
  });

  it("hylkää väärän skeeman ja epäkelvon palkinnon", () => {
    const wrongSchema = memoryStorage();
    wrongSchema.setItem("laulun-miekka.scene-return.v1", JSON.stringify({
      schemaVersion: 2, scene: "clearing", rewards: [],
    }));
    expect(consumeSceneReturn(wrongSchema)).toBeNull();

    const badReward = memoryStorage();
    badReward.setItem("laulun-miekka.scene-return.v1", JSON.stringify({
      schemaVersion: 1, scene: "clearing", rewards: [{ itemId: "food", quantity: 0 }],
    }));
    expect(consumeSceneReturn(badReward)).toBeNull();
  });

  it("lukee uuden kylläisyyden ja muuntaa vanhan hunger-kentän", () => {
    expect(campaignSatiety({ satiety: 72 })).toBe(72);
    expect(campaignSatiety({ hunger: 28 })).toBe(72);
    expect(campaignSatiety({})).toBe(100);
  });
});

describe("poistumissuunta paluukuoressa", () => {
  it("säilyttää kelvollisen exitDirin ja pudottaa tuntemattoman", () => {
    expect(createEmptySceneReturn("wilds", "e")).toEqual({ schemaVersion: 1, scene: "wilds", rewards: [], exitDir: "e" });
    expect(parseSceneReturn({ schemaVersion: 1, scene: "wilds", rewards: [], exitDir: "n" })?.exitDir).toBe("n");
    const bad = parseSceneReturn({ schemaVersion: 1, scene: "wilds", rewards: [], exitDir: "up" });
    expect(bad).toEqual({ schemaVersion: 1, scene: "wilds", rewards: [] });
  });
  it("kulkee tallennuksen läpi", () => {
    const storage = memoryStorage();
    saveSceneReturn(createEmptySceneReturn("yard", "s"), storage);
    expect(consumeSceneReturn(storage)?.exitDir).toBe("s");
  });
});
