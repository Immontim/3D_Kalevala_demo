// Jousiammunta ilman Three.js- tai DOM-riippuvuuksia: jännitys, lähtönopeus, nuolen lentorata
// painovoimassa, osumat maahan, esteisiin ja eläimiin sekä nuoliviini. Testattavissa suoraan.

export interface Vec3 { x: number; y: number; z: number }

export const ARCHERY = {
  /** Nuoliviinissä on kohtauksen alussa näin monta nuolta (omistajan päätös 2026-11-21). */
  quiverMax: 15,
  /** Täyteen jännitykseen kuluva aika (s). */
  drawTime: 0.85,
  /** Alle tämän jännityksen laukaisu perutaan: nuoli jää jänteelle. */
  minDraw: 0.25,
  /** Lähtönopeus vajaalla ja täydellä jännityksellä (m/s). Metsästysjousi noin 50 m/s. */
  speedMin: 20,
  speedMax: 52,
  /** Pelillinen painovoima: puolet todellisesta, jotta 20 m:n laukaus putoaa vain noin 0,4 m.
   *  Todellisella 9,81:llä jänis olisi 15 m:stä lähes mahdoton osua ilman harjoittelua. */
  gravity: 4.9,
  /** Uuden nuolen asettaminen jänteelle laukaisun jälkeen (s). */
  reloadTime: 0.55,
  /** Ilmassa oleva nuoli katoaa tämän ajan jälkeen (lentänyt pois kohtauksesta). */
  maxFlight: 6,
  /** Kuinka syvälle nuoli uppoaa osumakohtaan (m); loppuvarsi jää näkyviin. */
  stickDepth: 0.14,
  arrowLength: 0.78,
  /** Ammuttu nuoli: kuinka korkealta sen yltää poimimaan (m sankarin jaloista). */
  pickupReach: 2.2,
  /** Ohi mennyt nuoli kuuluu näin kauas (m): lähellä oleva riista säikähtää. */
  impactLoudness: 5,
  /** Tähtäyksen ja jännityksen aikana sankari kävelee hitaasti. */
  aimMoveScale: 0.45,
  /** Tähtäyskameran näkökenttä (astetta); tavallinen on 55. */
  aimFov: 40,
  /** Tähtäyksen pystykulman rajat (astetta, positiivinen = alas). Tavallinen katse on -18..40. */
  aimPitchMin: -45,
  aimPitchMax: 50,
};

/** Jännitys 0..1 napin pitoajasta. */
export function drawAmount(heldSeconds: number): number {
  return Math.min(1, Math.max(0, heldSeconds / ARCHERY.drawTime));
}

/** Lähtönopeus jännityksestä: lineaarinen vajaan ja täyden välillä. */
export function launchSpeed(draw: number): number {
  const d = Math.min(1, Math.max(0, draw));
  return ARCHERY.speedMin + (ARCHERY.speedMax - ARCHERY.speedMin) * d;
}

/** Lähtönopeusvektori lähtöpisteestä kohti tähtäyspistettä. */
export function launchVelocity(from: Vec3, toward: Vec3, speed: number): Vec3 {
  const dx = toward.x - from.x, dy = toward.y - from.y, dz = toward.z - from.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  return { x: (dx / len) * speed, y: (dy / len) * speed, z: (dz / len) * speed };
}

/** Yksi lentoaskel: tarkka paraabeli (ei ilmanvastusta). Palauttaa uuden paikan ja nopeuden. */
export function stepArrow(p: Vec3, v: Vec3, dt: number, gravity = ARCHERY.gravity): { p: Vec3; v: Vec3 } {
  return {
    p: { x: p.x + v.x * dt, y: p.y + v.y * dt - 0.5 * gravity * dt * dt, z: p.z + v.z * dt },
    v: { x: v.x, y: v.y - gravity * dt, z: v.z },
  };
}

/** Kuinka paljon vaakasuoraan ammuttu nuoli putoaa matkalla `distance` (m). Tähtäämisen nyrkkisääntö. */
export function dropAt(speed: number, distance: number, gravity = ARCHERY.gravity): number {
  const t = distance / speed;
  return 0.5 * gravity * t * t;
}

/** Janan ensimmäinen kohta pallon sisällä (osuus 0..1), tai null. Alku pallon sisällä = 0. */
export function segmentSphere(p0: Vec3, p1: Vec3, c: Vec3, radius: number): number | null {
  const dx = p1.x - p0.x, dy = p1.y - p0.y, dz = p1.z - p0.z;
  const fx = p0.x - c.x, fy = p0.y - c.y, fz = p0.z - c.z;
  const cc = fx * fx + fy * fy + fz * fz - radius * radius;
  if (cc <= 0) return 0;
  const a = dx * dx + dy * dy + dz * dz;
  if (a < 1e-12) return null;
  const b = 2 * (fx * dx + fy * dy + fz * dz);
  const disc = b * b - 4 * a * cc;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

/** Osuttava eläin: pallo, jonka keskipiste on maailmassa. */
export interface ArrowBody { id: string; x: number; y: number; z: number; radius: number }

export interface ArrowTraceWorld {
  groundAt(x: number, z: number): number;
  /** Kiinteä este (puu, kivi, rakennus) janalla: CollisionWorld.firstProjectileHit. */
  staticHit(p0: Vec3, p1: Vec3): { t: number; id: string } | null;
  bodies: readonly ArrowBody[];
}

export type ArrowHitKind = "ground" | "static" | "body";
export interface ArrowHit extends Vec3 { kind: ArrowHitKind; t: number; id?: string }

const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });

/** Ensimmäinen kohta, jossa jana painuu maan alle (osuus), tai null. Näytteet 0,25 m välein + puolitus. */
export function groundCrossing(p0: Vec3, p1: Vec3, groundAt: (x: number, z: number) => number): number | null {
  const below = (t: number) => { const p = lerp3(p0, p1, t); return p.y - groundAt(p.x, p.z); };
  if (below(0) <= 0) return 0;
  const steps = Math.max(1, Math.ceil(Math.hypot(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z) / 0.25));
  let prev = 0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (below(t) > 0) { prev = t; continue; }
    let lo = prev, hi = t;
    for (let k = 0; k < 8; k++) {
      const mid = (lo + hi) / 2;
      if (below(mid) > 0) lo = mid; else hi = mid;
    }
    return hi;
  }
  return null;
}

/** Janan ensimmäinen osuma: maa, kiinteä este tai eläin. Sama laskenta tähtäyssäteelle ja nuolelle. */
export function traceSegment(p0: Vec3, p1: Vec3, world: ArrowTraceWorld): ArrowHit | null {
  let best: ArrowHit | null = null;
  const consider = (kind: ArrowHitKind, t: number | null, id?: string) => {
    if (t === null || (best && t >= best.t)) return;
    best = { kind, t, ...lerp3(p0, p1, t), ...(id === undefined ? {} : { id }) };
  };
  consider("ground", groundCrossing(p0, p1, world.groundAt));
  const s = world.staticHit(p0, p1);
  if (s) consider("static", s.t, s.id);
  for (const b of world.bodies) consider("body", segmentSphere(p0, p1, b, b.radius), b.id);
  return best;
}

/** Nuoliviini: kohtauskohtainen resurssi. Täyteen viiniin ei mahdu poimittua nuolta. */
export interface Quiver { arrows: number; max: number }
export function newQuiver(max = ARCHERY.quiverMax): Quiver { return { arrows: max, max }; }
export function takeArrow(q: Quiver): boolean {
  if (q.arrows <= 0) return false;
  q.arrows--;
  return true;
}
export function returnArrow(q: Quiver): boolean {
  if (q.arrows >= q.max) return false;
  q.arrows++;
  return true;
}
