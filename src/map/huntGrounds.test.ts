import { describe, expect, it } from "vitest";
import { createCampaign, parseCampaign, serializeCampaign, type CampaignState } from "./campaign";
import { mapCell } from "./domain";
import {
  HUNT_RULES, advanceHuntGrounds, ensureHuntGrounds, huntCycleAt, isHuntInstance, removeHuntGround,
} from "./huntGrounds";
import { chebyshev } from "./placement";
import { PROTOTYPE_MAP, PROTOTYPE_START } from "./prototype";
import { discoverVisibleSites, mapSiteDefinition, mapSiteDisplay } from "./sites";
import { newCampaign } from "./storage";
import { WORLD_MINUTES_PER_DAY, mapCellVisibility } from "./uiState";

const hunts = (state: CampaignState) => state.world.siteInstances.filter(isHuntInstance);
const days = (n: number) => n * WORLD_MINUTES_PER_DAY;

/** Kaikki muut paikat, myös tietäjän mökki ja kalmistot (instansseja v08:sta lähtien). */
function otherSites(state: CampaignState, exceptId: string) {
  return state.world.siteInstances.filter((i) => i.id !== exceptId);
}

describe("metsästysapajat uudella matkalla", () => {
  it("200 siementä: 3–6 apajaa, kelvollisessa maastossa eikä toisen paikan vieressä", () => {
    const counts = new Set<number>();
    for (let seed = 1; seed <= 200; seed++) {
      const state = newCampaign(seed);
      const list = hunts(state);
      counts.add(list.length);
      expect(list.length).toBeGreaterThanOrEqual(HUNT_RULES.initial[0]);
      expect(list.length).toBeLessThanOrEqual(HUNT_RULES.initial[1]);
      expect(state.world.huntCycle).toBe(0);
      for (const h of list) {
        const cell = mapCell(PROTOTYPE_MAP, h.x, h.y)!;
        expect(HUNT_RULES.terrains).toContain(cell.terrainId);
        expect(cell.siteId).toBeUndefined();
        expect(chebyshev(h, PROTOTYPE_START)).toBeGreaterThanOrEqual(HUNT_RULES.minHeroDistance);
        for (const other of otherSites(state, h.id)) expect(chebyshev(h, other)).toBeGreaterThanOrEqual(HUNT_RULES.minSiteDistance);
      }
    }
    expect([...counts].sort()).toEqual([3, 4, 5, 6]);
  });

  it("apajat eivät ole tunnettuja eivätkä näy alussa", () => {
    const state = newCampaign(42);
    for (const h of hunts(state)) {
      expect(state.world.knownSiteIds).not.toContain(h.id);
      const display = mapSiteDisplay(h.id, { active: true, known: false, cellVisibility: "remembered" }, state.world.siteInstances);
      expect(display).toBe("hidden");
    }
  });

  it("apaja avaa erämaan ja säilyy tallennuksen läpi", () => {
    const state = newCampaign(9);
    const h = hunts(state)[0];
    expect(mapSiteDefinition(h.id, state.world.siteInstances)?.sceneId).toBe("wilds");
    const loaded = parseCampaign(serializeCampaign(state))!;
    expect(hunts(loaded)).toEqual(hunts(state));
    expect(loaded.world.huntCycle).toBe(0);
  });

  it("vanha tallennus saa alkuapajat kerran, ilman kuluneiden jaksojen ryöppyä", () => {
    const old = { ...createCampaign({ worldSeed: 77 }), world: { ...createCampaign({ worldSeed: 77 }).world, worldMinutes: days(65) } };
    const done = ensureHuntGrounds(old);
    expect(hunts(done).length).toBeGreaterThanOrEqual(3);
    expect(done.world.huntCycle).toBe(3);
    expect(ensureHuntGrounds(done)).toBe(done);
    expect(advanceHuntGrounds(done)).toBe(done);
  });
});

describe("apajan löytäminen", () => {
  it("tutkitullakin alueella apaja paljastuu vasta viereisestä ruudusta, myös viistoon", () => {
    const state = newCampaign(5);
    const h = hunts(state)[0];
    const far = { x: h.x + 2, y: h.y };
    expect(discoverVisibleSites(PROTOTYPE_MAP, [], far, state.world.siteInstances)).not.toContain(h.id);
    expect(mapSiteDisplay(h.id, { active: true, known: false, cellVisibility: mapCellVisibility(true, far, h) }, state.world.siteInstances)).toBe("hidden");
    const diagonal = { x: h.x + 1, y: h.y + 1 };
    expect(discoverVisibleSites(PROTOTYPE_MAP, [], diagonal, state.world.siteInstances)).toContain(h.id);
    expect(mapSiteDisplay(h.id, { active: true, known: false, cellVisibility: mapCellVisibility(true, diagonal, h) }, state.world.siteInstances)).toBe("normal");
  });
});

describe("apajien uusiutuminen", () => {
  it("20 päivän välein syntyy yksi uusi apaja, joka ei ole tunnettu eikä sankarin vieressä", () => {
    let state = newCampaign(3);
    const before = hunts(state).length;
    state = { ...state, world: { ...state.world, worldMinutes: days(19.9) } };
    expect(advanceHuntGrounds(state)).toBe(state);
    state = { ...state, world: { ...state.world, worldMinutes: days(20) } };
    const after = advanceHuntGrounds(state);
    expect(hunts(after).length).toBe(Math.min(before + 1, HUNT_RULES.maxActive));
    expect(after.world.huntCycle).toBe(1);
    const fresh = hunts(after).find((h) => h.id === "hunt-c1")!;
    expect(fresh).toBeDefined();
    expect(after.world.knownSiteIds).not.toContain(fresh.id);
    expect(chebyshev(fresh, { x: after.world.x, y: after.world.y })).toBeGreaterThanOrEqual(HUNT_RULES.minHeroDistance);
    for (const other of otherSites(after, fresh.id)) expect(chebyshev(fresh, other)).toBeGreaterThanOrEqual(HUNT_RULES.minSiteDistance);
  });

  it("kuuden apajan kartalla vanhin väistyy uuden tieltä", () => {
    let state = newCampaign(11);
    // Täytetään kuuteen ajamalla jaksoja.
    for (let d = 20; hunts(state).length < HUNT_RULES.maxActive; d += 20) {
      state = advanceHuntGrounds({ ...state, world: { ...state.world, worldMinutes: days(d) } });
    }
    const oldest = hunts(state)[0];
    state = { ...state, world: { ...state.world, knownSiteIds: [...state.world.knownSiteIds, oldest.id] } };
    const cycle = state.world.huntCycle;
    const next = advanceHuntGrounds({ ...state, world: { ...state.world, worldMinutes: days((cycle + 1) * 20) } });
    expect(hunts(next).length).toBe(HUNT_RULES.maxActive);
    expect(hunts(next).some((h) => h.id === oldest.id)).toBe(false);
    expect(next.world.knownSiteIds).not.toContain(oldest.id);
    expect(hunts(next).at(-1)!.id).toBe(`hunt-c${cycle + 1}`);
  });

  it("jakson laskenta: päivät 0–19 jakso 0, päivä 20 jakso 1", () => {
    expect(huntCycleAt(0)).toBe(0);
    expect(huntCycleAt(days(19.99))).toBe(0);
    expect(huntCycleAt(days(20))).toBe(1);
    expect(huntCycleAt(days(41))).toBe(2);
  });
});

describe("kertakäyttö", () => {
  it("apajalle meneminen poistaa sen kartalta ja pelaajan tiedosta", () => {
    let state = newCampaign(8);
    const h = hunts(state)[0];
    state = { ...state, world: { ...state.world, knownSiteIds: [h.id] } };
    const used = removeHuntGround(state, h.id);
    expect(used.world.siteInstances.some((i) => i.id === h.id)).toBe(false);
    expect(used.world.knownSiteIds).toEqual([]);
    expect(used.world.siteInstances.filter((i) => !isHuntInstance(i))).toEqual(state.world.siteInstances.filter((i) => !isHuntInstance(i)));
    // Pihaa tai leiriä ei voi poistaa tällä.
    expect(removeHuntGround(used, "yard")).toBe(used);
  });
});
