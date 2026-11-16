/**
 * Vapaan kameran liike (tauon tarkastelutila). Puhdas laskenta ilman Three.js:ää, jotta se on testattavissa.
 * Kamera katsoo suuntaan (yaw, pitch) kuten Three.js:n Euler(pitch, yaw, 0, "YXZ"): yaw 0 katsoo -Z:aan.
 */
export interface FreeCam { x: number; y: number; z: number; yaw: number; pitch: number; speed: number }

export const FREECAM = {
  /** Liikenopeus (m/s) rajoineen; rulla muuttaa sitä. Vaihto (Shift) kertoo nopeuden. */
  minSpeed: 0.25, maxSpeed: 40, defaultSpeed: 3, boost: 3.5, wheelStep: 1.12,
  pitchMax: 1.55, lookSens: 0.0022,
};

export const FREECAM_KEYS = {
  forward: "KeyW", back: "KeyS", left: "KeyA", right: "KeyD", up: "KeyE", down: "KeyQ",
  boost: ["ShiftLeft", "ShiftRight"],
} as const;

/** Katseen suuntavektori. */
export function freeCamForward(c: Pick<FreeCam, "yaw" | "pitch">) {
  const cp = Math.cos(c.pitch);
  return { x: -Math.sin(c.yaw) * cp, y: Math.sin(c.pitch), z: -Math.cos(c.yaw) * cp };
}

/** Kameran oikea puoli (vaakasuora). */
export function freeCamRight(c: Pick<FreeCam, "yaw">) {
  return { x: Math.cos(c.yaw), y: 0, z: -Math.sin(c.yaw) };
}

/** Siirtää kameraa dt sekuntia painettujen näppäinten mukaan: W/S eteen ja taakse katseen suuntaan, A/D sivulle, E/Q ylös ja alas. */
export function stepFreeCam(c: FreeCam, down: (code: string) => boolean, dt: number) {
  const axis = (pos: string, neg: string) => (down(pos) ? 1 : 0) - (down(neg) ? 1 : 0);
  const f = axis(FREECAM_KEYS.forward, FREECAM_KEYS.back);
  const r = axis(FREECAM_KEYS.right, FREECAM_KEYS.left);
  const u = axis(FREECAM_KEYS.up, FREECAM_KEYS.down);
  if (!f && !r && !u) return;
  const fast = FREECAM_KEYS.boost.some(down) ? FREECAM.boost : 1;
  const d = c.speed * fast * dt;
  const fw = freeCamForward(c), rt = freeCamRight(c);
  const len = Math.hypot(f, r, u);
  c.x += ((fw.x * f + rt.x * r) * d) / len;
  c.y += ((fw.y * f + u) * d) / len;
  c.z += ((fw.z * f + rt.z * r) * d) / len;
}

/** Hiiren liike (pikseleinä) kääntää katsetta; pystykulma rajataan, ettei kamera kierry ympäri. */
export function lookFreeCam(c: FreeCam, dx: number, dy: number) {
  c.yaw -= dx * FREECAM.lookSens;
  c.pitch = Math.max(-FREECAM.pitchMax, Math.min(FREECAM.pitchMax, c.pitch - dy * FREECAM.lookSens));
}

/** Rulla muuttaa liikenopeutta (ylös = nopeammin). */
export function scaleFreeCamSpeed(c: FreeCam, wheelDeltaY: number) {
  const k = wheelDeltaY < 0 ? FREECAM.wheelStep : 1 / FREECAM.wheelStep;
  c.speed = Math.max(FREECAM.minSpeed, Math.min(FREECAM.maxSpeed, c.speed * k));
}
