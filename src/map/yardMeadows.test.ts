import { describe, expect, it } from "vitest";
import { createCampaign, type SiteInstance } from "./campaign";
import { MAP_HEIGHT, MAP_WIDTH, createWorldMap, mapCell, mapIndex, type MapCell, type MapPosition, type WorldMapDefinition } from "./domain";
import { PROTOTYPE_MAP } from "./prototype";
import { completeSiteInstances, newSiteInstances } from "./siteInstances";
import { yardMeadowMap } from "./yardMeadows";

const yard: SiteInstance = { id: "yard", kind: "yard", x: 10, y: 10, archer: true };
const camp: SiteInstance = { id: "camp", kind: "camp", x: 9, y: 10, archer: false };

function filledMap(terrainId: MapCell["terrainId"], overrides: readonly (MapCell & MapPosition)[] = []) {
  const cells: MapCell[] = Array.from({ length: MAP_WIDTH * MAP_HEIGHT }, () => ({ terrainId }));
  for (const { x, y, ...cell } of overrides) cells[y * MAP_WIDTH + x] = cell;
  return createWorldMap(cells);
}

function connectedMeadows(map: WorldMapDefinition, yardPosition: MapPosition): number {
  const found = new Set<number>();
  const queue = [yardPosition];
  for (const { x, y } of queue) {
    if (Math.abs(x - yardPosition.x) > 2 || Math.abs(y - yardPosition.y) > 2) continue;
    const index = mapIndex(map, x, y);
    if (found.has(index) || mapCell(map, x, y)?.terrainId !== "meadow") continue;
    found.add(index);
    queue.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 });
  }
  return found.size;
}

describe("pihaniityt", () => {
  it("kasvattaa talosta yhtenäisen 3–9 ruudun niityn ja käyttää tallennettua siementä", () => {
    const map = filledMap("forest");
    const shapes = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const result = yardMeadowMap(map, seed, [yard, camp]);
      const meadowIndices = result.cells.flatMap((cell, index) => cell.terrainId === "meadow" ? [index] : []);
      expect(meadowIndices.length).toBeGreaterThanOrEqual(3);
      expect(meadowIndices.length).toBeLessThanOrEqual(9);
      expect(connectedMeadows(result, yard)).toBe(meadowIndices.length);
      expect(yardMeadowMap(map, seed, [camp, yard])).toEqual(result);
      expect(mapCell(result, camp.x, camp.y)?.terrainId).toBe("forest");
      shapes.add(meadowIndices.join(","));
    }
    expect(shapes.size).toBeGreaterThan(10);
    expect(map.cells.every((cell) => cell.terrainId === "forest")).toBe(true);
    expect(yardMeadowMap(map, 1, [camp])).toBe(map);
  });

  it("rajaa rantatalon niityn maalle ja säilyttää kiinteän paikan sekä joen", () => {
    const map = filledMap("water", [
      { x: 10, y: 10, terrainId: "forest" },
      { x: 10, y: 11, terrainId: "meadow" },
      { x: 11, y: 11, terrainId: "deepForest" },
      { x: 11, y: 10, terrainId: "river" },
      { x: 10, y: 12, terrainId: "forest", siteId: "lakeside" },
      { x: 9, y: 11, terrainId: "bog" },
      { x: 11, y: 12, terrainId: "rock" },
    ]);
    const result = yardMeadowMap(map, 23, [yard]);
    expect(connectedMeadows(result, yard)).toBe(3);
    expect(result.cells).toEqual(map.cells.map((cell, index) => (
      index === mapIndex(map, 10, 10) || index === mapIndex(map, 11, 11)
        ? { ...cell, terrainId: "meadow" }
        : cell
    )));
  });

  it("löytää vähintään kolme ruutua uusille ja vanhoille pihapaikoille oikealla kartalla", () => {
    for (let seed = 1; seed <= 1_000; seed++) {
      const newSites = newSiteInstances(seed);
      const migratedSites = completeSiteInstances(createCampaign(), seed).world.siteInstances;
      for (const sites of [newSites, migratedSites]) {
        const map = yardMeadowMap(PROTOTYPE_MAP, seed, sites);
        for (const site of sites) {
          if (site.kind === "yard") {
            expect(connectedMeadows(map, site), `piha ${site.id} (${site.x},${site.y}), siemen ${seed}`).toBeGreaterThanOrEqual(3);
          }
        }
      }
    }
  });
});
