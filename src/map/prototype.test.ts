import { describe, expect, it } from "vitest";
import { TERRAIN_IDS, mapCell } from "./domain";
import { CAMPFIRE_POSITION, PROTOTYPE_MAP, PROTOTYPE_START, YARD_POSITION } from "./prototype";

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

  it("sijoittaa saavutettavan punaisen käden nuotioaukion taistelulle", () => {
    const cell = mapCell(PROTOTYPE_MAP, CAMPFIRE_POSITION.x, CAMPFIRE_POSITION.y);
    expect(cell?.terrainId).not.toBe("water");
    expect(cell?.siteId).toBe("campfire");
    expect(Math.abs(CAMPFIRE_POSITION.x - PROTOTYPE_START.x)
      + Math.abs(CAMPFIRE_POSITION.y - PROTOTYPE_START.y)).toBeLessThanOrEqual(4);
  });
});
