// Pitkäkestoiset efektit: siunaukset ja kiroukset, jotka kestävät pelipäiviä ja näkyvät paperinuken
// alla kolmessa paikassa. Puhdas moduuli (ei DOM:ia eikä Three.js:ää), jotta tallennus ja kesto
// voidaan testata. Aika mitataan kartan maailma-ajassa (`worldMinutes`); 3D-kohtaus ei kuluta aikaa,
// joten efekti ei lopu kesken käynnin.
import type { TextKey } from "../i18n";
import type { StatName } from "../stats";
import type { CampaignState } from "./campaign";
import { WORLD_MINUTES_PER_DAY } from "./uiState";

export type LongEffectId = "ukko_blessing";
export type LongEffectKind = "blessing" | "curse";

export interface LongEffectDefinition {
  id: LongEffectId;
  kind: LongEffectKind;
  nameKey: TextKey;
  /** Lyhyt kuvaus vaikutuksesta (näkyy paikan vihjeenä). */
  descKey: TextKey;
  durationDays: number;
  /** Lisäykset sankarin kykyihin. Summautuvat muiden muuntimien (esim. nälän) kanssa. */
  modifiers: ReadonlyArray<{ stat: StatName; add: number }>;
}

/** Paperinuken alla on kolme efektipaikkaa (referenssikuva). Neljäs efekti ei mahdu. */
export const LONG_EFFECT_SLOTS = 3;

/** Ukon muistaminen kuppikivellä: +20 staminan yläraja 15 pelipäiväksi (omistaja 2026-11-22). */
export const UKKO_BLESSING_STAMINA = 20;
export const UKKO_BLESSING_DAYS = 15;

export const LONG_EFFECTS: Record<LongEffectId, LongEffectDefinition> = {
  ukko_blessing: {
    id: "ukko_blessing",
    kind: "blessing",
    nameKey: "effect.ukkoBlessing",
    descKey: "effect.ukkoBlessing.desc",
    durationDays: UKKO_BLESSING_DAYS,
    modifiers: [{ stat: "maxStamina", add: UKKO_BLESSING_STAMINA }],
  },
};

/** Tallennettu efekti: tunniste ja maailma-aika, jolloin se loppuu. */
export interface ActiveLongEffect {
  id: LongEffectId;
  until: number;
}

export function isLongEffectId(value: unknown): value is LongEffectId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(LONG_EFFECTS, value);
}

/** Voimassa olevat efektit (loppuneet pudotettu), siinä järjestyksessä kuin ne on saatu. */
export function activeLongEffects(state: Pick<CampaignState, "player" | "world">): ActiveLongEffect[] {
  return state.player.effects.filter((effect) => effect.until > state.world.worldMinutes);
}

/**
 * Antaa efektin. Sama efekti uudelleen alkaa alusta (kesto ei pinoudu). null = kaikki kolme paikkaa
 * ovat täynnä muita voimassa olevia efektejä. Loppuneet efektit siivotaan samalla pois tallennuksesta.
 */
export function tryAddLongEffect(state: CampaignState, id: LongEffectId): CampaignState | null {
  const until = state.world.worldMinutes + LONG_EFFECTS[id].durationDays * WORLD_MINUTES_PER_DAY;
  const others = activeLongEffects(state).filter((effect) => effect.id !== id);
  if (others.length >= LONG_EFFECT_SLOTS) return null;
  const existing = state.player.effects.findIndex((effect) => effect.id === id && effect.until > state.world.worldMinutes);
  const effects = existing >= 0
    ? activeLongEffects(state).map((effect) => (effect.id === id ? { id, until } : effect))
    : [...others, { id, until }];
  return { ...state, player: { ...state.player, effects } };
}

/** Jäljellä olevat pelipäivät ylöspäin pyöristettynä (näytetään paikan vihjeessä). */
export function longEffectDaysLeft(effect: ActiveLongEffect, worldMinutes: number): number {
  return Math.max(0, Math.ceil((effect.until - worldMinutes) / WORLD_MINUTES_PER_DAY - 1e-9));
}

/** Muunninten tunniste 3D:ssä: `long-effect:<id>:<stat>`. */
export const LONG_EFFECT_MOD_PREFIX = "long-effect:";

/** Voimassa olevien efektien muuntimet sankarille. */
export function longEffectModifiers(state: Pick<CampaignState, "player" | "world">): Array<{ id: string; stat: StatName; add: number }> {
  return activeLongEffects(state).flatMap((effect) =>
    LONG_EFFECTS[effect.id].modifiers.map((mod) => ({ id: `${LONG_EFFECT_MOD_PREFIX}${effect.id}:${mod.stat}`, stat: mod.stat, add: mod.add })));
}

/**
 * Salliva luku: tuntematon tai rikkinäinen merkintä pudotetaan, eikä koko tallennusta hylätä.
 * Puuttuva kenttä (tallennus ennen v08.01:tä) on tyhjä lista.
 */
export function parseLongEffects(value: unknown): ActiveLongEffect[] {
  if (!Array.isArray(value)) return [];
  const result: ActiveLongEffect[] = [];
  for (const entry of value.slice(0, 16)) {
    if (typeof entry !== "object" || entry === null) continue;
    const { id, until } = entry as Record<string, unknown>;
    if (!isLongEffectId(id) || typeof until !== "number" || !Number.isFinite(until) || until < 0) continue;
    if (result.some((effect) => effect.id === id)) continue;
    result.push({ id, until });
  }
  return result;
}
