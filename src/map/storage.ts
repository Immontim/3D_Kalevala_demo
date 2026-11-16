import { createCampaign, parseCampaign, serializeCampaign, type CampaignState } from "./campaign";
import { PROTOTYPE_MAP_ID, PROTOTYPE_START } from "./prototype";
import { legacyKnownSiteIds } from "./sites";

export const CAMPAIGN_STORE = "laulun-miekka.campaign.v5";
export const PREVIOUS_CAMPAIGN_STORE = "laulun-miekka.campaign.v4";
export const VERSION3_CAMPAIGN_STORE = "laulun-miekka.campaign.v3";
export const LEGACY_CAMPAIGN_STORE = "laulun-miekka.campaign.v2";
export const EARLIEST_CAMPAIGN_STORE = "laulun-miekka.campaign.v1";

export interface CampaignStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function newCampaign(): CampaignState {
  return createCampaign({ mapId: PROTOTYPE_MAP_ID, ...PROTOTYPE_START });
}

function compatible(state: CampaignState): boolean {
  return state.world.mapId === PROTOTYPE_MAP_ID
    && state.world.width === 20
    && state.world.height === 20
    && state.world.discovered.length === 400;
}

export function loadCampaign(storage?: CampaignStorage): CampaignState {
  try {
    const target = storage ?? localStorage;
    const stores = [CAMPAIGN_STORE, PREVIOUS_CAMPAIGN_STORE, VERSION3_CAMPAIGN_STORE, LEGACY_CAMPAIGN_STORE, EARLIEST_CAMPAIGN_STORE];
    for (const store of stores) {
      const parsed = parseCampaign(target.getItem(store));
      if (!parsed || !compatible(parsed)) continue;
      const campaign = store === CAMPAIGN_STORE ? parsed : {
        ...parsed,
        world: {
          ...parsed.world,
          knownSiteIds: [...new Set([
            ...parsed.world.knownSiteIds,
            ...legacyKnownSiteIds(parsed.world.mapId, parsed.world.width, parsed.world.discovered),
          ])],
        },
      };
      if (store !== CAMPAIGN_STORE) {
        // Kelvollinen vanha tallennus on arvokkaampi kuin migraation kirjoitus.
        // Yksityisessä selaustilassa set/remove voi epäonnistua, mutta peli saa silti jatkua.
        try {
          target.setItem(CAMPAIGN_STORE, serializeCampaign(campaign));
          for (const oldStore of stores.slice(1)) target.removeItem(oldStore);
        } catch { /* migraatio yritetään uudelleen seuraavalla latauksella */ }
      }
      return campaign;
    }
    return newCampaign();
  } catch {
    return newCampaign();
  }
}

export function saveCampaign(state: CampaignState, storage?: CampaignStorage): boolean {
  try {
    (storage ?? localStorage).setItem(CAMPAIGN_STORE, serializeCampaign(state));
    return true;
  } catch {
    return false;
  }
}

export function clearCampaign(storage?: CampaignStorage): boolean {
  try {
    const target = storage ?? localStorage;
    target.removeItem(CAMPAIGN_STORE);
    target.removeItem(PREVIOUS_CAMPAIGN_STORE);
    target.removeItem(VERSION3_CAMPAIGN_STORE);
    target.removeItem(LEGACY_CAMPAIGN_STORE);
    target.removeItem(EARLIEST_CAMPAIGN_STORE);
    return true;
  } catch {
    return false;
  }
}
