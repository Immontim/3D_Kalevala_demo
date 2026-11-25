// Prototyyppikartan paikkainstanssien luonti ja täydennys. Yhdistää sijoittelun (placement.ts),
// kartan (prototype.ts) ja kampanjan; puhdas, siemen annetaan ulkopuolelta.
import type { CampaignState, SiteInstance } from "./campaign";
import { ensureHuntGrounds } from "./huntGrounds";
import {
  CAMP_INSTANCE_ID, SMITHY_INSTANCE_ID, YARD_INSTANCE_IDS, placeCampInstance, placeShoreSites,
  placeSmithyInstance, placeYardInstances, type PlacementContext,
} from "./placement";
import { PROTOTYPE_MAP, PROTOTYPE_START } from "./prototype";
import { LEGACY_SHORE_POSITIONS, LEGACY_YARD_POSITION, SHORE_SITE_IDS } from "./sites";

/** Kartta ja aloitus ilman jo sijoitettuja paikkoja; `withSites` lisää ne väistettäviksi. */
export const PROTOTYPE_PLACEMENT: PlacementContext = {
  map: PROTOTYPE_MAP,
  start: PROTOTYPE_START,
  fixedSites: [],
};

/** Sijoittelukonteksti, jossa annetut paikat (esim. mökki ja kalmistot) väistetään. */
export function placementWith(sites: readonly SiteInstance[]): PlacementContext {
  return { ...PROTOTYPE_PLACEMENT, fixedSites: sites.map((site) => ({ x: site.x, y: site.y })) };
}

/** Uuden matkan pihat annettujen rantapaikkojen ympärille: molemmat arvotaan, toisessa on jousineito. */
export function newYardInstances(seed: number, shore: readonly SiteInstance[] = newShoreInstances(seed)): SiteInstance[] {
  return placeYardInstances(seed, placementWith(shore));
}

/** Uuden matkan tietäjän mökki ja kaksi kalmistoa rannoille. */
export function newShoreInstances(seed: number): SiteInstance[] {
  return placeShoreSites(seed, PROTOTYPE_PLACEMENT, SHORE_SITE_IDS);
}

/**
 * Uuden matkan kaikki arvotut paikat: ensin tietäjän mökki ja kalmistot rannoille (niillä on tiukimmat
 * maastoehdot), sitten kaksi pihaa, sepän paja ja lopuksi vainolaisten leiri kartan reunalla.
 */
export function newSiteInstances(seed: number): SiteInstance[] {
  const shore = newShoreInstances(seed);
  const yards = newYardInstances(seed, shore);
  const smithy = placeSmithyInstance(seed, placementWith(shore), [...shore, ...yards]);
  return [...shore, ...yards, smithy, placeCampInstance(seed, placementWith(shore), [...yards, smithy])];
}

/**
 * Täydentää puuttuvat instanssit. Vanha tallennus (ei instansseja) säilyttää kiinteän pihansa
 * tunnisteella "yard" (jousineito mukana) ja saa arvotun toisen pihan "yard-b" (ei jousineitoa).
 * Ennen v08:aa tietäjän mökki ja Louhen kalmisto olivat kartan kiinteitä paikkoja: vanha tallennus
 * saa ne entisille paikoilleen instansseina, ja vain uusi uhrikalmisto `cairn-b` arvotaan.
 * Jos vain osa on olemassa, puuttuvat arvotaan (leiri `camp` viimeisenä, pihoista etäällä).
 * Sijoittelu on deterministinen siemenestä; siemen tallennetaan kampanjaan, ja tulos tallennetaan
 * konkretisoituna, joten sitä ei arvota uudelleen. Lopuksi arvotaan metsästysapajat kerran, jos
 * tallennuksessa ei vielä ole niitä (huntCycle −1); ne väistävät kaikki paikat.
 */
export function completeSiteInstances(state: CampaignState, freshSeed: number): CampaignState {
  return ensureHuntGrounds(completeFixedInstances(state, freshSeed));
}

function completeFixedInstances(state: CampaignState, freshSeed: number): CampaignState {
  const have = new Set(state.world.siteInstances.map((instance) => instance.id));
  const required = [...SHORE_SITE_IDS, ...YARD_INSTANCE_IDS, SMITHY_INSTANCE_ID, CAMP_INSTANCE_ID];
  if (required.every((id) => have.has(id))) return state;
  const seed = state.world.worldSeed || freshSeed;
  let existing = state.world.siteInstances;
  let missingYards: readonly string[] = YARD_INSTANCE_IDS.filter((id) => !have.has(id));
  if (existing.length === 0) {
    existing = [{ id: "yard", kind: "yard", x: LEGACY_YARD_POSITION.x, y: LEGACY_YARD_POSITION.y, archer: true }];
    missingYards = ["yard-b"];
  }
  // Ennen v08:aa kiinteät paikat: sama ruutu kuin ennen, jotta pelaajan kartta ei muutu.
  const legacy: SiteInstance[] = [];
  if (!have.has("lakeside")) legacy.push({ id: "lakeside", kind: "lakeside", ...LEGACY_SHORE_POSITIONS.lakeside, archer: false });
  if (!have.has("cairnfield")) legacy.push({ id: "cairnfield", kind: "cairn", ...LEGACY_SHORE_POSITIONS.cairnfield, archer: false });
  const withLegacy = [...existing, ...legacy];
  const shoreAll = withLegacy.filter((site) => site.kind === "lakeside" || site.kind === "cairn");
  const placedYards = missingYards.length > 0
    ? placeYardInstances(seed, placementWith(shoreAll), { ids: missingYards, existing: withLegacy.filter((s) => s.kind === "yard") })
    : [];
  const withYards = [...withLegacy, ...placedYards];
  const yards = withYards.filter((site) => site.kind === "yard");
  const smithy = have.has(SMITHY_INSTANCE_ID)
    ? []
    : [placeSmithyInstance(seed, placementWith(shoreAll), withYards)];
  const withSmithy = [...withYards, ...smithy];
  const camp = have.has(CAMP_INSTANCE_ID)
    ? []
    : [placeCampInstance(seed, placementWith(shoreAll), [...yards, ...withSmithy.filter((site) => site.kind === "smithy")])];
  const withCamp = [...withSmithy, ...camp];
  const missingShore = SHORE_SITE_IDS.filter((id) => !withCamp.some((site) => site.id === id));
  const shore = missingShore.length > 0 ? placeShoreSites(seed, PROTOTYPE_PLACEMENT, missingShore, withCamp) : [];
  return {
    ...state,
    world: { ...state.world, worldSeed: seed, siteInstances: [...withCamp, ...shore] },
  };
}
