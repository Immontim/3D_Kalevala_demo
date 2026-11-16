import { describe, expect, it } from "vitest";
import { GAZE_ORIGIN_HEIGHT, ITEM_TAKE_RANGE, gazeDirection, gazeOrigin, pickGazeTarget, pointOnGaze } from "./sceneInteraction";

const hero = { x: 0, y: 0, z: 0 };
const target = (id: string, x: number, y: number, z: number, radius = 0.3) => ({ id, x, y, z, radius });

describe("scene interaction gaze", () => {
  it("suuntaa yaw-arvon mukaisesti ja positiivinen pitch alas", () => {
    expect(gazeDirection(0, 0)).toEqual({ x: 0, y: -0, z: 1 });
    const right = gazeDirection(Math.PI / 2, 0);
    expect(right.x).toBeCloseTo(1);
    expect(right.z).toBeCloseTo(0);
    expect(gazeDirection(0, 0.2).y).toBeLessThan(0);
  });

  it("nostaa katseen lähtöpisteen sankarin rinnan yläpuolelle", () => {
    expect(gazeOrigin(hero)).toEqual({ x: 0, y: GAZE_ORIGIN_HEIGHT, z: 0 });
  });

  it("valitsee katseakselilla olevan kohteen mutta ei sivussa tai takana olevaa", () => {
    const front = target("front", 0, 1.42, 2);
    expect(pickGazeTarget(hero, 0, 0, [target("side", 1, 1.42, 2), target("back", 0, 1.42, -1), front])?.id).toBe("front");
  });

  it("sallii tarkoituksella väljän kohdistusalueen", () => {
    expect(pickGazeTarget(hero, 0, 0, [target("near-ray", 0.24, 1.42, 2, 0.25)])?.id).toBe("near-ray");
    expect(pickGazeTarget(hero, 0, 0, [target("miss", 0.26, 1.42, 2, 0.25)])).toBeNull();
  });

  it("hylkää pitkän tartuntakantaman ulkopuolen", () => {
    expect(pickGazeTarget(hero, 0, 0, [target("far", 0, 1.42, ITEM_TAKE_RANGE + 0.2)])).toBeNull();
  });

  it("valitsee tarkemmin tähdätyn kohteen ennen sivumpana olevaa", () => {
    const exact = target("exact", 0, 1.42, 2.5, 0.4);
    const offset = target("offset", 0.2, 1.42, 1.6, 0.4);
    expect(pickGazeTarget(hero, 0, 0, [offset, exact])?.id).toBe("exact");
  });

  it("tuottaa HUDiin projisoitavan pisteen katseakselilta", () => {
    expect(pointOnGaze(gazeOrigin(hero), gazeDirection(0, 0), 3)).toEqual({ x: 0, y: 1.42, z: 3 });
  });
});
