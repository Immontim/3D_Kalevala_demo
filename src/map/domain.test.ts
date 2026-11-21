import { describe, expect, it } from "vitest";
import { WORLD_MINUTES_PER_DAY } from "./uiState";
import {
  MAP_HEIGHT,
  MAP_RULES,
  MAP_WIDTH,
  CROSSINGS,
  TERRAINS,
  TERRAIN_IDS,
  createWorldMap,
  createWorldMapState,
  mapIndex,
  moveOnMap,
  type MapCell,
  type CrossingId,
  type TerrainId,
} from "./domain";

function mapWith(overrides: { x: number; y: number; terrainId?: TerrainId; crossingId?: CrossingId; siteId?: string }[] = []) {
  const cells: MapCell[] = Array.from({ length: MAP_WIDTH * MAP_HEIGHT }, () => ({ terrainId: "meadow" }));
  for (const value of overrides) cells[value.y * MAP_WIDTH + value.x] = {
    terrainId: value.terrainId ?? "meadow",
    crossingId: value.crossingId,
    siteId: value.siteId,
  };
  return createWorldMap(cells);
}

describe("maailmankartan määrittely", () => {
  it("on 20 × 20 ruutua ja sisältää seitsemän parametrisoitua maastoa", () => {
    expect(MAP_WIDTH).toBe(20);
    expect(MAP_HEIGHT).toBe(20);
    expect(TERRAIN_IDS).toHaveLength(7);
    expect(Object.keys(TERRAINS)).toEqual([...TERRAIN_IDS]);
    for (const terrain of Object.values(TERRAINS)) {
      expect(terrain.minuteCost).toBeGreaterThanOrEqual(0);
      expect(typeof terrain.passable).toBe("boolean");
    }
  });

  it("skaalaa kulun päivän murto-osiin maaston mukaan", () => {
    expect(TERRAINS.meadow.minuteCost * 6).toBeCloseTo(WORLD_MINUTES_PER_DAY);
    expect(TERRAINS.forest.minuteCost * 4).toBeCloseTo(WORLD_MINUTES_PER_DAY);
    expect(TERRAINS.deepForest.minuteCost * 3).toBeCloseTo(WORLD_MINUTES_PER_DAY);
    expect(TERRAINS.rock.minuteCost * 2).toBeCloseTo(WORLD_MINUTES_PER_DAY);
    expect(TERRAINS.bog.minuteCost).toBeCloseTo(WORLD_MINUTES_PER_DAY * 0.7);
    expect(CROSSINGS.ford.minuteCost).toBeCloseTo(WORLD_MINUTES_PER_DAY * 0.4);
  });

  it("hylkää vääränkokoisen kartan", () => {
    expect(() => createWorldMap([{ terrainId: "meadow" }])).toThrow(/400/);
  });
});

describe("tutkimussumu", () => {
  it("paljastaa alussa sankarin ja kaikki kahdeksan naapuria", () => {
    const map = mapWith();
    const state = createWorldMapState(map, { x: 10, y: 10 });
    expect(state.discovered.filter(Boolean)).toHaveLength(9);
    expect(state.discovered[mapIndex(map, 9, 9)]).toBe(true);
    expect(state.discovered[mapIndex(map, 11, 11)]).toBe(true);
    expect(state.discovered[mapIndex(map, 12, 10)]).toBe(false);
  });

  it("rajaa 3 × 3 -paljastuksen kartan reunalla", () => {
    const map = mapWith();
    const state = createWorldMapState(map, { x: 0, y: 0 });
    expect(state.discovered.filter(Boolean)).toHaveLength(4);
  });

  it("säilyttää vanhat ruudut ja paljastaa uuden viereisen kaistaleen", () => {
    const map = mapWith();
    const before = createWorldMapState(map, { x: 10, y: 10 });
    const result = moveOnMap(map, before, "right");
    expect(result.state.discovered.filter(Boolean)).toHaveLength(12);
    expect(result.state.discovered[mapIndex(map, 9, 9)]).toBe(true);
    expect(result.state.discovered[mapIndex(map, 12, 9)]).toBe(true);
    expect(result.state.discovered[mapIndex(map, 12, 11)]).toBe(true);
  });
});

describe("karttaliike, aika ja kylläisyys", () => {
  it("liikkuu vain pääilmansuuntiin yhden ruudun", () => {
    const map = mapWith();
    const start = createWorldMapState(map, { x: 10, y: 10 });
    expect(moveOnMap(map, start, "up").state).toMatchObject({ x: 10, y: 9 });
    expect(moveOnMap(map, start, "right").state).toMatchObject({ x: 11, y: 10 });
    expect(moveOnMap(map, start, "down").state).toMatchObject({ x: 10, y: 11 });
    expect(moveOnMap(map, start, "left").state).toMatchObject({ x: 9, y: 10 });
    const invalid = moveOnMap(map, start, "up-right" as never);
    expect(invalid).toMatchObject({ moved: false, minutesSpent: 0 });
    expect(invalid.state).toBe(start);
  });

  it("estynyt liike ei muuta paikkaa, aikaa, kylläisyyttä tai paljastusta", () => {
    const map = mapWith([{ x: 11, y: 10, terrainId: "water" }]);
    const start = createWorldMapState(map, { x: 10, y: 10 }, { worldMinutes: 50, satiety: 88 });
    const result = moveOnMap(map, start, "right");
    expect(result).toMatchObject({ moved: false, minutesSpent: 0 });
    expect(result.state).toBe(start);
  });

  it("jokeen ei voi astua jalan", () => {
    const map = mapWith([{ x: 11, y: 10, terrainId: "river" }]);
    const start = createWorldMapState(map, { x: 10, y: 10 }, { worldMinutes: 50, satiety: 88 });
    const result = moveOnMap(map, start, "right");
    expect(result).toMatchObject({ moved: false, minutesSpent: 0 });
    expect(result.state).toBe(start);
  });

  it("kivinen kahlaamo tekee vain oman jokiruutunsa kuljettavaksi", () => {
    const map = mapWith([{ x: 11, y: 10, terrainId: "river", crossingId: "ford" }]);
    const start = createWorldMapState(map, { x: 10, y: 10 }, { worldMinutes: 50, satiety: 88 });
    const result = moveOnMap(map, start, "right");
    expect(result).toMatchObject({ moved: true, minutesSpent: CROSSINGS.ford.minuteCost });
    expect(result.state).toMatchObject({ x: 11, y: 10 });
    expect(result.state.worldMinutes).toBeCloseTo(50 + WORLD_MINUTES_PER_DAY * 0.4);
    expect(result.state.satiety).toBeCloseTo(88 - 1.44);
  });

  it("kuusi niittyliikettä kuluttaa päivän ja 3,6 kylläisyyspistettä", () => {
    const map = mapWith();
    let state = createWorldMapState(map, { x: 10, y: 10 });
    for (const direction of ["right", "left", "right", "left", "right", "left"] as const) {
      state = moveOnMap(map, state, direction).state;
    }
    expect(state.worldMinutes).toBeCloseTo(WORLD_MINUTES_PER_DAY);
    expect(state.satiety).toBeCloseTo(96.4);
  });

  it("kohdetiilin aika kasvattaa maailmanaikaa ja vähentää kylläisyyttä", () => {
    const map = mapWith([{ x: 11, y: 10, terrainId: "bog" }]);
    const start = createWorldMapState(map, { x: 10, y: 10 }, { worldMinutes: 100, satiety: 80 });
    const result = moveOnMap(map, start, "right");
    expect(result.minutesSpent).toBe(TERRAINS.bog.minuteCost);
    expect(result.state.worldMinutes).toBe(100 + TERRAINS.bog.minuteCost);
    expect(result.state.satiety).toBeCloseTo(80 - TERRAINS.bog.minuteCost * MAP_RULES.satietyLossPerMinute);
  });

  it("kylläisyys pysyy välillä 0–100 eikä estä liikkumista", () => {
    const map = mapWith([{ x: 11, y: 10, terrainId: "bog" }]);
    const start = createWorldMapState(map, { x: 10, y: 10 }, { satiety: 0.1 });
    const result = moveOnMap(map, start, "right");
    expect(result.moved).toBe(true);
    expect(result.state.satiety).toBe(0);
  });

  it("välittää kohderuudun pihapiirin tunnisteen", () => {
    const map = mapWith([{ x: 11, y: 10, siteId: "yard" }]);
    const result = moveOnMap(map, createWorldMapState(map, { x: 10, y: 10 }), "right");
    expect(result.siteId).toBe("yard");
  });
});
