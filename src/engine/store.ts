// 3D-puolen yksi kampanjatilan omistaja ja siihen sidottu maailmamoottori.
// Esineet, dialogi ja säännöt muuttavat tilaa vain `campaignStore().update(fn)`:n kautta.
import type { CampaignState } from "../map/campaign";
import { createCampaignStore, type CampaignStore } from "../map/campaignStore";
import { saveCampaign } from "../map/storage";
import { GAME_WORLD } from "../world/content";
import { createWorldRuntime, type WorldRuntime } from "../world/runtime";

let store: CampaignStore | null = null;
let runtime: WorldRuntime | null = null;

export function initCampaignStore(initial: CampaignState, save: (state: CampaignState) => boolean = saveCampaign) {
  store = createCampaignStore(initial, save);
  runtime = createWorldRuntime(store, GAME_WORLD);
  return store;
}

export function campaignStore(): CampaignStore {
  if (!store) throw new Error("Kampanjan tilanomistajaa ei ole alustettu");
  return store;
}

export function worldRuntime(): WorldRuntime {
  if (!runtime) throw new Error("Maailmamoottoria ei ole alustettu");
  return runtime;
}
