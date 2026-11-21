import { describe, expect, it } from "vitest";
import { SCENE_IDS } from "./app/route";
import {
  ENTRY_INSET, SCENE_LAYOUTS, approachSpawns, circlePolygon, clampToWalkable, entrySpawn, exitCrossed, nearestExit, ringExit,
  sceneLayout, walkableDepth, type SceneLayout,
} from "./sceneLayout";

const square: SceneLayout = {
  bounds: [{ x: -10, z: -10 }, { x: 10, z: -10 }, { x: 10, z: 10 }, { x: -10, z: 10 }],
  arena: { x: 0, z: 0, radius: 10 }, exits: [],
};
// L-muotoinen (kovera) monikulmio
const ell: SceneLayout = {
  bounds: [{ x: 0, z: 0 }, { x: 20, z: 0 }, { x: 20, z: 5 }, { x: 5, z: 5 }, { x: 5, z: 20 }, { x: 0, z: 20 }],
  arena: { x: 0, z: 0, radius: 5 }, exits: [],
};

describe("circlePolygon ja ringExit", () => {
  it("tekee oikean säteisen monikulmion", () => {
    const p = circlePolygon(0, 0, 11);
    expect(p).toHaveLength(48);
    for (const v of p) expect(Math.hypot(v.x, v.z)).toBeCloseTo(11, 6);
  });
  it("asettaa portin kulman mukaan: 0 = +z, 90 = +x", () => {
    const s = ringExit("a", 0, 10, 2, "s");
    expect(s.x).toBeCloseTo(0); expect(s.z).toBeCloseTo(10);
    const e = ringExit("b", 90, 10, 2, "e");
    expect(e.x).toBeCloseTo(10); expect(e.yaw).toBeCloseTo(Math.PI / 2);
  });
});

describe("clampToWalkable", () => {
  it("jättää sisäpisteen ennalleen", () => {
    expect(clampToWalkable(square, 3, -4, 0.5)).toEqual({ x: 3, z: -4 });
  });
  it("työntää ulkopisteen sisään säteen verran reunasta", () => {
    const p = clampToWalkable(square, 15, 2, 0.5);
    expect(p.x).toBeCloseTo(9.5); expect(p.z).toBeCloseTo(2);
  });
  it("kunnioittaa sädettä reunan lähellä", () => {
    const p = clampToWalkable(square, 9.8, 0, 1);
    expect(p.x).toBeCloseTo(9);
  });
  it("selviää kaukaisesta ulkopisteestä", () => {
    const p = clampToWalkable(square, 1e4, -1e4, 0.5);
    expect(p.x).toBeCloseTo(9.5); expect(p.z).toBeCloseTo(-9.5);
  });
  it("toimii koverassa monikulmiossa", () => {
    const p = clampToWalkable(ell, 10, 10, 0.5);
    expect(walkableDepth(ell, p.x, p.z)).toBeGreaterThanOrEqual(0.5 - 1e-6);
    expect(clampToWalkable(ell, 15, 2.5, 0.5)).toEqual({ x: 15, z: 2.5 });
  });
  it("pitää ympyräkohtauksessa kiekon sisällä", () => {
    const p = clampToWalkable(sceneLayout("cairnfield"), -30, 5, 0.6);
    expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(11 - 0.6 + 0.05);
  });
});

describe("poistumiskäytävä", () => {
  for (const id of SCENE_IDS) {
    const layout = sceneLayout(id);
    for (const e of layout.exits) {
      const ox = Math.sin(e.yaw), oz = Math.cos(e.yaw);
      it(`${id}/${e.id}: portin takana kuljettavaa ja poistuminen laukeaa`, () => {
        const out = { x: e.x + ox, z: e.z + oz };
        const p0 = clampToWalkable(layout, out.x, out.z, 0.5);
        expect(p0.x).toBeCloseTo(out.x); expect(p0.z).toBeCloseTo(out.z);
        expect(exitCrossed(layout, out.x, out.z)?.id).toBe(e.id);
        expect(exitCrossed(layout, e.x - ox * 3, e.z - oz * 3)).toBeNull();
        // sivusuunnassa ulos yrittävä työntyy takaisin käytävään
        const p = clampToWalkable(layout, e.x + ox * 2 + oz * 8, e.z + oz * 2 - ox * 8, 0.5);
        expect(walkableDepth(layout, p.x, p.z)).toBeGreaterThanOrEqual(0.5 - 1e-6);
      });
    }
  }
  it("origo ei laukaise poistumista missään kohtauksessa", () => {
    for (const id of SCENE_IDS) expect(exitCrossed(sceneLayout(id), 0, 0)).toBeNull();
  });
  it("nearestExit löytää lähimmän", () => {
    const w = sceneLayout("wilds");
    expect(nearestExit(w, 90, 15)?.exit.id).toBe("east");
    expect(nearestExit({ ...w, exits: [] }, 0, 0)).toBeNull();
  });
});

describe("kohtausdata", () => {
  it("korven alue mahtuu 200 x 200 metriin", () => {
    for (const v of SCENE_LAYOUTS.wilds.bounds) {
      expect(Math.abs(v.x)).toBeLessThanOrEqual(100);
      expect(Math.abs(v.z)).toBeLessThanOrEqual(100);
    }
  });
  it("portin sisäpuoli on kuljettavaa ja korven portit ovat reunalla (alle 1,5 m)", () => {
    for (const id of SCENE_IDS) {
      const layout = sceneLayout(id);
      for (const e of layout.exits) {
        const px = e.x - Math.sin(e.yaw) * 5, pz = e.z - Math.cos(e.yaw) * 5;
        expect(walkableDepth(layout, px, pz)).toBeGreaterThan(0);
      }
    }
    const w = SCENE_LAYOUTS.wilds;
    for (const e of w.exits) {
      let best = Infinity;
      for (let i = 0, j = w.bounds.length - 1; i < w.bounds.length; j = i++) {
        const a = w.bounds[j], b = w.bounds[i];
        const ex = b.x - a.x, ez = b.z - a.z;
        const t = Math.max(0, Math.min(1, ((e.x - a.x) * ex + (e.z - a.z) * ez) / (ex * ex + ez * ez)));
        best = Math.min(best, Math.hypot(e.x - (a.x + ex * t), e.z - (a.z + ez * t)));
      }
      expect(best).toBeLessThanOrEqual(1.5);
    }
  });
  it("arenan keskus on kuljettavalla alueella", () => {
    for (const id of SCENE_IDS) {
      const l = sceneLayout(id);
      expect(walkableDepth(l, l.arena.x, l.arena.z)).toBeGreaterThan(1);
    }
  });
});

describe("entrySpawn: aloitus polunsuulla", () => {
  it("on ensimmäisen polunsuun sisäpuolella, kuljettavalla alueella ja katse kohtaukseen", () => {
    for (const id of SCENE_IDS) {
      const l = sceneLayout(id);
      const s = entrySpawn(l);
      const e = l.exits[0];
      expect(Math.hypot(s.x - e.x, s.z - e.z)).toBeCloseTo(ENTRY_INSET, 6);
      expect(walkableDepth(l, s.x, s.z)).toBeGreaterThan(0.5);
      expect(exitCrossed(l, s.x, s.z)).toBeNull();
      // Katse osoittaa poispäin portista (sisään).
      const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
      expect(fx * (s.x - e.x) + fz * (s.z - e.z)).toBeGreaterThan(0);
    }
  });
  it("aukiolla aloitus on etelän polunsuulla, ei keskellä", () => {
    const s = entrySpawn(sceneLayout("clearing"));
    expect(Math.hypot(s.x, s.z)).toBeGreaterThan(7);
    expect(s.z).toBeLessThan(0);
  });
});

describe("approachSpawns: vastustajien tulopaikat", () => {
  const l = sceneLayout("clearing");
  it("tulevat pelaajan vastakkaiselta puolelta metsästä, kuljettavan alueen ulkopuolelta", () => {
    const player = { x: 0, z: -8 };
    const spots = approachSpawns(l, player, 3, 0);
    expect(spots).toHaveLength(3);
    for (const p of spots) {
      expect(p.z).toBeGreaterThan(10);
      expect(walkableDepth(l, p.x, p.z)).toBeLessThan(0);
      expect(Math.hypot(p.x - player.x, p.z - player.z)).toBeGreaterThan(20);
    }
  });
  it("katsovat valmiiksi pelaajaa kohti ja ovat vierekkäin", () => {
    const player = { x: 3, z: -6 };
    const spots = approachSpawns(l, player, 3, 0.3);
    for (const p of spots) {
      const toX = player.x - p.x, toZ = player.z - p.z, len = Math.hypot(toX, toZ);
      expect(Math.sin(p.yaw) * toX / len + Math.cos(p.yaw) * toZ / len).toBeCloseTo(1, 6);
    }
    expect(Math.hypot(spots[1].x - spots[0].x, spots[1].z - spots[0].z)).toBeCloseTo(1.8, 6);
  });
  it("ilman metsäkehää (aidattu piha) tulopaikka on alueen reunalla sisäpuolella", () => {
    const yard = sceneLayout("homestead");
    const [p] = approachSpawns(yard, { x: 0, z: 8 }, 1, 0);
    expect(walkableDepth(yard, p.x, p.z)).toBeGreaterThan(0.5);
    expect(p.z).toBeLessThan(-8);
  });
});
