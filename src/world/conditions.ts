// Ehtojen arviointi. Jokainen tulos kertoo suomeksi, miksi ehto piti tai ei pitänyt,
// jotta `__world.explain` voi näyttää epäonnistumisen syyn.
import { taggedItemCount, type CampaignState, type ItemId } from "../map/campaign";
import { nearestUnknownHuntGround } from "../map/huntGrounds";
import { mapCalendarTime } from "../map/uiState";
import { counterValue, flagValue } from "./state";
import { resolveInstanceId, resolveSiteId } from "./instances";
import { MOON_PHASE_NAMES, SCENE_ITEM_LABELS } from "./registry";
import type { Condition, CounterOp, WorldData } from "./types";

export interface ConditionResult {
  pass: boolean;
  /** Suomenkielinen selitys, joka kuvaa ehdon tilan nyt. */
  reason: string;
}

/** Moottorin laskurit ovat kokonaislukuja, joten maailma-ajan murto-osat tallennetaan miljoonasosina. */
export const WORLD_TIME_COUNTER_SCALE = 1_000_000;

/** Nolla merkitsee laskureissa "ei koskaan", joten aikaleimaan lisätään yksi. */
export function worldTimeCounterMark(worldMinutes: number): number {
  return Math.round(worldMinutes * WORLD_TIME_COUNTER_SCALE) + 1;
}

const OP_TEXT: Record<CounterOp, string> = {
  "<": "pienempi kuin",
  "<=": "enintään",
  "=": "täsmälleen",
  ">=": "vähintään",
  ">": "suurempi kuin",
};

export function compare(a: number, op: CounterOp, b: number): boolean {
  switch (op) {
    case "<": return a < b;
    case "<=": return a <= b;
    case "=": return a === b;
    case ">=": return a >= b;
    case ">": return a > b;
  }
}

function flagLabel(data: WorldData, flag: string): string {
  return data.flags[flag]?.label ?? `tuntematon lippu ${flag}`;
}

function counterLabel(data: WorldData, counter: string): string {
  return data.counters[counter]?.label ?? `tuntematon laskuri ${counter}`;
}

export function itemLabel(instanceId: string): string {
  return SCENE_ITEM_LABELS[instanceId] ?? `esine ${instanceId}`;
}

export function moonPhaseNames(phases: readonly number[]): string {
  return phases.map((p) => MOON_PHASE_NAMES[p] ?? `vaihe ${p}`).join(" tai ");
}

export function evaluate(cond: Condition, state: CampaignState, data: WorldData): ConditionResult {
  switch (cond.kind) {
    case "all": {
      const results = cond.of.map((c) => evaluate(c, state, data));
      const failed = results.find((r) => !r.pass);
      return failed
        ? { pass: false, reason: `kaikkien ehtojen piti pitää, mutta ei pitänyt: ${failed.reason}` }
        : { pass: true, reason: `kaikki ehdot pitävät (${results.map((r) => r.reason).join("; ")})` };
    }
    case "any": {
      const results = cond.of.map((c) => evaluate(c, state, data));
      const ok = results.find((r) => r.pass);
      return ok
        ? { pass: true, reason: `jokin ehdoista pitää: ${ok.reason}` }
        : { pass: false, reason: `yksikään vaihtoehto ei pitänyt (${results.map((r) => r.reason).join("; ")})` };
    }
    case "not": {
      const inner = evaluate(cond.of, state, data);
      return inner.pass
        ? { pass: false, reason: `ehdon ei pitänyt pitää, mutta piti: ${inner.reason}` }
        : { pass: true, reason: `ehto ei pidä, kuten vaadittiin: ${inner.reason}` };
    }
    case "flag": {
      const want = cond.value ?? true;
      const has = flagValue(state.engine, cond.flag);
      const label = flagLabel(data, cond.flag);
      return {
        pass: has === want,
        reason: has
          ? `lippu "${label}" on asetettu${want ? "" : ", vaikka sen piti olla asettamatta"}`
          : `lippu "${label}" ei ole asetettu${want ? ", vaikka sen piti olla" : ""}`,
      };
    }
    case "counter": {
      const value = counterValue(state.engine, cond.counter);
      const pass = compare(value, cond.op, cond.value);
      return {
        pass,
        reason: `${counterLabel(data, cond.counter)} on ${value}; vaadittiin ${OP_TEXT[cond.op]} ${cond.value}${pass ? "" : " (ei täyty)"}`,
      };
    }
    case "elapsedWorldMinutes": {
      const mark = counterValue(state.engine, cond.counter);
      const elapsed = mark > 0
        ? (worldTimeCounterMark(state.world.worldMinutes) - mark) / WORLD_TIME_COUNTER_SCALE
        : 0;
      const pass = mark > 0 && elapsed + 1 / WORLD_TIME_COUNTER_SCALE >= cond.minutes;
      return {
        pass,
        reason: mark > 0
          ? `${counterLabel(data, cond.counter)}: aikaa on kulunut ${elapsed.toFixed(2)} minuuttia; vaadittiin vähintään ${cond.minutes}${pass ? "" : " (ei täyty)"}`
          : `${counterLabel(data, cond.counter)}: aikaleimaa ei ole vielä kirjattu (ei täyty)`,
      };
    }
    case "moonPhase": {
      const phase = mapCalendarTime(state.world.worldMinutes).phase;
      const pass = cond.phases.includes(phase);
      return {
        pass,
        reason: `kuun vaihe on ${MOON_PHASE_NAMES[phase]}; vaadittiin ${moonPhaseNames(cond.phases)}${pass ? "" : " (ei täyty)"}`,
      };
    }
    case "itemTaken": {
      const id = resolveInstanceId(state, cond.instanceId);
      const taken = id !== null && state.world.sceneItems.takenInstanceIds.includes(id);
      return {
        pass: taken,
        reason: taken ? `${itemLabel(cond.instanceId)} on jo otettu` : `${itemLabel(cond.instanceId)} on vielä ottamatta`,
      };
    }
    case "hasItem": {
      const have = itemCount(state, cond.itemId);
      const pass = have >= cond.quantity;
      return {
        pass,
        reason: `pelaajalla on ${have} × ${cond.itemId}; vaadittiin vähintään ${cond.quantity}${pass ? "" : " (ei täyty)"}`,
      };
    }
    case "hasTagged": {
      const have = taggedItemCount(state.player.inventory, cond.tag);
      const pass = have >= cond.quantity;
      return {
        pass,
        reason: `pelaajalla on ${have} × tyyppiä ${cond.tag}; vaadittiin vähintään ${cond.quantity}${pass ? "" : " (ei täyty)"}`,
      };
    }
    case "moonChance": {
      const roll = moonRoll(state, cond.salt);
      const pass = roll < cond.chance;
      return {
        pass,
        reason: `kuunkierron ${currentMoonMark(state)} arpa "${cond.salt}" on ${roll.toFixed(2)}; vaadittiin alle ${cond.chance}${pass ? "" : " (ei täyty)"}`,
      };
    }
    case "sameMoon": {
      const moon = currentMoonMark(state);
      const value = counterValue(state.engine, cond.counter);
      const pass = value === moon;
      return {
        pass,
        reason: `${counterLabel(data, cond.counter)} on ${value}; nyt on kuunkierto ${moon}${pass ? " (sama kuu)" : " (eri kuu, ei täyty)"}`,
      };
    }
    case "siteKnown": {
      const id = resolveSiteId(state, cond.siteId);
      const pass = id !== null && state.world.knownSiteIds.includes(id);
      return {
        pass,
        reason: id === null
          ? `karttapaikan roolia ${cond.siteId} ei löydy (ei täyty)`
          : `karttapaikka ${id} on${pass ? "" : " ei ole"} pelaajan tiedossa${pass ? "" : " (ei täyty)"}`,
      };
    }
    case "unknownHuntGround": {
      const ground = nearestUnknownHuntGround(state);
      return {
        pass: ground !== null,
        reason: ground ? `kartalla on tuntematon metsästysapaja (${ground.id})` : "kaikki metsästysapajat ovat jo tiedossa tai niitä ei ole (ei täyty)",
      };
    }
  }
}

/** Nykyinen kuunkierto laskurin arvona: ensimmäinen kuu on 1, jotta 0 tarkoittaa "ei koskaan". */
export function currentMoonMark(state: CampaignState): number {
  return mapCalendarTime(state.world.worldMinutes).moon + 1;
}

/** Esineen kappalemäärä pelaajan inventaariossa. */
export function itemCount(state: CampaignState, itemId: ItemId): number {
  return state.player.inventory.stacks.reduce((sum, stack) => sum + (stack.itemId === itemId ? stack.quantity : 0), 0);
}

/** Kuunkierron arpa 0–1: sama koko kuunkierron saman siemenen ja suolan kanssa (FNV-1a + Murmur3-sekoitus). */
export function moonRoll(state: CampaignState, salt: string): number {
  let h = 0x811c9dc5;
  for (const ch of `${state.world.worldSeed}|${currentMoonMark(state)}|${salt}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // Murmur3:n loppusekoitus: lähes samanlaiset suolat ("emanta.fish", "emanta_b.fish") eivät korreloi.
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Kaikki ehtopuun liput, laskurit ja instanssit tarkistuksia varten (esim. rekisteritesti). */
export function conditionRefs(cond: Condition, out: { flags: string[]; counters: string[]; instances: string[] } = { flags: [], counters: [], instances: [] }) {
  switch (cond.kind) {
    case "all":
    case "any":
      cond.of.forEach((c) => conditionRefs(c, out));
      break;
    case "not": conditionRefs(cond.of, out); break;
    case "flag": out.flags.push(cond.flag); break;
    case "counter":
    case "elapsedWorldMinutes":
    case "sameMoon": out.counters.push(cond.counter); break;
    case "itemTaken": out.instances.push(cond.instanceId); break;
    case "moonPhase":
    case "hasItem":
    case "hasTagged":
    case "moonChance":
    case "siteKnown":
    case "unknownHuntGround": break;
  }
  return out;
}
