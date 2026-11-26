import { describe, expect, it } from "vitest";
import { BELLOWS_PERIOD, bellowsMotion, hammerMotion } from "./smithyMotion";

describe("sepän työliikkeiden yhteinen ajoitus", () => {
  it("liikuttaa palkeet aina vastakkaisessa vaiheessa ilman ajautumista", () => {
    for (let i = 0; i <= 240; i++) {
      const time = i * BELLOWS_PERIOD / 16;
      const m = bellowsMotion(time);
      expect(m.leftWeight + m.rightWeight).toBeCloseTo(1, 10);
      expect(m.left.x).toBe(0.25);
      expect(m.right.x).toBe(-0.25);
      expect(bellowsMotion(time + 60).leftWeight).toBeCloseTo(m.leftWeight, 10);
    }
  });

  it("antaa kahvoille GLB:n avoimet ja suljetut päätepisteet", () => {
    const openLeft = bellowsMotion(0.75);
    expect(openLeft.leftWeight).toBeCloseTo(0, 10);
    expect(openLeft.left.y).toBeCloseTo(1.142521, 6);
    expect(openLeft.left.z).toBeCloseTo(0.451783, 6);
    const shutLeft = bellowsMotion(0.25);
    expect(shutLeft.leftWeight).toBeCloseTo(1, 10);
    expect(shutLeft.left.y).toBeCloseTo(0.970389, 6);
    expect(shutLeft.left.z).toBeCloseTo(0.290847, 6);
  });

  it("ajoittaa vasaran yhden kosketusjakson joka kierrokselle", () => {
    expect(hammerMotion(0.55).mix).toBe(0);
    expect(hammerMotion(0.75).impact).toBe(true);
    expect(hammerMotion(1.19).mix).toBeGreaterThan(0);
    expect(hammerMotion(1.2).cycle).toBe(1);
    expect(hammerMotion(1.2).mix).toBe(0);
  });
});
