// Moottorin tallennettava tila: oma versioitu lohkonsa kampanjan sisällä.
// Lehtimoduuli (vain rekisteri), jotta `map/campaign.ts` voi tuoda tämän ilman tuontikehää.
import { COUNTERS, isKnownCounter, isKnownFlag } from "./registry";

export const ENGINE_STATE_VERSION = 1 as const;

export interface EngineState {
  version: typeof ENGINE_STATE_VERSION;
  /** Vain asetetut liput; puuttuva lippu on epätosi. */
  flags: Record<string, boolean>;
  /** Vain nollasta poikkeavat laskurit; puuttuva laskuri on 0. */
  counters: Record<string, number>;
}

export function createEngineState(): EngineState {
  return { version: ENGINE_STATE_VERSION, flags: {}, counters: {} };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Salliva luku: mikä tahansa roska muuttuu tyhjäksi tilaksi, ja tunnetuista kentistä
 * pidetään vain kelvolliset (tuntematon lippu, väärän tyyppinen arvo ja epäkelpo laskuri
 * pudotetaan). Tämä ei koskaan hylkää kampanjaa. Epätosi lippu normalisoidaan pois.
 */
export function parseEngineState(value: unknown): EngineState {
  const state = createEngineState();
  if (!isRecord(value)) return state;
  if (isRecord(value.flags)) {
    for (const [id, v] of Object.entries(value.flags)) {
      if (isKnownFlag(id) && v === true) state.flags[id] = true;
    }
  }
  if (isRecord(value.counters)) {
    for (const [id, v] of Object.entries(value.counters)) {
      if (!isKnownCounter(id) || typeof v !== "number" || !Number.isInteger(v) || v <= 0) continue;
      state.counters[id] = Math.min(v, COUNTERS[id].max);
    }
  }
  return state;
}

export function cloneEngineState(state: EngineState): EngineState {
  return { version: ENGINE_STATE_VERSION, flags: { ...state.flags }, counters: { ...state.counters } };
}

export function flagValue(state: EngineState, flag: string): boolean {
  return state.flags[flag] === true;
}

export function counterValue(state: EngineState, counter: string): number {
  return state.counters[counter] ?? 0;
}

export function withFlag(state: EngineState, flag: string, value: boolean): EngineState {
  if (flagValue(state, flag) === value) return state;
  const flags = { ...state.flags };
  if (value) flags[flag] = true; else delete flags[flag];
  return { ...state, flags };
}

/** Asettaa laskurin tarkkaan arvoon (rajattuna 0..max). */
export function withCounterSet(state: EngineState, counter: string, value: number, max: number): EngineState {
  const target = Math.max(0, Math.min(max, Math.round(value)));
  return withCounterAdded(state, counter, target - counterValue(state, counter), max);
}

export function withCounterAdded(state: EngineState, counter: string, amount: number, max: number): EngineState {
  const next = Math.max(0, Math.min(max, counterValue(state, counter) + amount));
  if (next === counterValue(state, counter)) return state;
  const counters = { ...state.counters };
  if (next === 0) delete counters[counter]; else counters[counter] = next;
  return { ...state, counters };
}
