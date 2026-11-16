import { describe, expect, it } from "vitest";
import { STRIKES } from "./combat";
import { TALK_ZONE, USE_ZONE, pickTarget } from "./interact";

const at = (x: number, z: number, id = "x") => ({ id, name: id, x, z });
const hero = (yaw = 0) => ({ x: 0, z: 0, yaw });

describe("puheen kantama ja sektori", () => {
  it("on otettu miekan kevyestä sivalluksesta", () => {
    expect(TALK_ZONE.range).toBe(STRIKES.slash.light.range);
    expect(TALK_ZONE.arc).toBe(STRIKES.slash.light.arc);
  });

  it("löytää edessä kantaman sisällä olevan", () => {
    expect(pickTarget(hero(), [at(0, 2)], TALK_ZONE)?.id).toBe("x");
  });

  it("ei löydä kantaman ulkopuolella olevaa", () => {
    expect(pickTarget(hero(), [at(0, TALK_ZONE.range + 0.1)], TALK_ZONE)).toBeNull();
  });

  it("ei löydä selän takana olevaa", () => {
    expect(pickTarget(hero(), [at(0, -1)], TALK_ZONE)).toBeNull();
  });

  it("sektorin reuna: 55° osuu, 65° ohittaa (puolikulma 60°)", () => {
    const d = 1.5;
    const side = (deg: number) => at(Math.sin((deg * Math.PI) / 180) * d, Math.cos((deg * Math.PI) / 180) * d);
    expect(pickTarget(hero(), [side(55)], TALK_ZONE)).not.toBeNull();
    expect(pickTarget(hero(), [side(-55)], TALK_ZONE)).not.toBeNull();
    expect(pickTarget(hero(), [side(65)], TALK_ZONE)).toBeNull();
    expect(pickTarget(hero(), [side(-65)], TALK_ZONE)).toBeNull();
  });

  it("katsesuunta kääntää sektoria", () => {
    // Katse kohti +x: kohde +x-suunnassa on edessä, +z-suunnassa sivulla yli 60°.
    expect(pickTarget(hero(Math.PI / 2), [at(2, 0)], TALK_ZONE)).not.toBeNull();
    expect(pickTarget(hero(Math.PI / 2), [at(0, 2)], TALK_ZONE)).toBeNull();
  });

  it("valitsee lähimmän", () => {
    expect(pickTarget(hero(), [at(0, 2, "far"), at(0.3, 1, "near")], TALK_ZONE)?.id).toBe("near");
  });

  it("käytön ulottuma on lyhyempi kuin puheen", () => {
    expect(USE_ZONE.range).toBeLessThan(TALK_ZONE.range);
    expect(pickTarget(hero(), [at(0, 2)], USE_ZONE)).toBeNull();
    expect(pickTarget(hero(), [at(0, 1.2)], USE_ZONE)).not.toBeNull();
  });
});
