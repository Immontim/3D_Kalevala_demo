import { describe, expect, it } from "vitest";
import { TERRAIN_IDS, mapCell, mapCellTravel } from "./domain";
import {
  CAIRNFIELD_POSITION,
  CAMPFIRE_POSITION,
  FORD_POSITION,
  LAKESIDE_POSITION,
  PROTOTYPE_MAP,
  PROTOTYPE_START,
  RIVER_ROUTE,
  YARD_POSITION,
} from "./prototype";
import { mapSiteDefinition } from "./sites";

describe("prototyyppikartta", () => {
  it("sisältää 20 × 20 ruutua ja kaikki seitsemän maastoa", () => {
    expect(PROTOTYPE_MAP.cells).toHaveLength(400);
    const terrains = new Set(PROTOTYPE_MAP.cells.map((cell) => cell.terrainId));
    expect([...terrains].sort()).toEqual([...TERRAIN_IDS].sort());
  });

  it("käyttää jokaiselle karttapaikalle rekisteröityä 2D-instanssia", () => {
    for (const cell of PROTOTYPE_MAP.cells) {
      if (cell.siteId) expect(mapSiteDefinition(cell.siteId)).toBeDefined();
    }
  });

  it("kaivertaa yhtenäisen joen järvestä ulkoveteen osumatta paikkoihin", () => {
    const occupied = new Set<string>();
    for (const [index, [x, y]] of RIVER_ROUTE.entries()) {
      expect(mapCell(PROTOTYPE_MAP, x, y)?.terrainId).toBe("river");
      expect(occupied.has(`${x},${y}`)).toBe(false);
      occupied.add(`${x},${y}`);
      if (index > 0) {
        const [previousX, previousY] = RIVER_ROUTE[index - 1];
        expect(Math.abs(x - previousX) + Math.abs(y - previousY)).toBe(1);
      }
    }
    for (const position of [PROTOTYPE_START, YARD_POSITION, LAKESIDE_POSITION, CAMPFIRE_POSITION, CAIRNFIELD_POSITION]) {
      expect(occupied.has(`${position.x},${position.y}`)).toBe(false);
    }
    const [firstX, firstY] = RIVER_ROUTE[0];
    const [lastX, lastY] = RIVER_ROUTE.at(-1)!;
    expect(mapCell(PROTOTYPE_MAP, firstX, firstY - 1)?.terrainId).toBe("water");
    expect(mapCell(PROTOTYPE_MAP, lastX + 1, lastY)?.terrainId).toBe("water");
  });

  it("säilyttää kaikki pakolliset paikat saavutettavina aloituksesta", () => {
    const targets = new Set([YARD_POSITION, LAKESIDE_POSITION, CAMPFIRE_POSITION, CAIRNFIELD_POSITION]
      .map(({ x, y }) => `${x},${y}`));
    const visited = new Set([`${PROTOTYPE_START.x},${PROTOTYPE_START.y}`]);
    const queue: { x: number; y: number }[] = [{ ...PROTOTYPE_START }];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = current.x + dx, y = current.y + dy;
        const key = `${x},${y}`;
        const cell = mapCell(PROTOTYPE_MAP, x, y);
        if (cell && mapCellTravel(cell).passable && !visited.has(key)) {
          visited.add(key);
          queue.push({ x, y });
        }
      }
    }
    for (const target of targets) expect(visited.has(target)).toBe(true);
  });

  it("sijoittaa yhden kivisen kahlaamon vaakasuoraan jokiosuuteen", () => {
    const fords = PROTOTYPE_MAP.cells.filter((cell) => cell.crossingId === "ford");
    expect(fords).toHaveLength(1);
    expect(mapCell(PROTOTYPE_MAP, FORD_POSITION.x, FORD_POSITION.y)).toMatchObject({
      terrainId: "river",
      crossingId: "ford",
    });
    expect(RIVER_ROUTE).toContainEqual([FORD_POSITION.x, FORD_POSITION.y]);
    expect(mapCellTravel(mapCell(PROTOTYPE_MAP, FORD_POSITION.x, FORD_POSITION.y - 1)!).passable).toBe(true);
    expect(mapCellTravel(mapCell(PROTOTYPE_MAP, FORD_POSITION.x, FORD_POSITION.y + 1)!).passable).toBe(true);
    for (const [x, y] of RIVER_ROUTE) {
      const cell = mapCell(PROTOTYPE_MAP, x, y)!;
      expect(mapCellTravel(cell).passable).toBe(x === FORD_POSITION.x && y === FORD_POSITION.y);
    }
  });

  it("aloitusruutu on kuljettava, ja kartassa ei ole kiinteää pihaa (pihat ovat kampanjan instansseja)", () => {
    expect(mapCell(PROTOTYPE_MAP, PROTOTYPE_START.x, PROTOTYPE_START.y)?.terrainId).not.toBe("water");
    expect(PROTOTYPE_MAP.cells.some((cell) => cell.siteId === "yard")).toBe(false);
    expect(mapCellTravel(mapCell(PROTOTYPE_MAP, YARD_POSITION.x, YARD_POSITION.y)!).passable).toBe(true);
  });

  it("sijoittaa tietäjän rantamökin kuljettavalle ruudulle järven viereen", () => {
    const cell = mapCell(PROTOTYPE_MAP, LAKESIDE_POSITION.x, LAKESIDE_POSITION.y);
    expect(cell?.siteId).toBe("lakeside");
    expect(cell?.terrainId).not.toBe("water");
    const neighbours = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([dx, dy]) => mapCell(PROTOTYPE_MAP, LAKESIDE_POSITION.x + dx, LAKESIDE_POSITION.y + dy)?.terrainId);
    expect(neighbours).toContain("water");
  });

  it("sijoittaa kalmiston vaaran kalliolle järven viereen", () => {
    const cell = mapCell(PROTOTYPE_MAP, CAIRNFIELD_POSITION.x, CAIRNFIELD_POSITION.y);
    expect(cell?.siteId).toBe("cairnfield");
    expect(cell?.terrainId).toBe("rock");
    const neighbours = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([dx, dy]) => mapCell(PROTOTYPE_MAP, CAIRNFIELD_POSITION.x + dx, CAIRNFIELD_POSITION.y + dy)?.terrainId);
    expect(neighbours).toContain("water");
  });

  it("sijoittaa saavutettavan punaisen käden nuotioaukion taistelulle", () => {
    const cell = mapCell(PROTOTYPE_MAP, CAMPFIRE_POSITION.x, CAMPFIRE_POSITION.y);
    expect(cell?.terrainId).not.toBe("water");
    expect(cell?.siteId).toBe("campfire");
    expect(Math.abs(CAMPFIRE_POSITION.x - PROTOTYPE_START.x)
      + Math.abs(CAMPFIRE_POSITION.y - PROTOTYPE_START.y)).toBeLessThanOrEqual(4);
  });
});
