// Laululoitsun puhdas logiikka: hidastus, alkuanimaation kesto, osuma-alueet ja lopputulos.
// Kaikki säädettävät luvut ovat taulukossa SONG.

export const SONG = {
  /** Maailman nopeus laulun aikana (vastustaja liikkuu, mutta näin hitaasti). */
  slowmo: 1 / 20,
  /** Pelaajan lauluasennon kesto ennen kuin rytmipeli alkaa (sekunteja, reaaliaikaa). */
  intro: 1.5,
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
export const SONG_VERSES = [
  "Lauloi vanha Väinämöinen:",
  "järvet läikkyi, maa järisi,",
  "vuoret vaskiset vapisi,",
  "paaet vahvat paukahteli,",
  "kalliot kaheksi lenti,",
  "kivet rannoilla rakoili.",
  "Lauloi nuoren Joukahaisen",
  "suohon suonivyötäisistä.",
];
