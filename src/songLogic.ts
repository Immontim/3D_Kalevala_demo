// Laululoitsun puhdas logiikka: hidastus, alkuanimaation kesto, osuma-alueet ja lopputulos.
// Kaikki säädettävät luvut ovat taulukossa SONG.

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
  speed: 1.25,
  /** Aika rytmipelin alusta ensimmäiseen riimuun nauhan nopeudella 1. */
  lead: 1.3,
  /** Riimujen väli nauhan nopeudella 1. */
  beatGap: 0.8,
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
  /** Parannuslaulu: elämää jokaisesta osumasta, heti osuman hetkellä. */
  healPerHit: 5,
};

/** Riimujen väli sekunteina nykyisellä nauhan nopeudella. */
export function beatGap(): number {
  return SONG.beatGap / SONG.speed;
}
/** Aika rytmipelin alusta ensimmäiseen riimuun nykyisellä nauhan nopeudella. */
export function songLead(): number {
  return SONG.lead / SONG.speed;
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
}

/** Kesto kasvaa osumien määrän mukaan; liian vähillä osumilla loitsu ei laukea lainkaan. */
export function songOutcome(results: boolean[]): SongOutcome {
  const hits = results.filter(Boolean).length;
  const success = hits >= SONG.minHits;
  return { success, hits, rootTime: success ? hits * SONG.rootTimePerHit : 0 };
}

/** Kalevalan 3. runo (1849, vapaa käyttää). Yksi säe per riimu: säkeiden määrä on riimujen määrä. */
export const SONG_VERSES: readonly string[] = [
  "Lauloi vanha Väinämöinen:",
  "järvet läikkyi, maa järisi,",
  "vuoret vaskiset vapisi,",
  "paaet vahvat paukahteli,",
  "kalliot kaheksi lenti,",
  "kivet rannoilla rakoili.",
  "Lauloi nuoren Joukahaisen",
  "suohon suonivyötäisistä.",
];

/** Kalevalan 9. runo (1849, vapaa käyttää): verensulkusanat. */
export const HEAL_VERSES: readonly string[] = [
  "Piäty, veri, vuotamasta,",
  "hurme, huppelehtamasta,",
  "päälleni päräjämästä,",
  "riuskumasta rinnoilleni!",
  "Veri, seiso kuin seinä,",
  "asu, hurme, kuin aita,",
  "kuin miekka meressä seiso,",
  "saraheinä sammalessa!",
];

export type SongId = "bog" | "heal";
export interface SongDef {
  id: SongId;
  name: string;
  /** Laulun oma riimu valintaringissä. */
  rune: string;
  verses: readonly string[];
  /** Tarvitseeko laulu elävän vastustajan. */
  needsEnemy: boolean;
}
export const SONGS: Record<SongId, SongDef> = {
  bog: { id: "bog", name: "Suolaulu", rune: "ᛚ", verses: SONG_VERSES, needsEnemy: true },
  heal: { id: "heal", name: "Parannuslaulu", rune: "ᛒ", verses: HEAL_VERSES, needsEnemy: false },
};

/** Laulupaikat valintaringissä. null = tyhjä paikka. */
export const SONG_SLOTS: readonly (SongId | null)[] = ["bog", "heal", null, null, null];

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
