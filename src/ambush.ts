// Väijytys polulla: satunnainen Pohjan soturien kohtaaminen karttaliikkeellä (omistaja 2026-11-26).
// Puhdas moduuli: ei Three.js:ää eikä DOM:ia. Kartta arpoo väijytyksen ja välittää siemenen ja kulkusuunnan
// 3D-kohtaukselle tunnisteessa (`?site=ambush-<siemen>-<suunta>`), joten tallennusmuotoa ei tarvita ja
// 3D-sivun uudelleenlataus tuo samat soturit. Väijytys on kertakäyttöinen: siihen ei voi palata.
import type { FighterLook, PohjaBuild, AxeModel } from "./fighter";
import type { TextKey } from "./i18n";
import type { MapDir } from "./sceneLayout";

/** Todennäköisyys, että karttasiirto 3D-paikattomaan ruutuun päättyy väijytykseen (kokeiluarvo). */
export const AMBUSH_CHANCE = 0.05;
/** Joukon koko 1, 2, 3: 45 / 35 / 20 %. */
export const AMBUSH_SIZE_WEIGHTS: readonly number[] = [0.45, 0.35, 0.2];
/** Kilven todennäköisyys miekka- tai kirvesmiehellä, kunnes ryhmän ainoa kilpi on jaettu. */
export const AMBUSH_SHIELD_CHANCE = 0.4;

const PREFIX = "ambush-";
const SITE_RE = /^ambush-(\d{1,10})-([nesw])$/;

/** Arvotaanko väijytys tästä siirrosta: vain onnistunut siirto ruutuun, jossa ei ole 3D-paikkaa, eikä
 *  paluun automaattinen askel (kohtauksen polunsuusta kartalle). */
export function ambushCanHappen(targetSiteId: string | undefined, returnStep: boolean): boolean {
  return !returnStep && targetSiteId === undefined;
}

export function rollsAmbush(roll: number, chance = AMBUSH_CHANCE): boolean {
  return roll < chance;
}

export function ambushSiteId(seed: number, travel: MapDir): string {
  return `${PREFIX}${seed >>> 0}-${travel}`;
}

export function isAmbushSite(site: string | null | undefined): boolean {
  return !!site && site.startsWith(PREFIX);
}

/** Tunnisteesta siemen ja kulkusuunta; tuntematon muoto antaa null (kohtaus käyttää silloin satunnaista). */
export function parseAmbushSite(site: string | null | undefined): { seed: number; travel: MapDir } | null {
  const m = site ? SITE_RE.exec(site) : null;
  if (!m) return null;
  const seed = Number(m[1]);
  if (!Number.isFinite(seed) || seed > 4294967295) return null;
  return { seed, travel: m[2] as MapDir };
}

export function oppositeDir(dir: MapDir): MapDir {
  return dir === "n" ? "s" : dir === "s" ? "n" : dir === "e" ? "w" : "e";
}

/** Polunsuut: "back" vie takaisin lähtöruutuun, "forward" jättää sankarin kohderuutuun (ei askelta). */
export const AMBUSH_EXIT_BACK = "back";
export const AMBUSH_EXIT_FORWARD = "forward";
export function ambushExitDir(exitId: string, travel: MapDir): MapDir | null {
  return exitId === AMBUSH_EXIT_BACK ? oppositeDir(travel) : null;
}

/** Siemenellinen satunnaisluku 0..1 (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function ambushSize(roll: number): number {
  let acc = 0;
  for (let i = 0; i < AMBUSH_SIZE_WEIGHTS.length; i++) {
    acc += AMBUSH_SIZE_WEIGHTS[i];
    if (roll < acc) return i + 1;
  }
  return AMBUSH_SIZE_WEIGHTS.length;
}

type Weapon = "sword" | AxeModel | "spear";

/**
 * Väijyjät siemenestä: 1–3 Pohjan soturia koko valikoimasta (vanha char_pohja, tanakka, hoikka) ja aseista
 * (miekka, parrakas kirves, karjalainen kirves, keihäs). Ryhmässä on enintään yksi kilpi ja enintään yksi
 * keihäs, eikä keihäsmiehellä ole kilpeä. Vanhan soturin asu on kiinteä (rengaspaita, säärisuojat, kypärä).
 */
export function ambushRoster(seed: number): FighterLook[] {
  const rnd = seededRandom(seed);
  const size = ambushSize(rnd());
  const out: FighterLook[] = [];
  let spearTaken = false, shieldTaken = false;
  for (let i = 0; i < size; i++) {
    const b = rnd();
    const build: PohjaBuild | undefined = b < 1 / 3 ? undefined : b < 2 / 3 ? "tanakka" : "hoikka";
    const weapons: Weapon[] = spearTaken ? ["sword", "parta", "karjala"] : ["sword", "parta", "karjala", "spear"];
    const weapon = weapons[Math.min(weapons.length - 1, Math.floor(rnd() * weapons.length))];
    const spear = weapon === "spear";
    if (spear) spearTaken = true;
    const shieldRoll = rnd();
    const shield = !spear && !shieldTaken && shieldRoll < AMBUSH_SHIELD_CHANCE;
    if (shield) shieldTaken = true;
    const tunicRoll = rnd(), helmetRoll = rnd(), mailRoll = rnd();
    const look: FighterLook = {
      character: "pohja",
      loadout: spear ? "spear" : shield ? "sword_shield" : "sword",
    };
    if (weapon === "parta" || weapon === "karjala") look.axe = weapon;
    if (build) {
      look.build = build;
      look.tunic = tunicRoll < 0.5 ? "vaalea" : "tumma";
      look.helmet = helmetRoll < 0.7;
      look.ringMail = mailRoll < 0.5;
    } else {
      look.helmet = true;
      look.ringMail = true;
      look.greaves = true;
    }
    out.push(look);
  }
  return out;
}

/** Soturin nimi aseen ja kilven mukaan. */
export function warriorNameKey(look: FighterLook): TextKey {
  const shield = look.loadout === "sword_shield";
  if (look.loadout === "spear") return "enemy.pohjaSpear";
  if (look.axe) return shield ? "enemy.pohjaAxeShield" : "enemy.pohjaAxe";
  return shield ? "enemy.pohjaShield" : "enemy.pohja";
}

/**
 * Väijyjien tulopaikat kohtauksen koordinaateissa (sankari saapuu +z-päästä ja katsoo −z:aan). Ensimmäinen
 * seisoo polulla edessä, muut tulevat metsän reunasta sivuilta tai polulta kauempaa.
 */
export function ambushSpawns(count: number, seed: number): { x: number; z: number }[] {
  const rnd = seededRandom(seed ^ 0x9e3779b9);
  const spots = [{ x: 0.4, z: -8 }];
  const others = [{ x: -8.0, z: -3.0 }, { x: 8.0, z: -5.0 }, { x: -0.4, z: -12.0 }];
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  return [...spots, ...others].slice(0, Math.max(0, count));
}
