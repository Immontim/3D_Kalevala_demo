import * as THREE from "three";
import { Bog } from "../bog";
import { choosing, songState } from "./song";
import { g } from "./state";
import { scene, world } from "./view";

// ---------- Efektit ----------
export const dotTex = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.4, "rgba(255,255,255,0.6)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
})();

export const sparkCount = 120;
export const sparkPos = new Float32Array(sparkCount * 3);
export const sparkVel = new Float32Array(sparkCount * 3);
export const sparkLife = new Float32Array(sparkCount);
export const sparkGeo = new THREE.BufferGeometry();
sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
export const sparks = new THREE.Points(
  sparkGeo,
  new THREE.PointsMaterial({ map: dotTex, color: 0xffd080, size: 0.12, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
);
sparks.frustumCulled = false;

export let sparkIdx = 0;
export function emitSparks(at: THREE.Vector3, n: number, speed: number) {
  for (let i = 0; i < n; i++) {
    const k = sparkIdx++ % sparkCount;
    sparkPos.set([at.x, at.y, at.z], k * 3);
    sparkVel.set([(Math.random() - 0.5) * speed, Math.random() * speed * 0.8, (Math.random() - 0.5) * speed], k * 3);
    sparkLife[k] = 0.4 + Math.random() * 0.4;
  }
}
export function updateSparks(dt: number) {
  for (let i = 0; i < sparkCount; i++) {
    if (sparkLife[i] <= 0) { sparkPos[i * 3 + 1] = -100; continue; }
    sparkLife[i] -= dt;
    sparkVel[i * 3 + 1] -= 9 * dt;
    for (let j = 0; j < 3; j++) sparkPos[i * 3 + j] += sparkVel[i * 3 + j] * dt;
  }
  sparkGeo.attributes.position.needsUpdate = true;
}

// Suo, johon vihollinen lauletaan (malli Blenderistä, liike koodista).
export const bog = new Bog(scene, world);


// Laulun kultainen rengas pelaajan ympärillä.
export const ringCount = 80;
export const ringPos = new Float32Array(ringCount * 3);
export const ringGeo = new THREE.BufferGeometry();
ringGeo.setAttribute("position", new THREE.BufferAttribute(ringPos, 3));
export const ring = new THREE.Points(
  ringGeo,
  new THREE.PointsMaterial({ map: dotTex, color: 0xffe08a, size: 0.16, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
);
ring.frustumCulled = false;

export function updateRing(realDt: number) {
  // Laulurengas (pyörii reaaliajassa, vaikka maailma on hidastettu).
  const ringMat = ring.material as THREE.PointsMaterial;
  ringMat.opacity += ((songState || choosing ? 0.9 : 0) - ringMat.opacity) * (1 - Math.exp(-5 * realDt));
  for (let i = 0; i < ringCount; i++) {
    const a = (i / ringCount) * Math.PI * 2 + g.realTime * 0.8;
    const h = 0.2 + ((i * 0.37 + g.realTime * 0.6) % 1) * 2.0;
    const rr = 1.0 + 0.15 * Math.sin(g.realTime * 3 + i);
    ringPos.set([g.player.pos.x + Math.cos(a) * rr, g.player.pos.y + h, g.player.pos.z + Math.sin(a) * rr], i * 3);
  }
  ringGeo.attributes.position.needsUpdate = true;
}

export function initEffects() {
  scene.add(sparks);

  scene.add(ring);
}
