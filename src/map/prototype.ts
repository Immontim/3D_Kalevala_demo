import { MAP_HEIGHT, MAP_WIDTH, createWorldMap, type MapCell, type TerrainId } from "./domain";
import { LEGACY_YARD_POSITION, MAP_SITE_DEFINITIONS } from "./sites";

export const PROTOTYPE_MAP_ID = "kalevala-prototype";
export const PROTOTYPE_START = { x: 10, y: 14 } as const;
/** Vanhan tallennuksen kiinteä piha. Kartassa ei ole enää pihaa: pihat ovat kampanjan instansseja. */
export const YARD_POSITION = LEGACY_YARD_POSITION;
/** Niityn ja järven rajalla: tietäjän mökki rannalla (rauhallinen 3D-kohtaus). */
export const LAKESIDE_POSITION = MAP_SITE_DEFINITIONS.lakeside.position;
/** Kaakon vaaran kalliokumpu veden rannalla: kalmisto (rauhallinen 3D-kohtaus). */
export const CAIRNFIELD_POSITION = MAP_SITE_DEFINITIONS.cairnfield.position;
/** Kivinen kahlaamo ylittää vaakasuoran uoman pohjois–eteläsuunnassa. */
export const FORD_POSITION = { x: 13, y: 11 } as const;

const LEGEND: Record<string, TerrainId> = {
  w: "water",
  f: "forest",
  d: "deepForest",
  m: "meadow",
  b: "bog",
  r: "rock",
  j: "river",
};

/** Kiemurteleva uoma keskisen järven etelälaidasta itäiseen ulkoveteen. */
export const RIVER_ROUTE = [
  [11, 9], [12, 9], [13, 9], [14, 9],
  [14, 10], [14, 11], [13, 11], [12, 11],
  [12, 12], [12, 13], [13, 13], [14, 13],
  [15, 13], [16, 13], [17, 13],
] as const satisfies readonly (readonly [number, number])[];

const RIVER_CELLS = new Set(RIVER_ROUTE.map(([x, y]) => `${x},${y}`));

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
  terrainId: RIVER_CELLS.has(`${x},${y}`) ? "river" : LEGEND[symbol],
  ...(x === FORD_POSITION.x && y === FORD_POSITION.y ? { crossingId: "ford" as const } : {}),
  ...(x === LAKESIDE_POSITION.x && y === LAKESIDE_POSITION.y ? { siteId: "lakeside" } : {}),
  ...(x === CAIRNFIELD_POSITION.x && y === CAIRNFIELD_POSITION.y ? { siteId: "cairnfield" } : {}),
})));

export const PROTOTYPE_MAP = createWorldMap(cells);
