import { describe, expect, it } from "vitest";
import { TERRAIN_IDS, mapCell } from "./domain";
import { PROTOTYPE_MAP, PROTOTYPE_START, YARD_POSITION } from "./prototype";

describe("prototyyppikartta", () => {
  it("sisältää 20 × 20 ruutua ja kaikki kuusi maastoa", () => {
    expect(PROTOTYPE_MAP.cells).toHaveLength(400);
    const terrains = new Set(PROTOTYPE_MAP.cells.map((cell) => cell.terrainId));
    expect([...terrains].sort()).toEqual([...TERRAIN_IDS].sort());
  });

  it("aloitusruutu on kuljettava ja rauhallinen piha on omana paikkanaan", () => {
    expect(mapCell(PROTOTYPE_MAP, PROTOTYPE_START.x, PROTOTYPE_START.y)?.terrainId).not.toBe("water");
    expect(mapCell(PROTOTYPE_MAP, YARD_POSITION.x, YARD_POSITION.y)?.siteId).toBe("yard");
  });
});
