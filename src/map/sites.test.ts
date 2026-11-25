import { describe, expect, it } from "vitest";
import { MAP_HEIGHT, MAP_WIDTH, createWorldMap, type MapCell } from "./domain";
import {
  LEGACY_YARD_POSITION,
  mapSiteDefinition,
  discoverVisibleSites,
  legacyKnownSiteIds,
  mapSiteDisplay,
  sceneForMapSite,
  siteDisplayForDefinition,
  siteIdAt,
  siteUnlocked,
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
  const shore: SiteInstance[] = [
    { id: "lakeside", kind: "lakeside", x: 9, y: 9, archer: false },
    { id: "cairnfield", kind: "cairn", x: 11, y: 11, archer: false },
    { id: "cairn-b", kind: "cairn", x: 2, y: 2, archer: false },
  ];
  const smithy: SiteInstance = { id: "smithy", kind: "smithy", x: 7, y: 12, archer: false };

  it("luokittelee mökin, kalmistot, pihat ja sepän pajan kiinteiksi ja pysyviksi", () => {
    for (const id of ["lakeside", "cairnfield", "cairn-b"]) {
      expect(mapSiteDefinition(id, shore)).toMatchObject({ movement: "fixed", lifetime: "persistent" });
    }
    expect(sceneForMapSite("lakeside")).toBeNull();       // mökki on v08:sta lähtien instanssi
    expect(sceneForMapSite("lakeside", shore)).toBe("lakeside");
    expect(sceneForMapSite("cairnfield", shore)).toBe("cairnfield");
    expect(sceneForMapSite("cairn-b", shore)).toBe("cairnfield");   // sama kohtaus, ilman Louhta
    expect(sceneForMapSite("yard")).toBeNull();           // piha on instanssi: ilman instanssilistaa tuntematon
    expect(sceneForMapSite("yard", instances)).toBe("yard");
    expect(sceneForMapSite("yard-b", instances)).toBe("yard");
    expect(sceneForMapSite("yard-c", instances)).toBeNull();
    expect(sceneForMapSite("smithy", [smithy])).toBe("smithy");
    expect(mapSiteDefinition("smithy", [smithy])).toMatchObject({ movement: "fixed", lifetime: "persistent" });
    const camp: SiteInstance = { id: "camp", kind: "camp", x: 3, y: 4, archer: false };
    expect(sceneForMapSite("camp", [camp])).toBeNull();                   // leiri on lukossa, kunnes Louhi on karkotettu
    expect(sceneForMapSite("camp", [camp], { "louhi.banished": true })).toBe("clearing");
    expect(sceneForMapSite("unknown", shore)).toBeNull();
  });

  it("löytää oman ruudun ja kahdeksan naapuria mutta ei kauempaa", () => {
    const map = siteMap([]);
    const far: SiteInstance = { id: "yard", kind: "yard", x: 12, y: 10, archer: false };
    expect(discoverVisibleSites(map, ["lakeside"], { x: 10, y: 10 }, [...shore, far]).sort()).toEqual(["cairnfield", "lakeside"]);
  });

  it("vainolaisten leiri on piilossa ja sisäänpääsemätön ennen Louhen karkotusta, sen jälkeen tavallinen paikka", () => {
    const map = siteMap([]);
    const camp: SiteInstance[] = [{ id: "camp", kind: "camp", x: 10, y: 10, archer: false }];
    const visible = { active: true, known: true, cellVisibility: "visible" } as const;
    expect(discoverVisibleSites(map, [], { x: 10, y: 10 }, camp)).toEqual([]);
    expect(mapSiteDisplay("camp", visible, camp)).toBe("hidden");
    expect(sceneForMapSite("camp", camp)).toBeNull();
    const flags = { "louhi.banished": true };
    expect(discoverVisibleSites(map, [], { x: 10, y: 10 }, camp, 1, flags)).toEqual(["camp"]);
    expect(mapSiteDisplay("camp", visible, camp, flags)).toBe("normal");
    expect(mapSiteDisplay("camp", { ...visible, cellVisibility: "remembered" }, camp, flags)).toBe("dimmed");
    expect(sceneForMapSite("camp", camp, flags)).toBe("clearing");
    expect(siteUnlocked(mapSiteDefinition("lakeside", shore), {})).toBe(true);   // muut paikat eivät ole lukossa
    expect(siteIdAt(map, camp, 10, 10)).toBe("camp");
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
    expect(mapSiteDisplay("lakeside", { active: true, known: false, cellVisibility: "visible" }, shore)).toBe("normal");
    expect(mapSiteDisplay("lakeside", { active: true, known: true, cellVisibility: "remembered" }, shore)).toBe("dimmed");
    expect(mapSiteDisplay("lakeside", { active: true, known: false, cellVisibility: "remembered" }, shore)).toBe("hidden");
    expect(mapSiteDisplay("lakeside", { active: false, known: true, cellVisibility: "visible" }, shore)).toBe("hidden");
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
