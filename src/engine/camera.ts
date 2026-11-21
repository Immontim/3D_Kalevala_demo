import * as THREE from "three";
import { choosing, songState } from "./song";
import { lockTarget } from "./enemies";
import { aim, fx, g } from "./state";
import { applyFreeCam, freeCam } from "./freecam";
import { camera, world } from "./view";
import { updateFoliageFade } from "./foliageFade";

// ---------- Katse ja lukitus ----------
// Hiiri kääntää katsetta (camYaw, camPitch), ja sankari kääntyy katseen suuntaan omalla
// kääntymisnopeudellaan. WASD liikkuu katseen suhteen. Lukitus pitää katseen vastustajassa.

export function bearing(from: THREE.Vector3, to: THREE.Vector3) { return Math.atan2(to.x - from.x, to.z - from.z); }

// ---------- Kamera ----------
export const camPos = new THREE.Vector3(0, 4, -9);
export const camLook = new THREE.Vector3();
// Puomin pituuden pehmennys: sisäänveto on nopea (ei leikkaa rungon läpi), ulosveto hidas.
let boomScale = 1;
const PIVOT_UP = 1.5;
const PULL_PAD = 0.25;
const PULL_MARGIN = 0.3;
const PULL_MIN = 1.1;
// Savutestien ja kuvakaappausten vapaa kamera: { pos: [x,y,z], look: [x,y,z] } tai null.

export function updateCamera(dt: number) {
  if (aim.override) {
    camera.position.fromArray(aim.override.pos);
    camera.lookAt(aim.override.look[0], aim.override.look[1], aim.override.look[2]);
    updateFoliageFade(camera, null);
    return;
  }
  if (freeCam.active) { applyFreeCam(); updateFoliageFade(camera, null); return; }
  // Kamera katseen suunnassa sankarin takana; pystykulma nostaa kameraa ja kallistaa katsetta.
  const locked = lockTarget();
  const dir = new THREE.Vector3(Math.sin(aim.yaw), 0, Math.cos(aim.yaw));
  const right = new THREE.Vector3(-dir.z, 0, dir.x);
  const singing = songState !== null || choosing;
  const back = singing ? 3.2 : 4.4;
  const height = singing ? 1.7 : 2.3;
  const pitch = singing ? 0 : aim.pitch;
  const desired = g.player.pos.clone().addScaledVector(dir, -back * Math.cos(pitch)).addScaledVector(right, singing ? -1.6 : -1.3)
    .setY(g.player.pos.y + height + back * Math.sin(pitch));
  world.clearCamera(desired);
  // Puiden rungot ja rakennukset: vedä kamera pivotista (sankarin pää) kohti sankaria, jos
  // väliin jää este. Pehmennetään puomin pituutta, ei sijaintia, jottei kamera heilu sivuun.
  const pivot = g.player.pos.clone().setY(g.player.pos.y + PIVOT_UP);
  const boomX = desired.x - pivot.x, boomZ = desired.z - pivot.z;
  const boomLen = Math.hypot(boomX, boomZ);
  let target = 1;
  if (boomLen > 0.01) {
    const hit = world.collision.firstCameraHit(pivot.x, pivot.z, desired.x, desired.z, PULL_PAD);
    if (hit) target = Math.min(1, Math.max(PULL_MIN, hit.t * boomLen - PULL_MARGIN) / boomLen);
  }
  boomScale = target < boomScale ? target : boomScale + (target - boomScale) * (1 - Math.exp(-5 * dt));
  if (boomScale < 0.999) {
    // Matala puomi ei saa katsoa suoraan alas: korkeus laskee vain hieman.
    desired.y = pivot.y + (desired.y - pivot.y) * (0.6 + 0.4 * boomScale);
    desired.x = pivot.x + boomX * boomScale;
    desired.z = pivot.z + boomZ * boomScale;
    camPos.copy(desired);
  } else {
    camPos.lerp(desired, 1 - Math.exp(-5 * dt));
  }
  const ahead = locked ? locked.pos : g.player.pos.clone().addScaledVector(dir, 3);
  const look = g.player.pos.clone().lerp(ahead, 0.6).setY(g.player.pos.y + 1.2);
  camLook.lerp(look, 1 - Math.exp(-8 * dt));
  camera.position.copy(camPos);
  if (fx.shake > 0) {
    camera.position.x += (Math.random() - 0.5) * fx.shake;
    camera.position.y += (Math.random() - 0.5) * fx.shake;
  }
  camera.lookAt(camLook);
  camera.fov += ((singing ? 46 : 55) - camera.fov) * (1 - Math.exp(-3 * dt));
  camera.updateProjectionMatrix();
  updateFoliageFade(camera, g.player.pos);
}
