import { createCampaign, parseCampaign, serializeCampaign, type CampaignState } from "./campaign";
import { PROTOTYPE_MAP_ID, PROTOTYPE_START } from "./prototype";
import { completeSiteInstances, newSiteInstances } from "./siteInstances";
import { legacyKnownSiteIds } from "./sites";

export const CAMPAIGN_STORE = "laulun-miekka.campaign.v6";
export const PREVIOUS_CAMPAIGN_STORE = "laulun-miekka.campaign.v5";
export const VERSION4_CAMPAIGN_STORE = "laulun-miekka.campaign.v4";
export const VERSION3_CAMPAIGN_STORE = "laulun-miekka.campaign.v3";
export const LEGACY_CAMPAIGN_STORE = "laulun-miekka.campaign.v2";
export const EARLIEST_CAMPAIGN_STORE = "laulun-miekka.campaign.v1";

export interface CampaignStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Uusi siemen sijoittelulle. Satunnaisuuden lähde on tässä, ei puhtaissa moduuleissa. */
export function randomSeed(): number {
  try {
    const value = crypto.getRandomValues(new Uint32Array(1))[0];
    if (value) return value;
  } catch { /* crypto ei käytössä: varasiemen alla */ }
  return Math.floor(Math.random() * 0xfffffffe) + 1;
}

/** Uusi matka: pihapiirit arvotaan siemenestä ja tallennetaan konkretisoituina. */
export function newCampaign(seed: number = randomSeed()): CampaignState {
  return createCampaign({
    mapId: PROTOTYPE_MAP_ID,
    ...PROTOTYPE_START,
    worldSeed: seed,
    siteInstances: newSiteInstances(seed),
  });
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
    const stores = [CAMPAIGN_STORE, PREVIOUS_CAMPAIGN_STORE, VERSION4_CAMPAIGN_STORE, VERSION3_CAMPAIGN_STORE, LEGACY_CAMPAIGN_STORE, EARLIEST_CAMPAIGN_STORE];
    for (const store of stores) {
      const parsed = parseCampaign(target.getItem(store));
      if (!parsed || !compatible(parsed)) continue;
      const inferLegacyKnowledge = store === VERSION3_CAMPAIGN_STORE
        || store === LEGACY_CAMPAIGN_STORE
        || store === EARLIEST_CAMPAIGN_STORE;
      let campaign = !inferLegacyKnowledge ? parsed : {
        ...parsed,
        world: {
          ...parsed.world,
          knownSiteIds: [...new Set([
            ...parsed.world.knownSiteIds,
            ...legacyKnownSiteIds(parsed.world.mapId, parsed.world.width, parsed.world.discovered),
          ])],
        },
      };
      // Vanha tallennus tai puuttuva paikkainstanssi täydennetään kerran ja tallennetaan, ettei
      // arvonta toistu seuraavalla latauksella.
      const completed = completeSiteInstances(campaign, randomSeed());
      if (completed !== campaign) {
        try { target.setItem(CAMPAIGN_STORE, serializeCampaign(completed)); } catch { /* yritetään uudelleen */ }
        campaign = completed;
      }
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
    target.removeItem(VERSION4_CAMPAIGN_STORE);
    target.removeItem(VERSION3_CAMPAIGN_STORE);
    target.removeItem(LEGACY_CAMPAIGN_STORE);
    target.removeItem(EARLIEST_CAMPAIGN_STORE);
    return true;
  } catch {
    return false;
  }
}
