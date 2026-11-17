// Prototyyppikartan paikkainstanssien luonti ja täydennys. Yhdistää sijoittelun (placement.ts),
// kartan (prototype.ts) ja kampanjan; puhdas, siemen annetaan ulkopuolelta.
import type { CampaignState, SiteInstance } from "./campaign";
import { YARD_INSTANCE_IDS, placeYardInstances, type PlacementContext } from "./placement";
import { PROTOTYPE_MAP, PROTOTYPE_START } from "./prototype";
import { LEGACY_YARD_POSITION, MAP_SITE_DEFINITIONS } from "./sites";

export const PROTOTYPE_PLACEMENT: PlacementContext = {
  map: PROTOTYPE_MAP,
  start: PROTOTYPE_START,
  fixedSites: Object.values(MAP_SITE_DEFINITIONS).map((site) => site.position),
};

/** Uuden matkan pihat: molemmat arvotaan, ja toisessa niistä on jousineito. */
export function newYardInstances(seed: number): SiteInstance[] {
  return placeYardInstances(seed, PROTOTYPE_PLACEMENT);
}

/**
 * Täydentää puuttuvat pihainstanssit. Vanha tallennus (ei instansseja) säilyttää kiinteän pihansa
 * tunnisteella "yard" (jousineito mukana) ja saa arvotun toisen pihan "yard-b" (ei jousineitoa).
 * Jos vain toinen on olemassa, puuttuva arvotaan. Sijoittelu on deterministinen siemenestä; siemen
 * tallennetaan kampanjaan, ja tulos tallennetaan konkretisoituna, joten sitä ei arvota uudelleen.
 */
export function completeYardInstances(state: CampaignState, freshSeed: number): CampaignState {
  const have = new Set(state.world.siteInstances.map((instance) => instance.id));
  if (YARD_INSTANCE_IDS.every((id) => have.has(id))) return state;
  const seed = state.world.worldSeed || freshSeed;
  let existing = state.world.siteInstances;
  let missing: readonly string[] = YARD_INSTANCE_IDS.filter((id) => !have.has(id));
  if (existing.length === 0) {
    existing = [{ id: "yard", kind: "yard", x: LEGACY_YARD_POSITION.x, y: LEGACY_YARD_POSITION.y, archer: true }];
    missing = ["yard-b"];
  }
  const placed = placeYardInstances(seed, PROTOTYPE_PLACEMENT, { ids: missing, existing });
  return {
    ...state,
    world: { ...state.world, worldSeed: seed, siteInstances: [...existing, ...placed] },
  };
}
