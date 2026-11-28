import { describe, expect, it } from "vitest";
import {
  AMBUSH_CHANCE,
  ambushCanHappen,
  ambushExitDir,
  ambushRoster,
  ambushSiteId,
  ambushSize,
  ambushSpawns,
  oppositeDir,
  parseAmbushSite,
  rollsAmbush,
  warriorNameKey,
} from "./ambush";
import { createCampaign, isFood, tryAddItem, withoutFood } from "./map/campaign";
import { SITE_PATTERN } from "./app/route";
import { clampToWalkable, entrySpawn, sceneLayout, walkableDepth } from "./sceneLayout";

describe("väijytyksen arvonta kartalla", () => {
  it("arvotaan vain 3D-paikattomaan ruutuun eikä paluun automaattisella askeleella", () => {
    expect(ambushCanHappen(undefined, false)).toBe(true);
    expect(ambushCanHappen("yard-b", false)).toBe(false);
    expect(ambushCanHappen("hunt-3", false)).toBe(false);
    expect(ambushCanHappen(undefined, true)).toBe(false);
  });
  it("todennäköisyys on 5 %", () => {
    expect(AMBUSH_CHANCE).toBe(0.05);
    expect(rollsAmbush(0.049)).toBe(true);
    expect(rollsAmbush(0.05)).toBe(false);
  });
});

describe("väijytyksen tunniste", () => {
  it("siemen ja kulkusuunta kulkevat tunnisteessa ja kelpaavat reitin site-parametriksi", () => {
    const id = ambushSiteId(4294967295, "e");
    expect(id).toBe("ambush-4294967295-e");
    expect(SITE_PATTERN.test(id)).toBe(true);
    expect(parseAmbushSite(id)).toEqual({ seed: 4294967295, travel: "e" });
    expect(parseAmbushSite("ambush-12-x")).toBeNull();
    expect(parseAmbushSite("yard")).toBeNull();
    expect(parseAmbushSite(null)).toBeNull();
  });
  it("takaisin vievä polunsuu palaa lähtöruutuun, eteenpäin vievä jättää kohderuutuun", () => {
    expect(oppositeDir("n")).toBe("s");
    expect(oppositeDir("w")).toBe("e");
    expect(ambushExitDir("back", "n")).toBe("s");
    expect(ambushExitDir("back", "e")).toBe("w");
    expect(ambushExitDir("forward", "n")).toBeNull();
  });
});

describe("väijyjien joukko", () => {
  const seeds = Array.from({ length: 3000 }, (_, i) => i * 7919 + 13);
  it("1–3 soturia, enintään yksi kilpi ja yksi keihäs, keihäsmiehellä ei kilpeä", () => {
    for (const seed of seeds) {
      const roster = ambushRoster(seed);
      expect(roster.length).toBeGreaterThanOrEqual(1);
      expect(roster.length).toBeLessThanOrEqual(3);
      expect(roster.filter((l) => l.loadout === "sword_shield").length).toBeLessThanOrEqual(1);
      expect(roster.filter((l) => l.loadout === "spear").length).toBeLessThanOrEqual(1);
      for (const l of roster) {
        expect(l.character).toBe("pohja");
        if (l.loadout === "spear") expect(l.axe).toBeUndefined();
        if (l.build) expect(l.tunic).toBeDefined();
        else expect(l.ringMail && l.greaves && l.helmet).toBe(true);
      }
    }
  });
  it("sama siemen antaa saman joukon", () => {
    expect(ambushRoster(123456)).toEqual(ambushRoster(123456));
  });
  it("koko valikoima on käytössä: kaikki vartalot, nutut ja aseet esiintyvät", () => {
    const all = seeds.flatMap((s) => ambushRoster(s));
    for (const build of [undefined, "tanakka", "hoikka"]) expect(all.some((l) => l.build === build)).toBe(true);
    for (const tunic of ["vaalea", "tumma"]) expect(all.some((l) => l.tunic === tunic)).toBe(true);
    for (const axe of ["parta", "karjala"]) expect(all.some((l) => l.axe === axe)).toBe(true);
    expect(all.some((l) => l.loadout === "spear")).toBe(true);
    expect(all.some((l) => l.loadout === "sword" && !l.axe)).toBe(true);
    expect(all.some((l) => l.loadout === "sword_shield" && l.axe)).toBe(true);
  });
  it("koko 45 / 35 / 20 %", () => {
    expect(ambushSize(0)).toBe(1);
    expect(ambushSize(0.449)).toBe(1);
    expect(ambushSize(0.45)).toBe(2);
    expect(ambushSize(0.799)).toBe(2);
    expect(ambushSize(0.8)).toBe(3);
    const counts = [0, 0, 0];
    for (const seed of seeds) counts[ambushRoster(seed).length - 1]++;
    expect(counts[0] / seeds.length).toBeCloseTo(0.45, 1);
    expect(counts[2] / seeds.length).toBeCloseTo(0.2, 1);
  });
  it("nimet aseen ja kilven mukaan", () => {
    expect(warriorNameKey({ character: "pohja", loadout: "sword_shield", axe: "parta" })).toBe("enemy.pohjaAxeShield");
    expect(warriorNameKey({ character: "pohja", loadout: "sword", axe: "karjala" })).toBe("enemy.pohjaAxe");
    expect(warriorNameKey({ character: "pohja", loadout: "spear" })).toBe("enemy.pohjaSpear");
    expect(warriorNameKey({ character: "pohja", loadout: "sword" })).toBe("enemy.pohja");
  });
});

describe("metsäpolun kohtaus", () => {
  const layout = sceneLayout("ambush");
  it("soikea aukio polun suuntaan ja polunsuu kummassakin päässä", () => {
    expect(layout.exits.map((e) => e.id)).toEqual(["back", "forward"]);
    expect(walkableDepth(layout, 0, 13)).toBeGreaterThan(0);
    expect(walkableDepth(layout, 0, -13)).toBeGreaterThan(0);
    expect(walkableDepth(layout, 8, 0)).toBeGreaterThan(0);
    expect(walkableDepth(layout, 10.5, 0)).toBeGreaterThan(0);
    expect(walkableDepth(layout, 12, 0)).toBeLessThan(0);
    // Aloituskohdassa (z 13,5) aukio on yhä noin 16 m leveä.
    expect(walkableDepth(layout, 7.5, 13.5)).toBeGreaterThan(0);
  });
  it("sankari saapuu takaa (+z) ja katsoo polkua pitkin eteen", () => {
    const s = entrySpawn(layout);
    expect(s.z).toBeGreaterThan(9);
    expect(Math.abs(s.yaw)).toBeCloseTo(Math.PI, 5);
  });
  it("väijyjät ovat kuljettavalla alueella edessä, eri paikoissa", () => {
    for (const count of [1, 2, 3]) {
      const spots = ambushSpawns(count, 99);
      expect(spots).toHaveLength(count);
      for (const p of spots) {
        expect(p.z).toBeLessThan(0);
        const c = clampToWalkable(layout, p.x, p.z, 0.6);
        expect(Math.hypot(c.x - p.x, c.z - p.z)).toBeLessThan(1e-6);
      }
      expect(new Set(spots.map((p) => `${p.x},${p.z}`)).size).toBe(count);
    }
  });
});

describe("ruoat väijytyksessä kaatuneelta", () => {
  it("vie kaikki ruoat ja jättää muut tavarat", () => {
    expect(isFood("barley_flatbread") && isFood("dried_fish") && isFood("hare_meat") && isFood("boar_meat")).toBe(true);
    expect(isFood("sword")).toBe(false);
    let inv = createCampaign().player.inventory;
    inv = tryAddItem(inv, "hare_meat", 2)!;
    inv = tryAddItem(inv, "dried_fish", 1)!;
    inv = tryAddItem(inv, "spear", 1)!;
    const after = withoutFood(inv);
    expect(after.stacks.some((s) => isFood(s.itemId))).toBe(false);
    expect(after.stacks.find((s) => s.itemId === "spear")?.quantity).toBe(1);
    expect(after.backpack).toBe(inv.backpack);
  });
});
