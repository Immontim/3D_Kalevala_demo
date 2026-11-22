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
  "campaign.won": { label: "kampanja on voitettu (leirin viimeinen aalto kaatui)" },
  "campaign.endSeen": { label: "pelaaja on nähnyt loppuruudun" },
  "archer.healed": { label: "jousineito on parannettu laululla ja nousee seisomaan" },
  "archer.gaveSword": { label: "jousineito on antanut taivaanrautamiekan" },
  "archer.dead": { label: "jousineito kuoli, koska häntä ei parannettu ajoissa" },
  "louhi.banished": { label: "Louhi on karkotettu kalmistolta ja vainolaisten leiri on paljastunut" },
  "rumor.heard": { label: "jousineidon talon emäntä on kertonut huhun vainolaisista" },
  "emanta.robbed": { label: "jousineidon talon emäntä tietää, että hänen pöydältään vietiin ruokaa kysymättä" },
  "emanta_b.robbed": { label: "toisen talon emäntä tietää, että hänen pöydältään vietiin ruokaa kysymättä" },
  "emanta.foodShared": { label: "jousineidon talon emäntä antoi jänislihasta luvan ottaa pöydän rieskat ja kalat" },
  "emanta_b.foodShared": { label: "toisen talon emäntä antoi jänislihasta luvan ottaa pöydän rieskat ja kalat" },
};

export const COUNTERS: Record<string, CounterDef> = {
  "thefts.noticed": { label: "huomatut varkaudet", max: 999 },
  "player.deaths": { label: "sankarin kaatumiset taistelussa", max: 999 },
  /** Loppuruudun tilastot kirjataan voiton hetkellä (`recordVictory`), jotta myöhempi vaeltaminen ei muuta niitä. */
  "win.days": { label: "matkaan kulunut pelipäivien määrä voitettaessa", max: 9999 },
  "win.explored": { label: "tutkittu osuus kartasta voitettaessa (prosenttia)", max: 100 },
  "archer.healFails": { label: "parannuslaulun epäonnistuneet yritykset jousineidolle", max: 3 },
  /** Kuunkierto + 1, jolla toisen talon emäntä viimeksi neuvoi apajan (0 = ei koskaan). */
  "emanta.huntTipMoon": { label: "kuunkierto, jolla emäntä viimeksi neuvoi metsästysapajan", max: 9999 },
};

/** Maailmanesineiden instanssitunnisteet ihmisen luettavina nimina (yhteenvetoa varten). */
export const SCENE_ITEM_LABELS: Record<string, string> = {
  "lakeside.sage-pack": "tietäjän tuohikontti rannalla",
  "@archerYard.table-flatbread": "jousineidon talon pöydän rieskat",
  "@archerYard.table-dried-fish": "jousineidon talon pöydän kuivatut kalat",
  "@otherYard.table-flatbread": "toisen talon pöydän rieskat",
  "@otherYard.table-dried-fish": "toisen talon pöydän kuivatut kalat",
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
