// Kevyt 2,5D-törmäyslaskenta. Kaikki muodot ovat maan XZ-tasossa; world.ts
// huolehtii erikseen maaston korkeudesta. Moduulissa ei ole Three.js-riippuvuutta,
// jotta liike, esteet, eläimet ja testit voivat käyttää samaa laskentaa.

export const COLLISION = {
  actorRadius: 0.5,
  /** Pitkätkin väistö- ja työntöliikkeet jaetaan näin lyhyisiin osiin. */
  maxStep: 0.18,
  solvePasses: 5,
  fireCoreRadius: 0.55,
  fireHazardRadius: 0.9,
  fireDamagePerSecond: 10,
  fireFeedbackGap: 0.45,
};

export type CollisionResponse = "slide" | "stop";

interface ColliderBase {
  id: string;
  /** Voiko hahmo kulkea kohteen läpi. */
  blocksMovement: boolean;
  /** Pysäyttääkö kohde lähitaisteluiskun ennen vastustajaa. */
  blocksMelee: boolean;
}

export interface CircleCollider extends ColliderBase {
  kind: "circle";
  x: number;
  z: number;
  radius: number;
}

export interface BoxCollider extends ColliderBase {
  kind: "box";
  x: number;
  z: number;
  yaw: number;
  halfX: number;
  halfZ: number;
}

export type StaticCollider = CircleCollider | BoxCollider;

export interface HazardZone {
  id: string;
  kind: "circle";
  x: number;
  z: number;
  radius: number;
  damagePerSecond: number;
}

export interface MoveResult {
  x: number;
  z: number;
  hit: StaticCollider | null;
}

export interface SegmentHit {
  collider: StaticCollider;
  x: number;
  z: number;
  /** Osuus janasta 0..1. */
  t: number;
}

interface PushOut { x: number; z: number; depth: number; }

const GRID_SIZE = 3;
const EPS = 1e-6;

function gridKey(x: number, z: number) { return `${x},${z}`; }

function bounds(c: StaticCollider) {
  if (c.kind === "circle") return { minX: c.x - c.radius, maxX: c.x + c.radius, minZ: c.z - c.radius, maxZ: c.z + c.radius };
  const s = Math.abs(Math.sin(c.yaw)), co = Math.abs(Math.cos(c.yaw));
  const ex = co * c.halfX + s * c.halfZ;
  const ez = s * c.halfX + co * c.halfZ;
  return { minX: c.x - ex, maxX: c.x + ex, minZ: c.z - ez, maxZ: c.z + ez };
}

function discPushOut(x: number, z: number, radius: number, c: StaticCollider): PushOut | null {
  if (c.kind === "circle") {
    const dx = x - c.x, dz = z - c.z;
    const min = radius + c.radius;
    const d2 = dx * dx + dz * dz;
    if (d2 >= min * min) return null;
    if (d2 <= EPS) return { x: 1, z: 0, depth: min };
    const d = Math.sqrt(d2);
    return { x: dx / d, z: dz / d, depth: min - d };
  }

  const sin = Math.sin(c.yaw), cos = Math.cos(c.yaw);
  const dx = x - c.x, dz = z - c.z;
  const lx = dx * cos - dz * sin;
  const lz = dx * sin + dz * cos;
  const qx = Math.max(-c.halfX, Math.min(c.halfX, lx));
  const qz = Math.max(-c.halfZ, Math.min(c.halfZ, lz));
  const ox = lx - qx, oz = lz - qz;
  const d2 = ox * ox + oz * oz;
  if (d2 > EPS) {
    if (d2 >= radius * radius) return null;
    const d = Math.sqrt(d2);
    const nx = ox / d, nz = oz / d;
    return { x: nx * cos + nz * sin, z: -nx * sin + nz * cos, depth: radius - d };
  }

  // Keskipiste on laatikon sisällä: poistutaan lyhintä sivua kohti ja jätetään
  // hahmon säteen verran tilaa myös laatikon ulkopuolelle.
  const toX = c.halfX - Math.abs(lx);
  const toZ = c.halfZ - Math.abs(lz);
  let nx = 0, nz = 0, depth: number;
  if (toX < toZ) { nx = lx < 0 ? -1 : 1; depth = toX + radius; }
  else { nz = lz < 0 ? -1 : 1; depth = toZ + radius; }
  return { x: nx * cos + nz * sin, z: -nx * sin + nz * cos, depth };
}

function segmentCircle(x0: number, z0: number, x1: number, z1: number, c: CircleCollider): number | null {
  const dx = x1 - x0, dz = z1 - z0;
  const fx = x0 - c.x, fz = z0 - c.z;
  const a = dx * dx + dz * dz;
  if (a <= EPS) return null;
  const b = 2 * (fx * dx + fz * dz);
  const cc = fx * fx + fz * fz - c.radius * c.radius;
  const disc = b * b - 4 * a * cc;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const t0 = (-b - root) / (2 * a), t1 = (-b + root) / (2 * a);
  if (t0 >= EPS && t0 <= 1 - EPS) return t0;
  if (t1 >= EPS && t1 <= 1 - EPS) return t1;
  return null;
}

function segmentBox(x0: number, z0: number, x1: number, z1: number, c: BoxCollider): number | null {
  const sin = Math.sin(c.yaw), cos = Math.cos(c.yaw);
  const local = (x: number, z: number) => {
    const dx = x - c.x, dz = z - c.z;
    return { x: dx * cos - dz * sin, z: dx * sin + dz * cos };
  };
  const a = local(x0, z0), b = local(x1, z1);
  const dx = b.x - a.x, dz = b.z - a.z;
  let lo = 0, hi = 1;
  for (const [p, d, half] of [[a.x, dx, c.halfX], [a.z, dz, c.halfZ]] as const) {
    if (Math.abs(d) <= EPS) {
      if (p < -half || p > half) return null;
      continue;
    }
    let t0 = (-half - p) / d, t1 = (half - p) / d;
    if (t0 > t1) [t0, t1] = [t1, t0];
    lo = Math.max(lo, t0);
    hi = Math.min(hi, t1);
    if (lo > hi) return null;
  }
  return lo >= EPS && lo <= 1 - EPS ? lo : hi >= EPS && hi <= 1 - EPS ? hi : null;
}

export class CollisionWorld {
  private colliders: StaticCollider[] = [];
  private hazards: HazardZone[] = [];
  private grid = new Map<string, number[]>();

  add(collider: StaticCollider) {
    const index = this.colliders.length;
    this.colliders.push(collider);
    const b = bounds(collider);
    for (let gx = Math.floor(b.minX / GRID_SIZE); gx <= Math.floor(b.maxX / GRID_SIZE); gx++) {
      for (let gz = Math.floor(b.minZ / GRID_SIZE); gz <= Math.floor(b.maxZ / GRID_SIZE); gz++) {
        const key = gridKey(gx, gz);
        const cell = this.grid.get(key) ?? [];
        if (!this.grid.has(key)) this.grid.set(key, cell);
        cell.push(index);
      }
    }
    return collider;
  }

  addHazard(zone: HazardZone) { this.hazards.push(zone); return zone; }

  /** Poistaa esteen käytöstä (ei liiku- eikä lyöntiestettä); ruudukon indeksit säilyvät ehjinä. */
  disable(id: string): boolean {
    const found = this.colliders.find((c) => c.id === id);
    if (!found) return false;
    found.blocksMovement = false;
    found.blocksMelee = false;
    return true;
  }

  private nearby(x: number, z: number, radius: number, movementOnly = false) {
    const found = new Set<number>();
    for (let gx = Math.floor((x - radius) / GRID_SIZE); gx <= Math.floor((x + radius) / GRID_SIZE); gx++) {
      for (let gz = Math.floor((z - radius) / GRID_SIZE); gz <= Math.floor((z + radius) / GRID_SIZE); gz++) {
        for (const i of this.grid.get(gridKey(gx, gz)) ?? []) found.add(i);
      }
    }
    const all = [...found].map((i) => this.colliders[i]);
    return movementOnly ? all.filter((c) => c.blocksMovement) : all;
  }

  depenetrateDisc(x: number, z: number, radius: number): MoveResult {
    let hit: StaticCollider | null = null;
    for (let pass = 0; pass < COLLISION.solvePasses; pass++) {
      let changed = false;
      for (const c of this.nearby(x, z, radius + GRID_SIZE, true)) {
        const push = discPushOut(x, z, radius, c);
        if (!push || push.depth <= EPS) continue;
        x += push.x * (push.depth + EPS);
        z += push.z * (push.depth + EPS);
        hit ??= c;
        changed = true;
      }
      if (!changed) break;
    }
    return { x, z, hit };
  }

  moveDisc(x: number, z: number, dx: number, dz: number, radius: number, response: CollisionResponse = "slide"): MoveResult {
    const distance = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(distance / COLLISION.maxStep));
    const sx = dx / steps, sz = dz / steps;
    let hit: StaticCollider | null = null;
    for (let i = 0; i < steps; i++) {
      const nx = x + sx, nz = z + sz;
      const solved = this.depenetrateDisc(nx, nz, radius);
      if (solved.hit) {
        hit ??= solved.hit;
        if (response === "stop") break;
      }
      x = solved.x;
      z = solved.z;
    }
    return { x, z, hit };
  }

  firstMeleeHit(x0: number, z0: number, x1: number, z1: number): SegmentHit | null {
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    const radius = Math.hypot(x1 - x0, z1 - z0) / 2 + GRID_SIZE;
    let best: SegmentHit | null = null;
    for (const c of this.nearby(mx, mz, radius)) {
      if (!c.blocksMelee) continue;
      const t = c.kind === "circle" ? segmentCircle(x0, z0, x1, z1, c) : segmentBox(x0, z0, x1, z1, c);
      if (t === null || (best && t >= best.t)) continue;
      best = { collider: c, x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, t };
    }
    return best;
  }

  hazardsAt(x: number, z: number, radius: number): HazardZone[] {
    return this.hazards.filter((h) => Math.hypot(x - h.x, z - h.z) < radius + h.radius);
  }

  stats() { return { colliders: this.colliders.length, hazards: this.hazards.length }; }
}

/** Yleinen dynaamisten ympyrävartaloiden erotus, jota myös tulevat eläimet voivat käyttää. */
export interface DiscBody { x: number; z: number; radius: number; immovable?: boolean; }

export function separateDiscBodies(a: DiscBody, b: DiscBody) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const min = a.radius + b.radius;
  const d2 = dx * dx + dz * dz;
  if (d2 >= min * min || (a.immovable && b.immovable)) return false;
  const d = d2 > EPS ? Math.sqrt(d2) : 0;
  const nx = d > EPS ? dx / d : 1, nz = d > EPS ? dz / d : 0;
  const overlap = min - d;
  const aShare = b.immovable ? 1 : a.immovable ? 0 : 0.5;
  const bShare = a.immovable ? 1 : b.immovable ? 0 : 0.5;
  a.x -= nx * overlap * aShare;
  a.z -= nz * overlap * aShare;
  b.x += nx * overlap * bShare;
  b.z += nz * overlap * bShare;
  return true;
}
