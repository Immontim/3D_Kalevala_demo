// Taistelijan tila näkyväksi: asento, paikka, terän hehku ja miekan vana.
import * as THREE from "three";
import { COMBAT } from "../combat";
import { GESTURE_TIME, POSES, gesturePose } from "../fighter";
import { groundHeight } from "../world";
import { Actor } from "./actor";
import { choosing, songState } from "./song";
import { g } from "./state";
import { heroBowPose } from "./hunt";

export function targetPose(a: Actor) {
  const k = a.attack.kind, hv = a.attack.weight === "heavy";
  switch (a.state) {
    case "windup": {
      const pose = k === "bash" ? POSES.bashWindup : k === "slash" ? POSES.slashWindup : k === "thrust" ? POSES.thrustWindup : hv ? POSES.heavyWindup : POSES.windup;
      return { pose, rate: 7 / a.timing.windup };
    }
    case "release": {
      const pose = k === "bash" ? POSES.bashStrike : k === "slash" ? POSES.slashStrike : k === "thrust" ? POSES.thrustStrike : hv ? POSES.heavyStrike : POSES.strike;
      // Iskuasento valmistuu osumahetkeen, samaan aikaan tukiaskeleen kanssa.
      return { pose, rate: 3.2 / (a.timing.release * COMBAT.strikePoint) };
    }
    case "recovery": return { pose: POSES.guard, rate: 5 };
    case "block": return { pose: a.stance === "slash" ? POSES.blockSide : a.stance === "thrust" ? POSES.blockThrust : POSES.block, rate: 22 };
    // Rauhan eleet. Keihäsmies tekee eleen vasemmalla kädellä, jotta keihäs pysyy oikeassa kädessä.
    case "talk": case "use": return { pose: gesturePose(a.state, Math.min(a.stateTime, GESTURE_TIME[a.state].total), a.loadout === "spear" ? "L" : "R"), rate: 16 };
    case "stagger": return { pose: POSES.stagger, rate: 14 };
    case "rooted": return { pose: POSES.rooted, rate: 6 };
    case "dead": return { pose: POSES.stagger, rate: 6 };
    case "dodge": return { pose: POSES.guard, rate: 10 };
    default: {
      if (a === g.player && !songState && !choosing) {
        const bow = heroBowPose();
        if (bow) return { pose: bow, rate: 14 };
      }
      return a === g.player && (songState || choosing) ? { pose: POSES.sing, rate: 4.5 } : { pose: POSES.guard, rate: 8 };
    }
  }
}

export const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
export function syncVisual(a: Actor, dt: number) {
  const f = a.fighter;
  a.pos.y = groundHeight(a.pos.x, a.pos.z);
  f.root.position.copy(a.pos);
  f.root.rotation.y = a.yaw;
  const { pose, rate } = targetPose(a);
  if (a.state === "dodge") f.root.rotation.z = Math.sin((a.stateTime / COMBAT.dodgeTime) * Math.PI) * 0.25;
  else f.root.rotation.z = 0;
  const sinkTarget = a.state === "rooted" ? 0.55 : 0;
  f.sink += (sinkTarget - f.sink) * (1 - Math.exp(-4 * dt));
  if (a.state === "dead") f.fall = Math.min(1, f.fall + dt * 1.6);
  f.animate(pose, rate, dt, a.moveSpeed);
  // Vihollisen terä hehkuu noston aikana: ajoitusvihje.
  const glow = a !== g.player && a.state === "windup" ? Math.min(1, a.stateTime / a.timing.windup) : 0;
  f.setGlow(glow * (a.attack.weight === "heavy" ? 1.5 : 0.9));
  f.root.updateMatrixWorld(true);
  f.bladeBase.getWorldPosition(tmpA);
  f.bladeTip.getWorldPosition(tmpB);
  a.trail.update(tmpA, tmpB, a.attack.kind !== "bash" && (a.state === "release" || (a.state === "recovery" && a.stateTime < a.timing.windup + a.timing.release + 0.05)));
}
