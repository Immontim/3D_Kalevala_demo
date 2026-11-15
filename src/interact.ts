// Rauhan vuorovaikutus: puhe ja käyttö. Puhdasta logiikkaa ilman selainriippuvuuksia.
//
// Rauhallisessa kohtauksessa lyöntinappi puhuu ja torjuntanappi käyttää. Kohde etsitään
// samoin kuin lyönnin kohde: sen pitää olla kantaman sisällä ja hahmon edessä olevassa
// sektorissa (puolikulma). Puheen kantama ja sektori on otettu miekan sivalluksesta,
// jotta tunne on sama kuin taistelussa; käytön ulottuma on lyhyempi mutta leveämpi.
import { STRIKES, angleBetween } from "./combat";

export interface Talkable {
  id: string;
  /** Näytettävä nimi. */
  name: string;
  x: number;
  z: number;
}

export interface Zone {
  /** Kantama metreinä hahmon keskipisteestä kohteen keskipisteeseen. */
  range: number;
  /** Puolikulma radiaaneina hahmon katsesuunnasta. */
  arc: number;
}

/** Puhe: miekan kevyen sivalluksen kantama ja sektori. */
export const TALK_ZONE: Zone = { range: STRIKES.slash.light.range, arc: STRIKES.slash.light.arc };
/** Käyttö: kädet ojentuvat eteen alaviistoon, joten ulottuma on lyhyempi ja sektori leveä. */
export const USE_ZONE: Zone = { range: 1.6, arc: Math.PI / 3 };

/** Paikan väki, jolle voi puhua. world.ts lisää heidät kohtauksen rakennusvaiheessa. */
export const TALKABLES: Talkable[] = [];
export function addTalkable(t: Talkable) { TALKABLES.push(t); }
export function clearTalkables() { TALKABLES.length = 0; }

/** Lähin kohde kantaman ja sektorin sisällä, tai null. yaw on katse (0 = +z, kasvaa kohti +x). */
export function pickTarget(from: { x: number; z: number; yaw: number }, list: readonly Talkable[], zone: Zone): Talkable | null {
  let best: Talkable | null = null;
  let bestD = Infinity;
  for (const t of list) {
    const dx = t.x - from.x, dz = t.z - from.z;
    const d = Math.hypot(dx, dz);
    if (d > zone.range) continue;
    // Aivan päällä oleva kohde on aina "edessä": kulmaa ei voi laskea.
    if (d > 0.05 && Math.abs(angleBetween(from.yaw, Math.atan2(dx, dz))) > zone.arc) continue;
    if (d < bestD) { best = t; bestD = d; }
  }
  return best;
}
