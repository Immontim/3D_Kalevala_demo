// Louhen kalmistokohtaamisen puhdas tilakone. Ei Three.js-, DOM- tai kampanjariippuvuuksia:
// engine-kerros muuntaa vaikutukset vihollisiksi, viesteiksi, animaatioiksi ja vahingoksi.
//
// Taistelu ja Louhen läsnäolo ovat tarkoituksella eri akseleita. Louhi voi siis myöhemmin
// liikkua, käyttää muitakin kykyjä tai poistua kesken taistelun ilman, että vartijoiden tila
// tai kohtaamisen rauhoittuminen sidotaan hänen Actor-toteutukseensa.

export type LouhiBattlePhase = "calm" | "active" | "cleared";
export type LouhiPresence = "present" | "banished";
export type LouhiAbilityId = "bog-song";

export type LouhiAction =
  | { kind: "idle" }
  | { kind: "casting"; ability: LouhiAbilityId; startedAt: number; completesAt: number };

export interface LouhiEncounterState {
  battle: LouhiBattlePhase;
  presence: LouhiPresence;
  guardsAlive: number;
  /** Ensimmäisen suoran Pohjolan unen riimu, jolla Louhi kutsuu vartijat (1-pohjainen). */
  pendingSleepInterruptBeat: 2 | 3 | null;
  /** Avunhuuto ja vartija-aalto voidaan laukaista vain kerran käyntiä kohti. */
  guardsCalled: boolean;
  action: LouhiAction;
  /** Reaaliaika, jonka jälkeen Louhi saa aloittaa seuraavan kyvyn. */
  nextAbilityAt: number;
}
export interface LouhiEncounterConfig {
  guardCount: number;
  initialAbilityDelay: number;
  abilityCooldown: number;
  castRange: number;
  /** Noin kolme kertaa nykyisen kahdeksanriimuisen pelaajalaulun kesto. */
  bogCastSeconds: number;
  bogSeconds: number;
  bogDamagePerSecond: number;
  /** Louhen suossa vartijoiden asevahinko säilyy normaalina. */
  bogMeleeDamageMultiplier: number;
}
export const LOUHI_ENCOUNTER: Readonly<LouhiEncounterConfig> = {
  guardCount: 2,
  initialAbilityDelay: 6,
  abilityCooldown: 12,
  castRange: 8,
  bogCastSeconds: 18,
  bogSeconds: 4,
  bogDamagePerSecond: 5,
  bogMeleeDamageMultiplier: 1,
};

export type LouhiEncounterEvent =
  | { type: "challenge"; now: number }
  | { type: "player-sleep-started"; now: number; nearLouhi: boolean }
  | { type: "player-song-beat"; songId: string; beat: number; now: number }
  | { type: "guard-down"; now: number }
  | { type: "tick"; now: number; playerDistance: number; playerRooted: boolean }
  | { type: "louhi-hit"; now: number }
  | { type: "louhi-removed"; now: number };

export type LouhiEncounterEffect =
  | { kind: "call-guards"; count: number; reason: "challenge" | "sleep" }
  | { kind: "interrupt-player-sleep"; afterBeat: 2 | 3 }
  | { kind: "louhi-cast-started"; ability: LouhiAbilityId; completesAt: number }
  | { kind: "louhi-cast-interrupted"; ability: LouhiAbilityId; reason: "hit" | "removed" | "battle-cleared" }
  | {
      kind: "bog-player";
      seconds: number;
      damagePerSecond: number;
      meleeDamageMultiplier: number;
    }
  | { kind: "battle-cleared" };

export interface LouhiEncounterStep {
  state: LouhiEncounterState;
  effects: LouhiEncounterEffect[];
}

export function createLouhiEncounterState(presence: LouhiPresence = "present"): LouhiEncounterState {
  return {
    battle: "calm",
    presence,
    guardsAlive: 0,
    pendingSleepInterruptBeat: null,
    guardsCalled: false,
    action: { kind: "idle" },
    nextAbilityAt: Infinity,
  };
}

function beginBattle(
  state: LouhiEncounterState,
  reason: "challenge" | "sleep",
  now: number,
  config: Readonly<LouhiEncounterConfig>,
): LouhiEncounterStep {
  if (state.battle !== "calm" || state.guardsCalled || state.presence !== "present") return { state, effects: [] };
  return {
    state: {
      ...state,
      battle: "active",
      guardsAlive: config.guardCount,
      guardsCalled: true,
      pendingSleepInterruptBeat: null,
      nextAbilityAt: now + config.initialAbilityDelay,
    },
    effects: [{ kind: "call-guards", count: config.guardCount, reason }],
  };
}

function cancelCast(
  state: LouhiEncounterState,
  reason: "hit" | "removed" | "battle-cleared",
  now: number,
  config: Readonly<LouhiEncounterConfig>,
): LouhiEncounterStep {
  if (state.action.kind !== "casting") return { state, effects: [] };
  const ability = state.action.ability;
  return {
    state: { ...state, action: { kind: "idle" }, nextAbilityAt: now + config.abilityCooldown },
    effects: [{ kind: "louhi-cast-interrupted", ability, reason }],
  };
}

/**
 * Etenee kohtaamista yhdellä tapahtumalla. `now` on aina reaaliaikaa: pelaajan laulun
 * bullet time ei siten venytä Louhen omaa laulua. RNG injektoidaan, jotta 2./3. riimun
 * valinta on toistettavissa testeissä.
 */
export function stepLouhiEncounter(
  state: LouhiEncounterState,
  event: LouhiEncounterEvent,
  config: Readonly<LouhiEncounterConfig> = LOUHI_ENCOUNTER,
  rng: () => number = Math.random,
): LouhiEncounterStep {
  switch (event.type) {
    case "challenge":
      return beginBattle(state, "challenge", event.now, config);

    case "player-sleep-started": {
      if (
        !event.nearLouhi || state.battle !== "calm" || state.presence !== "present"
        || state.guardsCalled || state.pendingSleepInterruptBeat !== null
      ) return { state, effects: [] };
      const beat: 2 | 3 = rng() < 0.5 ? 2 : 3;
      return { state: { ...state, pendingSleepInterruptBeat: beat }, effects: [] };
    }

    case "player-song-beat": {
      const beat = state.pendingSleepInterruptBeat;
      if (event.songId !== "sleep" || beat === null || event.beat < beat) return { state, effects: [] };
      const started = beginBattle(state, "sleep", event.now, config);
      if (started.effects.length === 0) return started;
      return {
        state: started.state,
        effects: [{ kind: "interrupt-player-sleep", afterBeat: beat }, ...started.effects],
      };
    }

    case "guard-down": {
      if (state.battle !== "active" || state.guardsAlive <= 0) return { state, effects: [] };
      const guardsAlive = state.guardsAlive - 1;
      if (guardsAlive > 0) return { state: { ...state, guardsAlive }, effects: [] };
      const cancelled = cancelCast({ ...state, guardsAlive: 0 }, "battle-cleared", event.now, config);
      return {
        state: { ...cancelled.state, battle: "cleared", nextAbilityAt: Infinity },
        effects: [...cancelled.effects, { kind: "battle-cleared" }],
      };
    }

    case "tick": {
      if (state.action.kind === "casting") {
        if (event.now < state.action.completesAt) return { state, effects: [] };
        return {
          state: { ...state, action: { kind: "idle" }, nextAbilityAt: event.now + config.abilityCooldown },
          effects: [{
            kind: "bog-player",
            seconds: config.bogSeconds,
            damagePerSecond: config.bogDamagePerSecond,
            meleeDamageMultiplier: config.bogMeleeDamageMultiplier,
          }],
        };
      }
      if (
        state.battle !== "active" || state.presence !== "present" || event.playerRooted
        || event.playerDistance > config.castRange || event.now < state.nextAbilityAt
      ) return { state, effects: [] };
      const completesAt = event.now + config.bogCastSeconds;
      return {
        state: { ...state, action: { kind: "casting", ability: "bog-song", startedAt: event.now, completesAt } },
        effects: [{ kind: "louhi-cast-started", ability: "bog-song", completesAt }],
      };
    }

    case "louhi-hit":
      return cancelCast(state, "hit", event.now, config);

    case "louhi-removed": {
      if (state.presence === "banished") return { state, effects: [] };
      const cancelled = cancelCast(state, "removed", event.now, config);
      return {
        state: {
          ...cancelled.state,
          presence: "banished",
          pendingSleepInterruptBeat: null,
          nextAbilityAt: Infinity,
        },
        effects: cancelled.effects,
      };
    }
  }
}

