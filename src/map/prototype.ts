import { MAP_HEIGHT, MAP_WIDTH, createWorldMap, type MapCell, type TerrainId } from "./domain";

export const PROTOTYPE_MAP_ID = "kalevala-prototype";
export const PROTOTYPE_START = { x: 10, y: 14 } as const;
export const YARD_POSITION = { x: 10, y: 11 } as const;
export const CAMPFIRE_POSITION = { x: 13, y: 14 } as const;
/** Niityn ja järven rajalla: tietäjän mökki rannalla (rauhallinen 3D-kohtaus). */
export const LAKESIDE_POSITION = { x: 9, y: 6 } as const;

const LEGEND: Record<string, TerrainId> = {
  w: "water",
  f: "forest",
  d: "deepForest",
  m: "meadow",
  b: "bog",
  r: "rock",
};

/** Käsin sommiteltu vertailukartta tulevan generaattorin laatutavoitteeksi. */
const ROWS = [
  "wwwwwwwwwwwwwwwwwwww",
  "wwwfffffwwwwwrrrrwww",
  "wwfffffffwwwrrrrrwww",
  "wfffdddfffwwrrrffffw",
  "wffddddffffwrrffffff",
  "wffdddffffwwffffbfff",
  "wfffffffmmwwfffbbbff",
  "wwffffmmmmwwffbbbbfw",
  "wwwffmmmmmmwfffbbffw",
  "wwffmmmmmmmmffffffww",
  "wfffmmmmmmmmmmfffffw",
  "wffmmmmmmmmmmmmffffw",
  "wfffmmmmmmmmmmmffffw",
  "wwffmmmmmmmmmmffffww",
  "wwwfffmmmmmmmmfffwww",
  "wwwwfffmmmmmmfffwwww",
  "wwwbbfffmmmmfffrrwww",
  "wwbbbbffffffffrrrrww",
  "wwwbbbfffffffrrrrwww",
  "wwwwwwwwwwwwwwwwwwww",
] as const;

if (ROWS.length !== MAP_HEIGHT || ROWS.some((row) => row.length !== MAP_WIDTH)) {
  throw new Error("Prototyyppikartan ruudukko ei ole 20 × 20.");
}

const cells: MapCell[] = ROWS.flatMap((row, y) => [...row].map((symbol, x) => ({
  terrainId: LEGEND[symbol],
  ...(x === YARD_POSITION.x && y === YARD_POSITION.y ? { siteId: "yard" } : {}),
  ...(x === CAMPFIRE_POSITION.x && y === CAMPFIRE_POSITION.y ? { siteId: "campfire" } : {}),
  ...(x === LAKESIDE_POSITION.x && y === LAKESIDE_POSITION.y ? { siteId: "lakeside" } : {}),
})));

export const PROTOTYPE_MAP = createWorldMap(cells);
