import * as THREE from "three";
import { FREECAM, FreeCam } from "../freecam";
import { camera } from "./view";

/** Vapaa kamera: tauon aikainen tarkastelutila. Kamera lähtee pelikameran paikasta ja asennosta. */
export const freeCam = {
  active: false,
  cam: { x: 0, y: 2, z: 0, yaw: 0, pitch: 0, speed: FREECAM.defaultSpeed } as FreeCam,
};

const eul = new THREE.Euler();

export function startFreeCam() {
  eul.setFromQuaternion(camera.quaternion, "YXZ");
  const c = freeCam.cam;
  c.x = camera.position.x; c.y = camera.position.y; c.z = camera.position.z;
  c.yaw = eul.y; c.pitch = Math.max(-FREECAM.pitchMax, Math.min(FREECAM.pitchMax, eul.x));
  freeCam.active = true;
  document.body.classList.add("freecam");
}

export function stopFreeCam() {
  freeCam.active = false;
  document.body.classList.remove("freecam");
}

export function applyFreeCam() {
  const c = freeCam.cam;
  camera.position.set(c.x, c.y, c.z);
  camera.rotation.set(c.pitch, c.yaw, 0, "YXZ");
}
