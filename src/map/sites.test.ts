import { describe, expect, it } from "vitest";
import { MAP_HEIGHT, MAP_WIDTH, createWorldMap, type MapCell } from "./domain";
import {
  MAP_SITE_DEFINITIONS,
  discoverVisibleSites,
  legacyKnownSiteIds,
  mapSiteDisplay,
  sceneForMapSite,
  siteDisplayForDefinition,
} from "./sites";

function siteMap(overrides: { x: number; y: number; siteId: string }[]) {
  const cells: MapCell[] = Array.from({ length: MAP_WIDTH * MAP_HEIGHT }, () => ({ terrainId: "meadow" }));
  for (const value of overrides) cells[value.y * MAP_WIDTH + value.x] = {
    terrainId: "meadow",
    siteId: value.siteId,
  };
  return createWorldMap(cells);
}

describe("2D-kohtaamisrekisteri", () => {
  it("luokittelee nykyiset kolme paikkaa kiinteiksi ja pysyviksi", () => {
    expect(Object.keys(MAP_SITE_DEFINITIONS).sort()).toEqual(["campfire", "lakeside", "yard"]);
    for (const site of Object.values(MAP_SITE_DEFINITIONS)) {
      expect(site).toMatchObject({ movement: "fixed", lifetime: "persistent" });
    }
    expect(sceneForMapSite("yard")).toBe("yard");
    expect(sceneForMapSite("lakeside")).toBe("lakeside");
    expect(sceneForMapSite("campfire")).toBe("clearing");
    expect(sceneForMapSite("unknown")).toBeNull();
  });

  it("löytää oman ruudun ja kahdeksan naapuria mutta ei kauempaa", () => {
    const map = siteMap([
      { x: 9, y: 9, siteId: "yard" },
      { x: 11, y: 11, siteId: "lakeside" },
      { x: 12, y: 10, siteId: "campfire" },
    ]);
    expect(discoverVisibleSites(map, ["yard"], { x: 10, y: 10 }).sort()).toEqual(["lakeside", "yard"]);
  });

  it("näyttää lähinäön normaalina ja vain tunnetun kiinteän paikan sumussa", () => {
    expect(mapSiteDisplay("yard", { active: true, known: false, cellVisibility: "visible" })).toBe("normal");
    expect(mapSiteDisplay("yard", { active: true, known: true, cellVisibility: "remembered" })).toBe("dimmed");
    expect(mapSiteDisplay("yard", { active: true, known: false, cellVisibility: "remembered" })).toBe("hidden");
    expect(mapSiteDisplay("yard", { active: false, known: true, cellVisibility: "visible" })).toBe("hidden");
    expect(siteDisplayForDefinition(
      { movement: "mobile" },
      { active: true, known: true, cellVisibility: "remembered" },
    )).toBe("hidden");
  });

  it("migroi vain vanhassa tallennuksessa todella löydetyt paikat", () => {
    const discovered = Array<boolean>(MAP_WIDTH * MAP_HEIGHT).fill(false);
    const yard = MAP_SITE_DEFINITIONS.yard.position;
    discovered[yard.y * MAP_WIDTH + yard.x] = true;
    expect(legacyKnownSiteIds("kalevala-prototype", MAP_WIDTH, discovered)).toEqual(["yard"]);
    expect(legacyKnownSiteIds("other-map", MAP_WIDTH, discovered)).toEqual([]);
  });
});
