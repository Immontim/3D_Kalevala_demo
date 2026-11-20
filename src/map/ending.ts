// Loppuruudun sisältö: voittaneen kampanjan tilastot tallennuksen lipuista ja laskureista. Puhdas moduuli.
import { songSlots } from "../songLogic";
import { TOTAL_ENEMIES } from "../waves";
import type { CampaignState } from "./campaign";
import { totalDays } from "./uiState";

export type EndingSideStoryId = "rumor" | "louhi" | "archer" | "sword";

export interface EndingSummary {
  /** Matkaan kuluneet pelipäivät voitettaessa. */
  days: number;
  /** Täysinä kuluneet kuunkierrot (28 päivää). */
  moons: number;
  /** Tutkittu osuus kartasta voitettaessa, prosenttia. */
  explored: number;
  songsKnown: number;
  songsTotal: number;
  enemiesDefeated: number;
  deaths: number;
  thefts: number;
  /** Matkan varrella tehdyt sivupolut: tehty vai ei. */
  sideStories: { id: EndingSideStoryId; done: boolean }[];
}

/** Loppuruutu näytetään voitetulle kampanjalle kerran, kunnes pelaaja on nähnyt sen. */
export function shouldShowEnding(state: CampaignState): boolean {
  return state.engine.flags["campaign.won"] === true && state.engine.flags["campaign.endSeen"] !== true;
}

export function isWon(state: CampaignState): boolean {
  return state.engine.flags["campaign.won"] === true;
}

/** null, jos kampanjaa ei ole voitettu. Päivät ja tutkittu kartta ovat voiton hetken tilasto, muut ovat nykytila. */
export function endingSummary(state: CampaignState): EndingSummary | null {
  if (!isWon(state)) return null;
  const flags = state.engine.flags;
  const counters = state.engine.counters;
  const days = counters["win.days"] ?? totalDays(state.world.worldMinutes);
  return {
    days,
    moons: Math.floor((days - 1) / 28),
    explored: counters["win.explored"] ?? 0,
    songsKnown: songSlots(flags).filter((id) => id !== null).length,
    songsTotal: 3,
    enemiesDefeated: TOTAL_ENEMIES,
    deaths: counters["player.deaths"] ?? 0,
    thefts: counters["thefts.noticed"] ?? 0,
    sideStories: [
      { id: "rumor", done: flags["rumor.heard"] === true },
      { id: "louhi", done: flags["louhi.banished"] === true },
      { id: "archer", done: flags["archer.healed"] === true },
      { id: "sword", done: flags["archer.gaveSword"] === true },
    ],
  };
}
