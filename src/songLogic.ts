// Laululoitsun puhdas logiikka: hidastus, alkuanimaation kesto, osuma-alueet ja lopputulos.
// Kaikki säädettävät luvut ovat tässä.

/** Maailman nopeus laulun aikana (vastustaja liikkuu, mutta näin hitaasti). */
export const SONG_SLOWMO = 1 / 20;
/** Pelaajan lauluasennon kesto ennen kuin rytmipeli alkaa (sekunteja, reaaliaikaa). */
export const SONG_INTRO = 1.5;
/** Aika rytmipelin alusta ensimmäiseen riimuun. */
export const SONG_LEAD = 1.3;
/** Riimujen väli. */
export const BEAT_GAP = 0.8;
/** Aika viimeisestä riimusta loitsun laukeamiseen. */
export const SONG_OUTRO = 0.45;

/** Ensimmäisen osuma-alueen puolikas: painallus saa osua näin paljon ohi riimun keskikohdan. */
export const ZONE_FIRST = 0.24;
/** Jokainen seuraava alue on tämän verran edellisestä. Kahdeksalla riimulla viimeinen on noin ±0,07 s. */
export const ZONE_SHRINK = 0.84;

/** Loitsu laukeaa, kun osumia on vähintään näin monta. */
export const SONG_MIN_HITS = 4;
/** Suohon laulamisen kesto jokaista osumaa kohti (pelin sekunteja). */
export const ROOT_TIME_PER_HIT = 0.75;

/** Osuma-alueen puolikas sekunteina riimulle i (0 = ensimmäinen). */
export function zoneHalf(i: number): number {
  return ZONE_FIRST * Math.pow(ZONE_SHRINK, i);
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
  const success = hits >= SONG_MIN_HITS;
  return { success, hits, rootTime: success ? hits * ROOT_TIME_PER_HIT : 0 };
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
