// Prototyyppikartan paikkainstanssien luonti ja täydennys. Yhdistää sijoittelun (placement.ts),
// kartan (prototype.ts) ja kampanjan; puhdas, siemen annetaan ulkopuolelta.
import type { CampaignState, SiteInstance } from "./campaign";
import { CAMP_INSTANCE_ID, YARD_INSTANCE_IDS, placeCampInstance, placeYardInstances, type PlacementContext } from "./placement";
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

/** Uuden matkan kaikki arvotut paikat: kaksi pihaa ja vainolaisten leiri kartan reunalla. */
export function newSiteInstances(seed: number): SiteInstance[] {
  const yards = newYardInstances(seed);
  return [...yards, placeCampInstance(seed, PROTOTYPE_PLACEMENT, yards)];
}

/**
 * Täydentää puuttuvat instanssit. Vanha tallennus (ei instansseja) säilyttää kiinteän pihansa
 * tunnisteella "yard" (jousineito mukana) ja saa arvotun toisen pihan "yard-b" (ei jousineitoa).
 * Jos vain osa on olemassa, puuttuvat arvotaan (leiri `camp` viimeisenä, pihoista etäällä).
 * Sijoittelu on deterministinen siemenestä; siemen tallennetaan kampanjaan, ja tulos tallennetaan
 * konkretisoituna, joten sitä ei arvota uudelleen.
 */
export function completeSiteInstances(state: CampaignState, freshSeed: number): CampaignState {
  const have = new Set(state.world.siteInstances.map((instance) => instance.id));
  if (YARD_INSTANCE_IDS.every((id) => have.has(id)) && have.has(CAMP_INSTANCE_ID)) return state;
  const seed = state.world.worldSeed || freshSeed;
  let existing = state.world.siteInstances;
  let missing: readonly string[] = YARD_INSTANCE_IDS.filter((id) => !have.has(id));
  if (existing.length === 0) {
    existing = [{ id: "yard", kind: "yard", x: LEGACY_YARD_POSITION.x, y: LEGACY_YARD_POSITION.y, archer: true }];
    missing = ["yard-b"];
  }
  const placed = missing.length > 0 ? placeYardInstances(seed, PROTOTYPE_PLACEMENT, { ids: missing, existing }) : [];
  const withYards = [...existing, ...placed];
  const camp = have.has(CAMP_INSTANCE_ID) ? [] : [placeCampInstance(seed, PROTOTYPE_PLACEMENT, withYards)];
  return {
    ...state,
    world: { ...state.world, worldSeed: seed, siteInstances: [...withYards, ...camp] },
  };
}
