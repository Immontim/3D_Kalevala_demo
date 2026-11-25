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
  "sage.offeringAsked": { label: "tietäjä on vaatinut uhrin ennen laulun opettamista ja kertonut toisesta kalmistosta" },
  "sage.offeringAwaited": { label: "pelaaja on lähtenyt rannalta uhripyynnön jälkeen: tietäjä kysyy seuraavalla käynnillä uhreista" },
  "sage.offeringConfirmed": { label: "pelaaja on kertonut tietäjälle, että uhrit on toimitettu" },
  "offering.made": { label: "pelaaja on uhrannut kaksi lihaa toisen kalmiston kuppikivelle Ukolle ja Manalle menneille" },
  "louhi.banished": { label: "Louhi on karkotettu kalmistolta ja vainolaisten leiri on paljastunut" },
  "rumor.heard": { label: "jompikumpi emäntä on kertonut huhun vainolaisista" },
  "emanta.greeted": { label: "pelaaja on puhunut jousineidon talon emännälle" },
  "emanta_b.greeted": { label: "pelaaja on puhunut toisen talon emännälle" },
  "emanta.met": { label: "jousineidon talon emäntä on tavattu aiemmalla käynnillä" },
  "emanta_b.met": { label: "toisen talon emäntä on tavattu aiemmalla käynnillä" },
  "emanta.robbed": { label: "jousineidon talon emäntä tietää, että hänen pöydältään vietiin ruokaa kysymättä" },
  "emanta_b.robbed": { label: "toisen talon emäntä tietää, että hänen pöydältään vietiin ruokaa kysymättä" },
  "emanta.foodShared": { label: "jousineidon talon emäntä antoi jänislihasta luvan ottaa pöydän rieskat ja kalat" },
  "emanta_b.foodShared": { label: "toisen talon emäntä antoi jänislihasta luvan ottaa pöydän rieskat ja kalat" },
  "smithy.exchangeOpen": { label: "sepän lihavaihto on maksettu ja toinen kauppatavara on luvallinen ottaa" },
  "smithy.tradeMade": { label: "pelaaja on tehnyt sepän kanssa ainakin yhden lihavaihtokaupan" },
  "smithy.tradePendingDeparture": { label: "sepän viimeisin lihavaihto odottaa pihasta lähtöä ennen aikaleimaa" },
  "smithy.tradeThisVisit": { label: "pelaaja on tehnyt sepän kanssa vaihtokaupan tällä käynnillä" },
  "smithy.salliToldArcherYard": { label: "sepän sälli on kertonut jousineidon maatilasta" },
};

export const COUNTERS: Record<string, CounterDef> = {
  "thefts.noticed": { label: "huomatut varkaudet", max: 999 },
  "player.deaths": { label: "sankarin kaatumiset taistelussa", max: 999 },
  /** Loppuruudun tilastot kirjataan voiton hetkellä (`recordVictory`), jotta myöhempi vaeltaminen ei muuta niitä. */
  "win.days": { label: "matkaan kulunut pelipäivien määrä voitettaessa", max: 9999 },
  "win.explored": { label: "tutkittu osuus kartasta voitettaessa (prosenttia)", max: 100 },
  "archer.healFails": { label: "parannuslaulun epäonnistuneet yritykset jousineidolle", max: 3 },
  /** Kuunkierto + 1, jolla jompikumpi emäntä viimeksi neuvoi apajan (0 = ei koskaan). */
  "emanta.huntTipMoon": { label: "kuunkierto, jolla jompikumpi emäntä viimeksi neuvoi metsästysapajan", max: 9999 },
  /** Kuunkierto + 1, jolla Ukkoa viimeksi muistettiin kummalla tahansa kuppikivellä (0 = ei koskaan). */
  "ukko.rememberedMoon": { label: "kuunkierto, jolla pelaaja viimeksi muisti Ukkoa kuppikivellä", max: 9999 },
  /** Maailma-aika miljoonasosaminuutteina + 1 (0 = ei koskaan), ks. conditions.ts. */
  "smithy.lastTradeAt": { label: "maailma-aika, jolloin sepän viimeisimmän lihavaihdon jälkeen lähdettiin", max: Number.MAX_SAFE_INTEGER },
};

/** Maailmanesineiden instanssitunnisteet ihmisen luettavina nimina (yhteenvetoa varten). */
export const SCENE_ITEM_LABELS: Record<string, string> = {
  "lakeside.sage-pack": "tietäjän tuohikontti rannalla",
  "@archerYard.table-flatbread": "jousineidon talon pöydän rieskat",
  "@archerYard.table-dried-fish": "jousineidon talon pöydän kuivatut kalat",
  "@otherYard.table-flatbread": "toisen talon pöydän rieskat",
  "@otherYard.table-dried-fish": "toisen talon pöydän kuivatut kalat",
  "smithy.spear": "sepän kauppatelineen keihäs",
  "smithy.greaves": "sepän kauppatelineen säärisuojat",
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
