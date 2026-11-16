// Kampanjan yksi tilan omistaja. Kaikki 3D:n tilamuutokset (esineiden otto, dialogi,
// maailmamoottorin säännöt) kulkevat `update(fn)`:n kautta, jolloin kahta kopiota ei ole:
// peräkkäinen otto ja lippumuutos eivät voi ylikirjoittaa toisiaan.
//
// Moduuli on selaimesta riippumaton: tallennus annetaan funktiona (testeissä keinotekoinen).
import type { CampaignState } from "./campaign";

export interface StoreUpdateResult {
  /** false = tallennus epäonnistui eikä muutos tullut voimaan (tila on ennallaan). */
  ok: boolean;
  /** Voimassa oleva tila päivityksen jälkeen. */
  state: CampaignState;
  /** true = tila todella muuttui (fn palautti uuden olion ja tallennus onnistui). */
  changed: boolean;
}

export type CampaignListener = (next: CampaignState, previous: CampaignState) => void;

export interface CampaignStore {
  get(): CampaignState;
  /**
   * Laskee uuden tilan nykyisestä, tallentaa sen ja vasta onnistumisen jälkeen ottaa sen käyttöön.
   * fn kutsutaan tasan kerran eikä saa tehdä sivuvaikutuksia. Jos fn palauttaa saman olion,
   * mitään ei kirjoiteta. Epäonnistunut tallennus jättää tilan ennalleen.
   */
  update(fn: (state: CampaignState) => CampaignState): StoreUpdateResult;
  /** Kuuntelija kutsutaan jokaisen voimaan tulleen muutoksen jälkeen. Palauttaa perumisfunktion. */
  subscribe(listener: CampaignListener): () => void;
}

export function createCampaignStore(
  initial: CampaignState,
  save: (state: CampaignState) => boolean,
): CampaignStore {
  let current = initial;
  const listeners = new Set<CampaignListener>();
  return {
    get: () => current,
    update(fn) {
      const previous = current;
      const next = fn(previous);
      if (next === previous) return { ok: true, state: previous, changed: false };
      if (!save(next)) return { ok: false, state: previous, changed: false };
      current = next;
      for (const listener of [...listeners]) listener(next, previous);
      return { ok: true, state: next, changed: true };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
