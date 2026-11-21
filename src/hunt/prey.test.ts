import { describe, expect, it } from "vitest";
import { SPECIES, type PreyEnv, killPrey, perceives, spawnPrey, updatePrey } from "./prey";

const free: PreyEnv = { rng: () => 0.5, move: (x, z, dx, dz) => ({ x: x + dx, z: z + dz }) };
const hare = SPECIES.hare;

function run(p: ReturnType<typeof spawnPrey>, seconds: number, stimuli: Parameters<typeof updatePrey>[2], env = free) {
  const events: string[] = [];
  for (let t = 0; t < seconds; t += 0.05) {
    const e = updatePrey(p, 0.05, typeof stimuli === "function" ? (stimuli as () => never)() : stimuli, env);
    if (e) events.push(e);
  }
  return events;
}

describe("jäniksen havainnot", () => {
  it("näkee sankarin 12 metristä mutta ei kauempaa", () => {
    const p = spawnPrey("h", "hare", 0, 0);
    expect(perceives(hare, p, { kind: "sight", x: 0, z: 11.9 })).toBe(true);
    expect(perceives(hare, p, { kind: "sight", x: 0, z: 12.5 })).toBe(false);
  });

  it("kuulee äänen äänen kantaman sisällä", () => {
    const p = spawnPrey("h", "hare", 0, 0);
    expect(perceives(hare, p, { kind: "sound", x: 4, z: 0, loudness: 5 })).toBe(true);
    expect(perceives(hare, p, { kind: "sound", x: 6, z: 0, loudness: 5 })).toBe(false);
  });

  it("kapea näkökenttä (tulevat lajit) ei näe selän taakse", () => {
    const def = { ...hare, senses: { ...hare.senses, sight: { range: 20, fovDeg: 180 } } };
    const p = spawnPrey("h", "hare", 0, 0, 0);
    expect(perceives(def, p, { kind: "sight", x: 0, z: 5 })).toBe(true);
    expect(perceives(def, p, { kind: "sight", x: 0, z: -5 })).toBe(false);
  });
});

describe("jäniksen tilat", () => {
  it("laiduntaa ja loikkii kotipaikan lähellä, kun ketään ei näy", () => {
    const p = spawnPrey("h", "hare", 0, 0);
    const seen = new Set<string>();
    for (let t = 0; t < 30; t += 0.05) { updatePrey(p, 0.05, [], free); seen.add(p.state); }
    expect(seen.has("graze")).toBe(true);
    expect(seen.has("hop")).toBe(true);
    expect(seen.has("flee")).toBe(false);
    expect(Math.hypot(p.x, p.z)).toBeLessThan(hare.homeRadius + hare.hopDistance[1] + 0.1);
  });

  it("säikähtää, jähmettyy hetkeksi ja pakenee poispäin sankarista", () => {
    const p = spawnPrey("h", "hare", 0, 0);
    const hero = { kind: "sight" as const, x: 0, z: -10 };
    expect(updatePrey(p, 0.05, [hero], free)).toBe("startled");
    expect(p.state).toBe("alert");
    run(p, hare.alertTime + 0.1, [hero]);
    expect(p.state).toBe("flee");
    run(p, 1, [hero]);
    expect(p.z).toBeGreaterThan(3);
    expect(p.speed).toBeGreaterThan(hare.fleeSpeed * 0.9);
  });

  it("pakenee nuolen iskun äänestä", () => {
    const p = spawnPrey("h", "hare", 0, 0);
    updatePrey(p, 0.05, [{ kind: "sound", x: 2, z: 0, loudness: 5 }], free);
    expect(p.state).toBe("alert");
    run(p, 0.6, []);
    expect(p.state).toBe("flee");
    expect(p.x).toBeLessThan(0);
  });

  it("rauhoittuu turvaetäisyydellä ja jatkaa laiduntamista uudessa paikassa", () => {
    const p = spawnPrey("h", "hare", 0, 0);
    updatePrey(p, 0.05, [{ kind: "sight", x: 0, z: -10 }], free);
    run(p, 8, []);
    expect(["graze", "hop"]).toContain(p.state);
    expect(Math.hypot(p.home.x, p.home.z)).toBeGreaterThan(10);
  });

  it("este edessä kääntää pakosuuntaa eikä jänis jää paikalleen", () => {
    // Seinä z = 2: liike sen yli estyy.
    const wall: PreyEnv = { rng: () => 0.3, move: (x, z, dx, dz) => ({ x: x + dx, z: Math.min(2, z + dz) }) };
    const p = spawnPrey("h", "hare", 0, 0);
    updatePrey(p, 0.05, [{ kind: "sight", x: 0, z: -10 }], wall);
    run(p, 2, [], wall);
    expect(Math.abs(p.x)).toBeGreaterThan(2);
  });

  it("kaadettu jänis ei enää liiku eikä säikähdä", () => {
    const p = spawnPrey("h", "hare", 0, 0);
    killPrey(p);
    expect(updatePrey(p, 0.05, [{ kind: "sight", x: 0, z: 1 }], free)).toBeNull();
    run(p, 2, [{ kind: "sight", x: 0, z: 1 }]);
    expect(p.state).toBe("dead");
    expect(p.x).toBe(0);
    expect(p.z).toBe(0);
  });
});
