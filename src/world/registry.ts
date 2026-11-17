// Maailmamoottorin tunnetut liput, laskurit ja esine-instanssien nimet.
// Lehtimoduuli: ei tuonteja, jotta kampanjatallennus voi käyttää rekisteriä ilman kehää.
//
// Tallennuksen moottoriosio luetaan sallivasti: lippu tai laskuri, jota tässä ei ole,
// pudotetaan lukuvaiheessa (ei koko tallennusta). Siksi jokainen uusi lippu lisätään tänne.

export interface FlagDef {
  /** Suomenkielinen nimi säännöistä generoitua yhteenvetoa varten (omistaja lukee tämän). */
  label: string;
}

export interface CounterDef {
  label: string;
  /** Yläraja; laskuri ei ylitä sitä. */
  max: number;
}

export const FLAGS: Record<string, FlagDef> = {
  "sage.permission": { label: "tietäjä on antanut luvan ottaa tuohikontin" },
  "sage.robbed": { label: "tietäjä tietää, että tuohikontti vietiin luvatta" },
  "sage.forgiven": { label: "tietäjä on antanut varkauden anteeksi" },
  "song.sleep.learned": { label: "pelaaja on oppinut laulun Pohjolan uni" },
  // Varattu tarinakäänteelle "emäntä kertoo huhun" (ROADMAP V2). Sillä ei ole vielä
  // pelisääntöä: moottorin testit käyttävät sitä esimerkkikäänteessä.
  "rumor.heard": { label: "emäntä on kertonut huhun vainolaisista" },
};

export const COUNTERS: Record<string, CounterDef> = {
  "thefts.noticed": { label: "huomatut varkaudet", max: 999 },
};

/** Maailmanesineiden instanssitunnisteet ihmisen luettavina nimina (yhteenvetoa varten). */
export const SCENE_ITEM_LABELS: Record<string, string> = {
  "lakeside.sage-pack": "tietäjän tuohikontti rannalla",
};

/** Kuun vaiheet 0–7 samassa järjestyksessä kuin kartan kalenteri (0 = uusikuu, 4 = täysikuu). */
export const MOON_PHASE_NAMES = [
  "uusikuu",
  "kasvava sirppi",
  "ensimmäinen neljännes",
  "kasvava kupera kuu",
  "täysikuu",
  "vähenevä kupera kuu",
  "viimeinen neljännes",
  "vähenevä sirppi",
] as const;

export function isKnownFlag(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(FLAGS, id);
}

export function isKnownCounter(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(COUNTERS, id);
}
