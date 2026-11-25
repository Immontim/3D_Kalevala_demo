import type { SiteInstance } from "./campaign";
import { mapCell, mapIndex, type MapCell, type MapPosition, type WorldMapDefinition } from "./domain";
import { chebyshev, rngStream } from "./placement";

const MEADOW_RADIUS = 2;
const MIN_TILES = 3;
const MAX_TILES = 9;
const NEIGHBORS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;

function meadowLand(cell: MapCell | undefined): boolean {
  return !!cell && !cell.crossingId && !cell.siteId
    && (cell.terrainId === "meadow" || cell.terrainId === "forest" || cell.terrainId === "deepForest");
}

/**
 * Pihaniityt johdetaan kampanjan siemenestä ja talojen tallennetuista paikoista.
 * Kukin niitty kasvaa talon ruudusta viereiseen ruutuun ja rajautuu rantaan,
 * kiinteisiin karttapaikkoihin sekä muihin paikkainstansseihin.
 */
export function yardMeadowMap(
  map: WorldMapDefinition,
  seed: number,
  instances: readonly SiteInstance[],
): WorldMapDefinition {
  const occupied = new Set(instances.map(({ x, y }) => mapIndex(map, x, y)));
  const cells = [...map.cells];
  let changed = false;

  for (const yard of instances) {
    if ((yard.kind !== "yard" && yard.kind !== "smithy") || !meadowLand(mapCell(map, yard.x, yard.y))) continue;
    const random = rngStream(seed, "yard-meadow:" + yard.id);
    const targetSize = MIN_TILES + Math.floor(random() * (MAX_TILES - MIN_TILES + 1));
    const patch = new Set([mapIndex(map, yard.x, yard.y)]);
    const frontier = new Map<number, MapPosition>();

    function extendFrontier(position: MapPosition): void {
      for (const [dx, dy] of NEIGHBORS) {
        const x = position.x + dx;
        const y = position.y + dy;
        if (chebyshev(yard, { x, y }) > MEADOW_RADIUS || !meadowLand(mapCell(map, x, y))) continue;
        const index = mapIndex(map, x, y);
        if (!patch.has(index) && !occupied.has(index)) frontier.set(index, { x, y });
      }
    }

    extendFrontier(yard);
    while (patch.size < targetSize && frontier.size > 0) {
      const [index, position] = [...frontier][Math.floor(random() * frontier.size)];
      frontier.delete(index);
      patch.add(index);
      extendFrontier(position);
    }

    for (const index of patch) {
      if (cells[index].terrainId === "meadow") continue;
      cells[index] = { ...cells[index], terrainId: "meadow" };
      changed = true;
    }
  }

  return changed ? { ...map, cells } : map;
}
