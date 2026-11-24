// Louhen kalmiston hybridi-kohtaaminen. Kampanjatila, Louhen läsnäolo ja
// vartijataistelu ovat erillisiä: myöhemmät liikkeet ja kyvyt voidaan lisätä
// Louhen toimintakerrokseen muuttamatta dialogia tai vartija-aaltoa.
import * as THREE from "three";
import { angleBetween, inStrikeZone } from "../combat";
import { setVillagerAction, villagerPosition } from "../folk";
import { t, type TextKey } from "../i18n";
import {
  LOUHI_ENCOUNTER,
  createLouhiEncounterState,
  stepLouhiEncounter,
  type LouhiEncounterEffect,
  type LouhiEncounterState,
} from "../louhiEncounter";
import { walkableDepth, sceneLayout } from "../sceneLayout";
import type { SongId } from "../songLogic";
import { LOUHI_AT, groundHeight } from "../world";
import { setState, type Actor } from "./actor";
import { $ } from "./dom";
import { addEnemy } from "./enemies";
import type { Encounter } from "./encounter";
import { flash, showMsg } from "./hud";
import { ENEMIES } from "./skirmish";
import { fx, g, sfx } from "./state";
import { world } from "./view";

const LAYOUT = sceneLayout("cairnfield");
const ARRIVE_TIMEOUT = 12;
const CALLS: readonly TextKey[] = ["world.louhi.call", "world.louhi.call.2", "world.louhi.call.3"];
/** Metsä Louhen takana. Pisteet ovat tarkoituksella kuljettavan kehän ulkopuolella. */
const GUARD_SPAWNS = [
  { x: -13.8, z: 4.2 },
  { x: -14.4, z: 7.1 },
] as const;

let state: LouhiEncounterState = createLouhiEncounterState();
let pendingInterruptedEffects: LouhiEncounterEffect[] = [];
const guardActors = new Set<Actor>();

export function configureLouhiEncounter(louhiPresent: boolean) {
  state = createLouhiEncounterState(louhiPresent ? "present" : "banished");
  pendingInterruptedEffects = [];
  guardActors.clear();
}

function guardDef() {
  const def = ENEMIES.find((enemy) => enemy.look.character === "pohja" && enemy.look.loadout === "sword_shield");
  if (!def) throw new Error("Pohjan miekka-kilpisoturin määrittely puuttuu");
  return def;
}

function spawnGuards(count = LOUHI_ENCOUNTER.guardCount) {
  const def = guardDef();
  for (let i = 0; i < count; i++) {
    const desired = GUARD_SPAWNS[i % GUARD_SPAWNS.length];
    const solved = world.collision.depenetrateDisc(desired.x, desired.z, 0.6);
    const pos = new THREE.Vector3(solved.x, groundHeight(solved.x, solved.z), solved.z);
    const enemy = addEnemy({ name: def.name, look: def.look, level: 0, aiLevel: 1 }, pos);
    guardActors.add(enemy);
    if (enemy.ai && walkableDepth(LAYOUT, solved.x, solved.z) < enemy.radius + 0.1) {
      enemy.ai.arriveUntil = g.gameTime + ARRIVE_TIMEOUT;
    }
  }
}

function callText() { return t(CALLS[Math.floor(Math.random() * CALLS.length)] ?? CALLS[0]); }

function applyEffects(effects: readonly LouhiEncounterEffect[]) {
  for (const effect of effects) {
    switch (effect.kind) {
      case "call-guards":
        spawnGuards(effect.count);
        showMsg(callText(), t("world.louhi.callSub"), 3.2);
        break;
      case "interrupt-player-sleep":
        // Laulu-UI suljetaan engine/song.ts:ssä ennen muiden vaikutusten näyttämistä.
        break;
      case "louhi-cast-started":
        setVillagerAction("louhi", "sing");
        showMsg(t("world.louhi.cast"), t("world.louhi.castSub"), 3);
        break;
      case "louhi-cast-interrupted":
        setVillagerAction("louhi", "idle");
        if (effect.reason === "hit") showMsg(t("world.louhi.castInterrupted"), "", 1.6);
        break;
      case "bog-player": {
        const player = g.player;
        setState(player, "rooted");
        player.rootTime = effect.seconds;
        player.rootedDamageMultiplier = effect.meleeDamageMultiplier;
        player.bogDot = { perSec: effect.damagePerSecond, left: effect.seconds, acc: 0 };
        sfx.swamp();
        fx.shake = Math.max(fx.shake, 0.25);
        showMsg(t("world.louhi.bogged"), t("world.louhi.boggedSub"), 2.8);
        break;
      }
      case "battle-cleared":
        setVillagerAction("louhi", "idle");
        showMsg(t("world.louhi.guardsDown"), t("world.louhi.guardsDownSub"), 3);
        break;
    }
  }
}

function step(event: Parameters<typeof stepLouhiEncounter>[1]) {
  const out = stepLouhiEncounter(state, event);
  state = out.state;
  return out.effects;
}

/** Dialogin haaste käynnistää saman aallon kuin keskeytetty Pohjolan uni. */
export function provokeLouhi() {
  applyEffects(step({ type: "challenge", now: g.realTime }));
}

function restartActiveBattle() {
  guardActors.clear();
  state = {
    ...state,
    guardsAlive: LOUHI_ENCOUNTER.guardCount,
    action: { kind: "idle" },
    nextAbilityAt: g.realTime + LOUHI_ENCOUNTER.initialAbilityDelay,
  };
  setVillagerAction("louhi", "idle");
  spawnGuards();
  showMsg(callText(), t("world.louhi.callSub"), 3.2);
}

const tmpLouhi = new THREE.Vector3();

export const louhiEncounter: Encounter = {
  peaceful: true,

  start() {
    $("wave").textContent = "";
    if (state.battle === "active") restartActiveBattle();
    else showMsg(t("cairnfield.title"), t("cairnfield.sub"), 3);
  },

  update(_dt, _realDt) {
    if (g.player.state === "dead") return;
    const louhi = villagerPosition("louhi", tmpLouhi) ?? tmpLouhi.set(LOUHI_AT.x, 0, LOUHI_AT.z);
    const effects = step({
      type: "tick",
      now: g.realTime,
      playerDistance: Math.hypot(g.player.pos.x - louhi.x, g.player.pos.z - louhi.z),
      playerRooted: g.player.state === "rooted",
    });
    applyEffects(effects);
  },

  onEnemyDown(enemy) {
    if (!guardActors.delete(enemy)) return;
    applyEffects(step({ type: "guard-down", now: g.realTime }));
  },

  onPlayerSongStart(songId: SongId, listenerId: string | null) {
    if (songId !== "sleep") return;
    applyEffects(step({ type: "player-sleep-started", now: g.realTime, nearLouhi: listenerId === "louhi" }));
  },

  onPlayerSongBeat(songId: SongId, beat: number) {
    const effects = step({ type: "player-song-beat", songId, beat, now: g.realTime });
    if (!effects.some((effect) => effect.kind === "interrupt-player-sleep")) {
      applyEffects(effects);
      return false;
    }
    pendingInterruptedEffects = effects.filter((effect) => effect.kind !== "interrupt-player-sleep");
    return true;
  },

  afterPlayerSongInterrupted() {
    const effects = pendingInterruptedEffects;
    pendingInterruptedEffects = [];
    applyEffects(effects);
  },

  onPlayerStrike(attacker: Actor, combatTarget: Actor | null) {
    if (state.presence !== "present" || state.action.kind !== "casting") return false;
    const louhi = villagerPosition("louhi", tmpLouhi);
    if (!louhi) return false;
    const dx = louhi.x - attacker.pos.x, dz = louhi.z - attacker.pos.z;
    const distance = Math.hypot(louhi.x - attacker.stepFrom.x, louhi.z - attacker.stepFrom.z);
    if (!inStrikeZone({ distance, angleToDefender: angleBetween(attacker.yaw, Math.atan2(dx, dz)) }, attacker.attack)) return false;
    if (combatTarget) {
      const tx = combatTarget.pos.x - attacker.pos.x, tz = combatTarget.pos.z - attacker.pos.z;
      const targetDistance = combatTarget.pos.distanceTo(attacker.stepFrom);
      const targetInZone = inStrikeZone(
        { distance: targetDistance, angleToDefender: angleBetween(attacker.yaw, Math.atan2(tx, tz)) },
        attacker.attack,
      );
      if (targetInZone && targetDistance <= distance) return false;
    }
    applyEffects(step({ type: "louhi-hit", now: g.realTime }));
    setVillagerAction("louhi", "hit");
    sfx.hit();
    fx.shake = Math.max(fx.shake, 0.08);
    flash("#654b83", 0.12);
    return true;
  },

  onNpcRemoved(npcId: string) {
    if (npcId === "louhi") applyEffects(step({ type: "louhi-removed", now: g.realTime }));
  },
};

export function louhiEncounterState() { return state; }
