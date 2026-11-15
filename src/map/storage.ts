import { createCampaign, parseCampaign, serializeCampaign, type CampaignState } from "./campaign";
import { PROTOTYPE_MAP_ID, PROTOTYPE_START } from "./prototype";

export const CAMPAIGN_STORE = "laulun-miekka.campaign.v2";
export const LEGACY_CAMPAIGN_STORE = "laulun-miekka.campaign.v1";

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
    const current = parseCampaign(target.getItem(CAMPAIGN_STORE));
    if (current && compatible(current)) return current;
    const legacy = parseCampaign(target.getItem(LEGACY_CAMPAIGN_STORE));
    if (legacy && compatible(legacy)) {
      // Kelvollinen vanha tallennus on arvokkaampi kuin migraation kirjoitus.
      // Yksityisessä selaustilassa set/remove voi epäonnistua, mutta peli saa silti jatkua.
      try {
        target.setItem(CAMPAIGN_STORE, serializeCampaign(legacy));
        target.removeItem(LEGACY_CAMPAIGN_STORE);
      } catch { /* migraatio yritetään uudelleen seuraavalla latauksella */ }
      return legacy;
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
    target.removeItem(LEGACY_CAMPAIGN_STORE);
    return true;
  } catch {
    return false;
  }
}
