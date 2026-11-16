import { TERRAIN_IDS, mapCell, type TerrainId, type WorldMapDefinition } from "./domain";

export type AtlasFrame = readonly [column: number, row: number];

const TERRAIN_FRAMES: Record<Exclude<TerrainId, "river">, readonly [AtlasFrame, AtlasFrame]> = {
  water: [[0, 0], [4, 0]],
  deepForest: [[1, 0], [5, 0]],
  forest: [[2, 0], [6, 0]],
  meadow: [[3, 0], [7, 0]],
  bog: [[0, 1], [4, 1]],
  rock: [[1, 1], [5, 1]],
};

const RIVER_STRAIGHT_FRAMES = [[6, 1], [7, 1], [4, 2]] as const satisfies readonly AtlasFrame[];
const RIVER_BEND_FRAMES = [[5, 2], [6, 2], [7, 2]] as const satisfies readonly AtlasFrame[];
const RIVER_END_FRAMES = [[4, 3], [5, 3], [6, 3]] as const satisfies readonly AtlasFrame[];

const NORTH = 1;
const EAST = 2;
const SOUTH = 4;
const WEST = 8;

export interface RiverTile {
  frame: AtlasFrame;
  /** Kuvan myötäpäiväinen kierto neljänneskierroksina. */
  quarterTurns: number;
  /** N/E/S/W-yhteydet bitteinä 1/2/4/8. */
  connections: number;
}

/** Vakaa koordinaattihajautus estää laattojen vaihtumisen renderöintien välillä. */
export function terrainVariant(terrainId: TerrainId, x: number, y: number, count = 2): number {
  const terrain = TERRAIN_IDS.indexOf(terrainId) + 1;
  const hash = Math.imul(x + 1, 73_856_093)
    ^ Math.imul(y + 1, 19_349_663)
    ^ Math.imul(terrain, 83_492_791);
  return (hash >>> 0) % count;
}

export function terrainFrame(terrainId: Exclude<TerrainId, "river">, x: number, y: number): AtlasFrame {
  const frames = TERRAIN_FRAMES[terrainId];
  return frames[terrainVariant(terrainId, x, y, frames.length)];
}

function connectsToRiver(map: WorldMapDefinition, x: number, y: number): boolean {
  const terrainId = mapCell(map, x, y)?.terrainId;
  return terrainId === "river" || terrainId === "water";
}

export function riverConnections(map: WorldMapDefinition, x: number, y: number): number {
  return (connectsToRiver(map, x, y - 1) ? NORTH : 0)
    | (connectsToRiver(map, x + 1, y) ? EAST : 0)
    | (connectsToRiver(map, x, y + 1) ? SOUTH : 0)
    | (connectsToRiver(map, x - 1, y) ? WEST : 0);
}

export function riverTile(map: WorldMapDefinition, x: number, y: number): RiverTile {
  const connections = riverConnections(map, x, y);
  const variant = terrainVariant("river", x, y, RIVER_STRAIGHT_FRAMES.length);
  if (connections === (NORTH | SOUTH)) {
    return { frame: RIVER_STRAIGHT_FRAMES[variant], quarterTurns: 0, connections };
  }
  if (connections === (EAST | WEST)) {
    return { frame: RIVER_STRAIGHT_FRAMES[variant], quarterTurns: 1, connections };
  }
  const bendTurns: Partial<Record<number, number>> = {
    [NORTH | EAST]: 0,
    [EAST | SOUTH]: 1,
    [SOUTH | WEST]: 2,
    [WEST | NORTH]: 3,
  };
  const bend = bendTurns[connections];
  if (bend !== undefined) return { frame: RIVER_BEND_FRAMES[variant], quarterTurns: bend, connections };

  const endTurns: Partial<Record<number, number>> = {
    [NORTH]: 0,
    [EAST]: 1,
    [SOUTH]: 2,
    [WEST]: 3,
  };
  const end = endTurns[connections];
  if (end !== undefined) return { frame: RIVER_END_FRAMES[variant], quarterTurns: end, connections };

  // Rikkinäinen tai myöhemmin haarautuva jokidata saa turvallisen vesilaatan.
  return { frame: [0, 0], quarterTurns: 0, connections };
}
