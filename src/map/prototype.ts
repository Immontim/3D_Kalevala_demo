import { MAP_HEIGHT, MAP_WIDTH, createWorldMap, type MapCell, type TerrainId } from "./domain";
import { LEGACY_SHORE_POSITIONS, LEGACY_YARD_POSITION } from "./sites";

export const PROTOTYPE_MAP_ID = "kalevala-prototype";
export const PROTOTYPE_START = { x: 10, y: 14 } as const;
/** Vanhan tallennuksen kiinteä piha. Kartassa ei ole enää pihaa: pihat ovat kampanjan instansseja. */
export const YARD_POSITION = LEGACY_YARD_POSITION;
/** Vanhan tallennuksen tietäjän mökki niityn ja järven rajalla. Uudella matkalla mökki arvotaan rannalle. */
export const LAKESIDE_POSITION = LEGACY_SHORE_POSITIONS.lakeside;
/** Vanhan tallennuksen Louhen kalmisto kaakon vaaralla veden rannalla. Uudella matkalla arvotaan rannalle. */
export const CAIRNFIELD_POSITION = LEGACY_SHORE_POSITIONS.cairnfield;
/** Puusilta ylittää vaakasuoran uoman pohjois–eteläsuunnassa. */
export const BRIDGE_POSITION = { x: 13, y: 11 } as const;

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
  "wfffdmdfffwwrrrffffw",
  "wffddddmfffwrrffffff",
  "wffdddmmffwwffffbfff",
  "wffffffffmwwfffbbbff",
  "wwffffffmmwwffbbbbfw",
  "wwwfffdfmmmwfffbbffw",
  "wwffffddfmmfffffffww",
  "wfffffdddfmmfmfffffw",
  "wffffffddfmmfmfffffw",
  "wfffffmfdfmmfmfffffw",
  "wwffffmmfmmfffffffww",
  "wwwffffffmmmfffffwww",
  "wwwwffffffmmffffwwww",
  "wwwbbfffffmffffrrwww",
  "wwbbbbffffffffrrrrww",
  "wwwbbbfffffffrrrrwww",
  "wwwwwwwwwwwwwwwwwwww",
] as const;

if (ROWS.length !== MAP_HEIGHT || ROWS.some((row) => row.length !== MAP_WIDTH)) {
  throw new Error("Prototyyppikartan ruudukko ei ole 20 × 20.");
}

const cells: MapCell[] = ROWS.flatMap((row, y) => [...row].map((symbol, x) => ({
  terrainId: RIVER_CELLS.has(`${x},${y}`) ? "river" : LEGEND[symbol],
  ...(x === BRIDGE_POSITION.x && y === BRIDGE_POSITION.y ? { crossingId: "bridge" as const } : {}),
})));

export const PROTOTYPE_MAP = createWorldMap(cells);
