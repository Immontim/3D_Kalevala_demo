// Taistelun puhdas logiikka: aseet, iskut, ajoitukset ja osumien ratkaisu.
// Ei Three.js-riippuvuuksia, jotta tätä voi testata suoraan.
//
// Kaikki säädettävät luvut ovat tämän tiedoston taulukoissa (WEAPONS, STRIKES, BASH,
// SHIELDS). Iskun lopullinen teho syntyy kolmesta kerroksesta:
//   lyöjän voima  ×  aseen kertoimet (WeaponDef)  ×  iskun kertoimet (StrikeDef)
// joten saman asekategorian sisään voi myöhemmin tehdä laadultaan erilaisia aseita
// ja lisätä hajontaa koskematta iskujen määrittelyihin.

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
export type WeaponId = "sword" | "spear";
/** Iskun suunta: ylälyönti, sivallus sivulta tai pisto suoraan eteen. */
export type StrikeStyle = "overhead" | "slash" | "thrust";
export type StrikeWeight = "light" | "heavy";
export const STYLES: readonly StrikeStyle[] = ["overhead", "slash", "thrust"];

/** Yhden iskutyypin perusarvot ennen aseen vaikutusta. */
export interface StrikeDef {
  timing: AttackTiming;
  /** Kantama metreinä ilman aseen ulottumaa. */
  range: number;
  /** Puolikulma radiaaneina, jonka sisällä isku osuu (hyökkääjän edessä). */
  arc: number;
  /** Vahinkokerroin. */
  damage: number;
  /** Askel eteenpäin iskun aikana, metreinä. */
  lunge: number;
  /** Kuinka paljon torjuttu isku kuluttaa kilpeä. */
  shieldDamage: number;
}

/**
 * Iskut: jokaisesta suunnasta kevyt (nopea) ja raskas (viritetty) versio.
 * Raskaan iskun windup on samalla viritysaika: niin kauan iskunappia pidetään pohjassa.
 */
export const STRIKES: Record<StrikeStyle, Record<StrikeWeight, StrikeDef>> = {
  overhead: {
    light: { timing: { windup: 0.36, release: 0.14, recovery: 0.4 }, range: 2.2, arc: Math.PI / 5, damage: 1.15, lunge: 0.15, shieldDamage: 1 },
    heavy: { timing: { windup: 0.7, release: 0.16, recovery: 0.6 }, range: 2.3, arc: Math.PI / 5, damage: 2.0, lunge: 0.3, shieldDamage: 2 },
  },
  slash: {
    light: { timing: { windup: 0.32, release: 0.14, recovery: 0.38 }, range: 2.3, arc: Math.PI / 3, damage: 1.0, lunge: 0.15, shieldDamage: 1 },
    heavy: { timing: { windup: 0.62, release: 0.16, recovery: 0.55 }, range: 2.4, arc: Math.PI / 3, damage: 1.7, lunge: 0.3, shieldDamage: 2 },
  },
  thrust: {
    light: { timing: { windup: 0.28, release: 0.12, recovery: 0.42 }, range: 2.5, arc: Math.PI / 7, damage: 0.85, lunge: 0.3, shieldDamage: 1 },
    heavy: { timing: { windup: 0.58, release: 0.12, recovery: 0.55 }, range: 2.6, arc: Math.PI / 7, damage: 1.5, lunge: 0.45, shieldDamage: 2 },
  },
};

/** Aseen ominaisuudet. Laadultaan erilaiset aseet ovat tämän taulukon uusia rivejä. */
export interface WeaponDef {
  id: WeaponId;
  name: string;
  /** Aseen perusvahinkokerroin (laatu). */
  damage: number;
  /** Lisäys iskun kantamaan metreinä. */
  reach: number;
  /** Lisäys iskun askeleeseen metreinä: keihäsmies syöksyy piston mukana. */
  lunge: number;
  /** Tätä lähempänä ase ei osu (keihään varsi on tiellä). */
  minRange: number;
  /** Noston ja palautumisen kerroin: yli 1 on hitaampi ase. */
  slowness: number;
  /** Mitä iskuja aseella voi tehdä ja kuinka hyvin (vahinkokerroin suunnittain). */
  styles: Partial<Record<StrikeStyle, number>>;
  /** Puolikulma, jonka sisältä tuleva isku voidaan torjua aseella. */
  blockArc: number;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  sword: {
    id: "sword", name: "Miekka", damage: 1, reach: 0, lunge: 0, minRange: 0, slowness: 1,
    styles: { overhead: 1, slash: 1, thrust: 1 }, blockArc: Math.PI / 2.2,
  },
  // Kantama on mitattu mallista: pistossa keihään kärki on 1,91 m hahmon keskeltä ja miekan
  // 1,25 m, ja syöksy on 0,3 m pidempi. Samalla pelivaralla kuin miekalla ero on 1,0 m.
  spear: {
    id: "spear", name: "Keihäs", damage: 1, reach: 1.0, lunge: 0.3, minRange: 1.3, slowness: 1.35,
    styles: { thrust: 1.3 }, blockArc: Math.PI / 2.2,
  },
};

export interface ShieldDef {
  /** Kestopisteet: kevyt isku vie 1, raskas 2 (StrikeDef.shieldDamage). */
  durability: number;
  /** Puolikulma, jonka sisältä tuleva isku osuu kilpeen. */
  blockArc: number;
  /** Tämän osuuden alapuolella kilvessä näkyy lovi. */
  notchAt: number;
}

/** Kilpi kestää 10 kevyttä tai 5 raskasta iskua. */
export const SHIELDS: Record<"round", ShieldDef> = {
  round: { durability: 10, blockArc: Math.PI / 1.5, notchAt: 0.5 },
};

export function weaponOf(loadout: Loadout): WeaponDef {
  return loadout === "spear" ? WEAPONS.spear : WEAPONS.sword;
}

/** Valmiiksi laskettu isku: iskun ja aseen arvot yhdistettynä. */
export interface AttackDef {
  /** Suunta, tai "bash" kilpityönnölle. */
  kind: StrikeStyle | "bash";
  weight: StrikeWeight;
  timing: AttackTiming;
  range: number;
  minRange: number;
  arc: number;
  /** Vahinkokerroin lyöjän voimaan. */
  damage: number;
  lunge: number;
  shieldDamage: number;
}

export function makeAttack(w: WeaponDef, style: StrikeStyle, weight: StrikeWeight): AttackDef {
  const s = STRIKES[style][weight];
  return {
    kind: style,
    weight,
    timing: { windup: s.timing.windup * w.slowness, release: s.timing.release, recovery: s.timing.recovery * w.slowness },
    range: s.range + w.reach,
    minRange: w.minRange,
    arc: s.arc,
    damage: s.damage * w.damage * (w.styles[style] ?? 0),
    lunge: s.lunge + w.lunge,
    shieldDamage: s.shieldDamage,
  };
}

/** Kilpityöntö: nopea ja lyhyt, lähes vahingoton, mutta murtaa aseella tehdyn torjunnan. */
export const BASH: AttackDef = {
  kind: "bash", weight: "light", timing: { windup: 0.2, release: 0.1, recovery: 0.4 },
  range: 1.7, minRange: 0, arc: Math.PI / 3, damage: 0.25, lunge: 0.3, shieldDamage: 1,
};

/** Iskusuunta, jonka ase osaa: jos pyydetty puuttuu, käytetään aseen ensimmäistä. */
export function styleFor(w: WeaponDef, wanted: StrikeStyle): StrikeStyle {
  if (w.styles[wanted]) return wanted;
  return STYLES.find((s) => w.styles[s]) ?? "slash";
}

/** Kuinka kauan täyteen viritettyä iskua voi pidätellä, ennen kuin se laukeaa itsestään. */
export const CHARGE_HOLD_MAX = 0.8;

/**
 * Viritysmittarin täyttö 0..1, kun iskunappia on pidetty pohjassa `held` sekuntia.
 * Täysi mittari tarkoittaa, että raskas isku on viritetty.
 */
export function chargeLevel(held: number, heavy: AttackDef): number {
  return Math.max(0, Math.min(1, held / heavy.timing.windup));
}

/** Torjunta, joka on aloitettu enintään näin vähän ennen osumaa, on täydellinen torjunta. */
export const PARRY_WINDOW = 0.2;
export const STAGGER_TIME = 0.9;
export const BLOCK_RECOIL = 0.3;
export const DODGE_TIME = 0.35;
export const DODGE_COOLDOWN = 0.6;
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
  /** Ehjä kilpi kädessä: torjuu kaikki iskusuunnat. */
  shield?: ShieldDef | null;
  /** Aseella torjuttaessa: mitä iskusuuntaa vastaan torjunta on. */
  stance?: StrikeStyle;
  /** Aseen torjuntakaari; oletus miekan. */
  blockArc?: number;
}

export interface Geometry {
  distance: number;
  /** Kulma (rad) hyökkääjän katsesuunnan ja defenderin suunnan välillä. */
  angleToDefender: number;
}

const DEFAULT_ATTACK = makeAttack(WEAPONS.sword, "slash", "light");

export function inStrikeZone(g: Geometry, a: AttackDef = DEFAULT_ATTACK): boolean {
  return g.distance <= a.range && g.distance >= a.minRange && Math.abs(g.angleToDefender) <= a.arc;
}

/**
 * Ratkaisee iskun lopputuloksen sillä hetkellä, kun isku laukeaa.
 * - Kilpi torjuu kaikki iskut (ja kuluu, ks. shieldWear).
 * - Aseella torjunta onnistuu vain, jos torjunta-asento vastaa iskun suuntaa.
 * - Kilpityöntö murtaa aseella tehdyn torjunnan asennosta riippumatta.
 */
export function resolveHit(g: Geometry, d: Defender, now: number, a: AttackDef = DEFAULT_ATTACK): HitResult {
  if (!inStrikeZone(g, a)) return "miss";
  if (d.state === "dead") return "miss";
  if (d.state === "dodge") return "dodged";
  if (d.state !== "block") return "hit";
  const arc = d.shield ? d.shield.blockArc : d.blockArc ?? WEAPONS.sword.blockArc;
  if (Math.abs(d.angleToAttacker) > arc) return "hit";
  const covers = !!d.shield || a.kind === "bash" || (d.stance ?? "slash") === a.kind;
  if (!covers) return "hit";
  if (now - d.blockStart <= PARRY_WINDOW) return "parried";
  if (a.kind === "bash" && !d.shield) return "guardbreak";
  return "blocked";
}

/** Kuinka paljon kilpi kuluu tästä iskusta. Täydellinen torjunta ei kuluta kilpeä. */
export function shieldWear(a: AttackDef, res: HitResult, d: Defender): number {
  return res === "blocked" && d.shield ? a.shieldDamage : 0;
}

export function damageFor(base: number, defenderState: ActionState): number {
  return defenderState === "rooted" ? base * 2 : base;
}

/** Iskun vahinko: lyöjän voima × iskun ja aseen kerroin. Vain osuma tekee vahinkoa. */
export function strikeDamage(power: number, a: AttackDef, res: HitResult, defenderState: ActionState): number {
  return res === "hit" ? damageFor(power * a.damage, defenderState) : 0;
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
export function enemyAttackTiming(a: AttackDef, wave: number): AttackTiming {
  const t = a.timing;
  const windup = Math.max(t.windup - 0.02, t.windup + 0.23 - 0.05 * (wave - 1));
  return { windup, release: t.release, recovery: t.recovery + 0.07 };
}

/** Kahden suunnan välinen etumerkillinen kulma välillä [-PI, PI]. */
export function angleBetween(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
