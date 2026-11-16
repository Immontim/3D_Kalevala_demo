// Moottorin yhteinen tila. Yksi moottori sivua kohti: tila on moduulin tasolla, ja muut
// moduulit lukevat ja muuttavat sitä näiden olioiden kautta.
import * as THREE from "three";
import type { StrikeStyle } from "../combat";
import type { Action } from "../bindings";
import type { Debris } from "../fighter";
import { Sfx } from "../audio";
import type { Actor } from "./actor";
import type { Encounter } from "./encounter";

export const DEG = Math.PI / 180;
export const sfx = new Sfx();

/** Pelitilanne. */
export const g = {
  /** Sankari. Luodaan käynnistyksessä (spawnHero) ennen kuin mikään muu käyttää tilaa. */
  player: null as unknown as Actor,
  /** Elossa olevat vastustajat. Kaatunut siirtyy heti listaan corpses. */
  enemies: [] as Actor[],
  /** Käynnissä oleva kohtaus: se päättää, keitä kentälle tuodaan ja milloin. Oletus on tyhjä kohtaus. */
  encounter: { start() {}, update() {}, onEnemyDown() {} } as Encounter,
  /** Laulun voima 0..COMBAT.songMax. */
  songPower: 0,
  /** Pelin aika (hidastuu laulussa, pysähtyy tauolla) ja reaaliaika sekunteina. */
  gameTime: 0,
  realTime: 0,
  timeScale: 1,
  running: false,
  gameOver: false,
  corpses: [] as { actor: Actor; removeAt: number }[],
  /** Viimeisimmät iskujen tulokset tekstinä (savutestit). */
  events: [] as string[],
  /** Maassa lojuvat irtokappaleet: kypärät, kilven palat, pudonneet aseet. */
  debris: [] as Debris[],
  playerAttackId: 0,
  /** Laulun valinta vapauttaa hiiren itse, eikä se saa laukaista automaattista taukoa. */
  choiceUnlock: false,
  /** Savutesteissä automaattisen tauon voi kytkeä pois. */
  autoPause: true,
};

/** Katse: hiiri kääntää suuntaa (yaw) ja pystykulmaa (pitch); lukitus pitää katseen vastustajassa. */
export const aim = {
  yaw: 0,
  pitch: 0,
  /** Pelaaja on kytkenyt lukituksen päälle; se jää voimaan, ja seuraava vastustaja lukitaan heti. */
  lockOn: false,
  /** Lukittu vastustaja. Jos se kaatuu tai poistuu, lukitus siirtyy lähimpään (lockTarget). */
  target: null as Actor | null,
  /** Savutestien ja kuvakaappausten vapaa kamera, tai null. */
  override: null as { pos: number[]; look: number[] } | null,
};

/** Pelaajan syöte: jonossa olevat painallukset ja pohjassa olevat napit. */
export const inputs = {
  strikeQueued: null as StrikeStyle | null,
  blockHeld: false,
  /** Torjuntanappi painettiin: rauhassa "käytä". Kulutetaan joka ruutu. */
  useQueued: false,
  dodgeQueued: false,
  songQueued: false,
  beatQueued: false,
  /** Laulun pikavalinta: valintaringin paikka 0–4, tai null. */
  pickQueued: null as number | null,
};
export const keys = new Set<string>();

/** Tehosteiden tila: osuman pysäytys, kameran tärinä ja suon esittelypaikka (kuvakaappaukset). */
export const fx = { hitstop: 0, shake: 0, bogDemo: null as THREE.Vector3 | null };

/** Näppäinten vaihto asetusikkunassa: sidontaa odottava paikka ja hetki, jolloin kuuntelu päättyi. */
export const bindUi = { capture: null as { action: Action; slot: number } | null, endedAt: 0 };
