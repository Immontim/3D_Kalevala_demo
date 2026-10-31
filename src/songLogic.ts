// Laululoitsun rytmipelin puhdas logiikka.

export type BeatJudgement = "perfect" | "good" | "miss";

export const PERFECT_WINDOW = 0.09;
export const GOOD_WINDOW = 0.2;

/** offset = painalluksen aika miinus tahdin aika (sekunteja, reaaliaikaa). */
export function judgeBeat(offset: number): BeatJudgement {
  const a = Math.abs(offset);
  if (a <= PERFECT_WINDOW) return "perfect";
  if (a <= GOOD_WINDOW) return "good";
  return "miss";
}

export interface SongOutcome {
  success: boolean;
  /** Kuinka kauan vihollinen on suossa (pelin sekunteja). */
  rootTime: number;
  score: number;
}

/** perfect = 2 pistettä, good = 1. Neljällä tahdilla maksimi on 8. */
export function songOutcome(results: BeatJudgement[]): SongOutcome {
  const score = results.reduce((s, r) => s + (r === "perfect" ? 2 : r === "good" ? 1 : 0), 0);
  if (score >= 7) return { success: true, rootTime: 6, score };
  if (score >= 4) return { success: true, rootTime: 3.5, score };
  return { success: false, rootTime: 0, score };
}

/** Kalevalan 3. runo (1849, vapaa käyttää). Yksi säe per tahti. */
export const SONG_VERSES = [
  "Lauloi vanha Väinämöinen:",
  "järvet läikkyi, maa järisi,",
  "lauloi nuoren Joukahaisen",
  "suohon suonivyötäisistä.",
];
