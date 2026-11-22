// Laululoitsun puhdas logiikka: hidastus, alkuanimaation kesto, osuma-alueet ja lopputulos.
// Kaikki säädettävät luvut ovat taulukossa SONG.
import { VerbatimText, t, verbatim } from "./i18n";

export const SONG = {
  /** Maailman nopeus laulun aikana (vastustaja liikkuu, mutta näin hitaasti). */
  slowmo: 1 / 15,
  /**
   * Aika laulun valinnasta rytmipelin alkuun (sekunteja, reaaliaikaa). Lauluasento otetaan jo
   * valinnan aikana, joten tämä on vain lyhyt hengähdys.
   */
  intro: 0.6,
  /**
   * Laulunauhan nopeus: 1 = alkuperäinen. Nauha näyttää samalta, mutta merkki kulkee sen yli näin
   * paljon nopeammin, joten riimujen väli ja osuma-alueiden kesto lyhenevät samassa suhteessa.
   */
  speed: 1.5,
  /** Aika rytmipelin alusta ensimmäiseen riimuun nauhan nopeudella 1. */
  lead: 1.3,
  /** Riimujen väli nauhan nopeudella 1. */
  beatGap: 0.8,
  /**
   * Tauko riimuryhmien välissä riimuvälin osuutena (0 = tasainen rytmi). Jokainen tauko arvotaan
   * välillä 30–100 % tästä, joten laulu ei toistu samanlaisena ja täydellinen tasarytmi ei riitä.
   */
  pairPause: 0.5,
  /** Montako riimua tulee peräkkäin ennen taukoa (2 = säepari, kuten Kalevalan kerrossa). */
  pairSize: 2,
  /** Aika viimeisestä riimusta loitsun laukeamiseen. */
  outro: 0.45,
  /** Ensimmäisen osuma-alueen puolikas nauhan nopeudella 1. */
  zoneFirst: 0.24,
  /** Jokainen seuraava alue on tämän verran edellisestä. */
  zoneShrink: 0.84,
  /** Loitsu laukeaa, kun osumia on vähintään näin monta. */
  minHits: 4,
  /** Suohon laulamisen kesto jokaista osumaa kohti (pelin sekunteja). */
  rootTimePerHit: 0.75,
  /** Suo vahingoittaa koko juuttumisen ajan, kun osumia on vähintään näin monta (3 = "yli kaksi"). */
  bogDotMinHits: 3,
  /** Suon vahinko sekunnissa (ohittaa haarniskan; voi kaataa). */
  bogDotPerSec: 10,
  /** Suon vahinko tulee tikkeinä näin usein (pelin sekunteja); mittari sykähtää joka tikillä. */
  bogDotInterval: 1,
  /** Parannuslaulu: elämää jokaisesta osumasta, heti osuman hetkellä. */
  healPerHit: 5,
  /** Säekaarten hiipumisaika laulun päätyttyä, laulukohtaisesti (sekunteja, reaaliaikaa). */
  fade: { bog: 1.2, heal: 1.2, sleep: 1.6 },
};

/** Pienin osuus pairPause-maksimista, jonka arvottu tauko saa: tauon pitää aina erottua. */
export const PAUSE_MIN_SHARE = 0.3;

/** Riimujen väli sekunteina nykyisellä nauhan nopeudella. */
export function beatGap(): number {
  return SONG.beatGap / SONG.speed;
}
/** Aika rytmipelin alusta ensimmäiseen riimuun nykyisellä nauhan nopeudella. */
export function songLead(): number {
  return SONG.lead / SONG.speed;
}

/**
 * Riimujen ajat (reaaliaikaa): ensimmäinen riimu `songLead()` alun jälkeen, sitten riimuväli, ja
 * jokaisen `pairSize`-ryhmän jälkeen lisäksi arvottu tauko. rng palauttaa luvun väliltä [0, 1).
 */
export function songBeats(count: number, playAt: number, rng: () => number = Math.random): number[] {
  const gap = beatGap();
  const size = Math.max(1, Math.round(SONG.pairSize));
  const out: number[] = [];
  let at = playAt + songLead();
  for (let i = 0; i < count; i++) {
    if (i > 0) {
      at += gap;
      if (i % size === 0 && SONG.pairPause > 0) at += gap * SONG.pairPause * (PAUSE_MIN_SHARE + (1 - PAUSE_MIN_SHARE) * rng());
    }
    out.push(at);
  }
  return out;
}

/** Osuma-alueen puolikas sekunteina riimulle i (0 = ensimmäinen). */
export function zoneHalf(i: number): number {
  return (SONG.zoneFirst * Math.pow(SONG.zoneShrink, i)) / SONG.speed;
}

/** offset = painalluksen aika miinus riimun aika (sekunteja, reaaliaikaa). */
export function inZone(offset: number, i: number): boolean {
  return Math.abs(offset) <= zoneHalf(i);
}

export interface SongOutcome {
  success: boolean;
  hits: number;
  /** Kuinka kauan vihollinen on suossa (pelin sekunteja). */
  rootTime: number;
  /** Suon vahinko sekunnissa juuttumisen ajan (0 = ei vahinkoa). */
  dotPerSec: number;
}

/** Kesto kasvaa osumien määrän mukaan; liian vähillä osumilla loitsu ei laukea lainkaan. */
export function songOutcome(results: boolean[]): SongOutcome {
  const hits = results.filter(Boolean).length;
  const success = hits >= SONG.minHits;
  const dot = success && hits >= SONG.bogDotMinHits ? SONG.bogDotPerSec : 0;
  return { success, hits, rootTime: success ? hits * SONG.rootTimePerHit : 0, dotPerSec: dot };
}

/** Suon vahinko yhdellä vastustajalla: jäljellä oleva aika ja aika edellisestä tikistä (pelin sekunteja). */
export interface BogDot {
  perSec: number;
  left: number;
  acc: number;
}

/**
 * Etenee suon vahinkoa ajan dt verran. Vahinko tulee tikkeinä (`interval` välein, perSec × interval);
 * kun aika loppuu, viimeisen vajaan jakson osuus tulee vielä yhtenä pienempänä tikkinä, joten koko
 * vahinko on aina perSec × kesto. Palauttaa tikkien määrän ja yhteisvahingon; muuttaa dot-oliota.
 */
export function stepBogDot(dot: BogDot, dt: number, interval = SONG.bogDotInterval): { ticks: number; damage: number } {
  const step = Math.min(Math.max(0, dt), dot.left);
  const every = Math.max(0.05, interval);
  dot.left -= step;
  dot.acc += step;
  let ticks = 0, damage = 0;
  while (dot.acc >= every - 1e-9) { dot.acc -= every; ticks++; damage += dot.perSec * every; }
  if (dot.left <= 1e-9 && dot.acc > 1e-6) { ticks++; damage += dot.perSec * dot.acc; dot.acc = 0; }
  return { ticks, damage };
}

/** Kalevalan 3. runo (1849, vapaa käyttää). Yksi säe per riimu: säkeiden määrä on riimujen määrä. */
export const SONG_VERSES: readonly VerbatimText[] = [
  verbatim("Lauloi vanha Väinämöinen:", "fi", "Kalevala, runo 3"),
  verbatim("järvet läikkyi, maa järisi,", "fi", "Kalevala, runo 3"),
  verbatim("vuoret vaskiset vapisi,", "fi", "Kalevala, runo 3"),
  verbatim("paaet vahvat paukahteli,", "fi", "Kalevala, runo 3"),
  verbatim("kalliot kaheksi lenti,", "fi", "Kalevala, runo 3"),
  verbatim("kivet rannoilla rakoili.", "fi", "Kalevala, runo 3"),
  verbatim("Lauloi nuoren Joukahaisen", "fi", "Kalevala, runo 3"),
  verbatim("suohon suonivyötäisistä.", "fi", "Kalevala, runo 3"),
];

/** Kalevalan 9. runo (1849, vapaa käyttää): verensulkusanat. */
export const HEAL_VERSES: readonly VerbatimText[] = [
  verbatim("Piäty, veri, vuotamasta,", "fi", "Kalevala, runo 9"),
  verbatim("hurme, huppelehtamasta,", "fi", "Kalevala, runo 9"),
  verbatim("päälleni päräjämästä,", "fi", "Kalevala, runo 9"),
  verbatim("riuskumasta rinnoilleni!", "fi", "Kalevala, runo 9"),
  verbatim("Veri, seiso kuin seinä,", "fi", "Kalevala, runo 9"),
  verbatim("asu, hurme, kuin aita,", "fi", "Kalevala, runo 9"),
  verbatim("kuin miekka meressä seiso,", "fi", "Kalevala, runo 9"),
  verbatim("saraheinä sammalessa!", "fi", "Kalevala, runo 9"),
];

/** Kalevalan 42. runo (1849, vapaa käyttää): Väinämöinen soittaa ja Pohjolan väki nukahtaa. Poimittu kahdesta peräkkäisestä kohdasta. */
export const SLEEP_VERSES: readonly VerbatimText[] = [
  verbatim("Väkeä väsyttelevi,", "fi", "Kalevala, runo 42"),
  verbatim("rahvahaista raukaisevi:", "fi", "Kalevala, runo 42"),
  verbatim("kaikki nukkui kuuntelijat", "fi", "Kalevala, runo 42"),
  verbatim("sekä vaipui katselijat;", "fi", "Kalevala, runo 42"),
  verbatim("pani pitkähän unehen,", "fi", "Kalevala, runo 42"),
  verbatim("viikommaksi nukkumahan", "fi", "Kalevala, runo 42"),
  verbatim("koko Pohjolan perehen", "fi", "Kalevala, runo 42"),
  verbatim("ja kaiken kyläisen kansan.", "fi", "Kalevala, runo 42"),
];

export type SongId = "bog" | "heal" | "sleep";
export interface SongDef {
  id: SongId;
  name: string;
  /** Laulun oma riimu valintaringissä. */
  rune: string;
  verses: readonly VerbatimText[];
  /** Tarvitseeko laulu elävän vastustajan. */
  needsEnemy: boolean;
  /** Voiko laulun laulaa rauhassa (ilman taistelun voimaa), esim. tietäjän opettama laulu. */
  peaceful?: boolean;
  /** Rauhassa laulu on käytettävissä vain, kun jokin näistä hahmoista on kuuluvilla (esim. loukkaantunut jousineito). */
  peaceTargets?: readonly string[];
}
export const SONGS: Record<SongId, SongDef> = {
  bog: { id: "bog", name: t("song.bog.name"), rune: "ᛚ", verses: SONG_VERSES, needsEnemy: true },
  heal: { id: "heal", name: t("song.heal.name"), rune: "ᛒ", verses: HEAL_VERSES, needsEnemy: false, peaceTargets: ["jousineito"] },
  // Tietäjä opettaa; vaikutus (Louhen karkotus) tulee V5:ssä, joten laulu ei vaadi vastustajaa.
  // Kuulijaksi valitaan Louhi, jos hän on kuuluvilla: kalmiston kuppikivi on myös puhuteltava, eikä se saa viedä karkotusta.
  sleep: { id: "sleep", name: t("song.sleep.name"), rune: "ᛋ", verses: SLEEP_VERSES, needsEnemy: false, peaceful: true, peaceTargets: ["louhi"] },
};

/** Laulu, joka avautuu laulupaikkaan vasta, kun moottorin lippu on asetettu (opeteltu). */
export const SONG_UNLOCK_FLAG: Partial<Record<SongId, string>> = { sleep: "song.sleep.learned" };

/** Laulupaikat valintaringissä. null = tyhjä paikka. */
export const SONG_SLOTS: readonly (SongId | null)[] = ["bog", "heal", null, null, null];

/** Laulupaikat kampanjan lippujen mukaan: opeteltu laulu ilmestyy ensimmäiseen vapaaseen paikkaan. */
export function songSlots(flags: Readonly<Record<string, boolean>>): (SongId | null)[] {
  const slots: (SongId | null)[] = [...SONG_SLOTS];
  for (const id of Object.keys(SONG_UNLOCK_FLAG) as SongId[]) {
    const flag = SONG_UNLOCK_FLAG[id];
    if (!flag || flags[flag] !== true || slots.includes(id)) continue;
    const free = slots.indexOf(null);
    if (free >= 0) slots[free] = id;
  }
  return slots;
}

/** Parannuslaulun yhden osuman vaikutus: palauttaa uuden elämän, enintään maksimin. */
export function healOnHit(hp: number, maxHp: number): number {
  return Math.min(maxHp, hp + SONG.healPerHit);
}

/**
 * Laulupaikkojen keskipisteet ruudulla: kaari hahmon yläpuolella vasemmalta oikealle.
 * cx, cy = hahmon keskikohta ruudulla, r = kaaren säde (px). Palauttaa [x, y] jokaiselle paikalle.
 */
export function slotPositions(cx: number, cy: number, r: number, count = SONG_SLOTS.length): [number, number][] {
  const from = (200 * Math.PI) / 180, to = (-20 * Math.PI) / 180;
  return Array.from({ length: count }, (_, i) => {
    const a = from + ((to - from) * i) / Math.max(1, count - 1);
    return [cx + Math.cos(a) * r, cy - Math.sin(a) * r];
  });
}

// ---------- Säekaaret ----------
// Laulun säkeet piirtyvät sankarin ylle sisäkkäisiksi kaariksi: säepari = yksi kaari, parin
// ensimmäinen säe vasemmalla ja toinen oikealla puoliskolla. Sisin kaari on ensimmäinen pari.

/**
 * Kaaret ovat ellipsejä (leveys = korkeus × ARC_ASPECT), jotta teksti ei nouse päistään pystyyn.
 * Puoliskojen kulmat asteina ellipsin parametrina (0 = oikealle, 90 = ylös); teksti kulkee vasemmalta oikealle.
 */
export const ARC_ASPECT = 1.6;
export const ARC_HALVES: readonly [number, number][] = [[155, 93], [87, 25]];

/** Säkeen paikka kaarissa: rengas (0 = sisin) ja puolisko (0 = vasen, 1 = oikea). */
export function versePlace(i: number): { ring: number; side: 0 | 1 } {
  return { ring: Math.floor(i / 2), side: (i % 2) as 0 | 1 };
}

/** Ellipsin piste kulmassa deg (keskipiste cx, cy; säteet rx, ry). */
export function arcPoint(cx: number, cy: number, rx: number, ry: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [cx + Math.cos(a) * rx, cy - Math.sin(a) * ry];
}

/** Puoliskon kaaren pituus (numeerisesti). */
export function halfLength(rx: number, ry: number, side: 0 | 1): number {
  const [d0, d1] = ARC_HALVES[side];
  const n = 48;
  let len = 0;
  let prev = arcPoint(0, 0, rx, ry, d0);
  for (let k = 1; k <= n; k++) {
    const p = arcPoint(0, 0, rx, ry, d0 + ((d1 - d0) * k) / n);
    len += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    prev = p;
  }
  return len;
}

export interface ArcLayout {
  /** Sisimmän kaaren pystysäde. */
  inner: number;
  /** Renkaiden väli. */
  gap: number;
  rings: number;
}

/**
 * Kaarten mitat: sisin kaari niin, että pisin säe mahtuu puoliskolle väljästi (90 %), ja renkaiden
 * väli fontin koosta. longestPx = pisimmän säkeen leveys pikseleinä.
 */
export function arcLayout(longestPx: number, fontPx: number, rings: number): ArcLayout {
  const perUnit = Math.min(halfLength(ARC_ASPECT, 1, 0), halfLength(ARC_ASPECT, 1, 1));
  return { inner: Math.max(fontPx * 5, longestPx / 0.9 / perUnit), gap: fontPx * 1.45, rings };
}

/** Renkaan säteet [rx, ry]. Renkaat ovat tasavälein sekä leveys- että korkeussuunnassa. */
export function ringRadii(l: ArcLayout, ring: number): [number, number] {
  return [l.inner * ARC_ASPECT + ring * l.gap, l.inner + ring * l.gap];
}

/** Kaarten tarvitsema tila keskipisteen ympärillä: puolileveys ja korkeus ylöspäin (ilman fonttia). */
export function arcExtent(l: ArcLayout): { halfWidth: number; up: number } {
  const [rx, ry] = ringRadii(l, Math.max(0, l.rings - 1));
  const edge = Math.max(Math.abs(Math.cos((ARC_HALVES[0][0] * Math.PI) / 180)), Math.abs(Math.cos((ARC_HALVES[1][1] * Math.PI) / 180)));
  return { halfWidth: rx * edge, up: ry };
}

/** SVG-polku renkaan puoliskolle keskipisteen (cx, cy) ympäri. Suunta vasemmalta oikealle. */
export function arcPath(cx: number, cy: number, rx: number, ry: number, side: 0 | 1): string {
  const [d0, d1] = ARC_HALVES[side];
  const f = (p: [number, number]) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  return `M${f(arcPoint(cx, cy, rx, ry, d0))} A${rx.toFixed(1)},${ry.toFixed(1)} 0 0 1 ${f(arcPoint(cx, cy, rx, ry, d1))}`;
}

/** Puoliskon keskikohta (säkeen lentämisen maali). */
export function arcMid(cx: number, cy: number, rx: number, ry: number, side: 0 | 1): [number, number] {
  return arcPoint(cx, cy, rx, ry, (ARC_HALVES[side][0] + ARC_HALVES[side][1]) / 2);
}

/** Kaarten läpinäkyvyys hiipumisen aikana: 1 → 0 ajassa fade (s). fade ≤ 0 = katoaa heti. */
export function fadeOpacity(elapsed: number, fade: number): number {
  if (fade <= 0) return elapsed >= 0 ? 0 : 1;
  return Math.max(0, Math.min(1, 1 - elapsed / fade));
}
