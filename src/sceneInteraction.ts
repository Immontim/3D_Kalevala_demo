/** Puhdas 3D-katsevalinta. Ei DOM- tai Three.js-riippuvuuksia, jotta kohdistus voidaan testata. */

export const ITEM_TAKE_RANGE = 2.8;
export const GAZE_ORIGIN_HEIGHT = 1.42;
export const GAZE_MARKER_DISTANCE = 3.2;

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export interface GazeTarget extends Point3 {
  id: string;
  /** Tarkoituksella mallia suurempi kohdistussäde metreinä. */
  radius: number;
}

export function gazeDirection(yaw: number, pitch: number): Point3 {
  const flat = Math.cos(pitch);
  return {
    x: Math.sin(yaw) * flat,
    // Positiivinen aim.pitch nostaa olkapääkameraa ja tarkoittaa katsetta alaviistoon.
    y: -Math.sin(pitch),
    z: Math.cos(yaw) * flat,
  };
}

export function gazeOrigin(hero: Point3): Point3 {
  return { x: hero.x, y: hero.y + GAZE_ORIGIN_HEIGHT, z: hero.z };
}

export function pointOnGaze(origin: Point3, direction: Point3, distance = GAZE_MARKER_DISTANCE): Point3 {
  return {
    x: origin.x + direction.x * distance,
    y: origin.y + direction.y * distance,
    z: origin.z + direction.z * distance,
  };
}

/**
 * Valitsee katseakselia lähimpänä olevan kohteen. Kantama mitataan sankarin paikan ja
 * esineen kohdistuspisteen väliltä; näin olkapääkamera ei lyhennä tartuntaetäisyyttä.
 */
export function pickGazeTarget<T extends GazeTarget>(
  hero: Point3,
  yaw: number,
  pitch: number,
  targets: readonly T[],
  maxRange = ITEM_TAKE_RANGE,
): T | null {
  const origin = gazeOrigin(hero);
  const dir = gazeDirection(yaw, pitch);
  let best: T | null = null;
  let bestScore = Infinity;

  for (const target of targets) {
    const hx = target.x - hero.x, hz = target.z - hero.z;
    // Tartuntaetäisyys on maan tasossa kuten liike ja nykyinen puhekohdistus. Pöydän
    // korkeus ei saa viedä muuten lähellä olevaa ruokaa kantaman ulkopuolelle.
    if (Math.hypot(hx, hz) > maxRange) continue;
    const dx = target.x - origin.x, dy = target.y - origin.y, dz = target.z - origin.z;
    const along = dx * dir.x + dy * dir.y + dz * dir.z;
    if (along <= 0) continue;
    const d2 = dx * dx + dy * dy + dz * dz;
    const perpendicular = Math.sqrt(Math.max(0, d2 - along * along));
    if (perpendicular > target.radius) continue;
    // Kulmapoikkeama ratkaisee ensin; tasatilanteessa lähempi kohde voittaa.
    const score = perpendicular / Math.max(0.05, along) + along * 1e-4;
    if (score < bestScore) { best = target; bestScore = score; }
  }
  return best;
}
