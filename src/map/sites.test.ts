import { describe, expect, it } from "vitest";
import { MAP_HEIGHT, MAP_WIDTH, createWorldMap, type MapCell } from "./domain";
import {
  LEGACY_YARD_POSITION,
  MAP_SITE_DEFINITIONS,
  discoverVisibleSites,
  legacyKnownSiteIds,
  mapSiteDisplay,
  sceneForMapSite,
  siteDisplayForDefinition,
  siteIdAt,
} from "./sites";
import type { SiteInstance } from "./campaign";

function siteMap(overrides: { x: number; y: number; siteId: string }[]) {
  const cells: MapCell[] = Array.from({ length: MAP_WIDTH * MAP_HEIGHT }, () => ({ terrainId: "meadow" }));
  for (const value of overrides) cells[value.y * MAP_WIDTH + value.x] = {
    terrainId: "meadow",
    siteId: value.siteId,
  };
  return createWorldMap(cells);
}

describe("2D-kohtaamisrekisteri", () => {
  const instances: SiteInstance[] = [
    { id: "yard", kind: "yard", x: 6, y: 7, archer: false },
    { id: "yard-b", kind: "yard", x: 12, y: 8, archer: true },
  ];

  it("luokittelee kiinteät paikat ja pihainstanssit kiinteiksi ja pysyviksi", () => {
    expect(Object.keys(MAP_SITE_DEFINITIONS).sort()).toEqual(["cairnfield", "campfire", "lakeside"]);
    for (const site of Object.values(MAP_SITE_DEFINITIONS)) {
      expect(site).toMatchObject({ movement: "fixed", lifetime: "persistent" });
    }
    expect(sceneForMapSite("yard")).toBeNull();           // piha on instanssi: ilman instanssilistaa tuntematon
    expect(sceneForMapSite("yard", instances)).toBe("yard");
    expect(sceneForMapSite("yard-b", instances)).toBe("yard");
    expect(sceneForMapSite("yard-c", instances)).toBeNull();
    expect(sceneForMapSite("lakeside")).toBe("lakeside");
    expect(sceneForMapSite("campfire")).toBe("clearing");
    expect(sceneForMapSite("cairnfield")).toBe("cairnfield");
    expect(sceneForMapSite("unknown")).toBeNull();
  });

  it("löytää oman ruudun ja kahdeksan naapuria mutta ei kauempaa", () => {
    const map = siteMap([
      { x: 9, y: 9, siteId: "lakeside" },
      { x: 11, y: 11, siteId: "cairnfield" },
      { x: 12, y: 10, siteId: "campfire" },
    ]);
    expect(discoverVisibleSites(map, ["lakeside"], { x: 10, y: 10 }).sort()).toEqual(["cairnfield", "lakeside"]);
  });

  it("löytää myös pihainstanssit lähinäössä ja siirtää saman ruudun paikan instanssista", () => {
    const map = siteMap([{ x: 9, y: 9, siteId: "lakeside" }]);
    expect(discoverVisibleSites(map, [], { x: 11, y: 8 }, instances)).toEqual(["yard-b"]);
    expect(discoverVisibleSites(map, [], { x: 11, y: 6 }, instances)).toEqual([]);
    expect(siteIdAt(map, instances, 12, 8)).toBe("yard-b");
    expect(siteIdAt(map, instances, 9, 9)).toBe("lakeside");
    expect(siteIdAt(map, instances, 1, 1)).toBeUndefined();
  });

  it("näyttää lähinäön normaalina ja vain tunnetun kiinteän paikan sumussa", () => {
    expect(mapSiteDisplay("lakeside", { active: true, known: false, cellVisibility: "visible" })).toBe("normal");
    expect(mapSiteDisplay("lakeside", { active: true, known: true, cellVisibility: "remembered" })).toBe("dimmed");
    expect(mapSiteDisplay("lakeside", { active: true, known: false, cellVisibility: "remembered" })).toBe("hidden");
    expect(mapSiteDisplay("lakeside", { active: false, known: true, cellVisibility: "visible" })).toBe("hidden");
    expect(siteDisplayForDefinition(
      { movement: "mobile" },
      { active: true, known: true, cellVisibility: "remembered" },
    )).toBe("hidden");
  });

  it("migroi vain vanhassa tallennuksessa todella löydetyt paikat", () => {
    const discovered = Array<boolean>(MAP_WIDTH * MAP_HEIGHT).fill(false);
    const yard = LEGACY_YARD_POSITION;
    discovered[yard.y * MAP_WIDTH + yard.x] = true;
    expect(legacyKnownSiteIds("kalevala-prototype", MAP_WIDTH, discovered)).toEqual(["yard"]);
    expect(legacyKnownSiteIds("other-map", MAP_WIDTH, discovered)).toEqual([]);
  });
});
