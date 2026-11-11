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

export type Loadout = "sword" | "sword_shield" | "spear";
export type AttackKind = "slash" | "heavy" | "thrust" | "bash";

export interface AttackDef {
  kind: AttackKind;
  timing: AttackTiming;
  /** Kantama metreinä. */
  range: number;
  /** Tätä lähempänä isku ei osu (keihään varsi on tiellä). */
  minRange: number;
  /** Puolikulma radiaaneina, jonka sisällä isku osuu (hyökkääjän edessä). */
  arc: number;
  /** Vahinkokerroin perusvahinkoon. */
  damage: number;
  /** Askel eteenpäin iskun aikana, metreinä. */
  lunge: number;
}

/**
 * Iskutyypit. Ajoitukset ovat pelaajan; vihollisen ajoitus tulee enemyAttackTiming()-funktiosta.
 * - slash: nopea sivallus, perusisku.
 * - heavy: raskas isku pään yli. Hidas, mutta murtaa miekalla tai keihäällä tehdyn torjunnan.
 * - thrust: keihään pisto. Pitkä kantama ja kapea kaari, ei osu aivan lähelle.
 * - bash: kilpityöntö. Lyhyt ja nopea, ei juuri vahinkoa, mutta murtaa minkä tahansa torjunnan.
 */
export const ATTACKS: Record<AttackKind, AttackDef> = {
  slash: { kind: "slash", timing: { windup: 0.32, release: 0.14, recovery: 0.38 }, range: 2.3, minRange: 0, arc: Math.PI / 3, damage: 1, lunge: 0.15 },
  heavy: { kind: "heavy", timing: { windup: 0.62, release: 0.16, recovery: 0.55 }, range: 2.4, minRange: 0, arc: Math.PI / 4, damage: 1.8, lunge: 0.3 },
  thrust: { kind: "thrust", timing: { windup: 0.4, release: 0.12, recovery: 0.5 }, range: 3.3, minRange: 1.3, arc: Math.PI / 7, damage: 1.1, lunge: 0.4 },
  bash: { kind: "bash", timing: { windup: 0.2, release: 0.1, recovery: 0.4 }, range: 1.7, minRange: 0, arc: Math.PI / 3, damage: 0.25, lunge: 0.3 },
};

export const PLAYER_ATTACK: AttackTiming = ATTACKS.slash.timing;
/** Kuinka pitkään iskunappia pidetään pohjassa, ennen kuin sivallus muuttuu raskaaksi iskuksi. */
export const HEAVY_HOLD = 0.24;

/** Torjunta, joka on aloitettu enintään näin vähän ennen osumaa, on täydellinen torjunta. */
export const PARRY_WINDOW = 0.2;
export const STAGGER_TIME = 0.9;
export const BLOCK_RECOIL = 0.3;
export const DODGE_TIME = 0.35;
export const DODGE_COOLDOWN = 0.6;

export const ATTACK_RANGE = ATTACKS.slash.range;
/** Puolikulma, jonka sisältä tuleva isku voidaan torjua aseella. */
export const BLOCK_ARC = Math.PI / 2.2;
/** Kilpi suojaa leveämmältä alalta kuin ase. */
export const SHIELD_BLOCK_ARC = Math.PI / 1.5;
/** Murretun torjunnan jälkeinen horjahdus sekunteina. */
export const GUARDBREAK_STAGGER = 0.9;
/** Suojan murtanut pääsee jatkamaan näin paljon nopeammin (lyhentää palautumista). */
export const GUARDBREAK_ADVANTAGE = 0.25;

export const SONG_GAIN_HIT = 15;
export const SONG_GAIN_PARRY = 30;
export const SONG_MAX = 100;

export type HitResult = "hit" | "blocked" | "guardbreak" | "parried" | "dodged" | "miss";

export interface Defender {
  state: ActionState;
  /** Pelin aika, jolloin nykyinen torjunta alkoi. */
  blockStart: number;
  /** Kulma (rad) defenderin katsesuunnan ja hyökkääjän suunnan välillä. */
  angleToAttacker: number;
  /** Torjuuko kilvellä (leveämpi suoja, kestää raskaan iskun). */
  shield?: boolean;
}

export interface Geometry {
  distance: number;
  /** Kulma (rad) hyökkääjän katsesuunnan ja defenderin suunnan välillä. */
  angleToDefender: number;
}

export function inStrikeZone(g: Geometry, a: AttackDef = ATTACKS.slash): boolean {
  return g.distance <= a.range && g.distance >= a.minRange && Math.abs(g.angleToDefender) <= a.arc;
}

/** Ratkaisee iskun lopputuloksen sillä hetkellä, kun isku laukeaa. */
export function resolveHit(g: Geometry, d: Defender, now: number, a: AttackDef = ATTACKS.slash): HitResult {
  if (!inStrikeZone(g, a)) return "miss";
  if (d.state === "dead") return "miss";
  if (d.state === "dodge") return "dodged";
  const arc = d.shield ? SHIELD_BLOCK_ARC : BLOCK_ARC;
  if (d.state === "block" && Math.abs(d.angleToAttacker) <= arc) {
    if (now - d.blockStart <= PARRY_WINDOW) return "parried";
    if (a.kind === "bash") return "guardbreak";
    if (a.kind === "heavy" && !d.shield) return "guardbreak";
    return "blocked";
  }
  return "hit";
}

/** Iskun vahinko lopputuloksen mukaan. Murrettu torjunta päästää raskaasta iskusta puolet läpi. */
export function strikeDamage(base: number, a: AttackDef, res: HitResult, defenderState: ActionState): number {
  if (res === "hit") return damageFor(base * a.damage, defenderState);
  if (res === "guardbreak" && a.kind === "heavy") return base * a.damage * 0.5;
  return 0;
}

/** Mikä isku lähtee, kun iskunappia painetaan. */
export function attackFor(loadout: Loadout, blocking: boolean): AttackKind {
  if (loadout === "spear") return "thrust";
  if (loadout === "sword_shield" && blocking) return "bash";
  return "slash";
}

export type AttackPhase = "windup" | "release" | "recovery" | "done";

export function attackPhase(elapsed: number, t: AttackTiming): AttackPhase {
  if (elapsed < t.windup) return "windup";
  if (elapsed < t.windup + t.release) return "release";
  if (elapsed < t.windup + t.release + t.recovery) return "recovery";
  return "done";
}

/**
 * Vihollisen ajoitus: nosto on aluksi 0,23 s pelaajan nostoa pidempi ja lyhenee aalto
 * aallolta, mutta jää lopulta vain hieman pelaajan nostoa nopeammaksi.
 */
export function enemyAttackTiming(kind: AttackKind, wave: number): AttackTiming {
  const t = ATTACKS[kind].timing;
  const windup = Math.max(t.windup - 0.02, t.windup + 0.23 - 0.05 * (wave - 1));
  return { windup, release: t.release, recovery: t.recovery + 0.07 };
}

export function enemyTiming(wave: number): AttackTiming {
  return enemyAttackTiming("slash", wave);
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
