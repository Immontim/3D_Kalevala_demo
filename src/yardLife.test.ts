import { describe, expect, it } from "vitest";
import { pickSpot, planYardAnimals, YARD_LIFE, type Spot, type YardLifeContext } from "./yardLife";

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
  table: { x: -4.4, z: -6.6 },
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

describe("koira pöydän luona ja väen paikat", () => {
  it("kun emäntä on muualla, koira on usein hänen tai pöydän luona", () => {
    const ctx: YardLifeContext = { ...CTX, housewife: { x: 4.5, z: -3.3 }, avoid: [{ x: 4.5, z: -3.3, r: 0.5 }] };
    let wife = 0, table = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const dog = planYardAnimals(ctx, seeded(seed)).dog;
      if (Math.hypot(dog.x - ctx.housewife.x, dog.z - ctx.housewife.z) < 2.8) wife++;
      else if (Math.hypot(dog.x - ctx.table!.x, dog.z - ctx.table!.z) < 3.4) table++;
    }
    expect(wife / 400).toBeGreaterThan(0.4);
    expect(table / 400).toBeGreaterThan(0.1);
    expect((wife + table) / 400).toBeLessThan(0.9);       // välillä muualla
  });

  it("paikka arvotaan painojen mukaan ja varattu paikka ohitetaan", () => {
    const spots: Spot[] = [
      { key: "a", weight: 0.7, x: 0, z: 0, yaw: 0 },
      { key: "b", weight: 0.2, x: 5, z: 0, yaw: 0 },
      { key: "c", weight: 0.1, x: 10, z: 0, yaw: 0 },
    ];
    const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
    const rng = seeded(7);
    for (let i = 0; i < 1000; i++) counts[pickSpot(spots, rng).key]++;
    expect(counts.a).toBeGreaterThan(600);
    expect(counts.c).toBeGreaterThan(40);
    for (let i = 0; i < 50; i++) expect(pickSpot(spots, rng, (s) => s.x !== 0).key).not.toBe("a");
    expect(pickSpot(spots, rng, () => false).key).toMatch(/[abc]/);   // ei vapaata: silti jokin
  });
});
