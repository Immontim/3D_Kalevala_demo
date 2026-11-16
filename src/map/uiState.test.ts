import { describe, expect, it } from "vitest";
import { mapCalendarTime, satietyBand, sceneForMapSite } from "./uiState";

describe("karttakalenteri", () => {
  it.each([
    [0, { moon: 0, day: 1, phase: 0 }],
    [10, { moon: 0, day: 2, phase: 0 }],
    [179, { moon: 0, day: 28, phase: 7 }],
    [180, { moon: 1, day: 1, phase: 0 }],
    [359, { moon: 1, day: 28, phase: 7 }],
    [360, { moon: 2, day: 1, phase: 0 }],
  ] as const)("muuntaa tausta-ajan %s kuuksi, päiväksi ja vaiheeksi", (time, expected) => {
    expect(mapCalendarTime(time)).toEqual(expected);
  });

  it("rajaa virheellisen ajan ensimmäiseen päivään", () => {
    expect(mapCalendarTime(-10)).toEqual({ moon: 0, day: 1, phase: 0 });
    expect(mapCalendarTime(Number.NaN)).toEqual({ moon: 0, day: 1, phase: 0 });
  });
});

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
    expect(sceneForMapSite("lakeside")).toBe("lakeside");
    expect(sceneForMapSite(undefined)).toBeNull();
    expect(sceneForMapSite("unknown")).toBeNull();
  });
});
