// Taistelun puhdas logiikka: aseet, iskut, ajoitukset ja osumien ratkaisu.
// Ei Three.js-riippuvuuksia, jotta tätä voi testata suoraan.
//
// Kaikki säädettävät luvut ovat tämän tiedoston taulukoissa (WEAPONS, STRIKES, BASH,
// SHIELDS). Iskun lopullinen teho syntyy kolmesta kerroksesta:
//   lyöjän voima  ×  aseen kertoimet (WeaponDef)  ×  iskun kertoimet (StrikeDef)
// joten saman asekategorian sisään voi myöhemmin tehdä laadultaan erilaisia aseita
// ja lisätä hajontaa koskematta iskujen määrittelyihin.

import { t } from "./i18n";

export type ActionState =
  | "idle"
  | "windup"
  | "release"
  | "recovery"
  | "block"
  | "stagger"
  | "dodge"
  | "rooted"
  | "talk"
  | "use"
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
  /** Sankarin horjahduksen jälkeen näin moneen sekuntiin osumat tekevät vain vahingon eivätkä horjuta uudelleen. */
  staggerImmunity: 0.4,
  /** Suojan murtanut pääsee jatkamaan näin paljon nopeammin (lyhentää palautumista). */
  guardbreakAdvantage: 0.25,
  /** Torjuttu lyöjä palautuu näin paljon hitaammin. */
  blockRecoil: 0.3,
  /** Kilpityönnön peräännyttämä matka ja liikkeen nopeus. */
  bashPushDistance: 0.65,
  bashPushSpeed: 2.6,
  dodgeTime: 0.35,
  dodgeCooldown: 0.6,
  /**
   * Väistöaskeleen pituus (m). Askel kulkee sidestepPose-käyrää pitkin, ei tasaisella nopeudella.
   * Sivuaskeleen leveimmässä kohdassa jalat ovat taisteluasennon leveyden (0,34 m) + tämän verran erillään;
   * pidempi askel painaa lantion syvään "sumokyykkyyn". Väistön suoja-aika (dodgeTime) ei riipu matkasta.
   */
  dodgeDistance: 0.6,
  /**
   * Osuus iskuvaiheesta (release), jonka kohdalla isku osuu. Sitä ennen lyöjä ottaa
   * tukiaskeleen eteen (lunge); isku ratkeaa vasta, kun askel on otettu.
   */
  strikePoint: 0.7,
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
  /**
   * Suoja-aika yhtä vastaan monta -taistelussa: onnistunut torjunta pysäyttää näin monta
   * sekuntia myös muiden vastustajien iskut, jotka tulevat samasta suunnasta kuin torjuttu isku.
   */
  graceBlock: 0.6,
  /** Suoja-aika täydellisen torjunnan jälkeen, sekunteja. */
  graceParry: 1.0,
  /**
   * Suoja-ajan sektorin puolikas asteina, mitattuna torjutun iskun suunnasta. Lisäksi iskun on tultava
   * torjunnan omalta sektorilta katseen edestä: sivulta ja takaa tuleva osuu.
   */
  graceArc: 40,
};

/** Puettujen suojavarusteiden kertoimet ja kypärän irtoamisen todennäköisyydet. */
export const ARMOUR = {
  ringMailDamage: 0.85,
  greavesDamage: 0.95,
  helmetLightKnock: 0.25,
  helmetHeavyKnock: 0.6,
  helmetFatalKnock: 1,
};

export function damageAfterArmour(damage: number, ringMail: boolean, greaves: boolean): number {
  return damage * (ringMail ? ARMOUR.ringMailDamage : 1) * (greaves ? ARMOUR.greavesDamage : 1);
}

/** Kypärä voi irrota vain osuvasta ylälyönnistä; irrotessaan se ottaa koko iskun vastaan. */
export function helmetAbsorbsOverhead(
  kind: StrikeStyle,
  weight: StrikeWeight,
  hasHelmet: boolean,
  wouldBeFatal: boolean,
  roll: number,
): boolean {
  if (!hasHelmet || kind !== "overhead") return false;
  const chance = wouldBeFatal ? ARMOUR.helmetFatalKnock
    : weight === "heavy" ? ARMOUR.helmetHeavyKnock : ARMOUR.helmetLightKnock;
  return roll < chance;
}

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
  /** Suurin kääntymisnopeus, astetta sekunnissa. */
  turnSpeed: number;
  /** Vastustajan reaktioviive sekunteina: kuinka jäljessä se seuraa pelaajan liikettä (pelaajalla ei käytössä). */
  reaction: number;
}

/** Vastustajien arvot ovat aallon 0 arvoja: aalto lisää niihin WAVES-taulukon verran. */
export const CHARACTERS: Record<string, CharacterDef> = {
  // Nuori urho on kömpelö ja hidas kääntymään: ketterä sankari pääsee sen kylkeen.
  hero: { hp: 100, stamina: 100, staminaRegen: 1, power: 20, moveSpeed: 3.4, turnSpeed: 600, reaction: 0 },
  urho: { hp: 70, stamina: 60, staminaRegen: 1, power: 14, moveSpeed: 2.4, turnSpeed: 95, reaction: 0.5 },
  pohja: { hp: 80, stamina: 80, staminaRegen: 1, power: 14, moveSpeed: 2.4, turnSpeed: 140, reaction: 0.3 },
};

/** Aaltojen vaikeutuminen ja pelaajan lepo aaltojen välissä. */
export const WAVES = {
  /** Vastustajan elämän ja voiman lisäys jokaista aaltoa kohti. */
  hpPerWave: 20,
  powerPerWave: 1,
  /** Pelaajan palautuminen aaltojen välissä. */
  restHp: 35,
  restStamina: 35,
  /** Aallosta twoFrom alkaen vastustajia on kaksi, aallosta threeFrom alkaen kolme. */
  twoFrom: 4,
  threeFrom: 6,
  /** Ryhmässä jokaisen vastustajan elämä kerrotaan tällä (kaksi tai kolme vastustajaa). */
  hpScaleTwo: 0.6,
  hpScaleThree: 0.45,
  /** Sekunteja vastustajan kaatumisesta seuraavan saapumiseen. */
  nextWaveDelay: 3,
  /** Kaatunut vastustaja jää maahan näin pitkäksi aikaa seuraavan saavuttua (sama kuin pudonneilla varusteilla). */
  corpseTime: 40,
};

/** Montako vastustajaa aallossa on. */
export function groupSize(wave: number): number {
  return wave >= WAVES.threeFrom ? 3 : wave >= WAVES.twoFrom ? 2 : 1;
}

/** Ryhmän koon mukainen kerroin jokaisen vastustajan elämälle. */
export function groupHpScale(size: number): number {
  return size >= 3 ? WAVES.hpScaleThree : size === 2 ? WAVES.hpScaleTwo : 1;
}

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
  /** Kiertely (sivuaskel) vain tätä lähempänä; kauempaa juostaan suoraan kohti. */
  strafeRange: 5,
  spearRetreatScale: 1.25,
  /** Päätösten väli sekunteina (vähintään + satunnainen lisä) ja hyökkäyksen todennäköisyys. */
  decideMin: 0.5,
  decideRandom: 1.0,
  attackChance: 0.65,
  /**
   * Ryhmän hyökkäyskatto: näin moni saa olla yhtä aikaa nostamassa tai lyömässä. Raja on tilannepohjainen:
   * paikan saa kuka tahansa, joka on asemissa, kun lyöjiä on vähemmän.
   */
  maxAttackers: 2,
  /** Iskun aloitusviive (s) päätöksestä: jokainen arpoo omansa, jotta ryhmä ei lyö samassa ruudussa. */
  attackDelayMin: 0.04,
  attackDelayMax: 0.22,
  /** Toisen juuri aloittaman noston jälkeen oma isku alkaa aikaisintaan näin monen sekunnin päästä (siirtyy, ei peruunnu). */
  startSpacing: 0.15,
  /** Katon takia odottamaan jäänyt pysyy näin paljon lyöntietäisyyttä kauempana (m)… */
  waitBack: 0.9,
  /** …ja näin monta sekuntia katon vapauduttua, ettei se heilu edestakaisin. */
  waitHold: 0.6,
  /** Vastustajat pitävät toisiinsa vähintään tämän välin (m), jolloin ryhmä levittäytyy sankarin ympärille. */
  spread: 2.4,
  /** Ryhmässä vastustaja ei kierrä sankarin selän taakse tätä kulmaa (astetta sankarin katseesta) pidemmälle. */
  flankMax: 115,
  /** Pohjan kilpisoturin satunnainen kilpityöntö lähietäisyydellä. */
  bashChance: 0.12,
  /** Vastaisku torjunnan jälkeen. */
  counterChance: 0.55,
  /**
   * Torjunnan reaktioviive (s): jokainen vastustaja arpoo oman viiveensä jokaiseen pelaajan iskuun,
   * jotta kilvet eivät nouse yhtä aikaa. Yläraja lyhenee, jos asento ei muuten ehtisi nousta (BLOCK_RAISE).
   */
  blockDelayMin: 0.03,
  blockDelayMax: 0.16,
  /** Vastustaja torjuu vain, jos se on pelaajan iskun kaaressa tai enintään näin monta astetta sen ulkopuolella. */
  threatMargin: 25,
  /** Etenevä nosto: osuus iskuista, joiden noston aikana vastustaja astuu perääntyvän pelaajan perään. */
  advanceChance: 0.45,
  /** Etenevän noston nopeus vastustajan omasta kävelynopeudesta. */
  advanceScale: 0.6,
  /** Eteneminen loppuu, kun pelaaja on näin paljon (m) iskun kantaman sisäpuolella. */
  advanceKeep: 0.6,
  /** Eteneminen vain, jos pelaaja on enintään näin monta astetta katseen sivulla: kiertäminen auttaa yhä. */
  advanceArc: 50,
  /** Uupunut vetäytyy tälle etäisyydelle, kunnes kestävyyttä on taas restUntil; lyö silti, jos pelaaja tulee restCornered lähemmäs. */
  restUntil: 12,
  restDistance: 3.8,
  restCornered: 2.0,
  /** Suosta päässeen kääntymisnopeus (rad/s) ja kulma, jonka sisällä se on taas valmis. */
  reorientTurn: 3.2,
  /** Kääntymisnopeuden kerroin iskun, horjahduksen ja väistön aikana: lyövä vastustaja ei seuraa kiertäjää. */
  attackTurnScale: 0.35,
  reorientDone: 0.2,
};

export type Loadout = "sword" | "sword_shield" | "spear";
export type WeaponId = "sword" | "spear" | "sky_iron_sword";
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
  /**
   * Tukiaskel eteenpäin iskuvaiheen alussa, metreinä. Kantama (range) lasketaan paikasta,
   * josta askel lähti, joten askeleen pidentäminen ei pidennä iskun ulottumaa.
   */
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
    light: { timing: { windup: 0.32, release: 0.2, recovery: 0.32 }, range: 2.3, arc: Math.PI / 3, damage: 1.0, lunge: 0.45, shieldDamage: 1 },
    heavy: { timing: { windup: 0.62, release: 0.22, recovery: 0.49 }, range: 2.4, arc: Math.PI / 3, damage: 1.7, lunge: 0.6, shieldDamage: 2 },
  },
  thrust: {
    light: { timing: { windup: 0.28, release: 0.2, recovery: 0.34 }, range: 2.5, arc: Math.PI / 7, damage: 0.85, lunge: 0.5, shieldDamage: 1 },
    heavy: { timing: { windup: 0.58, release: 0.2, recovery: 0.47 }, range: 2.6, arc: Math.PI / 7, damage: 1.5, lunge: 0.65, shieldDamage: 2 },
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
  /** Puolikulma, jonka sisältä tuleva isku voidaan torjua aseella (radiaaneina; PI / 4 = ±45° edestä). */
  blockArc: number;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  sword: {
    id: "sword", name: t("weapon.sword"), damage: 1, reach: 0, lunge: 0, minRange: 0, slowness: 1,
    styles: { overhead: 1, slash: 1, thrust: 1 }, blockArc: Math.PI / 4,
  },
  // Kantama on mitattu mallista: pistossa keihään kärki on 1,91 m hahmon keskeltä ja miekan
  // 1,25 m, ja syöksy on 0,3 m pidempi. Samalla pelivaralla kuin miekalla ero on 1,0 m.
  spear: {
    id: "spear", name: t("weapon.spear"), damage: 1.1, reach: 1.0, lunge: 0.3, minRange: 1.3, slowness: 1.35,
    styles: { thrust: 1.3 }, blockArc: Math.PI / 4,
  },
  // Taivaanrautamiekka: sama miekka (sama malli, iskut ja kantama), mutta taivaan raudasta takoen
  // 30 % tehokkaampi. Mitattava ero perusmiekkaan on vain vahingossa (ks. combat.test.ts).
  sky_iron_sword: {
    id: "sky_iron_sword", name: t("weapon.skyIronSword"), damage: 1.3, reach: 0, lunge: 0, minRange: 0, slowness: 1,
    styles: { overhead: 1, slash: 1, thrust: 1 }, blockArc: Math.PI / 4,
  },
};

export interface ShieldDef {
  /** Kestopisteet: kevyt isku vie 1, raskas 2 (StrikeDef.shieldDamage). */
  durability: number;
  /** Puolikulma, jonka sisältä tuleva isku osuu kilpeen (radiaaneina; PI / 3 = ±60° edestä). */
  blockArc: number;
  /** Tämän osuuden alapuolella kilvessä näkyy lovi. */
  notchAt: number;
}

/** Kilpi kestää 10 kevyttä tai 5 raskasta iskua. */
export const SHIELDS: Record<"round", ShieldDef> = {
  round: { durability: 10, blockArc: Math.PI / 3, notchAt: 0.5 },
};

/** Aseen määrittely varustuksesta. `skyIron` vaihtaa miekan taivaanrautamiekaksi (keihäs ei muutu). */
export function weaponOf(loadout: Loadout, skyIron = false): WeaponDef {
  if (loadout === "spear") return WEAPONS.spear;
  return skyIron ? WEAPONS.sky_iron_sword : WEAPONS.sword;
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

/** Kilpityöntö: nopea ja lyhyt, lähes vahingoton, mutta murtaa ase- ja kilpitorjunnan. */
export const BASH: AttackDef = {
  kind: "bash", weight: "light", timing: { windup: 0.2, release: 0.1, recovery: 0.4 },
  range: 1.7, minRange: 0, arc: Math.PI / 3, damage: 0.25, lunge: 0.3, shieldDamage: 1,
};

/** Saako tämä tekoälyn päätös valita kilpityönnön. Vain Pohjan soturi osaa liikkeen. */
export function shouldShieldBash(
  isPohja: boolean,
  hasShield: boolean,
  distance: number,
  angleToPlayer: number,
  turtling: boolean,
  quickCounter: boolean,
  roll: number,
): boolean {
  if (!isPohja || !hasShield || quickCounter || distance >= BASH.range - 0.1 || Math.abs(angleToPlayer) >= BASH.arc * 0.9) return false;
  return turtling || roll < ENEMY_AI.bashChance;
}

/** Yhden ruudun osuus jäljellä olevasta kilpityönnön taaksehorjahduksesta. */
export function bashPushStep(remaining: number, dt: number, rooted = false): number {
  return rooted ? 0 : Math.min(Math.max(0, remaining), COMBAT.bashPushSpeed * Math.max(0, dt));
}

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
  light: 6,
  /** Raskaan lyönnin hinta. */
  heavy: 12,
  /** Toteutuneen torjunnan hinta osumahetkellä (myös täydellinen torjunta). */
  blockHit: 4,
  /** Torjunta-asennon ylläpito sekunnissa. Palautuminen (hahmon staminaRegen) jatkuu samalla. */
  blockHold: 1.5,
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
 * - Kilpi torjuu aseiskut (ja kuluu, ks. shieldWear).
 * - Aseella torjunta onnistuu vain, jos torjunta-asento vastaa iskun suuntaa.
 * - Kilpityöntö murtaa aseella tai kilvellä tehdyn torjunnan asennosta riippumatta.
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
  // Kilpityöntö murtaa torjunta-asennon myös kilpeä vastaan; kilpi ei silti hajoa tai kulu.
  if (a.kind === "bash") return "guardbreak";
  if (now - d.blockStart <= COMBAT.parryWindow) return "parried";
  return "blocked";
}

/** Kuinka pitkän suoja-ajan torjunta antaa muita lyöjiä vastaan (0 = ei suoja-aikaa). */
export function graceAfter(res: HitResult): number {
  return res === "parried" ? COMBAT.graceParry : res === "blocked" ? COMBAT.graceBlock : 0;
}

/**
 * Pysäyttääkö suoja-aika iskun, joka muuten osuisi. Suoja koskee vain muita kuin sitä lyöjää,
 * jonka isku torjuttiin, ja vain iskuja, jotka tulevat torjunnan sektorilta katseen edestä
 * (angleToAttacker) ja enintään graceArc asteen päästä torjutun iskun suunnasta (fromGraceDir).
 */
export function graceCovers(now: number, graceUntil: number, sameAttacker: boolean, angleToAttacker: number, blockArc: number, fromGraceDir: number): boolean {
  if (sameAttacker || now > graceUntil) return false;
  return Math.abs(angleToAttacker) <= blockArc && Math.abs(fromGraceDir) <= (COMBAT.graceArc * Math.PI) / 180;
}

/** Kuinka paljon kilpi kuluu tästä iskusta. Täydellinen torjunta ei kuluta kilpeä. */
export function shieldWear(a: AttackDef, res: HitResult, d: Defender): number {
  return res === "blocked" && d.shield ? a.shieldDamage : 0;
}

export function damageFor(base: number, defenderState: ActionState): number {
  return defenderState === "rooted" ? base * COMBAT.rootedDamage : base;
}

/** Iskun vahinko: lyöjän voima × iskun ja aseen kerroin. Kilpityöntö tekee pienen vahingon myös murtaessaan suojan. */
export function strikeDamage(power: number, a: AttackDef, res: HitResult, defenderState: ActionState): number {
  return res === "hit" || (res === "guardbreak" && a.kind === "bash") ? damageFor(power * a.damage, defenderState) : 0;
}

/** Tukiaskeleen eteneminen 0..1, kun iskuvaihetta on kulunut `inRelease` sekuntia. Askel on valmis osumahetkellä. */
export function lungeProgress(inRelease: number, release: number): number {
  const t = Math.max(0, inRelease) / Math.max(1e-6, release * COMBAT.strikePoint);
  const u = Math.min(1, t);
  // Nopea lähtö ja pehmeä pysähdys: jalka ehtii maahan ennen osumaa.
  return 1 - (1 - u) * (1 - u);
}

/** Osuuko isku jo: tukiaskel on otettu, kun iskuvaiheesta on kulunut `strikePoint`-osuus. */
export function strikeLands(inRelease: number, release: number): boolean {
  return inRelease >= release * COMBAT.strikePoint;
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

/** Kääntää suuntaa current kohti suuntaa target enintään maxStep radiaania lyhyempää kautta. */
export function turnToward(current: number, target: number, maxStep: number): number {
  const d = angleBetween(current, target);
  return Math.abs(d) <= maxStep ? current + d : current + Math.sign(d) * maxStep;
}

/** Kahden suunnan välinen etumerkillinen kulma välillä [-PI, PI]. */
export function angleBetween(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Ryhmän hyökkäyskatto: iskun saa aloittaa, jos muita on nostamassa tai lyömässä vähemmän kuin
 * ENEMY_AI.maxAttackers. Vuoroja tai järjestysnumeroita ei ole: ratkaisee vain se, kuka lyö juuri nyt.
 */
export function mayStartAttack(othersStriking: number, maxAttackers: number = ENEMY_AI.maxAttackers): boolean {
  return othersStriking < Math.max(1, Math.round(maxAttackers));
}

/** Iskun aloitusviive päätöksestä (s); rand 0..1. */
export function attackStartDelay(rand: number): number {
  return ENEMY_AI.attackDelayMin + (ENEMY_AI.attackDelayMax - ENEMY_AI.attackDelayMin) * rand;
}

/**
 * Horjuttaako osuma puolustajaa. Jo horjuva ei horjahda uudelleen eikä horjahdus pitene: jatko-osuma
 * tekee vain vahingon. Suohon juuttunut ei horjahda. Horjahduksen jälkeen on hetki (staggerFreeUntil),
 * jolloin osumat eivät horjuta, jotta usea lyöjä ei pidä sankaria horjahdusketjussa.
 * Tavallinen isku keskeyttää vain levon, torjunnan ja noston; kilpityöntö ja murrettu torjunta myös muun.
 */
export function hitStaggers(kind: StrikeStyle | "bash", res: HitResult, defState: ActionState, now: number, staggerFreeUntil: number): boolean {
  if (defState === "stagger" || defState === "rooted" || defState === "dead" || now < staggerFreeUntil) return false;
  if (res === "guardbreak" || kind === "bash") return res === "hit" || res === "guardbreak";
  return res === "hit" && (defState === "idle" || defState === "block" || defState === "windup");
}

/**
 * Torjunta-asennon nousuaika (s) varustuksen mukaan: aika, jossa asento on BLOCK_RAISE_DONE-osuudelta valmis.
 * Asennon animaationopeus johdetaan tästä (blockPoseRate), joten luku ja kuva pysyvät samassa tahdissa.
 * Keihäsmiehen tuleva oma torjunta-animaatio saa olla hitaampi: suurenna keihään arvoa, niin
 * hän ehtii nopeita iskuja vastaan harvemmin (blockReactionDelay palauttaa null).
 * Koskee kaikkia saman varustuksen kantajia, myös keihästä kantavaa sankaria.
 */
export const BLOCK_RAISE: Record<Loadout, number> = { sword: 0.086, sword_shield: 0.086, spear: 0.086 };
export const BLOCK_RAISE_DONE = 0.85;

/** Torjunta-asennon animaationopeus (eksponentiaalinen lähestyminen), joka valmistuu BLOCK_RAISE-ajassa. */
export function blockPoseRate(loadout: Loadout): number {
  return -Math.log(1 - BLOCK_RAISE_DONE) / BLOCK_RAISE[loadout];
}

/** Pelaajan iskun aikaisin mahdollinen osumahetki (s nyt): kevyt isku laukeaa aikaisintaan oman nostonsa jälkeen. */
export function timeToImpact(stateTime: number, t: AttackTiming): number {
  return Math.max(0, t.windup - stateTime) + t.release * COMBAT.strikePoint;
}

/**
 * Vastustajan torjuntareaktion viive (s), tai null, jos asento ei ehtisi nousta ennen osumaa.
 * `roll` on vastustajan oma arpa (0–1), jotta ryhmän kilvet eivät nouse samaan aikaan.
 */
export function blockReactionDelay(impactIn: number, raise: number, roll: number): number | null {
  const latest = Math.min(ENEMY_AI.blockDelayMax, impactIn - raise);
  if (latest < ENEMY_AI.blockDelayMin) return null;
  return ENEMY_AI.blockDelayMin + roll * (latest - ENEMY_AI.blockDelayMin);
}

/** Onko vastustaja pelaajan iskun edessä: iskun kaaressa tai enintään threatMargin-asteen päässä siitä. */
export function threatenedBy(angleFromAttacker: number, arc: number): boolean {
  return Math.abs(angleFromAttacker) <= arc + ENEMY_AI.threatMargin * Math.PI / 180;
}

/** Arvotaanko iskusta etenevä nosto. Kilpityöntö on lähiliike eikä etene. */
export function rollsAdvance(kind: StrikeStyle | "bash", roll: number): boolean {
  return kind !== "bash" && roll < ENEMY_AI.advanceChance;
}

/** Astuuko etenevää nostoa tekevä vastustaja tällä ruudulla: pelaaja on kantaman reunalla ja edessä. */
export function advancesInWindup(advancing: boolean, distance: number, range: number, angleToPlayer: number): boolean {
  return advancing && distance > range - ENEMY_AI.advanceKeep && Math.abs(angleToPlayer) < ENEMY_AI.advanceArc * Math.PI / 180;
}
