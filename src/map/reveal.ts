// Kartan paikan paljastus moottorin efektille: tunnetuksi ja ruutu ympäristöineen näkyviin.
// Puhdas moduuli. Toimii vain prototyyppikartalla (muita karttoja ei ole).
import type { CampaignState } from "./campaign";
import { revealAround } from "./domain";
import { PROTOTYPE_MAP, PROTOTYPE_MAP_ID } from "./prototype";
import { mapSiteDefinition } from "./sites";

/** Palauttaa uuden tilan tai null, jos paikkaa ei tunneta. Jo paljastettu paikka palauttaa saman tilan. */
export function revealSiteOnMap(state: CampaignState, siteId: string): CampaignState | null {
  const site = mapSiteDefinition(siteId, state.world.siteInstances);
  if (!site || state.world.mapId !== PROTOTYPE_MAP_ID) return null;
  const known = state.world.knownSiteIds.includes(siteId);
  const discovered = revealAround(PROTOTYPE_MAP, state.world.discovered, site.position);
  const changed = !known || discovered.some((cell, i) => cell !== state.world.discovered[i]);
  if (!changed) return state;
  return {
    ...state,
    world: {
      ...state.world,
      discovered,
      knownSiteIds: known ? state.world.knownSiteIds : [...state.world.knownSiteIds, siteId],
    },
  };
}
