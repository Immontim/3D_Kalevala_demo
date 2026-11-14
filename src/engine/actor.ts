// Taistelija pelitilanteessa: sankari tai vastustaja.
import * as THREE from "three";
import type { Ai } from "./ai";
import { ActionState, AttackDef, AttackTiming, Loadout, SHIELDS, ShieldDef, StrikeStyle, WeaponDef, makeAttack, styleFor, weaponOf } from "../combat";
import { Fighter, FighterLook, SwordTrail } from "../fighter";
import { Modifier, Stats, baseStats, effectiveStats } from "../stats";
import { scene } from "./view";

export interface Actor {
  fighter: Fighter;
  trail: SwordTrail;
  pos: THREE.Vector3;
  yaw: number;
  state: ActionState;
  stateTime: number;
  timing: AttackTiming;
  /** Käynnissä oleva tai viimeisin isku. */
  attack: AttackDef;
  loadout: Loadout;
  weapon: WeaponDef;
  /** Ehjä kilpi, tai null jos kilpeä ei ole tai se on hajonnut. */
  shield: ShieldDef | null;
  shieldHp: number;
  /** Aseella torjuttaessa: mitä iskusuuntaa vastaan torjunta on. */
  stance: StrikeStyle;
  /** Pelaaja pitää iskunappia pohjassa: isku virittyy eikä vielä laukea. */
  charging: boolean;
  struck: boolean;
  hp: number;
  /** Kestävyys: kuluu lyönneistä ja torjunnoista, palautuu itsestään. */
  stamina: number;
  /** Hahmon perusarvot (hahmon rivi ja aalto). */
  base: Stats;
  /** Ajonaikaiset vaikutukset kykyihin: ruoka, nälkä, loitsut, esineet. */
  mods: Modifier[];
  /** Lopulliset kyvyt: perusarvot ja voimassa olevat vaikutukset. Päivitetään joka ruutu. */
  stats: Stats;
  blockStart: number;
  rootTime: number;
  dodgeDir: THREE.Vector3;
  dodgeCd: number;
  moveSpeed: number;
  extraRecovery: number;
  /** Tukiaskeleesta otettu osuus 0..1 ja paikka, josta askel lähti (kantama lasketaan siitä). */
  lunged: number;
  stepFrom: THREE.Vector3;
  /** Suoja-aika muita lyöjiä vastaan: voimassa tähän pelin aikaan asti, ja kenen isku torjuttiin. */
  graceUntil: number;
  graceFrom: Actor | null;
  /** Nimi mittarissa (vastustajilla). */
  name: string;
  /** Taso: 0 sankarilla; vastustajilla kasvattaa elämää, voimaa ja tekoälyn taitoa. */
  level: number;
  /** Tekoälyn tila; null sankarilla. */
  ai: Ai | null;
}

/** level = 0 sankarille; vastustajilla taso kasvattaa elämää ja voimaa. */
export function makeActor(look: FighterLook, pos: THREE.Vector3, level: number, trailColor: number): Actor {
  const fighter = new Fighter(look);
  const trail = new SwordTrail(trailColor);
  scene.add(fighter.root, trail.mesh);
  const weapon = weaponOf(look.loadout);
  const shield = look.loadout === "sword_shield" ? SHIELDS.round : null;
  const base = baseStats(look.character, level);
  const stats = effectiveStats(base, [], 0);
  return {
    base, mods: [], stats, stamina: stats.maxStamina,
    weapon, shield, shieldHp: shield ? shield.durability : 0, stance: "slash", charging: false,
    fighter, trail, pos: pos.clone(), yaw: 0, state: "idle", stateTime: 0, timing: { windup: 0.3, release: 0.1, recovery: 0.3 },
    attack: makeAttack(weapon, styleFor(weapon, "slash"), "light"), loadout: look.loadout, struck: false, hp: stats.maxHp,
    blockStart: -99, rootTime: 0, dodgeDir: new THREE.Vector3(), dodgeCd: 0, moveSpeed: 0, extraRecovery: 0,
    lunged: 0, stepFrom: pos.clone(), graceUntil: -1, graceFrom: null, name: "", level, ai: null,
  };
}

/** Poistaa taistelijan näkymästä ja vapauttaa sen omat materiaalit. */
export function removeActor(a: Actor) {
  scene.remove(a.fighter.root, a.trail.mesh);
  a.fighter.dispose();
  a.trail.mesh.geometry.dispose();
  (a.trail.mesh.material as THREE.Material).dispose();
}

// ---------- Tilakoneet ----------
export function setState(a: Actor, s: ActionState) {
  a.state = s;
  a.stateTime = 0;
  a.struck = false;
  a.charging = false;
}
