import { describe, expect, it } from "vitest";
import { CollisionWorld } from "../collision";
import {
  ARCHERY, type ArrowTraceWorld, drawAmount, dropAt, groundCrossing, launchSpeed, launchVelocity,
  newQuiver, returnArrow, segmentSphere, stepArrow, takeArrow, traceSegment,
} from "./archery";

const flat = (h = 0) => () => h;
const noStatic = () => null;

describe("jousen jännitys ja lähtönopeus", () => {
  it("jännitys kasvaa pitoajan mukaan ja pysähtyy täyteen", () => {
    expect(drawAmount(0)).toBe(0);
    expect(drawAmount(ARCHERY.drawTime / 2)).toBeCloseTo(0.5);
    expect(drawAmount(ARCHERY.drawTime * 3)).toBe(1);
  });

  it("täysi jännitys antaa suurimman lähtönopeuden, vajaa pienemmän", () => {
    expect(launchSpeed(1)).toBe(ARCHERY.speedMax);
    expect(launchSpeed(0)).toBe(ARCHERY.speedMin);
    expect(launchSpeed(0.5)).toBeGreaterThan(ARCHERY.speedMin);
    expect(launchSpeed(0.5)).toBeLessThan(ARCHERY.speedMax);
  });

  it("lähtönopeus osoittaa tähtäyspistettä kohti annetulla vauhdilla", () => {
    const v = launchVelocity({ x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: 10 }, 40);
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(0);
    expect(v.z).toBeCloseTo(40);
  });
});

describe("nuolen lentorata", () => {
  it("noudattaa painovoiman paraabelia askelkoosta riippumatta", () => {
    const v0 = { x: 0, y: 10, z: 30 };
    let a = { p: { x: 0, y: 0, z: 0 }, v: v0 };
    for (let i = 0; i < 100; i++) a = stepArrow(a.p, a.v, 0.01);
    const b = stepArrow({ x: 0, y: 0, z: 0 }, v0, 1);
    expect(a.p.y).toBeCloseTo(b.p.y, 6);
    expect(a.p.z).toBeCloseTo(30, 6);
    expect(a.p.y).toBeCloseTo(10 - ARCHERY.gravity / 2, 6);
  });

  it("vaakasuoraan ammuttu nuoli putoaa 20 metrissä täydellä jännityksellä alle puoli metriä", () => {
    const drop = dropAt(ARCHERY.speedMax, 20);
    expect(drop).toBeGreaterThan(0.2);
    expect(drop).toBeLessThan(0.5);
    expect(dropAt(ARCHERY.speedMin, 20)).toBeGreaterThan(drop * 4);
  });

  it("kantaa täydellä jännityksellä 45 asteen kulmassa yli sata metriä", () => {
    const s = ARCHERY.speedMax, v = { x: 0, y: s * Math.SQRT1_2, z: s * Math.SQRT1_2 };
    let p = { x: 0, y: 0.001, z: 0 }, vel = v;
    for (let i = 0; i < 2000 && p.y > 0; i++) ({ p, v: vel } = stepArrow(p, vel, 0.005));
    expect(p.z).toBeGreaterThan(100);
  });
});

describe("nuolen osumat", () => {
  it("osuu maahan kohdassa, jossa jana painuu maan alle", () => {
    const t = groundCrossing({ x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 4 }, flat(0));
    expect(t).toBeCloseTo(0.5, 2);
  });

  it("osuu kumpuilevaan maastoon ennen tasaisen maan kohtaa", () => {
    const hill = (_x: number, z: number) => (z > 2 ? 0.8 : 0);
    const hit = traceSegment({ x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 4 }, { groundAt: hill, staticHit: noStatic, bodies: [] });
    expect(hit?.kind).toBe("ground");
    expect(hit!.z).toBeGreaterThan(1.9);
    expect(hit!.z).toBeLessThan(2.3);
  });

  it("osuu eläimeen ennen sen takana olevaa maata ja kertoo kumpaan", () => {
    const world: ArrowTraceWorld = { groundAt: flat(0), staticHit: noStatic, bodies: [{ id: "hare-1", x: 0, y: 0.2, z: 5, radius: 0.25 }] };
    const hit = traceSegment({ x: 0, y: 0.4, z: 0 }, { x: 0, y: -0.1, z: 10 }, world);
    expect(hit?.kind).toBe("body");
    expect(hit?.id).toBe("hare-1");
    expect(hit!.z).toBeGreaterThan(4.6);
    expect(hit!.z).toBeLessThan(5);
  });

  it("ohi menevä nuoli ei osu eläimeen", () => {
    expect(segmentSphere({ x: 1, y: 0.2, z: 0 }, { x: 1, y: 0.2, z: 10 }, { x: 0, y: 0.2, z: 5 }, 0.25)).toBeNull();
  });

  it("osuu puunrunkoon (rajaton korkeus) mutta lentää matalan kiven yli", () => {
    const c = new CollisionWorld();
    c.add({ id: "tree", kind: "circle", x: 0, z: 6, radius: 0.3, blocksMovement: true, blocksMelee: true, blocksCamera: true });
    c.add({ id: "rock", kind: "circle", x: 0, z: 3, radius: 0.7, blocksMovement: true, blocksMelee: true, top: 0.9 });
    const world: ArrowTraceWorld = {
      groundAt: flat(0),
      staticHit: (a, b) => { const h = c.firstProjectileHit(a.x, a.y, a.z, b.x, b.y, b.z); return h && { t: h.t, id: h.collider.id }; },
      bodies: [],
    };
    const high = traceSegment({ x: 0, y: 1.4, z: 0 }, { x: 0, y: 1.4, z: 10 }, world);
    expect(high?.kind).toBe("static");
    expect(high?.id).toBe("tree");
    expect(high!.z).toBeCloseTo(5.7, 2);
    const low = traceSegment({ x: 0, y: 0.5, z: 0 }, { x: 0, y: 0.5, z: 10 }, world);
    expect(low?.id).toBe("rock");
    expect(low!.z).toBeCloseTo(2.3, 2);
  });

  it("laskeutuu matalan kiven päälle ylhäältä", () => {
    const c = new CollisionWorld();
    c.add({ id: "rock", kind: "circle", x: 0, z: 0, radius: 1, blocksMovement: true, blocksMelee: true, top: 1 });
    const hit = c.firstProjectileHit(0, 2, -0.5, 0, 0.5, 0.5);
    expect(hit?.collider.id).toBe("rock");
    expect(hit!.y).toBeCloseTo(1, 4);
  });
});

describe("nuoliviini", () => {
  it("alkaa täytenä ja tyhjenee laukauksista", () => {
    const q = newQuiver();
    expect(q.arrows).toBe(15);
    for (let i = 0; i < 15; i++) expect(takeArrow(q)).toBe(true);
    expect(takeArrow(q)).toBe(false);
    expect(q.arrows).toBe(0);
  });

  it("poimittu nuoli palaa viiniin, mutta täyteen ei mahdu", () => {
    const q = newQuiver();
    expect(returnArrow(q)).toBe(false);
    takeArrow(q);
    expect(returnArrow(q)).toBe(true);
    expect(q.arrows).toBe(15);
  });
});
