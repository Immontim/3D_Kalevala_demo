// Maailmankartan puhdas sääntöydin. Ei selain-, DOM- tai Three.js-riippuvuuksia.

export const MAP_WIDTH = 20;
export const MAP_HEIGHT = 20;

export const TERRAIN_IDS = ["meadow", "forest", "deepForest", "bog", "rock", "water", "river"] as const;
export type TerrainId = (typeof TERRAIN_IDS)[number];
export const CROSSING_IDS = ["ford"] as const;
export type CrossingId = (typeof CROSSING_IDS)[number];

export interface TerrainDefinition {
  id: TerrainId;
  /** Voiko ruutuun kulkea ilman myöhemmin lisättävää erityiskykyä (esim. venettä). */
  passable: boolean;
  /** Kohderuutuun siirtymiseen kuluva maailmanaika minuutteina. */
  minuteCost: number;
}

/** Ensimmäisen karttaprototyypin luvut. Tasapaino tarkistetaan pelitestissä. */
export const TERRAINS: Record<TerrainId, TerrainDefinition> = {
  meadow: { id: "meadow", passable: true, minuteCost: 10 },
  forest: { id: "forest", passable: true, minuteCost: 15 },
  deepForest: { id: "deepForest", passable: true, minuteCost: 25 },
  bog: { id: "bog", passable: true, minuteCost: 35 },
  rock: { id: "rock", passable: true, minuteCost: 25 },
  water: { id: "water", passable: false, minuteCost: 0 },
  river: { id: "river", passable: false, minuteCost: 0 },
};

/** Joen tai muun esteen paikallinen ylitystapa ilman uutta maastolajia. */
export const CROSSINGS: Record<CrossingId, Pick<TerrainDefinition, "passable" | "minuteCost">> = {
  ford: { passable: true, minuteCost: 20 },
};

export const MAP_RULES = {
  /** Menetettyä kylläisyyttä per maailmassa kulunut minuutti. */
  satietyLossPerMinute: 0.05,
  revealRadius: 1,
} as const;

export interface MapCell {
  terrainId: TerrainId;
  /** Maaston kulkusäännön korvaava paikallinen ylitys, esimerkiksi kivinen kahlaamo. */
  crossingId?: CrossingId;
  /** Maastosta erillinen merkityspaikka, esimerkiksi rauhallinen pihapiiri. */
  siteId?: string;
}

export interface WorldMapDefinition {
  width: typeof MAP_WIDTH;
  height: typeof MAP_HEIGHT;
  /** Rivit ylhäältä alas, jokainen rivi vasemmalta oikealle. */
  cells: readonly MapCell[];
}

export interface MapPosition {
  x: number;
  y: number;
}

export interface WorldMapState extends MapPosition {
  worldMinutes: number;
  /** 100 = kylläinen, 0 = nääntynyt. Kylläisyys ei itsessään estä toimintaa tai tapa. */
  satiety: number;
  /** Pysyvä tutkimussumu samassa rivijärjestyksessä kuin kartan cells. */
  discovered: readonly boolean[];
}

export type MapDirection = "up" | "right" | "down" | "left";

export interface MapMoveResult {
  state: WorldMapState;
  moved: boolean;
  minutesSpent: number;
  /** Kohderuudun paikka siirron jälkeen, tai undefined tavallisella ruudulla/estossa. */
  siteId?: string;
}

const DIRECTION_DELTAS: Record<MapDirection, MapPosition> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

export function createWorldMap(cells: readonly MapCell[]): WorldMapDefinition {
  if (cells.length !== MAP_WIDTH * MAP_HEIGHT) {
    throw new Error(`Kartan pitää sisältää ${MAP_WIDTH * MAP_HEIGHT} ruutua, saatiin ${cells.length}.`);
  }
  return { width: MAP_WIDTH, height: MAP_HEIGHT, cells: [...cells] };
}

export function mapIndex(map: WorldMapDefinition, x: number, y: number): number {
  return y * map.width + x;
}

export function mapCell(map: WorldMapDefinition, x: number, y: number): MapCell | undefined {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return undefined;
  return map.cells[mapIndex(map, x, y)];
}

/** Ruudun todellinen kulkukelpoisuus ja aikakustannus mahdollinen ylitys huomioiden. */
export function mapCellTravel(cell: MapCell): Pick<TerrainDefinition, "passable" | "minuteCost"> {
  return cell.crossingId ? CROSSINGS[cell.crossingId] : TERRAINS[cell.terrainId];
}

/** Paljastaa sijainnin ympäriltä Chebyshev-säteen eli myös viistot naapurit. */
export function revealAround(
  map: WorldMapDefinition,
  discovered: readonly boolean[],
  position: MapPosition,
  radius = MAP_RULES.revealRadius,
): boolean[] {
  const next = Array.from({ length: map.cells.length }, (_, i) => !!discovered[i]);
  for (let y = position.y - radius; y <= position.y + radius; y++) {
    for (let x = position.x - radius; x <= position.x + radius; x++) {
      if (mapCell(map, x, y)) next[mapIndex(map, x, y)] = true;
    }
  }
  return next;
}

export function createWorldMapState(
  map: WorldMapDefinition,
  start: MapPosition,
  values: { worldMinutes?: number; satiety?: number; discovered?: readonly boolean[] } = {},
): WorldMapState {
  if (!mapCell(map, start.x, start.y)) throw new Error("Kartan aloituspaikka on kartan ulkopuolella.");
  const discovered = values.discovered ?? Array<boolean>(map.cells.length).fill(false);
  if (discovered.length !== map.cells.length) throw new Error("Tutkimussumun koko ei vastaa karttaa.");
  return {
    ...start,
    worldMinutes: Math.max(0, values.worldMinutes ?? 0),
    satiety: clampSatiety(values.satiety ?? 100),
    discovered: revealAround(map, discovered, start),
  };
}

export function clampSatiety(satiety: number): number {
  return Math.max(0, Math.min(100, satiety));
}

/** Ratkaisee yhden atomisen, vain pääilmansuuntiin sallitun karttaliikkeen. */
export function moveOnMap(
  map: WorldMapDefinition,
  state: WorldMapState,
  direction: MapDirection,
): MapMoveResult {
  const delta = DIRECTION_DELTAS[direction];
  // Runtime-suoja esimerkiksi vanhasta tai vioittuneesta näppäindatasta tulevalle arvolle.
  if (!delta) return { state, moved: false, minutesSpent: 0 };
  const x = state.x + delta.x;
  const y = state.y + delta.y;
  const cell = mapCell(map, x, y);
  if (!cell) return { state, moved: false, minutesSpent: 0 };
  const travel = mapCellTravel(cell);
  if (!travel.passable) return { state, moved: false, minutesSpent: 0 };

  const minutesSpent = travel.minuteCost;
  const next: WorldMapState = {
    x,
    y,
    worldMinutes: state.worldMinutes + minutesSpent,
    satiety: clampSatiety(state.satiety - minutesSpent * MAP_RULES.satietyLossPerMinute),
    discovered: revealAround(map, state.discovered, { x, y }),
  };
  return { state: next, moved: true, minutesSpent, siteId: cell.siteId };
}
