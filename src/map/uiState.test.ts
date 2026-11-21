import { describe, expect, it } from "vitest";
import { mapCalendarTime, mapCellVisibility, satietyBand, WORLD_MINUTES_PER_DAY } from "./uiState";

describe("karttaruudun näkyvyys", () => {
  it("näyttää sankarin ruudun ja kaikki kahdeksan naapuria", () => {
    for (let y = 9; y <= 11; y++) {
      for (let x = 9; x <= 11; x++) {
        expect(mapCellVisibility(true, { x: 10, y: 10 }, { x, y })).toBe("visible");
      }
    }
  });

  it("himmentää aiemmin löydetyn kaukoruudun mutta pitää löytämättömän pimeänä", () => {
    expect(mapCellVisibility(true, { x: 10, y: 10 }, { x: 12, y: 10 })).toBe("remembered");
    expect(mapCellVisibility(false, { x: 10, y: 10 }, { x: 10, y: 10 })).toBe("unknown");
  });
});

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

  it("vaihtaa päivän täsmälleen myös päivän murto-osista kertyvällä ajalla", () => {
    const meadowMove = WORLD_MINUTES_PER_DAY / 6;
    const accumulated = (moves: number) => {
      let time = 0;
      for (let i = 0; i < moves; i++) time += meadowMove;
      return time;
    };
    const sixMeadowMoves = accumulated(6);
    const fullMoon = accumulated(168);
    expect(mapCalendarTime(sixMeadowMoves)).toMatchObject({ moon: 0, day: 2 });
    expect(mapCalendarTime(fullMoon)).toMatchObject({ moon: 1, day: 1, phase: 0 });
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
