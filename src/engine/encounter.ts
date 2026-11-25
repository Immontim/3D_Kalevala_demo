// Kohtaus kertoo moottorille, mitä kentällä tapahtuu: keitä sinne tuodaan, milloin, ja mitä
// seuraa, kun vastustaja kaatuu. Moottori itse ei tiedä aalloista mitään. Aaltotaistelu
// (skirmish.ts) on yksi kohtaus; rauhallinen kohtaus ilman vastustajia on toinen.
import type { Actor } from "./actor";
import type { SongId } from "../songLogic";
import { t, type TextKey } from "../i18n";
import { $ } from "./dom";
import { showMsg } from "./hud";

export interface Encounter {
  /** Kohtaus alkaa tai aloitetaan alusta: oma tila nollataan ja ensimmäiset vastustajat tuodaan. */
  start(): void;
  /** Kutsutaan joka pelin askeleella (ei tauolla eikä laulun valinnassa). */
  update(dt: number, realDt?: number): void;
  /** Vastustaja kaatui. Se on jo poistettu elävien listalta (g.enemies). */
  onEnemyDown(e: Actor): void;
  /** Laulun elinkaarikoukut paikallisille kohtaamisreaktioille. */
  onPlayerSongStart?(songId: SongId, listenerId: string | null): void;
  /** True tarkoittaa, että kohtaaminen katkaisi laulun tämän riimun jälkeen. */
  onPlayerSongBeat?(songId: SongId, beat: number): boolean;
  /** Kutsutaan sen jälkeen, kun kohtaamisen pyytämä laulunkatkaisu on sulkenut laulu-UI:n. */
  afterPlayerSongInterrupted?(): void;
  /** Vahingoittumaton kohtauskohde voi kuluttaa pelaajan iskun. */
  onPlayerStrike?(attacker: Actor, combatTarget: Actor | null): boolean;
  /** Maailmasääntö poisti paikallisen hahmon kesken kohtaamisen. */
  onNpcRemoved?(npcId: string): void;
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
/** Sepän aidattu pihapiiri ja avopaja. */
export const smithyVisit: Encounter = makeVisit("smithy.title", "smithy.sub");
/** Erämaa: laaja metsä (200 x 200 m), josta poistutaan polunsuista. */
export const wildsVisit: Encounter = makeVisit("wilds.title", "wilds.sub");
