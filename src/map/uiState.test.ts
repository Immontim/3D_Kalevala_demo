import { describe, expect, it } from "vitest";
import { satietyBand, sceneForMapSite } from "./uiState";

describe("kylläisyyden viisi kasvokuvaa", () => {
  it.each([
    [100, "full"], [80, "full"],
    [79.99, "content"], [60, "content"],
    [59.99, "neutral"], [40, "neutral"],
    [39.99, "peckish"], [20.01, "peckish"],
    [20, "starving"], [19.99, "starving"], [0, "starving"],
  ] as const)("valitsee arvolla %s kasvot %s", (value, band) => {
    expect(satietyBand(value)).toBe(band);
  });

  it("rajaa esityksessä virheellisen arvon turvallisesti", () => {
    expect(satietyBand(120)).toBe("full");
    expect(satietyBand(-5)).toBe("starving");
  });
});

describe("karttapaikan 3D-kohde", () => {
  it("kytkee pihan rauhalliseen pihaan ja punaisen käden nuotioaukioon", () => {
    expect(sceneForMapSite("yard")).toBe("yard");
    expect(sceneForMapSite("campfire")).toBe("clearing");
    expect(sceneForMapSite(undefined)).toBeNull();
    expect(sceneForMapSite("unknown")).toBeNull();
  });
});
