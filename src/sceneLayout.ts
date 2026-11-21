// Kohtausten kuljettava alue ja polunsuut (poistumiset) datana. Puhdas moduuli: ei Three.js:ää eikä DOM:ia,
// joten geometria voidaan testata ilman 3D-maailmaa.
import type { SceneId } from "./app/route";

export interface Vec2 { x: number; z: number }
/** Karttasuunta. Konventio 3D:ssä: -z = pohjoinen, +x = itä (data voi silti asettaa minkä tahansa). */
export type MapDir = "n" | "e" | "s" | "w";
export const MAP_DIRS: readonly MapDir[] = ["n", "e", "s", "w"];

export interface SceneExit {
  id: string;
  /** Polunsuun "portin" keskipiste rajalla. */
  x: number; z: number;
  /** Suunta ulos kohtauksesta (yaw: 0 = +z, π/2 = +x). */
  yaw: number;
  /** Polun leveys (m). */
  width: number;
  mapDir: MapDir | null;
}

export interface SceneLayout {
  /** Kuljettava alue monikulmiona (kumpi tahansa kiertosuunta). */
  bounds: Vec2[];
  /** Taistelun keskus ja säde (vihollisten tulopaikat). */
  arena: { x: number; z: number; radius: number };
  exits: SceneExit[];
}

/** Käytävä ulottuu portista näin monta metriä sisään- ja ulospäin. */
export const EXIT_CORRIDOR_IN = 5;
export const EXIT_CORRIDOR_OUT = 4;
/** Portin linjan ylitys tämän verran riittää poistumiseksi. */
export const EXIT_CROSS_MARGIN = 0.3;

export function circlePolygon(cx: number, cz: number, radius: number, segments = 48): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    out.push({ x: cx + Math.sin(a) * radius, z: cz + Math.cos(a) * radius });
  }
  return out;
}

/** Portti kehällä origon ympärillä. Kulma asteina: 0 = +z, 90 = +x. Yaw osoittaa ulospäin. */
export function ringExit(id: string, aDeg: number, radius: number, width: number, mapDir: MapDir | null): SceneExit {
  const a = (aDeg * Math.PI) / 180;
  return { id, x: Math.sin(a) * radius, z: Math.cos(a) * radius, yaw: a, width, mapDir };
}

function outDir(e: SceneExit): Vec2 { return { x: Math.sin(e.yaw), z: Math.cos(e.yaw) }; }

// ---------- Geometria ----------

interface EdgeHit { depth: number; qx: number; qz: number; nx: number; nz: number }

/** Lähin reunapiste monikulmiolle ja etumerkillinen syvyys (positiivinen sisällä). */
function polygonProbe(poly: Vec2[], x: number, z: number): EdgeHit {
  let inside = false;
  let best = Infinity, qx = x, qz = z;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j], b = poly[i];
    if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
    const ex = b.x - a.x, ez = b.z - a.z;
    const len2 = ex * ex + ez * ez;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - a.x) * ex + (z - a.z) * ez) / len2)) : 0;
    const px = a.x + ex * t, pz = a.z + ez * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < best) { best = d; qx = px; qz = pz; }
  }
  // Suunta reunalta sisäänpäin: sisäpisteelle pisteen suuntaan, ulkopisteelle reunaa kohti.
  let nx = inside ? x - qx : qx - x, nz = inside ? z - qz : qz - z;
  const nl = Math.hypot(nx, nz);
  if (nl > 1e-9) { nx /= nl; nz /= nl; } else { nx = 0; nz = 0; }
  return { depth: inside ? best : -best, qx, qz, nx, nz };
}

interface Rect { cx: number; cz: number; ux: number; uz: number; u0: number; u1: number; hw: number }

function exitRect(e: SceneExit): Rect {
  const o = outDir(e);
  return { cx: e.x, cz: e.z, ux: o.x, uz: o.z, u0: -EXIT_CORRIDOR_IN, u1: EXIT_CORRIDOR_OUT, hw: e.width / 2 };
}

function rectLocal(r: Rect, x: number, z: number) {
  const dx = x - r.cx, dz = z - r.cz;
  // v-akseli = (uz, -ux)
  return { u: dx * r.ux + dz * r.uz, v: dx * r.uz - dz * r.ux };
}

function rectDepth(r: Rect, x: number, z: number): number {
  const { u, v } = rectLocal(r, x, z);
  return Math.min(u - r.u0, r.u1 - u, r.hw - Math.abs(v));
}

function rectClamp(r: Rect, x: number, z: number, radius: number): Vec2 {
  const { u, v } = rectLocal(r, x, z);
  const clampAxis = (val: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, val)));
  const cu = clampAxis(u, r.u0 + radius, r.u1 - radius);
  const cv = clampAxis(v, -(r.hw - radius), r.hw - radius);
  return { x: r.cx + cu * r.ux + cv * r.uz, z: r.cz + cu * r.uz - cv * r.ux };
}

/**
 * Pitää annetun säteisen kiekon kuljettavalla alueella (bounds tai jokin poistumiskäytävä).
 * Valitsee muodon, jonka sisällä piste on syvimmällä, ja työntää pisteen siinä `radius` verran reunasta sisään.
 */
export function clampToWalkable(layout: SceneLayout, x: number, z: number, radius: number): Vec2 {
  // Kulmissa yksi työntö jättää kiekon vielä osin ulos, joten toistetaan muutaman kierroksen ajan.
  for (let pass = 0; pass < 4; pass++) {
    const poly = polygonProbe(layout.bounds, x, z);
    let bestDepth = poly.depth;
    let bestRect: Rect | null = null;
    for (const e of layout.exits) {
      const r = exitRect(e);
      const d = rectDepth(r, x, z);
      if (d > bestDepth) { bestDepth = d; bestRect = r; }
    }
    if (bestDepth >= radius - 1e-6) break;
    if (bestRect) ({ x, z } = rectClamp(bestRect, x, z, radius));
    else if (poly.nx === 0 && poly.nz === 0) { x = poly.qx; z = poly.qz; }
    else { x = poly.qx + poly.nx * radius; z = poly.qz + poly.nz * radius; }
  }
  return { x, z };
}

/** Kuljettavan alueen syvyys pisteessä (positiivinen = sisällä). Testejä ja vihjeitä varten. */
export function walkableDepth(layout: SceneLayout, x: number, z: number): number {
  let d = polygonProbe(layout.bounds, x, z).depth;
  for (const e of layout.exits) d = Math.max(d, rectDepth(exitRect(e), x, z));
  return d;
}

/** Piste on portin linjan takana (yli 0,3 m) ja sivusuunnassa polun leveyden sisällä. */
export function exitCrossed(layout: SceneLayout, x: number, z: number): SceneExit | null {
  for (const e of layout.exits) {
    const o = outDir(e);
    const dx = x - e.x, dz = z - e.z;
    const along = dx * o.x + dz * o.z;
    const side = dx * o.z - dz * o.x;
    if (along > EXIT_CROSS_MARGIN && Math.abs(side) <= e.width / 2) return e;
  }
  return null;
}

export function nearestExit(layout: SceneLayout, x: number, z: number): { exit: SceneExit; distance: number } | null {
  let best: { exit: SceneExit; distance: number } | null = null;
  for (const e of layout.exits) {
    const distance = Math.hypot(x - e.x, z - e.z);
    if (!best || distance < best.distance) best = { exit: e, distance };
  }
  return best;
}

// ---------- Data ----------

const R = 11;
function circleScene(exit: SceneExit): SceneLayout {
  return { bounds: circlePolygon(0, 0, R), arena: { x: 0, z: 0, radius: R }, exits: [exit] };
}

/**
 * Korpi: epäsäännöllinen, suunnilleen neliö (±97 m, mahtuu 200 × 200 m:iin). Reuna kiertää myötäpäivään
 * luoteiskulmasta; kiinteä heilahtelu (sisäänpäin 0–4 m) on kovakoodattu, ei satunnaista. Polunsuiden
 * portit ovat kärkipisteinä suoraan reunalla.
 */
const WILDS_BOUNDS: Vec2[] = [
  // pohjoinen (länsi -> itä)
  { x: -94, z: -94 }, { x: -70, z: -95.5 }, { x: -45, z: -93 }, { x: -20, z: -96.5 },
  { x: 4, z: -97 }, { x: 14, z: -97 }, { x: 24, z: -97 }, { x: 50, z: -94 }, { x: 75, z: -96 },
  { x: 95, z: -95 },
  // itä (pohjoinen -> etelä)
  { x: 96, z: -70 }, { x: 93, z: -45 }, { x: 95, z: -15 }, { x: 97, z: 8 }, { x: 97, z: 18 }, { x: 97, z: 28 },
  { x: 94, z: 50 }, { x: 96, z: 75 }, { x: 94, z: 94 },
  // etelä (itä -> länsi)
  { x: 70, z: 96 }, { x: 45, z: 93.5 }, { x: 10, z: 96.5 }, { x: -26, z: 97 }, { x: -36, z: 97 },
  { x: -46, z: 97 }, { x: -65, z: 94 }, { x: -80, z: 96 }, { x: -95, z: 95 },
  // länsi (etelä -> pohjoinen)
  { x: -93, z: 70 }, { x: -96, z: 45 }, { x: -94, z: 20 }, { x: -97, z: 0 }, { x: -95, z: -30 }, { x: -96, z: -60 },
];

export const SCENE_LAYOUTS: Record<SceneId, SceneLayout> = {
  clearing: circleScene(ringExit("south", 200, 11.4, 2.6, "s")),
  homestead: circleScene(ringExit("gate", 0, 13.4, 2.4, "s")),
  yard: circleScene(ringExit("gate", 0, 13.4, 2.4, "s")),
  lakeside: circleScene(ringExit("path", 205, 11.4, 2.4, "n")),
  lakeruin: circleScene(ringExit("path", 205, 11.4, 2.4, "n")),
  cairnfield: circleScene(ringExit("path", 180, 11.4, 2.4, "n")),
  wilds: {
    bounds: WILDS_BOUNDS,
    arena: { x: 0, z: 0, radius: 14 },
    exits: [
      { id: "north", x: 14, z: -97, yaw: Math.PI, width: 3, mapDir: "n" },
      { id: "east", x: 97, z: 18, yaw: Math.PI / 2, width: 3, mapDir: "e" },
      { id: "south", x: -36, z: 97, yaw: 0, width: 3, mapDir: "s" },
    ],
  },
};

export function sceneLayout(id: SceneId): SceneLayout {
  return SCENE_LAYOUTS[id];
}
