// Taistelija pelitilanteessa: sankari tai vastustaja.
import * as THREE from "three";
import type { Ai } from "./ai";
import { ActionState, AttackDef, AttackTiming, COMBAT, Loadout, SHIELDS, ShieldDef, StrikeStyle, WeaponDef, makeAttack, styleFor, weaponOf } from "../combat";
import { CharacterId, Fighter, FighterLook, SwordTrail } from "../fighter";
import { Modifier, Stats, baseStats, effectiveStats } from "../stats";
import { COLLISION } from "../collision";
import type { BogDot } from "../songLogic";
import { scene } from "./view";

export interface Actor {
  fighter: Fighter;
  trail: SwordTrail;
  pos: THREE.Vector3;
  /** Vartalon säde XZ-tason törmäyksissä. Sama rajapinta sopii myöhemmin eläimille. */
  radius: number;
  yaw: number;
  state: ActionState;
  stateTime: number;
  timing: AttackTiming;
  /** Käynnissä oleva tai viimeisin isku. */
  attack: AttackDef;
  character: CharacterId;
  loadout: Loadout;
  weapon: WeaponDef;
  /** Ehjä kilpi, tai null jos kilpeä ei ole tai se on hajonnut. */
  shield: ShieldDef | null;
  shieldHp: number;
  armour: { ringMail: boolean; greaves: boolean };
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
  /** Aseiskujen vahinkokerroin suohon juuttuneena. */
  rootedDamageMultiplier: number;
  /** Suon vahinko juuttumisen ajan (null = suo ei vahingoita). */
  bogDot: BogDot | null;
  /** Kasvaa jokaisesta suon vahinkotikistä: elämämittari sykähtää (hud.ts). */
  dotPulse: number;
  dodgeDir: THREE.Vector3;
  dodgeCd: number;
  /** Kilpityönnön aiheuttaman taaksehorjahduksen suunta ja jäljellä oleva matka. */
  bashPushDir: THREE.Vector3;
  bashPushLeft: number;
  moveSpeed: number;
  extraRecovery: number;
  /** Tukiaskeleesta otettu osuus 0..1 ja paikka, josta askel lähti (kantama lasketaan siitä). */
  lunged: number;
  stepFrom: THREE.Vector3;
  /** Suoja-aika muita lyöjiä vastaan: voimassa tähän pelin aikaan asti, ja kenen isku torjuttiin. */
  graceUntil: number;
  graceFrom: Actor | null;
  /** Suunta (maailman kulma), josta torjuttu isku tuli: suoja-aika koskee vain sen ympäristöä. */
  graceDir: number;
  /** Horjahduksen jälkeen osumat eivät horjuta tähän pelin aikaan asti (vain sankarilla). */
  staggerFreeUntil: number;
  /** Nimi mittarissa (vastustajilla). */
  name: string;
  /** Taso: 0 sankarilla; vastustajilla kasvattaa elämää, voimaa ja tekoälyn taitoa. */
  level: number;
  /** Tekoälyn tila; null sankarilla. */
  ai: Ai | null;
  /** Henkilökohtainen toimintanopeus ja sen päättymisaika. */
  tempoScale: number;
  tempoUntil: number;
}

/** level = 0 sankarille; vastustajilla taso kasvattaa elämää ja voimaa. */
export function makeActor(look: FighterLook, pos: THREE.Vector3, level: number, trailColor: number): Actor {
  const fighter = new Fighter(look);
  const trail = new SwordTrail(trailColor);
  scene.add(fighter.root, trail.mesh);
  const weapon = weaponOf(look.loadout, !!look.skyIron);
  const shield = look.loadout === "sword_shield" ? SHIELDS.round : null;
  const base = baseStats(look.character, level);
  const stats = effectiveStats(base, [], 0);
  return {
    base, mods: [], stats, stamina: stats.maxStamina,
    weapon, shield, shieldHp: shield ? shield.durability : 0,
    armour: { ringMail: !!look.ringMail, greaves: !!look.greaves }, stance: "slash", charging: false,
    fighter, trail, pos: pos.clone(), radius: COLLISION.actorRadius, yaw: 0, state: "idle", stateTime: 0, timing: { windup: 0.3, release: 0.1, recovery: 0.3 },
    attack: makeAttack(weapon, styleFor(weapon, "slash"), "light"), character: look.character, loadout: look.loadout, struck: false, hp: stats.maxHp,
    blockStart: -99, rootTime: 0, rootedDamageMultiplier: COMBAT.rootedDamage, bogDot: null, dotPulse: 0, dodgeDir: new THREE.Vector3(), dodgeCd: 0,
    bashPushDir: new THREE.Vector3(), bashPushLeft: 0, moveSpeed: 0, extraRecovery: 0,
    lunged: 0, stepFrom: pos.clone(), graceUntil: -1, graceFrom: null, graceDir: 0, staggerFreeUntil: -1, name: "", level, ai: null,
    tempoScale: 1, tempoUntil: -1,
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
