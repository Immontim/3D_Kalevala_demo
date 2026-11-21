import { describe, expect, it } from "vitest";
import { SIDESTEP, dodgeDirection, sidestepPose } from "./sidestep";

describe("väistö sivu- tai taka-askeleena", () => {
  it("pelkkä väistönappi tai eteenpäin ei väistä", () => {
    expect(dodgeDirection(false, false, false)).toBeNull();
    // Vasen ja oikea yhtä aikaa kumoavat toisensa.
    expect(dodgeDirection(true, true, false)).toBeNull();
  });
  it("vasen, oikea ja taakse antavat yksikkösuunnan", () => {
    expect(dodgeDirection(true, false, false)).toEqual({ x: -1, back: 0 });
    expect(dodgeDirection(false, true, false)).toEqual({ x: 1, back: 0 });
    expect(dodgeDirection(false, false, true)).toEqual({ x: 0, back: 1 });
    const d = dodgeDirection(true, false, true)!;
    expect(Math.hypot(d.x, d.back)).toBeCloseTo(1);
    expect(d.x).toBeLessThan(0);
  });
  it("alussa ja lopussa jalat ovat vartalon alla, ja vartalo kulkee jalkojen keskellä", () => {
    const a = sidestepPose(0), b = sidestepPose(1);
    expect([a.lead, a.trail, a.body]).toEqual([0, 0, 0]);
    expect([b.lead, b.trail, b.body]).toEqual([1, 1, 1]);
    for (const u of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      const p = sidestepPose(u);
      expect(p.body).toBeCloseTo((p.lead + p.trail) / 2);
    }
  });
  it("johtava jalka laskeutuu ennen kuin perässä tuleva nousee (ei hyppyä eikä laahausta)", () => {
    expect(SIDESTEP.trailStart).toBeGreaterThanOrEqual(SIDESTEP.leadEnd);
    for (let u = 0; u <= 1; u += 0.01) {
      const p = sidestepPose(u);
      expect(Math.min(p.leadUp, p.trailUp)).toBeLessThan(1e-9);
    }
  });
  it("vartalon matka kasvaa koko askeleen ajan", () => {
    let prev = -1;
    for (let u = 0; u <= 1.0001; u += 0.05) {
      const b = sidestepPose(u).body;
      expect(b).toBeGreaterThanOrEqual(prev);
      prev = b;
    }
  });
});
