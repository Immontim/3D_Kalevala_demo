import { describe, expect, it } from "vitest";
import { createCampaign, type CampaignState } from "./campaign";
import { endingSummary, isWon, shouldShowEnding } from "./ending";
import { DAYS_PER_MOON, WORLD_MINUTES_PER_MOON, totalDays } from "./uiState";
import { GAME_WORLD } from "../world/content";
import { postEvent } from "../world/engine";
import { PROTOTYPE_MAP_ID } from "./prototype";

function played(over: (s: CampaignState) => CampaignState = (s) => s): CampaignState {
  return over(createCampaign({ mapId: PROTOTYPE_MAP_ID }));
}

const WIN = { type: "battle.won", sceneId: "clearing", wave: 5 } as const;

describe("pelipäivät", () => {
  it("ensimmäinen päivä on 1 ja päivä vaihtuu 180/28 minuutin välein", () => {
    expect(totalDays(0)).toBe(1);
    expect(totalDays(6)).toBe(1);
    expect(totalDays(7)).toBe(2);
    expect(totalDays(WORLD_MINUTES_PER_MOON)).toBe(DAYS_PER_MOON + 1);
    expect(totalDays(-5)).toBe(1);
    expect(totalDays(Number.NaN)).toBe(1);
  });
});

describe("voitto ja loppuruutu (V7)", () => {
  it("kampanja ei ole voitettu ennen viimeisen aallon voittoa eikä loppuruutua näytetä", () => {
    const state = played();
    expect(isWon(state)).toBe(false);
    expect(endingSummary(state)).toBeNull();
    expect(shouldShowEnding(state)).toBe(false);
  });

  it("battle.won kirjaa voiton ja jäädyttää päivät ja tutkitun kartan voiton hetkeen", () => {
    const state = played((s) => ({
      ...s,
      world: { ...s.world, worldMinutes: 400, discovered: s.world.discovered.map((_, i) => i < 100) },
    }));
    const won = postEvent(state, WIN, GAME_WORLD);
    expect(won.fired.map((f) => f.ruleId)).toEqual(["campaign.victory"]);
    expect(won.state.engine.flags["campaign.won"]).toBe(true);
    expect(won.state.engine.counters["win.days"]).toBe(totalDays(400));
    expect(won.state.engine.counters["win.explored"]).toBe(25);
    expect(won.state.world.worldMinutes).toBe(400);                      // 3D ei kuluta aikaa
    // Myöhempi vaeltaminen ei muuta voiton hetken tilastoa.
    const later: CampaignState = { ...won.state, world: { ...won.state.world, worldMinutes: 5000 } };
    expect(endingSummary(later)?.days).toBe(totalDays(400));
    expect(shouldShowEnding(won.state)).toBe(true);
  });

  it("voitto kirjataan vain kerran, väärä kohtaus ei voita, ja kaatumiset lasketaan", () => {
    const first = postEvent(played(), WIN, GAME_WORLD);
    expect(postEvent(first.state, WIN, GAME_WORLD).fired).toEqual([]);
    expect(postEvent(played(), { ...WIN, sceneId: "lakeside" }, GAME_WORLD).fired).toEqual([]);
    let state = played();
    for (let i = 0; i < 3; i++) state = postEvent(state, { type: "player.died", sceneId: "clearing" }, GAME_WORLD).state;
    expect(state.engine.counters["player.deaths"]).toBe(3);
    expect(endingSummary(postEvent(state, WIN, GAME_WORLD).state)?.deaths).toBe(3);
  });

  it("loppuruudun tilasto kokoaa lipuista ja laskureista", () => {
    let state = played((s) => ({
      ...s,
      engine: {
        ...s.engine,
        flags: { "rumor.heard": true, "louhi.banished": true, "archer.healed": true, "song.sleep.learned": true },
        counters: { "thefts.noticed": 2 },
      },
    }));
    state = postEvent(state, WIN, GAME_WORLD).state;
    const summary = endingSummary(state)!;
    expect(summary).toMatchObject({ days: 1, moons: 0, songsKnown: 3, songsTotal: 3, enemiesDefeated: 9, deaths: 0, thefts: 2 });
    expect(summary.sideStories).toEqual([
      { id: "rumor", done: true }, { id: "louhi", done: true }, { id: "archer", done: true }, { id: "sword", done: false },
    ]);
  });

  it("kuunkierrot lasketaan 28 päivän jaksoista", () => {
    const state = played((s) => ({ ...s, world: { ...s.world, worldMinutes: WORLD_MINUTES_PER_MOON * 2 + 10 } }));
    const summary = endingSummary(postEvent(state, WIN, GAME_WORLD).state)!;
    expect(summary.days).toBe(2 * DAYS_PER_MOON + 2);
    expect(summary.moons).toBe(2);
  });

  it("nähty loppuruutu ei avaudu uudelleen, mutta voitto säilyy; tallennus säilyttää tilat", () => {
    const won = postEvent(played(), WIN, GAME_WORLD).state;
    const seen: CampaignState = { ...won, engine: { ...won.engine, flags: { ...won.engine.flags, "campaign.endSeen": true } } };
    expect(shouldShowEnding(seen)).toBe(false);
    expect(isWon(seen)).toBe(true);
    expect(endingSummary(seen)).not.toBeNull();
  });

  it("säännöt ovat suomeksi selitettävissä: voitto ja kaatumisen laskenta", () => {
    const rules = GAME_WORLD.rules.map((r) => r.id);
    expect(rules).toContain("campaign.victory");
    expect(rules).toContain("player.death-counted");
  });
});
