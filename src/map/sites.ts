import type { SceneId } from "../app/route";
import { MAP_RULES, mapCell, type MapPosition, type WorldMapDefinition } from "./domain";
import type { MapCellVisibility } from "./uiState";

export const MAP_SITE_IDS = ["yard", "lakeside", "campfire"] as const;
export type MapSiteId = (typeof MAP_SITE_IDS)[number];
export type MapSiteMovement = "fixed" | "mobile";
export type MapSiteLifetime = "persistent" | "temporary";
export type MapSiteDisplay = "hidden" | "normal" | "dimmed";

export interface MapSiteDefinition {
  id: MapSiteId;
  mapId: string;
  position: MapPosition;
  sceneId: SceneId;
  movement: MapSiteMovement;
  lifetime: MapSiteLifetime;
}

/** 2D-instanssin metadata; sama sceneId saa myöhemmin esiintyä monessa instanssissa. */
export const MAP_SITE_DEFINITIONS: Record<MapSiteId, MapSiteDefinition> = {
  yard: {
    id: "yard",
    mapId: "kalevala-prototype",
    position: { x: 10, y: 11 },
    sceneId: "yard",
    movement: "fixed",
    lifetime: "persistent",
  },
  lakeside: {
    id: "lakeside",
    mapId: "kalevala-prototype",
    position: { x: 9, y: 6 },
    sceneId: "lakeside",
    movement: "fixed",
    lifetime: "persistent",
  },
  campfire: {
    id: "campfire",
    mapId: "kalevala-prototype",
    position: { x: 13, y: 14 },
    sceneId: "clearing",
    movement: "fixed",
    lifetime: "persistent",
  },
};

export function mapSiteDefinition(siteId: string | undefined): MapSiteDefinition | undefined {
  if (!siteId || !(MAP_SITE_IDS as readonly string[]).includes(siteId)) return undefined;
  return MAP_SITE_DEFINITIONS[siteId as MapSiteId];
}

export function sceneForMapSite(siteId: string | undefined): SceneId | null {
  return mapSiteDefinition(siteId)?.sceneId ?? null;
}

/** Lisää aktiivisen 3 × 3 -näön rekisteröidyt paikat pelaajan tietoon. */
export function discoverVisibleSites(
  map: WorldMapDefinition,
  knownSiteIds: readonly string[],
  observer: MapPosition,
  radius = MAP_RULES.revealRadius,
): string[] {
  const known = new Set(knownSiteIds);
  for (let y = observer.y - radius; y <= observer.y + radius; y++) {
    for (let x = observer.x - radius; x <= observer.x + radius; x++) {
      const siteId = mapCell(map, x, y)?.siteId;
      if (mapSiteDefinition(siteId)) known.add(siteId!);
    }
  }
  return [...known];
}

export function mapSiteDisplay(
  siteId: string | undefined,
  options: { active: boolean; known: boolean; cellVisibility: MapCellVisibility },
): MapSiteDisplay {
  return siteDisplayForDefinition(mapSiteDefinition(siteId), options);
}

export function siteDisplayForDefinition(
  definition: Pick<MapSiteDefinition, "movement"> | undefined,
  options: { active: boolean; known: boolean; cellVisibility: MapCellVisibility },
): MapSiteDisplay {
  if (!definition || !options.active || options.cellVisibility === "unknown") return "hidden";
  if (options.cellVisibility === "visible") return "normal";
  if (!options.known || definition.movement === "mobile") return "hidden";
  return "dimmed";
}

/**
 * Lukittu v1–v3-snapshot. Älä johda tätä koko rekisteristä: tuleva paikka ei
 * saa muuttua tunnetuksi vain siksi, että sen ruutu oli vanhassa versiossa tutkittu.
 */
const LEGACY_SITE_SNAPSHOT = [
  { id: "yard", x: 10, y: 11 },
  { id: "lakeside", x: 9, y: 6 },
  { id: "campfire", x: 13, y: 14 },
] as const;

export function legacyKnownSiteIds(
  mapId: string,
  width: number,
  discovered: readonly boolean[],
): string[] {
  if (mapId !== "kalevala-prototype") return [];
  return LEGACY_SITE_SNAPSHOT
    .filter(({ x, y }) => discovered[y * width + x])
    .map(({ id }) => id);
}
