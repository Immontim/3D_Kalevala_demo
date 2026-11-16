import { describe, expect, it } from "vitest";
import { FREECAM, FreeCam, lookFreeCam, scaleFreeCamSpeed, stepFreeCam } from "./freecam";

const cam = (over: Partial<FreeCam> = {}): FreeCam => ({ x: 0, y: 2, z: 0, yaw: 0, pitch: 0, speed: 4, ...over });
const keys = (...codes: string[]) => (c: string) => codes.includes(c);

describe("vapaa kamera", () => {
  it("W liikuttaa katseen suuntaan ja yaw 0 katsoo -Z:aan", () => {
    const c = cam();
    stepFreeCam(c, keys("KeyW"), 0.5);
    expect(c.z).toBeCloseTo(-2);
    expect(c.x).toBeCloseTo(0);
    expect(c.y).toBeCloseTo(2);
  });
  it("ylöspäin katsova kamera nousee eteen liikuttaessa", () => {
    const c = cam({ pitch: Math.PI / 4 });
    stepFreeCam(c, keys("KeyW"), 1);
    expect(c.y).toBeGreaterThan(2);
    expect(Math.hypot(c.x, c.y - 2, c.z)).toBeCloseTo(4);
  });
  it("D liikkuu oikealle katseen mukaan, S taakse, E ylös ja Q alas", () => {
    const c = cam({ yaw: Math.PI / 2 }); // katsoo -X:ään; oikea = (cos yaw, 0, -sin yaw) = -Z
    stepFreeCam(c, keys("KeyD"), 1);
    expect(c.x).toBeCloseTo(0);
    expect(c.z).toBeCloseTo(-4);
    const d = cam();
    stepFreeCam(d, keys("KeyE"), 0.25);
    expect(d.y).toBeCloseTo(3);
    stepFreeCam(d, keys("KeyQ"), 0.5);
    expect(d.y).toBeCloseTo(1);
  });
  it("vinottainen liike ei ole nopeampaa ja Shift nopeuttaa", () => {
    const c = cam();
    stepFreeCam(c, keys("KeyW", "KeyD"), 1);
    expect(Math.hypot(c.x, c.z)).toBeCloseTo(4);
    const f = cam();
    stepFreeCam(f, keys("KeyW", "ShiftLeft"), 1);
    expect(f.z).toBeCloseTo(-4 * FREECAM.boost);
  });
  it("ei painikkeita: ei liikettä", () => {
    const c = cam();
    stepFreeCam(c, keys(), 1);
    expect(c).toEqual(cam());
  });
  it("hiiri kääntää katsetta ja pystykulma rajataan", () => {
    const c = cam();
    lookFreeCam(c, 100, 0);
    expect(c.yaw).toBeLessThan(0);
    lookFreeCam(c, 0, -1e6);
    expect(c.pitch).toBe(FREECAM.pitchMax);
    lookFreeCam(c, 0, 1e6);
    expect(c.pitch).toBe(-FREECAM.pitchMax);
  });
  it("rulla säätää nopeutta rajojen sisällä", () => {
    const c = cam({ speed: 4 });
    scaleFreeCamSpeed(c, -100);
    expect(c.speed).toBeGreaterThan(4);
    for (let i = 0; i < 200; i++) scaleFreeCamSpeed(c, -100);
    expect(c.speed).toBe(FREECAM.maxSpeed);
    for (let i = 0; i < 400; i++) scaleFreeCamSpeed(c, 100);
    expect(c.speed).toBe(FREECAM.minSpeed);
  });
});
