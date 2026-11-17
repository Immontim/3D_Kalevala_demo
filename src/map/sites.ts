import type { SceneId } from "../app/route";
import type { SiteInstance } from "./campaign";
import { MAP_RULES, mapCell, type MapPosition, type WorldMapDefinition } from "./domain";
import type { MapCellVisibility } from "./uiState";

export const FIXED_SITE_IDS = ["lakeside", "campfire", "cairnfield"] as const;
export type FixedSiteId = (typeof FIXED_SITE_IDS)[number];
export type MapSiteMovement = "fixed" | "mobile";
export type MapSiteLifetime = "persistent" | "temporary";
export type MapSiteDisplay = "hidden" | "normal" | "dimmed";

export interface MapSiteDefinition {
  /** Kiinteän paikan tunniste tai paikkainstanssin tunniste (esim. "yard", "yard-b"). */
  id: string;
  mapId: string;
  position: MapPosition;
  sceneId: SceneId;
  movement: MapSiteMovement;
  lifetime: MapSiteLifetime;
  /** Paikka on piilossa ja sisäänpääsemätön, kunnes tämä moottorin lippu on asetettu. */
  requiresFlag?: string;
}

export type SiteFlags = Readonly<Record<string, boolean>>;

/** Onko paikka pelaajan käytettävissä (ei lipulla lukittu)? */
export function siteUnlocked(definition: Pick<MapSiteDefinition, "requiresFlag"> | undefined, flags: SiteFlags): boolean {
  return !!definition && (!definition.requiresFlag || flags[definition.requiresFlag] === true);
}

/** Vanhan tallennuksen kiinteä piha (instanssi "yard") ennen satunnaisia pihapiirejä. */
export const LEGACY_YARD_POSITION: MapPosition = { x: 10, y: 11 };

/** Kartalle käsin kiinnitetyt paikat. Pihapiirit ovat kampanjan `siteInstances`-instansseja. */
export const MAP_SITE_DEFINITIONS: Record<FixedSiteId, MapSiteDefinition> = {
  lakeside: {
    id: "lakeside",
    mapId: "kalevala-prototype",
    position: { x: 9, y: 6 },
    sceneId: "lakeside",
    movement: "fixed",
    lifetime: "persistent",
  },
  /** Vainolaisten leiri (punainen käsi): paljastuu vasta, kun Louhi on karkotettu (V5). */
  campfire: {
    id: "campfire",
    mapId: "kalevala-prototype",
    position: { x: 13, y: 14 },
    sceneId: "clearing",
    movement: "fixed",
    lifetime: "persistent",
    requiresFlag: "louhi.banished",
  },
  /** Kaakon vaaran kalliokumpu veden rannalla: rauhallinen kalmisto kuppikivineen. */
  cairnfield: {
    id: "cairnfield",
    mapId: "kalevala-prototype",
    position: { x: 16, y: 16 },
    sceneId: "cairnfield",
    movement: "fixed",
    lifetime: "persistent",
  },
};

/** Pihainstanssin 2D-metadata: sama `yard`-kohtaus ajetaan jokaiselle instanssille omilla parametreillaan. */
export function instanceSiteDefinition(instance: SiteInstance): MapSiteDefinition {
  return {
    id: instance.id,
    mapId: "kalevala-prototype",
    position: { x: instance.x, y: instance.y },
    sceneId: "yard",
    movement: "fixed",
    lifetime: "persistent",
  };
}

export function mapSiteDefinition(
  siteId: string | undefined,
  instances: readonly SiteInstance[] = [],
): MapSiteDefinition | undefined {
  if (!siteId) return undefined;
  if ((FIXED_SITE_IDS as readonly string[]).includes(siteId)) return MAP_SITE_DEFINITIONS[siteId as FixedSiteId];
  const instance = instances.find((entry) => entry.id === siteId);
  return instance ? instanceSiteDefinition(instance) : undefined;
}

export function sceneForMapSite(
  siteId: string | undefined,
  instances: readonly SiteInstance[] = [],
  flags: SiteFlags = {},
): SceneId | null {
  const definition = mapSiteDefinition(siteId, instances);
  return siteUnlocked(definition, flags) ? definition!.sceneId : null;
}

/** Ruudun paikka: kartan kiinteä paikka tai kampanjan paikkainstanssi. */
export function siteIdAt(
  map: WorldMapDefinition,
  instances: readonly SiteInstance[],
  x: number,
  y: number,
): string | undefined {
  return mapCell(map, x, y)?.siteId ?? instances.find((instance) => instance.x === x && instance.y === y)?.id;
}

/** Lisää aktiivisen 3 × 3 -näön rekisteröidyt paikat pelaajan tietoon. */
export function discoverVisibleSites(
  map: WorldMapDefinition,
  knownSiteIds: readonly string[],
  observer: MapPosition,
  instances: readonly SiteInstance[] = [],
  radius = MAP_RULES.revealRadius,
  flags: SiteFlags = {},
): string[] {
  const known = new Set(knownSiteIds);
  for (let y = observer.y - radius; y <= observer.y + radius; y++) {
    for (let x = observer.x - radius; x <= observer.x + radius; x++) {
      const siteId = siteIdAt(map, instances, x, y);
      const definition = mapSiteDefinition(siteId, instances);
      if (definition && siteUnlocked(definition, flags)) known.add(siteId!);
    }
  }
  return [...known];
}

export function mapSiteDisplay(
  siteId: string | undefined,
  options: { active: boolean; known: boolean; cellVisibility: MapCellVisibility },
  instances: readonly SiteInstance[] = [],
  flags: SiteFlags = {},
): MapSiteDisplay {
  const definition = mapSiteDefinition(siteId, instances);
  if (!siteUnlocked(definition, flags)) return "hidden";
  return siteDisplayForDefinition(definition, options);
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
