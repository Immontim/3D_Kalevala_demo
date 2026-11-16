// Kohtaus kertoo moottorille, mitä kentällä tapahtuu: keitä sinne tuodaan, milloin, ja mitä
// seuraa, kun vastustaja kaatuu. Moottori itse ei tiedä aalloista mitään. Aaltotaistelu
// (skirmish.ts) on yksi kohtaus; rauhallinen kohtaus ilman vastustajia on toinen.
import type { Actor } from "./actor";
import { t, type TextKey } from "../i18n";
import { $ } from "./dom";
import { showMsg } from "./hud";

export interface Encounter {
  /** Kohtaus alkaa tai aloitetaan alusta: oma tila nollataan ja ensimmäiset vastustajat tuodaan. */
  start(): void;
  /** Kutsutaan joka pelin askeleella (ei tauolla eikä laulun valinnassa). */
  update(dt: number): void;
  /** Vastustaja kaatui. Se on jo poistettu elävien listalta (g.enemies). */
  onEnemyDown(e: Actor): void;
  /** Rauhallinen kohtaus: niin kauan kuin kentällä ei ole vastustajia, sankarin ase on huotrassa. */
  peaceful?: boolean;
}

/** Rauhallinen kohtaus: kentällä ei ole vastustajia, sankari voi liikkua vapaasti. */
export const peace: Encounter = {
  peaceful: true,
  start() { $("wave").textContent = ""; },   // edellisen kohtauksen aaltonumero pois näkyvistä
  update() {},
  onEnemyDown() {},
};

/** Vierailu rauhallisella pihalla: kuin peace, mutta kertoo alussa, missä ollaan. Paikan voi
 *  muuttaa vihamieliseksi vaihtamalla kohtauksen (startEncounter) tai tuomalla yksittäisen
 *  vastustajan (addEnemy); vastustajan mittarit tulevat näkyviin itsestään. */
function makeVisit(title: TextKey, sub: TextKey): Encounter {
  return {
    peaceful: true,
    start() { peace.start(); showMsg(t(title), t(sub), 3); },
    update() {},
    onEnemyDown() {},
  };
}
export const visit: Encounter = makeVisit("yard.title", "yard.sub");
/** Vierailu järven rannalla: sama rauhallinen kohtaus, oma otsikko. */
export const lakesideVisit: Encounter = makeVisit("lakeside.title", "lakeside.sub");
/** Sama ranta tuhon jälkeen. */
export const lakeruinVisit: Encounter = makeVisit("lakeruin.title", "lakeruin.sub");
/** Kalmisto järven rannalla: kuppikivi, röykkiöt ja Louhi. */
export const cairnfieldVisit: Encounter = makeVisit("cairnfield.title", "cairnfield.sub");
