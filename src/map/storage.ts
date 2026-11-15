import { createCampaign, parseCampaign, serializeCampaign, type CampaignState } from "./campaign";
import { PROTOTYPE_MAP_ID, PROTOTYPE_START } from "./prototype";

export const CAMPAIGN_STORE = "laulun-miekka.campaign.v1";

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
    const loaded = parseCampaign((storage ?? localStorage).getItem(CAMPAIGN_STORE));
    return loaded && compatible(loaded) ? loaded : newCampaign();
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
    (storage ?? localStorage).removeItem(CAMPAIGN_STORE);
    return true;
  } catch {
    return false;
  }
}
