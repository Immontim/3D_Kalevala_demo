import { describe, expect, it } from "vitest";
import { MAP_HEIGHT, MAP_WIDTH, createWorldMap, type MapCell } from "./domain";
import { riverTile, terrainFrame, terrainVariant } from "./tiles";

function riverMap(
  points: readonly (readonly [number, number])[],
  waters: readonly (readonly [number, number])[] = [],
) {
  const cells: MapCell[] = Array.from({ length: MAP_WIDTH * MAP_HEIGHT }, () => ({ terrainId: "meadow" }));
  for (const [x, y] of points) cells[y * MAP_WIDTH + x] = { terrainId: "river" };
  for (const [x, y] of waters) cells[y * MAP_WIDTH + x] = { terrainId: "water" };
  return createWorldMap(cells);
}

describe("maastolaattojen variaatiot", () => {
  it("valitsee koordinaateille vakaan variaation ja käyttää molempia kuvia", () => {
    expect(terrainVariant("meadow", 7, 9)).toBe(terrainVariant("meadow", 7, 9));
    const variants = new Set(Array.from({ length: 20 }, (_, x) => terrainVariant("meadow", x, 5)));
    expect(variants).toEqual(new Set([0, 1]));
    expect(terrainFrame("meadow", 7, 9)).toHaveLength(2);
  });
});

describe("jokilaattojen yhteydet", () => {
  it.each([
    ["pystysuora", [[10, 9], [10, 10], [10, 11]], 0, 5],
    ["vaakasuora", [[9, 10], [10, 10], [11, 10]], 1, 10],
    ["koilliskaarre", [[10, 9], [10, 10], [11, 10]], 0, 3],
    ["kaakkoiskaarre", [[11, 10], [10, 10], [10, 11]], 1, 6],
    ["lounaiskaarre", [[10, 11], [10, 10], [9, 10]], 2, 12],
    ["luoteiskaarre", [[9, 10], [10, 10], [10, 9]], 3, 9],
  ] as const)("ratkaisee %s", (_name, points, turns, connections) => {
    expect(riverTile(riverMap(points), 10, 10)).toMatchObject({ quarterTurns: turns, connections });
  });

  it("liittää joen päässä olevan veden osaksi uomaa", () => {
    const tile = riverTile(riverMap([[10, 10], [11, 10]], [[9, 10]]), 10, 10);
    expect(tile).toMatchObject({ quarterTurns: 1, connections: 10 });
  });
});
