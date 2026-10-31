// Taistelun puhdas logiikka: ajoitukset ja osumien ratkaisu.
// Ei Three.js-riippuvuuksia, jotta tätä voi testata suoraan.

export type ActionState =
  | "idle"
  | "windup"
  | "release"
  | "recovery"
  | "block"
  | "stagger"
  | "dodge"
  | "rooted"
  | "dead";

export interface AttackTiming {
  windup: number; // nosto, sekunteina pelin aikaa
  release: number; // iskun aktiivinen vaihe
  recovery: number; // palautuminen
}

export const PLAYER_ATTACK: AttackTiming = { windup: 0.32, release: 0.14, recovery: 0.38 };
export const ENEMY_ATTACK_BASE: AttackTiming = { windup: 0.55, release: 0.14, recovery: 0.45 };

/** Torjunta, joka on aloitettu enintään näin vähän ennen osumaa, on täydellinen torjunta. */
export const PARRY_WINDOW = 0.2;
export const STAGGER_TIME = 0.9;
export const BLOCK_RECOIL = 0.3;
export const DODGE_TIME = 0.35;
export const DODGE_COOLDOWN = 0.6;

export const ATTACK_RANGE = 2.3;
/** Puolikulma radiaaneina, jonka sisällä isku osuu (hyökkääjän edessä). */
export const ATTACK_ARC = Math.PI / 3;
/** Puolikulma, jonka sisältä tuleva isku voidaan torjua. */
export const BLOCK_ARC = Math.PI / 2.2;

export const SONG_GAIN_HIT = 15;
export const SONG_GAIN_PARRY = 30;
export const SONG_MAX = 100;

export type HitResult = "hit" | "blocked" | "parried" | "dodged" | "miss";

export interface Defender {
  state: ActionState;
  /** Pelin aika, jolloin nykyinen torjunta alkoi. */
  blockStart: number;
  /** Kulma (rad) defenderin katsesuunnan ja hyökkääjän suunnan välillä. */
  angleToAttacker: number;
}

export interface Geometry {
  distance: number;
  /** Kulma (rad) hyökkääjän katsesuunnan ja defenderin suunnan välillä. */
  angleToDefender: number;
}

export function inStrikeZone(g: Geometry): boolean {
  return g.distance <= ATTACK_RANGE && Math.abs(g.angleToDefender) <= ATTACK_ARC;
}

/** Ratkaisee iskun lopputuloksen sillä hetkellä, kun isku laukeaa. */
export function resolveHit(g: Geometry, d: Defender, now: number): HitResult {
  if (!inStrikeZone(g)) return "miss";
  if (d.state === "dead") return "miss";
  if (d.state === "dodge") return "dodged";
  if (d.state === "block" && Math.abs(d.angleToAttacker) <= BLOCK_ARC) {
    return now - d.blockStart <= PARRY_WINDOW ? "parried" : "blocked";
  }
  return "hit";
}

export type AttackPhase = "windup" | "release" | "recovery" | "done";

export function attackPhase(elapsed: number, t: AttackTiming): AttackPhase {
  if (elapsed < t.windup) return "windup";
  if (elapsed < t.windup + t.release) return "release";
  if (elapsed < t.windup + t.release + t.recovery) return "recovery";
  return "done";
}

/** Vaikeutuu aalto aallolta: nosto lyhenee, mutta ei alle 0,3 s. */
export function enemyTiming(wave: number): AttackTiming {
  const windup = Math.max(0.3, ENEMY_ATTACK_BASE.windup - 0.05 * (wave - 1));
  return { ...ENEMY_ATTACK_BASE, windup };
}

export function damageFor(base: number, defenderState: ActionState): number {
  return defenderState === "rooted" ? base * 2 : base;
}

/** Kahden suunnan välinen etumerkillinen kulma välillä [-PI, PI]. */
export function angleBetween(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
