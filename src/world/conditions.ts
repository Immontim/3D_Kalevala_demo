// Ehtojen arviointi. Jokainen tulos kertoo suomeksi, miksi ehto piti tai ei pitänyt,
// jotta `__world.explain` voi näyttää epäonnistumisen syyn.
import type { CampaignState } from "../map/campaign";
import { mapCalendarTime } from "../map/uiState";
import { counterValue, flagValue } from "./state";
import { MOON_PHASE_NAMES, SCENE_ITEM_LABELS } from "./registry";
import type { Condition, CounterOp, WorldData } from "./types";

export interface ConditionResult {
  pass: boolean;
  /** Suomenkielinen selitys, joka kuvaa ehdon tilan nyt. */
  reason: string;
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
    case "moonPhase": {
      const phase = mapCalendarTime(state.world.worldMinutes).phase;
      const pass = cond.phases.includes(phase);
      return {
        pass,
        reason: `kuun vaihe on ${MOON_PHASE_NAMES[phase]}; vaadittiin ${moonPhaseNames(cond.phases)}${pass ? "" : " (ei täyty)"}`,
      };
    }
    case "itemTaken": {
      const taken = state.world.sceneItems.takenInstanceIds.includes(cond.instanceId);
      return {
        pass: taken,
        reason: taken ? `${itemLabel(cond.instanceId)} on jo otettu` : `${itemLabel(cond.instanceId)} on vielä ottamatta`,
      };
    }
  }
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
    case "counter": out.counters.push(cond.counter); break;
    case "itemTaken": out.instances.push(cond.instanceId); break;
    case "moonPhase": break;
  }
  return out;
}
