// Pitkäkestoiset efektit: kesto, paikat, tallennus ja muuntimet (Ukon siunaus, 2026-11-22).
import { describe, expect, it } from "vitest";
import { createCampaign, parseCampaign, serializeCampaign, type CampaignState } from "./campaign";
import {
  LONG_EFFECT_SLOTS,
  UKKO_BLESSING_DAYS,
  UKKO_BLESSING_STAMINA,
  activeLongEffects,
  longEffectDaysLeft,
  longEffectModifiers,
  parseLongEffects,
  tryAddLongEffect,
} from "./longEffects";
import { applyLongEffects, applyMapToSceneTransition, createMapToSceneTransition } from "./transition";
import { WORLD_MINUTES_PER_DAY } from "./uiState";
import { effectiveStats, type Modifier } from "../stats";

const at = (state: CampaignState, minutes: number): CampaignState => ({ ...state, world: { ...state.world, worldMinutes: minutes } });

describe("pitkäkestoiset efektit", () => {
  it("Ukon siunaus kestää 15 pelipäivää ja loppuu sen jälkeen", () => {
    const start = at(createCampaign(), 10);
    const blessed = tryAddLongEffect(start, "ukko_blessing")!;
    expect(activeLongEffects(blessed).map((e) => e.id)).toEqual(["ukko_blessing"]);
    expect(longEffectDaysLeft(blessed.player.effects[0], 10)).toBe(UKKO_BLESSING_DAYS);
    const almost = at(blessed, 10 + (UKKO_BLESSING_DAYS - 0.5) * WORLD_MINUTES_PER_DAY);
    expect(activeLongEffects(almost)).toHaveLength(1);
    expect(longEffectDaysLeft(almost.player.effects[0], almost.world.worldMinutes)).toBe(1);
    expect(activeLongEffects(at(blessed, 10 + UKKO_BLESSING_DAYS * WORLD_MINUTES_PER_DAY))).toEqual([]);
  });

  it("sama efekti uudelleen alkaa alusta eikä vie toista paikkaa", () => {
    const first = tryAddLongEffect(at(createCampaign(), 0), "ukko_blessing")!;
    const later = tryAddLongEffect(at(first, 5 * WORLD_MINUTES_PER_DAY), "ukko_blessing")!;
    expect(later.player.effects).toEqual([{ id: "ukko_blessing", until: (5 + UKKO_BLESSING_DAYS) * WORLD_MINUTES_PER_DAY }]);
  });

  it("paikkoja on kolme; loppuneet efektit siivotaan pois tallennuksesta", () => {
    expect(LONG_EFFECT_SLOTS).toBe(3);
    const old = { ...createCampaign(), player: { ...createCampaign().player, effects: [{ id: "ukko_blessing" as const, until: 5 }] } };
    const renewed = tryAddLongEffect(at(old, 100), "ukko_blessing")!;
    expect(renewed.player.effects).toHaveLength(1);
    expect(renewed.player.effects[0].until).toBeGreaterThan(100);
  });

  it("antaa kestävyyden ylärajaan +20 ja summautuu nälän rangaistukseen", () => {
    const blessed = tryAddLongEffect(at(createCampaign(), 0), "ukko_blessing")!;
    expect(longEffectModifiers(blessed)).toEqual([{ id: "long-effect:ukko_blessing:maxStamina", stat: "maxStamina", add: UKKO_BLESSING_STAMINA }]);
    const base = { maxHp: 100, maxStamina: 100, staminaRegen: 1, power: 10, moveSpeed: 3, damageTaken: 1, turnSpeed: 360, reaction: 0.3 };
    const actor = { base, mods: [] as Modifier[], stats: effectiveStats(base, [], 0), hp: 100, stamina: 100 };
    applyMapToSceneTransition(actor, createMapToSceneTransition("clearing", "battle", 30));   // nälkä −20
    applyLongEffects(actor, blessed);
    expect(actor.stats.maxStamina).toBe(100 - 20 + UKKO_BLESSING_STAMINA);
    // Idempotentti: uusi kutsu ei pinoa, ja efektin loputtua muunnin poistuu.
    applyLongEffects(actor, blessed);
    expect(actor.stats.maxStamina).toBe(100);
    applyLongEffects(actor, at(blessed, 99 * WORLD_MINUTES_PER_DAY));
    expect(actor.stats.maxStamina).toBe(80);
    expect(actor.stamina).toBe(80);
  });

  it("tallentuu ja latautuu; vanha tallennus ilman kenttää ja roskamerkinnät eivät kaada latausta", () => {
    const blessed = tryAddLongEffect(at(createCampaign(), 3), "ukko_blessing")!;
    expect(parseCampaign(serializeCampaign(blessed))?.player.effects).toEqual(blessed.player.effects);
    const legacy = JSON.parse(serializeCampaign(createCampaign()));
    delete legacy.player.effects;
    expect(parseCampaign(legacy)?.player.effects).toEqual([]);
    expect(parseLongEffects([{ id: "nope", until: 5 }, { id: "ukko_blessing", until: -1 }, "x", { id: "ukko_blessing", until: 9 }, { id: "ukko_blessing", until: 12 }]))
      .toEqual([{ id: "ukko_blessing", until: 9 }]);
    expect(parseLongEffects("roskaa")).toEqual([]);
  });
});
