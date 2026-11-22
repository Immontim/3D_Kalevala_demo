// Erämaan taustalinnut: puhdas tilakone ja lentoradat (ei Three.js:ää eikä DOMia).
// Linnut ovat pelkkää liikettä metsässä: ne istuvat oikeiden puiden oksilla ja latvoissa, lentävät
// kaarena puusta puuhun tai maahan, tepastelevat ja nokkivat maassa ja lehahtavat puuhun, kun sankari
// tulee liian lähelle. Ne eivät ole riistaa. Parvi pysyy sankarin ympärillä: kauas jäänyt lintu siirretään
// näkymättömästi uuteen puuhun sankarin lähelle.

export type SpeciesId = "peippo" | "rastas" | "korppi";

export interface SpeciesTuning {
  /** Montako parvessa on. */
  count: number;
  /** Linnun pituus nokasta pyrstöön (m). */
  length: number;
  /** Lentonopeus (m/s). */
  flySpeed: number;
  /** Maassa liikkumisen nopeus (m/s). */
  walkSpeed: number;
  /** Hyppiikö maassa (varpuslinnut) vai käveleekö (korppi). */
  hops: boolean;
  /** Sankarin etäisyys, jolta maassa oleva lintu lehahtaa puuhun (m). */
  fleeDist: number;
  /** Todennäköisyys lentää maahan, kun lintu lähtee puusta. */
  groundChance: number;
  /** Todennäköisyys valita latva oksan sijaan. */
  topChance: number;
  perchTime: readonly [number, number];
  groundTime: readonly [number, number];
  /** Lennon pituus puusta puuhun (m). */
  flight: readonly [number, number];
  /** Siiveniskut: taajuus (Hz), iskujakso ja liitojakso (s), iskun laajuus (rad). */
  flapHz: number;
  flapOn: number;
  flapOff: number;
  flapAmp: number;
  /** Liidossa siivet: 1 = suppuun (peipon aaltoileva lento), 0 = levällään (korpin liito). */
  glideFold: number;
  /** Nokkimisen tahti (rad/s). */
  peckRate: number;
}

export const BIRD_SPECIES: Record<SpeciesId, SpeciesTuning> = {
  peippo: {
    count: 9, length: 0.15, flySpeed: 7, walkSpeed: 0.5, hops: true, fleeDist: 6,
    groundChance: 0.5, topChance: 0.15, perchTime: [3, 14], groundTime: [5, 16], flight: [5, 22],
    flapHz: 15, flapOn: 0.32, flapOff: 0.2, flapAmp: 1.0, glideFold: 1, peckRate: 10,
  },
  rastas: {
    count: 4, length: 0.23, flySpeed: 8, walkSpeed: 0.9, hops: true, fleeDist: 7,
    groundChance: 0.65, topChance: 0.3, perchTime: [4, 16], groundTime: [6, 20], flight: [6, 26],
    flapHz: 10, flapOn: 0.55, flapOff: 0.15, flapAmp: 0.9, glideFold: 0.6, peckRate: 8,
  },
  korppi: {
    count: 3, length: 0.62, flySpeed: 9, walkSpeed: 0.7, hops: false, fleeDist: 9,
    groundChance: 0.3, topChance: 0.85, perchTime: [6, 22], groundTime: [6, 18], flight: [10, 40],
    flapHz: 3.2, flapOn: 1.3, flapOff: 1.2, flapAmp: 0.6, glideFold: 0, peckRate: 5,
  },
};

export const BIRD_FLOCK = {
  /** Parvi pyrkii pysymään näin lähellä sankaria (m). */
  keepNear: 45,
  /** Tätä kauempana istuva tai maassa oleva lintu siirretään sankarin lähelle (m). */
  relocateBeyond: 70,
  /** Siirron ja alkusijoittelun kehä sankarista (m). */
  relocateRing: [32, 52] as const,
  spawnRing: [6, 50] as const,
  /** Osuus linnuista, jotka aloittavat maasta. */
  spawnGround: 0.3,
  /** Maassa olevan linnun tepastelualueen säde laskeutumispaikasta (m). */
  groundWander: 1.8,
  /** Puun alaoksalla istuva lintu lähtee, jos sankari tulee näin lähelle vaakasuunnassa (m)… */
  lowPerchFlee: 2.5,
  /** …ja oksa on enintään näin korkealla maasta (m). */
  lowPerchHeight: 3.5,
  /** Lennon aikana lintu pysyy vähintään näin korkealla maan yllä (m, ei lähtö- ja laskeutumishetkellä). */
  flightClearance: 0.5,
  /** Hypyn korkeus (m, kerrotaan lajin pituudella / 0.15). */
  hopHeight: 0.025,
} as const;

export type BirdState = "perch" | "fly" | "ground";

/** Ympäristö: maan korkeus ja onko maassa vapaata (ei kiveä, runkoa eikä kulkualueen ulkopuolta). */
export interface BirdEnv {
  ground(x: number, z: number): number;
  groundFree(x: number, z: number): boolean;
}

/** Puiden istumapaikat litteänä taulukkona: x, y, z, laji (0 oksa, 1 latva) per paikka. */
export class PerchSet {
  readonly count: number;
  private grid = new Map<number, number[]>();
  private static CELL = 10;

  constructor(readonly data: Float32Array) {
    this.count = Math.floor(data.length / 4);
    for (let i = 0; i < this.count; i++) {
      const key = PerchSet.key(Math.floor(data[i * 4] / PerchSet.CELL), Math.floor(data[i * 4 + 2] / PerchSet.CELL));
      let cell = this.grid.get(key);
      if (!cell) this.grid.set(key, (cell = []));
      cell.push(i);
    }
  }

  private static key(gx: number, gz: number) { return (gx + 2048) * 4096 + (gz + 2048); }

  x(i: number) { return this.data[i * 4]; }
  y(i: number) { return this.data[i * 4 + 1]; }
  z(i: number) { return this.data[i * 4 + 2]; }
  isTop(i: number) { return this.data[i * 4 + 3] > 0.5; }

  /** Istumapaikat vaakaetäisyydellä [rMin, rMax] pisteestä. */
  candidates(x: number, z: number, rMin: number, rMax: number): number[] {
    const out: number[] = [];
    const c = PerchSet.CELL;
    const r2min = rMin * rMin, r2max = rMax * rMax;
    for (let gx = Math.floor((x - rMax) / c); gx <= Math.floor((x + rMax) / c); gx++) {
      for (let gz = Math.floor((z - rMax) / c); gz <= Math.floor((z + rMax) / c); gz++) {
        for (const i of this.grid.get(PerchSet.key(gx, gz)) ?? []) {
          const dx = this.data[i * 4] - x, dz = this.data[i * 4 + 2] - z, d2 = dx * dx + dz * dz;
          if (d2 >= r2min && d2 <= r2max) out.push(i);
        }
      }
    }
    return out;
  }
}

export interface Vec3 { x: number; y: number; z: number }

/** Kuutiollinen Bézier-lentorata: p0 lähtö, p3 määränpää. */
export interface FlightPath { p0: Vec3; p1: Vec3; p2: Vec3; p3: Vec3; dur: number }

export function bezier(path: FlightPath, t: number, out: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
  const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  out.x = a * path.p0.x + b * path.p1.x + c * path.p2.x + d * path.p3.x;
  out.y = a * path.p0.y + b * path.p1.y + c * path.p2.y + d * path.p3.y;
  out.z = a * path.p0.z + b * path.p1.z + c * path.p2.z + d * path.p3.z;
  return out;
}

/** Radan derivaatta (suunta) kohdassa t. */
export function bezierTangent(path: FlightPath, t: number, out: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
  const u = 1 - t, a = 3 * u * u, b = 6 * u * t, c = 3 * t * t;
  const { p0, p1, p2, p3 } = path;
  out.x = a * (p1.x - p0.x) + b * (p2.x - p1.x) + c * (p3.x - p2.x);
  out.y = a * (p1.y - p0.y) + b * (p2.y - p1.y) + c * (p3.y - p2.y);
  out.z = a * (p1.z - p0.z) + b * (p2.z - p1.z) + c * (p3.z - p2.z);
  return out;
}

const dist3 = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/**
 * Lentokaari: lähtö nousee ensin ylös (maasta jyrkästi), määränpäähän tullaan hieman yläviistosta.
 * Ohjauspisteet ovat kummankin päätepisteen yläpuolella, joten rata ei painu päätepisteiden alle.
 */
export function planFlight(from: Vec3, to: Vec3, speed: number, fromGround: boolean, toGround: boolean): FlightPath {
  const dx = to.x - from.x, dz = to.z - from.z, dy = to.y - from.y;
  const d = Math.hypot(dx, dz);
  const lift = Math.min(3.5, Math.max(0.6, 0.12 * d));
  const k1 = fromGround ? 0.15 : 0.3, k2 = toGround ? 0.22 : 0.3;
  const p0 = { x: from.x, y: from.y, z: from.z }, p3 = { x: to.x, y: to.y, z: to.z };
  const p1 = { x: from.x + dx * k1, y: from.y + lift + Math.max(0, dy) * (fromGround ? 0.8 : 0.6), z: from.z + dz * k1 };
  const p2 = { x: to.x - dx * k2, y: to.y + lift * (toGround ? 1.0 : 0.6) + Math.max(0, -dy) * 0.4, z: to.z - dz * k2 };
  const len = (dist3(p0, p1) + dist3(p1, p2) + dist3(p2, p3) + dist3(p0, p3)) / 2;
  return { p0, p1, p2, p3, dur: Math.max(0.6, len / speed) };
}

export interface Bird {
  id: number;
  species: SpeciesId;
  state: BirdState;
  x: number; y: number; z: number;
  /** Suunta: atan2(dx, dz), eli 0 = +z. */
  yaw: number;
  /** Nokan nousukulma (rad, ylös positiivinen). */
  pitch: number;
  /** Istumapaikka (perch) tai lennon kohde (fly → puu); -1 = ei puuta. */
  perch: number;
  timer: number;
  // Lento
  path: FlightPath | null;
  t: number;
  flyClock: number;
  fromGround: boolean;
  toGround: boolean;
  // Maassa
  homeX: number; homeZ: number;
  walkX: number; walkZ: number;
  walking: boolean;
  pause: number;
  pecking: boolean;
  peckPhase: number;
  hopPhase: number;
  lookT: number;
  // Animaatio näkymälle
  /** Siiven nostokulma (rad, ylös positiivinen). */
  wing: number;
  /** Siiven supistus: 0 = levällään, 1 = suppuun kyljillä. */
  fold: number;
  /** Pään taivutus alas (rad). */
  headDip: number;
}

/** Toistettava satunnaislukugeneraattori (mulberry32). */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const range = (rng: () => number, [a, b]: readonly [number, number]) => a + (b - a) * rng();

export class Flock {
  readonly birds: Bird[] = [];
  /** Varatut istumapaikat (istuva lintu tai lennon kohde). */
  readonly occupied = new Set<number>();
  private tmp: Vec3 = { x: 0, y: 0, z: 0 };
  private tan: Vec3 = { x: 0, y: 0, z: 0 };

  constructor(
    readonly perches: PerchSet,
    readonly env: BirdEnv,
    readonly rng: () => number,
    readonly species: Record<SpeciesId, SpeciesTuning> = BIRD_SPECIES,
  ) {}

  /** Luo parven sankarin ympärille. */
  spawn(px: number, pz: number) {
    let id = 0;
    for (const sp of Object.keys(this.species) as SpeciesId[]) {
      for (let i = 0; i < this.species[sp].count; i++) {
        const b = blankBird(id++, sp, this.rng);
        this.birds.push(b);
        if (this.rng() < BIRD_FLOCK.spawnGround && this.landOnGroundNear(b, px, pz, BIRD_FLOCK.spawnRing)) continue;
        if (!this.sitAtRandomPerch(b, px, pz, BIRD_FLOCK.spawnRing)) this.landOnGroundNear(b, px, pz, BIRD_FLOCK.spawnRing);
      }
    }
  }

  step(dt: number, px: number, pz: number) {
    dt = Math.min(dt, 0.1);
    if (dt <= 0) return;
    for (const b of this.birds) {
      if (b.state !== "fly" && Math.hypot(b.x - px, b.z - pz) > BIRD_FLOCK.relocateBeyond) {
        this.relocate(b, px, pz);
        continue;
      }
      if (b.state === "perch") this.stepPerch(b, dt, px, pz);
      else if (b.state === "fly") this.stepFly(b, dt);
      else this.stepGround(b, dt, px, pz);
    }
  }

  /** Tilastot konsoliin. */
  stats() {
    const s = { perch: 0, fly: 0, ground: 0 };
    for (const b of this.birds) s[b.state]++;
    return { birds: this.birds.length, perches: this.perches.count, ...s };
  }

  // ---------- Tilat ----------

  private stepPerch(b: Bird, dt: number, px: number, pz: number) {
    b.wing = 0; b.fold = 1; b.pitch = 0;
    b.timer -= dt;
    b.lookT -= dt;
    // Katselee ympärilleen: pieni käännös ja nokan nyökkäys silloin tällöin.
    if (b.lookT <= 0) {
      b.yaw += (this.rng() - 0.5) * 1.6;
      b.lookT = 0.8 + this.rng() * 2.5;
    }
    b.headDip = Math.max(0, b.headDip - dt * 3);
    const sp = this.species[b.species];
    const low = b.y - this.env.ground(b.x, b.z) < BIRD_FLOCK.lowPerchHeight;
    if (low && Math.hypot(b.x - px, b.z - pz) < BIRD_FLOCK.lowPerchFlee) { this.flee(b, px, pz); return; }
    if (b.timer > 0) return;
    if (this.rng() < sp.groundChance && this.flyToGround(b, px, pz)) return;
    this.flyToTree(b, px, pz);
  }

  private stepFly(b: Bird, dt: number) {
    const path = b.path!;
    const sp = this.species[b.species];
    b.t += dt / path.dur;
    b.flyClock += dt;
    if (b.t >= 1) { this.land(b); return; }
    const p = bezier(path, b.t, this.tmp);
    // Mäki voi nousta lähtö- ja laskeutumispaikan väliin: lintu pysyy maan yllä (päätepisteissä vähemmän).
    const clear = BIRD_FLOCK.flightClearance * Math.min(1, 6 * b.t, 6 * (1 - b.t));
    b.x = p.x; b.z = p.z;
    b.y = Math.max(p.y, this.env.ground(p.x, p.z) + clear);
    const d = bezierTangent(path, b.t, this.tan);
    const h = Math.hypot(d.x, d.z);
    if (h > 1e-4) b.yaw = Math.atan2(d.x, d.z);
    b.pitch = 0.6 * Math.max(-0.7, Math.min(0.7, Math.atan2(d.y, Math.max(h, 1e-4))));
    b.headDip = 0;
    // Siivet: lähtö ja laskeutuminen räpyttäen, välissä lajin rytmi (isku + liito).
    const remaining = (1 - b.t) * path.dur;
    if (b.flyClock < 0.35 || remaining < 0.25) {
      b.fold = 0;
      b.wing = 0.25 + sp.flapAmp * Math.sin(b.flyClock * Math.PI * 2 * sp.flapHz * 1.25);
      return;
    }
    const cycle = sp.flapOn + sp.flapOff;
    const phase = (b.flyClock - 0.35) % cycle;
    if (phase < sp.flapOn) {
      b.fold = 0;
      b.wing = 0.15 + sp.flapAmp * Math.sin(phase * Math.PI * 2 * sp.flapHz);
    } else {
      b.fold = sp.glideFold;
      b.wing = sp.glideFold > 0.5 ? 0 : 0.08;
    }
  }

  private stepGround(b: Bird, dt: number, px: number, pz: number) {
    const sp = this.species[b.species];
    b.wing = 0; b.fold = 1; b.pitch = 0;
    if (Math.hypot(b.x - px, b.z - pz) < sp.fleeDist) { this.flee(b, px, pz); return; }
    b.timer -= dt;
    if (b.timer <= 0) {
      this.flyToTree(b, px, pz);
      return;
    }
    let hop = 0;
    if (b.walking) {
      const dx = b.walkX - b.x, dz = b.walkZ - b.z, d = Math.hypot(dx, dz);
      const stepLen = sp.walkSpeed * dt;
      if (d <= stepLen) {
        b.x = b.walkX; b.z = b.walkZ;
        b.walking = false;
        b.pause = 0.4 + this.rng() * 1.6;
        b.pecking = this.rng() < 0.65;
      } else {
        b.x += (dx / d) * stepLen;
        b.z += (dz / d) * stepLen;
        b.yaw = Math.atan2(dx, dz);
        b.hopPhase += dt * Math.PI * 2 * (sp.hops ? 4 : 2.2);
        hop = sp.hops
          ? BIRD_FLOCK.hopHeight * (sp.length / 0.15) * Math.abs(Math.sin(b.hopPhase))
          : 0.004 * Math.abs(Math.sin(b.hopPhase));
      }
      b.headDip = Math.max(0, b.headDip - dt * 4);
    } else {
      b.pause -= dt;
      if (b.pecking) {
        b.peckPhase += dt * sp.peckRate;
        b.headDip = 0.9 * Math.max(0, Math.sin(b.peckPhase));
      } else {
        b.headDip = Math.max(0, b.headDip - dt * 4);
        b.lookT -= dt;
        if (b.lookT <= 0) { b.yaw += (this.rng() - 0.5) * 1.4; b.lookT = 0.5 + this.rng(); }
      }
      if (b.pause <= 0) this.pickWalk(b);
    }
    b.y = this.env.ground(b.x, b.z) + hop;
  }

  // ---------- Siirtymät ----------

  private flee(b: Bird, px: number, pz: number) {
    const sp = this.species[b.species];
    const away = Math.hypot(b.x - px, b.z - pz);
    // Puu, joka on kauempana sankarista kuin lintu nyt; jos sellaista ei ole, mikä tahansa vapaa puu.
    const cands = this.perches.candidates(b.x, b.z, 4, Math.max(25, sp.flight[1]))
      .filter((i) => !this.occupied.has(i) && Math.hypot(this.perches.x(i) - px, this.perches.z(i) - pz) > away + 3);
    const target = this.pick(cands, b) ?? this.pick(this.freePerches(b.x, b.z, 4, 40), b);
    if (target === undefined) return;
    this.startFlight(b, target);
  }

  private flyToTree(b: Bird, px: number, pz: number) {
    const sp = this.species[b.species];
    let cands = this.freePerches(b.x, b.z, sp.flight[0], sp.flight[1]);
    // Pysytään sankarin lähellä: kaukana olevalle kelpaavat vain lähemmäs vievät puut.
    const now = Math.hypot(b.x - px, b.z - pz);
    const near = cands.filter((i) => {
      const d = Math.hypot(this.perches.x(i) - px, this.perches.z(i) - pz);
      return d < BIRD_FLOCK.keepNear || d < now;
    });
    if (near.length) cands = near;
    const wantTop = this.rng() < sp.topChance;
    const kind = cands.filter((i) => this.perches.isTop(i) === wantTop);
    const target = this.pick(kind.length ? kind : cands, b);
    if (target === undefined) { b.timer = 2; return; }
    this.startFlight(b, target);
  }

  private flyToGround(b: Bird, px: number, pz: number): boolean {
    const sp = this.species[b.species];
    for (let k = 0; k < 10; k++) {
      const a = this.rng() * Math.PI * 2, d = 3 + this.rng() * 13;
      const x = b.x + Math.sin(a) * d, z = b.z + Math.cos(a) * d;
      if (Math.hypot(x - px, z - pz) < sp.fleeDist + 3) continue;
      if (!this.env.groundFree(x, z)) continue;
      this.releasePerch(b);
      b.path = planFlight(b, { x, y: this.env.ground(x, z), z }, sp.flySpeed, b.state === "ground", true);
      b.state = "fly"; b.t = 0; b.flyClock = 0;
      b.fromGround = false; b.toGround = true;
      return true;
    }
    return false;
  }

  private startFlight(b: Bird, perch: number) {
    const sp = this.species[b.species];
    const fromGround = b.state === "ground";
    this.releasePerch(b);
    this.occupied.add(perch);
    b.perch = perch;
    const to = { x: this.perches.x(perch), y: this.perches.y(perch), z: this.perches.z(perch) };
    b.path = planFlight(b, to, sp.flySpeed, fromGround, false);
    b.state = "fly"; b.t = 0; b.flyClock = 0;
    b.fromGround = fromGround; b.toGround = false;
  }

  private land(b: Bird) {
    const sp = this.species[b.species];
    const p = b.path!.p3;
    b.path = null;
    b.pitch = 0; b.wing = 0; b.fold = 1;
    if (b.toGround) {
      b.x = p.x; b.z = p.z; b.y = this.env.ground(p.x, p.z);
      this.startGround(b);
    } else {
      b.x = p.x; b.y = p.y; b.z = p.z;
      b.state = "perch";
      b.timer = range(this.rng, sp.perchTime);
      b.lookT = 0.5 + this.rng() * 2;
    }
  }

  private startGround(b: Bird) {
    const sp = this.species[b.species];
    b.state = "ground";
    b.perch = -1;
    b.homeX = b.x; b.homeZ = b.z;
    b.timer = range(this.rng, sp.groundTime);
    b.walking = false;
    b.pause = 0.3 + this.rng();
    b.pecking = this.rng() < 0.5;
  }

  private pickWalk(b: Bird) {
    for (let k = 0; k < 6; k++) {
      const a = this.rng() * Math.PI * 2, r = this.rng() * BIRD_FLOCK.groundWander;
      const x = b.homeX + Math.sin(a) * r, z = b.homeZ + Math.cos(a) * r;
      if (!this.env.groundFree(x, z)) continue;
      b.walkX = x; b.walkZ = z; b.walking = true;
      return;
    }
    b.pause = 0.5;
  }

  /** Näkymätön siirto sankarin lähelle (lintu on niin kaukana, ettei sitä piirretä). */
  private relocate(b: Bird, px: number, pz: number) {
    if (!this.sitAtRandomPerch(b, px, pz, BIRD_FLOCK.relocateRing)) this.landOnGroundNear(b, px, pz, BIRD_FLOCK.relocateRing);
  }

  private sitAtRandomPerch(b: Bird, px: number, pz: number, ring: readonly [number, number]): boolean {
    const sp = this.species[b.species];
    const cands = this.freePerches(px, pz, ring[0], ring[1]);
    const wantTop = this.rng() < sp.topChance;
    const kind = cands.filter((i) => this.perches.isTop(i) === wantTop);
    const target = this.pick(kind.length ? kind : cands, b);
    if (target === undefined) return false;
    this.releasePerch(b);
    this.occupied.add(target);
    b.perch = target;
    b.state = "perch";
    b.path = null;
    b.x = this.perches.x(target); b.y = this.perches.y(target); b.z = this.perches.z(target);
    b.yaw = this.rng() * Math.PI * 2;
    b.timer = range(this.rng, sp.perchTime);
    b.wing = 0; b.fold = 1; b.pitch = 0;
    return true;
  }

  private landOnGroundNear(b: Bird, px: number, pz: number, ring: readonly [number, number]): boolean {
    const sp = this.species[b.species];
    for (let k = 0; k < 20; k++) {
      const a = this.rng() * Math.PI * 2, d = Math.max(sp.fleeDist + 3, range(this.rng, ring));
      const x = px + Math.sin(a) * d, z = pz + Math.cos(a) * d;
      if (!this.env.groundFree(x, z)) continue;
      this.releasePerch(b);
      b.path = null;
      b.x = x; b.z = z; b.y = this.env.ground(x, z);
      b.yaw = this.rng() * Math.PI * 2;
      b.wing = 0; b.fold = 1; b.pitch = 0;
      this.startGround(b);
      return true;
    }
    return false;
  }

  private releasePerch(b: Bird) {
    if (b.perch >= 0) this.occupied.delete(b.perch);
    b.perch = -1;
  }

  private freePerches(x: number, z: number, rMin: number, rMax: number) {
    return this.perches.candidates(x, z, rMin, rMax).filter((i) => !this.occupied.has(i));
  }

  private pick(list: number[], b: Bird): number | undefined {
    const own = list.filter((i) => i !== b.perch);
    return own.length ? own[Math.floor(this.rng() * own.length)] : undefined;
  }
}

function blankBird(id: number, species: SpeciesId, rng: () => number): Bird {
  return {
    id, species, state: "perch", x: 0, y: 0, z: 0, yaw: rng() * Math.PI * 2, pitch: 0,
    perch: -1, timer: 0, path: null, t: 0, flyClock: 0, fromGround: false, toGround: false,
    homeX: 0, homeZ: 0, walkX: 0, walkZ: 0, walking: false, pause: 0, pecking: false,
    peckPhase: rng() * 6, hopPhase: 0, lookT: rng() * 2, wing: 0, fold: 1, headDip: 0,
  };
}
