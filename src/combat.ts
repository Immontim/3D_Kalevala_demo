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

/**
 * Taistelun yleiset ajat ja kertoimet. Kaikki ovat säädettävissä (ks. tuning.ts).
 */
export const COMBAT = {
  /** Kuinka kauan täyteen viritettyä iskua voi pidätellä, ennen kuin se laukeaa itsestään. */
  chargeHoldMax: 0.8,
  /** Torjunta, joka on aloitettu enintään näin vähän ennen osumaa, on täydellinen torjunta. */
  parryWindow: 0.2,
  /** Horjahdus täydellisen torjunnan jälkeen, sekunteja. */
  staggerTime: 0.9,
  /** Osuman aiheuttama horjahdus, sekunteja. */
  hitStagger: 0.405,
  /** Murretun torjunnan jälkeinen horjahdus, sekunteja. */
  guardbreakStagger: 0.9,
  /** Suojan murtanut pääsee jatkamaan näin paljon nopeammin (lyhentää palautumista). */
  guardbreakAdvantage: 0.25,
  /** Torjuttu lyöjä palautuu näin paljon hitaammin. */
  blockRecoil: 0.3,
  dodgeTime: 0.35,
  dodgeCooldown: 0.6,
  /** Väistön nopeus, m/s. */
  dodgeSpeed: 7,
  /** Kaikkien lyöntien noston kerroin (1 = taulukon ajat). */
  windupScale: 1,
  /** Kaikkien lyöntien palautumisajan kerroin (1 = taulukon ajat). */
  recoveryScale: 1,
  /** Liikenopeuden kerroin torjunnan, noston ja palautumisen aikana. */
  guardMoveScale: 0.41,
  /** Suohon laulettu ottaa vahingon tällä kertoimella. */
  rootedDamage: 2,
  /** Laulun voiman kertyminen osumasta ja täydellisestä torjunnasta, ja mittarin koko. */
  songGainHit: 15,
  songGainParry: 30,
  songMax: 100,
};

/** Hahmon perusarvot. Ajonaikaiset muutokset (ruoka, nälkä, loitsut) tehdään stats.ts:n muuntimilla. */
export interface CharacterDef {
  hp: number;
  /** Enimmäiskestävyys. */
  stamina: number;
  /** Kestävyyden palautuminen sekunnissa. */
  staminaRegen: number;
  /** Lyöjän voima: vahingon perusarvo ennen aseen ja iskun kertoimia. */
  power: number;
  /** Kävelynopeus, m/s. */
  moveSpeed: number;
}

/** Vastustajien arvot ovat aallon 0 arvoja: aalto lisää niihin WAVES-taulukon verran. */
export const CHARACTERS: Record<string, CharacterDef> = {
  hero: { hp: 100, stamina: 100, staminaRegen: 1, power: 20, moveSpeed: 3.4 },
  urho: { hp: 80, stamina: 60, staminaRegen: 1, power: 14, moveSpeed: 2.4 },
  pohja: { hp: 80, stamina: 80, staminaRegen: 1, power: 14, moveSpeed: 2.4 },
};

/** Aaltojen vaikeutuminen ja pelaajan lepo aaltojen välissä. */
export const WAVES = {
  /** Vastustajan elämän ja voiman lisäys jokaista aaltoa kohti. */
  hpPerWave: 20,
  powerPerWave: 1,
  /** Pelaajan palautuminen aaltojen välissä. */
  restHp: 35,
  restStamina: 35,
  /** Sekunteja vastustajan kaatumisesta seuraavan saapumiseen. */
  nextWaveDelay: 3,
  /** Kaatunut vastustaja jää maahan näin pitkäksi aikaa seuraavan saavuttua (sama kuin pudonneilla varusteilla). */
  corpseTime: 40,
};

/** Vastustajan tekoälyn luvut. */
export const ENEMY_AI = {
  /** Nosto on aluksi näin paljon pelaajan nostoa pidempi ja lyhenee aalto aallolta. */
  windupHandicap: 0.23,
  windupPerWave: 0.05,
  /** Lopulta nosto on tämän verran pelaajan nostoa nopeampi. */
  windupEdge: 0.02,
  extraRecovery: 0.07,
  /** Kuinka usein vastustaja torjuu pelaajan noston: perusarvo, lisäys aaltoa kohti ja katto. */
  blockBase: 0.3,
  blockPerWave: 0.1,
  blockMax: 0.7,
  blockShieldBonus: 0.2,
  blockSpearBonus: -0.1,
  /** Kuinka usein aseella torjuva lukee iskun suunnan oikein. */
  readBase: 0.5,
  readPerWave: 0.06,
  readMax: 0.9,
  /** Raskaan lyönnin osuus varustuksen mukaan, ja kilven takana seisovaa pelaajaa vastaan. */
  heavySword: 0.35,
  heavySpear: 0.25,
  heavyShield: 0.15,
  heavyVsTurtle: 0.7,
  /** Pelaaja on seissyt torjunnassa näin pitkään: suoja kannattaa murtaa. */
  turtleTime: 0.7,
  /** Tavoite-etäisyydet. */
  distSword: 1.9,
  distSpear: 2.9,
  distBash: 1.35,
  /** Liikenopeuden kertoimet: kaukaa lähestyessä ja keihäsmiehen perääntyessä. */
  chaseScale: 1.42,
  spearRetreatScale: 1.25,
  /** Päätösten väli sekunteina (vähintään + satunnainen lisä) ja hyökkäyksen todennäköisyys. */
  decideMin: 0.5,
  decideRandom: 1.0,
  attackChance: 0.65,
  bashChance: 0.9,
  /** Vastaisku torjunnan jälkeen. */
  counterChance: 0.55,
  /** Uupunut vetäytyy tälle etäisyydelle, kunnes kestävyyttä on taas restUntil; lyö silti, jos pelaaja tulee restCornered lähemmäs. */
  restUntil: 12,
  restDistance: 3.8,
  restCornered: 2.0,
  /** Suosta päässeen kääntymisnopeus (rad/s) ja kulma, jonka sisällä se on taas valmis. */
  reorientTurn: 3.2,
  reorientDone: 0.2,
};

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
    timing: {
      windup: s.timing.windup * w.slowness * COMBAT.windupScale,
      release: s.timing.release,
      recovery: s.timing.recovery * w.slowness * COMBAT.recoveryScale,
    },
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

/**
 * Viritysmittarin täyttö 0..1, kun iskunappia on pidetty pohjassa `held` sekuntia.
 * Täysi mittari tarkoittaa, että raskas isku on viritetty.
 */
export function chargeLevel(held: number, heavy: AttackDef): number {
  return Math.max(0, Math.min(1, held / heavy.timing.windup));
}

// ---------- Kestävyys (stamina) ----------
/**
 * Kaikki kestävyyden luvut. Lyönnit ja torjunnat kuluttavat kestävyyttä, ja se palautuu
 * tasaisesti. Enimmäismäärä ja palautumisnopeus ovat hahmon arvoja (CHARACTERS, stats.ts).
 */
export const STAMINA = {
  /** Kevyen lyönnin (ja kilpityönnön) hinta. Tätä vähemmällä hahmo on uupunut. */
  light: 3,
  /** Raskaan lyönnin hinta. */
  heavy: 9,
  /** Toteutuneen torjunnan hinta osumahetkellä (myös täydellinen torjunta). */
  blockHit: 2,
  /** Torjunta-asennon ylläpito sekunnissa. Palautuminen (hahmon staminaRegen) jatkuu samalla. */
  blockHold: 1,
  /** Uupuneen lyönnin vahinkokerroin. */
  weakDamage: 0.25,
};

/** Uupunut: ei pysty torjumaan, ja lyönnit ovat heikkoja. Raja on kevyen lyönnin hinta. */
export function exhausted(stamina: number): boolean {
  return stamina < STAMINA.light;
}

export function canStrikeHeavy(stamina: number): boolean {
  return stamina >= STAMINA.heavy;
}

/** Millainen lyönti näillä voimilla syntyy: raskas, kevyt vai uupuneen heikko lyönti. */
export type StrikeTier = "heavy" | "light" | "weak";
export function strikeTier(stamina: number, weight: StrikeWeight): StrikeTier {
  if (exhausted(stamina)) return "weak";
  return weight === "heavy" && canStrikeHeavy(stamina) ? "heavy" : "light";
}

/** Heikko lyönti ei maksa mitään: sen hinta on jo maksettu vahingossa. */
export function strikeCost(tier: StrikeTier): number {
  return tier === "heavy" ? STAMINA.heavy : tier === "light" ? STAMINA.light : 0;
}

/** Uupuneen lyönti: sama isku, mutta vain neljännes vahingosta. */
export function weakened(a: AttackDef): AttackDef {
  return { ...a, weight: "light", damage: a.damage * STAMINA.weakDamage };
}

/** Kestävyys dt sekunnin kuluttua. */
export function staminaTick(stamina: number, max: number, regen: number, blocking: boolean, dt: number): number {
  const rate = regen - (blocking ? STAMINA.blockHold : 0);
  return Math.max(0, Math.min(max, stamina + rate * dt));
}

/** Kestävyys toteutuneen torjunnan jälkeen. */
export function staminaAfterBlock(stamina: number): number {
  return Math.max(0, stamina - STAMINA.blockHit);
}


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
  if (now - d.blockStart <= COMBAT.parryWindow) return "parried";
  if (a.kind === "bash" && !d.shield) return "guardbreak";
  return "blocked";
}

/** Kuinka paljon kilpi kuluu tästä iskusta. Täydellinen torjunta ei kuluta kilpeä. */
export function shieldWear(a: AttackDef, res: HitResult, d: Defender): number {
  return res === "blocked" && d.shield ? a.shieldDamage : 0;
}

export function damageFor(base: number, defenderState: ActionState): number {
  return defenderState === "rooted" ? base * COMBAT.rootedDamage : base;
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
  const windup = Math.max(t.windup - ENEMY_AI.windupEdge, t.windup + ENEMY_AI.windupHandicap - ENEMY_AI.windupPerWave * (wave - 1));
  return { windup, release: t.release, recovery: t.recovery + ENEMY_AI.extraRecovery };
}

/** Kahden suunnan välinen etumerkillinen kulma välillä [-PI, PI]. */
export function angleBetween(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
