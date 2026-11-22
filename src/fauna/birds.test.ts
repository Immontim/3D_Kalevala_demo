import { describe, expect, it } from "vitest";
import { BIRD_FLOCK, BIRD_SPECIES, Flock, PerchSet, bezier, makeRng, planFlight, type BirdEnv } from "./birds";

/** Metsä ruudukossa 5 m:n välein: latva 12 m:ssä ja kaksi oksaa 7 m:ssä jokaisella puulla. */
function forestPerches(extent = 150, step = 5): PerchSet {
  const out: number[] = [];
  for (let x = -extent; x <= extent; x += step) {
    for (let z = -extent; z <= extent; z += step) {
      const g = ground(x, z);
      out.push(x, g + 12, z, 1);
      out.push(x + 0.8, g + 7, z, 0);
      out.push(x - 0.6, g + 6.5, z + 0.5, 0);
    }
  }
  return new PerchSet(new Float32Array(out));
}

function ground(x: number, z: number) { return 0.05 * x + Math.sin(z * 0.1) * 2; }

const env: BirdEnv = {
  ground,
  // Kivi kohdassa (20, 20) ja kulkualueen raja |x| < 140.
  groundFree: (x, z) => Math.abs(x) < 140 && Math.hypot(x - 20, z - 20) > 3,
};

function makeFlock(seed = 7, perches = forestPerches()) {
  const flock = new Flock(perches, env, makeRng(seed));
  flock.spawn(0, 0);
  return flock;
}

describe("PerchSet", () => {
  it("palauttaa vain kehän sisällä olevat istumapaikat", () => {
    const p = forestPerches(50);
    const list = p.candidates(3, -2, 10, 20);
    expect(list.length).toBeGreaterThan(0);
    for (const i of list) {
      const d = Math.hypot(p.x(i) - 3, p.z(i) + 2);
      expect(d).toBeGreaterThanOrEqual(10);
      expect(d).toBeLessThanOrEqual(20);
    }
  });
});

describe("planFlight", () => {
  it("alkaa lähdöstä, päättyy kohteeseen ja kaartuu molempien yläpuolelle", () => {
    const from = { x: 0, y: 8, z: 0 }, to = { x: 15, y: 0, z: 5 };
    const path = planFlight(from, to, 7, false, true);
    expect(bezier(path, 0)).toEqual(from);
    expect(bezier(path, 1)).toEqual(to);
    let top = -Infinity, low = Infinity;
    for (let t = 0; t <= 1; t += 0.01) {
      const p = bezier(path, t);
      top = Math.max(top, p.y);
      low = Math.min(low, p.y);
    }
    expect(top).toBeGreaterThan(8);
    expect(low).toBeGreaterThanOrEqual(0 - 1e-9);
    expect(path.dur).toBeGreaterThan(Math.hypot(15, 8, 5) / 7 * 0.9);
  });
});

describe("Flock", () => {
  it("luo 12–20 lintua kolmesta lajista, ja jokainen istuu puussa tai on maassa", () => {
    const flock = makeFlock();
    expect(flock.birds.length).toBeGreaterThanOrEqual(12);
    expect(flock.birds.length).toBeLessThanOrEqual(20);
    expect(new Set(flock.birds.map((b) => b.species)).size).toBe(3);
    for (const b of flock.birds) {
      if (b.state === "perch") {
        expect(b.x).toBeCloseTo(flock.perches.x(b.perch), 5);
        expect(b.y).toBeCloseTo(flock.perches.y(b.perch), 5);
        expect(b.z).toBeCloseTo(flock.perches.z(b.perch), 5);
      } else {
        expect(b.state).toBe("ground");
        expect(b.y).toBeCloseTo(ground(b.x, b.z), 6);
      }
    }
  });

  it("ei koskaan istu tyhjässä ilmassa eikä lennä maan alla pitkässä ajossa", () => {
    const flock = makeFlock(11);
    let px = 0, pz = 0, flights = 0, grounds = 0;
    const seen = new Set<string>();
    for (let i = 0; i < 6000; i++) {
      // Sankari kävelee hitaasti edestakaisin.
      px = Math.sin(i * 0.002) * 40;
      pz = Math.cos(i * 0.0013) * 30;
      flock.step(1 / 30, px, pz);
      const perched = new Set<number>();
      for (const b of flock.birds) {
        seen.add(`${b.id}:${b.state}`);
        const g = ground(b.x, b.z);
        if (b.state === "perch") {
          expect(b.perch).toBeGreaterThanOrEqual(0);
          expect(b.x).toBeCloseTo(flock.perches.x(b.perch), 5);
          expect(b.y).toBeCloseTo(flock.perches.y(b.perch), 5);
          expect(perched.has(b.perch)).toBe(false);
          perched.add(b.perch);
          expect(b.fold).toBe(1);
        } else if (b.state === "ground") {
          grounds++;
          expect(b.y).toBeGreaterThanOrEqual(g - 1e-6);
          expect(b.y - g).toBeLessThanOrEqual(BIRD_FLOCK.hopHeight * (0.62 / 0.15) + 1e-6);
          expect(env.groundFree(b.homeX, b.homeZ)).toBe(true);
          expect(Math.hypot(b.x - b.homeX, b.z - b.homeZ)).toBeLessThanOrEqual(BIRD_FLOCK.groundWander + 1e-6);
        } else {
          flights++;
          expect(b.y).toBeGreaterThanOrEqual(g - 1e-6);
        }
      }
    }
    expect(flights).toBeGreaterThan(0);
    expect(grounds).toBeGreaterThan(0);
    // Jokainen lintu on ehtinyt sekä istua että lentää.
    for (const b of flock.birds) {
      expect(seen.has(`${b.id}:fly`)).toBe(true);
    }
  });

  it("maassa oleva lintu lehahtaa puuhun, kun sankari tulee lähelle, ja lentää poispäin", () => {
    const flock = makeFlock(3);
    const b = flock.birds.find((x) => x.species === "peippo")!;
    // Pakotetaan lintu maahan ja sankari kolmen metrin päähän.
    flock.step(0.01, 0, 0);
    Object.assign(b, { state: "ground", perch: -1, x: 10, z: 10, y: ground(10, 10), homeX: 10, homeZ: 10, timer: 50, walking: false, pause: 5 });
    for (const i of [...flock.occupied]) if (!flock.birds.some((o) => o.perch === i)) flock.occupied.delete(i);
    flock.step(1 / 60, 10 - 3, 10);
    expect(b.state).toBe("fly");
    expect(b.toGround).toBe(false);
    expect(b.perch).toBeGreaterThanOrEqual(0);
    const target = { x: flock.perches.x(b.perch), z: flock.perches.z(b.perch) };
    expect(Math.hypot(target.x - 7, target.z - 10)).toBeGreaterThan(3 + 3);
  });

  it("ei lehahda kaukaisesta sankarista", () => {
    const flock = makeFlock(3);
    const b = flock.birds.find((x) => x.species === "korppi")!;
    Object.assign(b, { state: "ground", perch: -1, x: 10, z: 10, y: ground(10, 10), homeX: 10, homeZ: 10, timer: 50, walking: false, pause: 5 });
    flock.step(1 / 60, 10 - BIRD_SPECIES.korppi.fleeDist - 1, 10);
    expect(b.state).toBe("ground");
  });

  it("räpyttää lennossa ja pitää siivet suppuun istuessa", () => {
    const flock = makeFlock(5);
    const b = flock.birds.find((x) => x.species === "peippo")!;
    b.timer = 0;
    const wings = new Set<number>();
    for (let i = 0; i < 3000 && wings.size < 10; i++) {
      flock.step(1 / 60, 0, 0);
      if (b.state === "fly") wings.add(Math.round(b.wing * 100));
      else { expect(b.fold).toBe(1); expect(b.wing).toBe(0); }
    }
    expect(wings.size).toBeGreaterThanOrEqual(10);
  });

  it("siirtää kauas jääneet linnut sankarin lähelle", () => {
    const flock = makeFlock(9, forestPerches(260));
    for (let i = 0; i < 30; i++) flock.step(1 / 30, 0, 0);
    // Sankari siirtyy 180 m:n päähän.
    for (let i = 0; i < 30 * 12; i++) flock.step(1 / 30, 180, 0);
    for (const b of flock.birds) {
      if (b.state === "fly") continue;
      expect(Math.hypot(b.x - 180, b.z)).toBeLessThanOrEqual(BIRD_FLOCK.relocateBeyond);
    }
  });

  it("on toistettava samalla siemenellä", () => {
    const a = makeFlock(21), b = makeFlock(21);
    for (let i = 0; i < 500; i++) { a.step(1 / 30, i * 0.05, 0); b.step(1 / 30, i * 0.05, 0); }
    expect(a.birds.map((x) => [x.state, x.x, x.y, x.z])).toEqual(b.birds.map((x) => [x.state, x.x, x.y, x.z]));
  });

  it("tauko (dt = 0) pysäyttää linnut", () => {
    const flock = makeFlock(4);
    const before = flock.birds.map((x) => [x.x, x.y, x.z, x.state]);
    flock.step(0, 0, 0);
    expect(flock.birds.map((x) => [x.x, x.y, x.z, x.state])).toEqual(before);
  });
});
