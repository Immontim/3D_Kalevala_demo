// Säädettävät arvot: oletukset, muutokset niihin ja muutosten JSON-esitys.
// Puhdasta logiikkaa, ei selain- eikä Three.js-riippuvuuksia.
//
// Kaikki pelin parametritaulukot on koottu juuriksi (ROOTS). Jokainen taulukon luku on
// säädettävissä polulla, esim. "characters.hero.hp" tai "weapons.spear.reach". Taukoikkunan
// säätövälilehti näyttää näistä vain osan (FIELDS); loput voi muuttaa JSON-tekstin kautta.

import { CHARACTERS, COMBAT, ENEMY_AI, SHIELDS, STAMINA, STRIKES, WAVES, WEAPONS } from "./combat";
import { SONG } from "./songLogic";
import { CONTROLS } from "./controls";

type Tree = { [key: string]: Tree | number | unknown };

/** Säädettävien taulukoiden juuret. Avain on polun ensimmäinen osa. */
export const ROOTS: Record<string, Tree> = {
  characters: CHARACTERS as unknown as Tree,
  waves: WAVES,
  stamina: STAMINA,
  combat: COMBAT,
  weapons: WEAPONS as unknown as Tree,
  strikes: STRIKES as unknown as Tree,
  shields: SHIELDS as unknown as Tree,
  enemyAi: ENEMY_AI,
  song: SONG,
  controls: CONTROLS,
};

function isTree(v: unknown): v is Tree {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Kaikki puun luvut polkuineen. Muut arvot (nimet, tunnisteet) ohitetaan. */
function numberLeaves(tree: Tree, prefix = "", out = new Map<string, number>()): Map<string, number> {
  for (const [k, v] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "number") out.set(path, v);
    else if (isTree(v)) numberLeaves(v, path, out);
  }
  return out;
}

/** Oletusarvot: taulukoiden sisältö sellaisena kuin koodi ne määrittelee. */
export const DEFAULTS: ReadonlyMap<string, number> = numberLeaves(ROOTS);

export function getValue(path: string): number | undefined {
  let node: unknown = ROOTS;
  for (const part of path.split(".")) {
    if (!isTree(node)) return undefined;
    node = node[part];
  }
  return typeof node === "number" ? node : undefined;
}

function setValue(path: string, value: number) {
  const parts = path.split(".");
  let node: Tree = ROOTS;
  for (const part of parts.slice(0, -1)) node = node[part] as Tree;
  node[parts[parts.length - 1]] = value;
}

/** Yksi säätövälilehden kenttä. */
export interface Field {
  group: string;
  label: string;
  path: string;
  min: number;
  max: number;
  step: number;
}

const character = (group: string, id: string): Field[] => [
  { group, label: "Elämä", path: `characters.${id}.hp`, min: 1, max: 1000, step: 5 },
  { group, label: "Kestävyys", path: `characters.${id}.stamina`, min: 1, max: 1000, step: 5 },
  { group, label: "Kestävyyden palautuminen / s", path: `characters.${id}.staminaRegen`, min: 0, max: 50, step: 0.5 },
  { group, label: "Lyöjän voima", path: `characters.${id}.power`, min: 0, max: 200, step: 1 },
  { group, label: "Kääntymisnopeus, °/s", path: `characters.${id}.turnSpeed`, min: 10, max: 1440, step: 5 },
];
const reaction = (group: string, id: string): Field =>
  ({ group, label: "Reaktioviive, s", path: `characters.${id}.reaction`, min: 0, max: 3, step: 0.05 });

/** Säätövälilehden kentät ryhmittäin. Rajat koskevat myös JSON-tekstistä luettuja arvoja. */
export const FIELDS: readonly Field[] = [
  ...character("Sankari (pelaaja)", "hero"),
  ...character("Nuori urho (aallon 0 arvot)", "urho"),
  reaction("Nuori urho (aallon 0 arvot)", "urho"),
  ...character("Pohjan soturi (aallon 0 arvot)", "pohja"),
  reaction("Pohjan soturi (aallon 0 arvot)", "pohja"),
  { group: "Ohjaus", label: "Hiiren herkkyys, ° / pikseli", path: "controls.mouseSens", min: 0.01, max: 1, step: 0.01 },
  { group: "Ohjaus", label: "Vastustajan kääntymiskerroin iskun aikana", path: "enemyAi.attackTurnScale", min: 0, max: 1, step: 0.05 },
  { group: "Aallot", label: "Vastustajan elämän lisäys / aalto", path: "waves.hpPerWave", min: 0, max: 200, step: 5 },
  { group: "Aallot", label: "Vastustajan voiman lisäys / aalto", path: "waves.powerPerWave", min: 0, max: 20, step: 0.5 },
  { group: "Aallot", label: "Pelaajan elämän palautus aaltojen välissä", path: "waves.restHp", min: 0, max: 1000, step: 5 },
  { group: "Aallot", label: "Pelaajan kestävyyden palautus aaltojen välissä", path: "waves.restStamina", min: 0, max: 1000, step: 5 },
  { group: "Kestävyyden hinnat", label: "Kevyt lyönti", path: "stamina.light", min: 0, max: 100, step: 1 },
  { group: "Kestävyyden hinnat", label: "Raskas lyönti", path: "stamina.heavy", min: 0, max: 100, step: 1 },
  { group: "Kestävyyden hinnat", label: "Toteutunut torjunta", path: "stamina.blockHit", min: 0, max: 100, step: 1 },
  { group: "Kestävyyden hinnat", label: "Torjunta-asento / s", path: "stamina.blockHold", min: 0, max: 50, step: 0.5 },
  { group: "Kestävyyden hinnat", label: "Uupuneen lyönnin vahinkokerroin", path: "stamina.weakDamage", min: 0, max: 1, step: 0.05 },
  { group: "Aseet ja lyönnit", label: "Miekan vahinkokerroin", path: "weapons.sword.damage", min: 0, max: 10, step: 0.05 },
  { group: "Aseet ja lyönnit", label: "Keihään vahinkokerroin", path: "weapons.spear.damage", min: 0, max: 10, step: 0.05 },
  { group: "Aseet ja lyönnit", label: "Noston kerroin (kaikki lyönnit)", path: "combat.windupScale", min: 0.2, max: 5, step: 0.05 },
  { group: "Aseet ja lyönnit", label: "Palautumisen kerroin (kaikki lyönnit)", path: "combat.recoveryScale", min: 0.2, max: 5, step: 0.05 },
  { group: "Aseet ja lyönnit", label: "Täydellisen torjunnan ikkuna, s", path: "combat.parryWindow", min: 0, max: 1, step: 0.01 },
  { group: "Laulu", label: "Laulunauhan nopeus", path: "song.speed", min: 0.25, max: 4, step: 0.05 },
  { group: "Laulu", label: "Vaaditut osumat", path: "song.minHits", min: 1, max: 8, step: 1 },
  { group: "Laulu", label: "Suon kesto / osuma, s", path: "song.rootTimePerHit", min: 0, max: 10, step: 0.05 },
  { group: "Laulu", label: "Parannus / osuma, elämää", path: "song.healPerHit", min: 0, max: 100, step: 1 },
  { group: "Laulu", label: "Laulun voima osumasta", path: "combat.songGainHit", min: 0, max: 100, step: 1 },
  { group: "Laulu", label: "Laulun voima täydellisestä torjunnasta", path: "combat.songGainParry", min: 0, max: 100, step: 1 },
];

const FIELD_BY_PATH = new Map(FIELDS.map((f) => [f.path, f]));

/** Luku, jota ei saa asettaa nollaksi tai negatiiviseksi, koska sillä jaetaan tai se on kesto. */
const POSITIVE = /(Scale|speed|Speed|slowness|stamina|hp|Time|release|windup|recovery|beatGap|zoneFirst|zoneShrink|slowmo|durability|songMax)$/;

/** Rajaa arvon sallittuun väliin: kentän rajoihin, tai yleiseen turvaväliin, jos kenttää ei ole. */
export function clampValue(path: string, value: number): number {
  const f = FIELD_BY_PATH.get(path);
  if (f) return Math.max(f.min, Math.min(f.max, value));
  const min = POSITIVE.test(path) ? 0.01 : -1000;
  return Math.max(min, Math.min(10000, value));
}

/** Palauttaa kaikki arvot oletuksiin. */
export function resetTuning() {
  for (const [path, v] of DEFAULTS) setValue(path, v);
}

function sameValue(a: number, b: number) {
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

/** Oletuksista poikkeavat arvot polku → arvo. */
export function changedValues(): Map<string, number> {
  const out = new Map<string, number>();
  for (const [path, def] of DEFAULTS) {
    const v = getValue(path);
    if (v !== undefined && !sameValue(v, def)) out.set(path, v);
  }
  return out;
}

export interface Parsed {
  /** Oletuksista poikkeavat, sallittuun väliin rajatut arvot polku → arvo. */
  values: Map<string, number>;
  /** Polut, joita ei tunnistettu tai joiden arvo ei ollut luku. */
  rejected: string[];
  /** Polut, joiden arvo rajattiin sallittuun väliin. */
  clamped: string[];
}

/**
 * Lukee joukon muutoksia muuttamatta mitään. Syöte on joko sisäkkäinen puu
 * ({ characters: { hero: { hp: 120 } } }), polkulista ({ "characters.hero.hp": 120 }) tai
 * vientimuoto, jossa puu on kentässä "muutokset".
 */
export function parseChanges(input: unknown): Parsed {
  const res: Parsed = { values: new Map(), rejected: [], clamped: [] };
  const src = isTree(input) && isTree(input.muutokset) ? input.muutokset : input;
  if (!isTree(src)) {
    if (input !== null && input !== undefined) res.rejected.push("(koko teksti)");
    return res;
  }
  const walk = (node: Tree, prefix: string) => {
    for (const [k, v] of Object.entries(node)) {
      const path = prefix ? `${prefix}.${k}` : k;
      const def = DEFAULTS.get(path);
      if (isTree(v)) walk(v, path);
      else if (typeof v === "number" && Number.isFinite(v) && def !== undefined) {
        const c = clampValue(path, v);
        if (c !== v) res.clamped.push(path);
        if (!sameValue(c, def)) res.values.set(path, c);
      } else res.rejected.push(path);
    }
  };
  walk(src, "");
  return res;
}

/** Ottaa käyttöön joukon muutoksia: kaikki arvot palautetaan ensin oletuksiin, sitten asetetaan annetut. */
export function applyChanges(values: ReadonlyMap<string, number>) {
  resetTuning();
  for (const [path, v] of values) if (DEFAULTS.has(path)) setValue(path, clampValue(path, v));
}

export function applyTuning(input: unknown): Parsed {
  const parsed = parseChanges(input);
  applyChanges(parsed.values);
  return parsed;
}

/** Muutokset sisäkkäisenä puuna, samassa muodossa kuin taulukot ovat koodissa. */
export function changesAsTree(values: ReadonlyMap<string, number> = changedValues()): Tree {
  const out: Tree = {};
  for (const [path, v] of values) {
    const parts = path.split(".");
    let node = out;
    for (const part of parts.slice(0, -1)) node = (node[part] ??= {}) as Tree;
    node[parts[parts.length - 1]] = +v.toFixed(6);
  }
  return out;
}

/**
 * Muutokset JSON-tekstinä kopioitavaksi. Teksti kertoo pelin version ja vain oletuksista
 * poikkeavat arvot, joten sen voi liittää sellaisenaan takaisin tai antaa uusiksi oletuksiksi.
 */
export function exportTuning(version: string, values: ReadonlyMap<string, number> = changedValues()): string {
  return JSON.stringify({ peli: "Laulun miekka", versio: version, muutokset: changesAsTree(values) }, null, 2);
}

/** Lukee JSON-tekstin muuttamatta mitään. */
export function parseTuningText(text: string): Parsed | { error: string } {
  if (!text.trim()) return { values: new Map(), rejected: [], clamped: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "virheellinen JSON" };
  }
  if (!isTree(parsed)) return { error: "tekstin pitää olla JSON-olio" };
  return parseChanges(parsed);
}
