import { describe, expect, it } from "vitest";
import { planYardAnimals, YARD_LIFE, type YardLifeContext } from "./yardLife";

/** Siemennetty satunnaisluku toistettaviin arvontoihin. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pihan karkea malli: koppi lännessä, pöytä ja emäntä pohjoisessa, nuotio koillisessa.
const CTX: YardLifeContext = {
  coop: { x: -9.55, z: 1.68, yaw: (-80 * Math.PI) / 180 + Math.PI },
  housewife: { x: -2.44, z: -6.27 },
  dogSpots: [{ x: 1.9, z: 11.5 }, { x: -1.9, z: 11.5 }, { x: 3, z: -2.2 }],
  blocked: (x, z, pad) => Math.hypot(x - 3.6, z + 4.6) < 2 + pad || Math.hypot(x + 4.4, z + 6.6) < 2 + pad || Math.hypot(x + 9.55, z - 1.68) < 1.2 + pad,
  avoid: [{ x: -2.44, z: -6.27, r: 0.5 }, { x: 1, z: -6.4, r: 1.25 }],
  fenceRadius: 12.9,
};

describe("pihan eläinten arvonta", () => {
  it("kanoja on 2–4 ja kukko; paikallaan istuva kana on korkeintaan yksi eri orrella kuin kukko", () => {
    const counts = new Set<number>();
    let roosting = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const plan = planYardAnimals(CTX, seeded(seed));
      const total = plan.hens.length + (plan.roostingHen ? 1 : 0);
      counts.add(total);
      expect(total).toBeGreaterThanOrEqual(YARD_LIFE.hens[0]);
      expect(total).toBeLessThanOrEqual(YARD_LIFE.hens[1]);
      if (plan.roostingHen) { roosting++; expect(plan.roostingHen).not.toBe(plan.rooster); }
    }
    expect([...counts].sort()).toEqual([2, 3, 4]);
    // Animoitu kana on selvästi yleisempi kuin paikallaan istuva.
    expect(roosting).toBeLessThan(300 * 0.45);
  });

  it("eläimet eivät ole esteiden päällä, toistensa päällä eivätkä aidan ulkopuolella", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const plan = planYardAnimals(CTX, seeded(seed));
      const all = [...plan.hens, plan.dog];
      for (const a of all) {
        expect(Math.hypot(a.x, a.z)).toBeLessThan(CTX.fenceRadius - 0.8);
        expect(CTX.blocked(a.x, a.z, 0.1)).toBe(false);
        for (const c of CTX.avoid) expect(Math.hypot(a.x - c.x, a.z - c.z)).toBeGreaterThan(c.r);
      }
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) expect(Math.hypot(all[i].x - all[j].x, all[i].z - all[j].z)).toBeGreaterThan(0.5);
      }
    }
  });

  it("kanat ovat enimmäkseen kopin lähellä ja koira useimmiten emännän luona", () => {
    let nearCoop = 0, hens = 0, dogNear = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const plan = planYardAnimals(CTX, seeded(seed));
      for (const h of plan.hens) { hens++; if (Math.hypot(h.x - CTX.coop.x, h.z - CTX.coop.z) < 3.6) nearCoop++; }
      if (Math.hypot(plan.dog.x - CTX.housewife.x, plan.dog.z - CTX.housewife.z) < 2.8) dogNear++;
    }
    expect(nearCoop / hens).toBeGreaterThan(0.7);
    expect(dogNear / 300).toBeGreaterThan(0.45);
    expect(dogNear / 300).toBeLessThan(0.8);       // välillä muualla (portinpieli ym.)
  });
});
