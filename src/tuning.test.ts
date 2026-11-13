import { afterEach, describe, expect, it } from "vitest";
import { CHARACTERS, STAMINA, WEAPONS } from "./combat";
import { SONG } from "./songLogic";
import { baseStats, effectiveStats, withModifier, Modifier } from "./stats";
import {
  DEFAULTS, FIELDS, applyTuning, changedValues, clampValue, exportTuning, getValue, parseChanges, parseTuningText, resetTuning,
} from "./tuning";

afterEach(() => resetTuning());

describe("hahmon kyvyt", () => {
  it("perusarvot tulevat hahmon rivistä, ja aalto kasvattaa vastustajan elämää ja voimaa", () => {
    expect(baseStats("hero")).toMatchObject({ maxHp: 100, maxStamina: 100, power: 20, staminaRegen: 1, moveSpeed: 3.4 });
    expect(baseStats("urho", 1)).toMatchObject({ maxHp: 90, maxStamina: 60, power: 15 });
    expect(baseStats("pohja", 3)).toMatchObject({ maxHp: 140, maxStamina: 80, power: 17 });
  });
  it("vaikutukset lasketaan perusarvojen päälle: ensin lisäykset, sitten kertoimet", () => {
    const base = baseStats("hero");
    const mods: Modifier[] = [
      { id: "ruoka", stat: "maxStamina", add: 20 },
      { id: "loitsu", stat: "maxStamina", mul: 1.5 },
      { id: "nälkä", stat: "staminaRegen", mul: 0.5 },
    ];
    const s = effectiveStats(base, mods, 0);
    expect(s.maxStamina).toBe(180);
    expect(s.staminaRegen).toBe(0.5);
    expect(s.power).toBe(base.power);
    expect(base.maxStamina).toBe(100);
  });
  it("ajastettu vaikutus loppuu itsestään", () => {
    const mods: Modifier[] = [{ id: "juoma", stat: "power", add: 10, until: 30 }];
    expect(effectiveStats(baseStats("hero"), mods, 29).power).toBe(30);
    expect(effectiveStats(baseStats("hero"), mods, 30).power).toBe(20);
  });
  it("sama tunniste korvaa aiemman vaikutuksen, eikä arvo mene alle nollan", () => {
    let mods = withModifier([], { id: "a", stat: "power", add: 5 });
    mods = withModifier(mods, { id: "a", stat: "power", add: -500 });
    expect(mods).toHaveLength(1);
    expect(effectiveStats(baseStats("hero"), mods, 0).power).toBe(0);
  });
});

describe("säädettävät arvot", () => {
  it("jokainen säätövälilehden kenttä osoittaa olemassa olevaan lukuun, ja oletus on rajojen sisällä", () => {
    for (const f of FIELDS) {
      const def = DEFAULTS.get(f.path);
      expect(def, f.path).toBeTypeOf("number");
      expect(def!, f.path).toBeGreaterThanOrEqual(f.min);
      expect(def!, f.path).toBeLessThanOrEqual(f.max);
    }
    expect(new Set(FIELDS.map((f) => f.path)).size).toBe(FIELDS.length);
  });
  it("muutos vaikuttaa pelin taulukoihin ja palautuu oletuksiin", () => {
    applyTuning({ characters: { hero: { hp: 150 } }, song: { speed: 1.75 }, weapons: { spear: { reach: 1.4 } } });
    expect(CHARACTERS.hero.hp).toBe(150);
    expect(baseStats("hero").maxHp).toBe(150);
    expect(SONG.speed).toBe(1.75);
    expect(WEAPONS.spear.reach).toBe(1.4);
    expect(changedValues().size).toBe(3);
    resetTuning();
    expect(CHARACTERS.hero.hp).toBe(100);
    expect(changedValues().size).toBe(0);
  });
  it("uusi muutosjoukko korvaa edellisen kokonaan", () => {
    applyTuning({ stamina: { heavy: 12 } });
    applyTuning({ stamina: { light: 4 } });
    expect(STAMINA.heavy).toBe(9);
    expect(STAMINA.light).toBe(4);
  });
  it("tuntematon polku ja muu kuin luku hylätään, ja arvo rajataan sallittuun väliin", () => {
    const r = parseChanges({ characters: { hero: { hp: -5, nimi: "x" } }, olematon: { a: 1 }, song: { speed: 0 } });
    expect(r.rejected.sort()).toEqual(["characters.hero.nimi", "olematon.a"]);
    expect(r.clamped.sort()).toEqual(["characters.hero.hp", "song.speed"]);
    expect(r.values.get("characters.hero.hp")).toBe(1);
    expect(r.values.get("song.speed")).toBe(0.25);
    expect(CHARACTERS.hero.hp).toBe(100);
  });
  it("kentätön kesto tai jakaja ei voi mennä nollaan", () => {
    expect(clampValue("weapons.spear.slowness", 0)).toBeGreaterThan(0);
    expect(clampValue("strikes.slash.light.timing.release", -1)).toBeGreaterThan(0);
    expect(clampValue("enemyAi.blockSpearBonus", -0.3)).toBe(-0.3);
  });
  it("vienti sisältää version ja vain muutetut arvot, ja sen voi lukea takaisin", () => {
    applyTuning({ "characters.urho.stamina": 75, waves: { restHp: 50 } });
    const text = exportTuning("v00.00.00");
    expect(JSON.parse(text)).toEqual({
      peli: "Laulun miekka", versio: "v00.00.00",
      muutokset: { characters: { urho: { stamina: 75 } }, waves: { restHp: 50 } },
    });
    resetTuning();
    const back = parseTuningText(text);
    expect("error" in back).toBe(false);
    if (!("error" in back)) expect([...back.values]).toEqual([["characters.urho.stamina", 75], ["waves.restHp", 50]]);
  });
  it("virheellinen teksti ei muuta mitään", () => {
    expect(parseTuningText("{ rikki")).toHaveProperty("error");
    expect(parseTuningText("[1, 2]")).toHaveProperty("error");
    expect(getValue("characters.hero.hp")).toBe(100);
  });
  it("oletuksen suuruinen arvo ei ole muutos", () => {
    expect(parseChanges({ characters: { hero: { hp: 100 } } }).values.size).toBe(0);
  });
});
