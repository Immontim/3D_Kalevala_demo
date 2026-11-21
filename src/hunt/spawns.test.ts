import { describe, expect, it } from "vitest";
import { rngStream } from "../map/placement";
import { HARE_SPAWN, type HareSpawnOptions, pickHareSpots } from "./spawns";

const bog = { x: -6, z: 4, rx: 19, rz: 14 };
const burn = { x: 52, z: -40, rx: 16, rz: 13 };
const inZone = (z: typeof bog, p: { x: number; z: number }) => ((p.x - z.x) / z.rx) ** 2 + ((p.z - z.z) / z.rz) ** 2 <= 1.0001;

function options(seed: number, extra: Partial<HareSpawnOptions> = {}): HareSpawnOptions {
  return {
    rng: rngStream(seed, "hares"),
    bog, burn,
    anywhere: { x: 0, z: 0, rx: 85, rz: 85 },
    valid: () => true,
    avoid: { x: 10, z: -76, radius: 22 },
    ...extra,
  };
}

describe("jänisten arvonta", () => {
  it("arpoo 7–9 jänistä, joista 1–3 suolla ja 1–3 paloaukealla", () => {
    const totals = new Set<number>();
    for (let seed = 1; seed <= 200; seed++) {
      const spots = pickHareSpots(options(seed));
      totals.add(spots.length);
      expect(spots.length).toBeGreaterThanOrEqual(HARE_SPAWN.total[0]);
      expect(spots.length).toBeLessThanOrEqual(HARE_SPAWN.total[1]);
      const onBog = spots.filter((s) => s.zone === "bog");
      const onBurn = spots.filter((s) => s.zone === "burn");
      expect(onBog.length).toBeGreaterThanOrEqual(1);
      expect(onBog.length).toBeLessThanOrEqual(3);
      expect(onBurn.length).toBeGreaterThanOrEqual(1);
      expect(onBurn.length).toBeLessThanOrEqual(3);
      for (const s of onBog) expect(inZone(bog, s)).toBe(true);
      for (const s of onBurn) expect(inZone(burn, s)).toBe(true);
    }
    expect([...totals].sort()).toEqual([7, 8, 9]);
  });

  it("paikat vaihtelevat käynnistä toiseen", () => {
    const a = pickHareSpots(options(1)), b = pickHareSpots(options(2));
    expect(a[0].x).not.toBeCloseTo(b[0].x, 1);
  });

  it("ei arvo jänistä saapumispaikan lähelle eikä kelpaamattomaan kohtaan", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const spots = pickHareSpots(options(seed, { valid: (x) => x > -40 }));
      for (const s of spots) {
        expect(Math.hypot(s.x - 10, s.z + 76)).toBeGreaterThanOrEqual(22);
        expect(s.x).toBeGreaterThan(-40);
      }
    }
  });

  it("jänikset eivät ole aivan vierekkäin", () => {
    const spots = pickHareSpots(options(7));
    for (let i = 0; i < spots.length; i++) {
      for (let j = i + 1; j < spots.length; j++) {
        expect(Math.hypot(spots[i].x - spots[j].x, spots[i].z - spots[j].z)).toBeGreaterThanOrEqual(HARE_SPAWN.minGap / 2);
      }
    }
  });
});
