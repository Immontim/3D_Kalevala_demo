// Kohtaus kertoo moottorille, mitä kentällä tapahtuu: keitä sinne tuodaan, milloin, ja mitä
// seuraa, kun vastustaja kaatuu. Moottori itse ei tiedä aalloista mitään. Aaltotaistelu
// (skirmish.ts) on yksi kohtaus; rauhallinen kohtaus ilman vastustajia on toinen.
import type { Actor } from "./actor";

export interface Encounter {
  /** Kohtaus alkaa tai aloitetaan alusta: oma tila nollataan ja ensimmäiset vastustajat tuodaan. */
  start(): void;
  /** Kutsutaan joka pelin askeleella (ei tauolla eikä laulun valinnassa). */
  update(dt: number): void;
  /** Vastustaja kaatui. Se on jo poistettu elävien listalta (g.enemies). */
  onEnemyDown(e: Actor): void;
}

/** Rauhallinen kohtaus: kentällä ei ole vastustajia, sankari voi liikkua vapaasti. */
export const peace: Encounter = { start() {}, update() {}, onEnemyDown() {} };
