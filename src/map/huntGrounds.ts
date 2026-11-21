// Metsästysapajat kartalla: alkuarvonta, 20 päivän uusiutuminen ja kertakäyttö. Puhdas moduuli.
//
// Apaja on tavallinen paikkainstanssi (kind "hunt"), joka avaa erämaakohtauksen. Se ei ole koskaan
// valmiiksi tunnettu: kartta näyttää sen vasta, kun sankari on sen vieressä (3 × 3 -näkö, myös
// viistoon), vaikka ruutu olisi jo tutkittu. Sisään meneminen kuluttaa apajan.
import type { CampaignState, SiteInstance } from "./campaign";
import { mapCell, mapIndex, type MapPosition, type TerrainId, type WorldMapDefinition } from "./domain";
import { chebyshev, rngStream, travelMinutes } from "./placement";
import { PROTOTYPE_MAP, PROTOTYPE_START } from "./prototype";
import { MAP_SITE_DEFINITIONS } from "./sites";
import { WORLD_MINUTES_PER_DAY } from "./uiState";

/** Omistajan päätökset 2026-11-21. */
export const HUNT_RULES = {
  /** Uuden matkan alussa arvottavat apajat. */
  initial: [3, 6] as const,
  /** Aktiivisia apajia enintään; täynnä vanhin väistyy uuden tieltä. */
  maxActive: 6,
  /** Näin monen pelipäivän välein arvotaan yksi uusi apaja. */
  periodDays: 20,
  terrains: ["meadow", "forest", "deepForest", "bog"] as readonly TerrainId[],
  /** Ei toisen 3D-paikan (näkyvän, löytämättömän tai lukitun) vieressä: Chebyshev-väli vähintään. */
  minSiteDistance: 2,
  /** Ei sankarin näkökentässä syntyessään, jotta apaja löydetään eikä se ilmesty silmien eteen. */
  minHeroDistance: 2,
} as const;

export const HUNT_INSTANCE_PREFIX = "hunt-";

export function isHuntInstance(instance: Pick<SiteInstance, "kind">): boolean {
  return instance.kind === "hunt";
}

/** Kuinka mones 20 päivän jakso on menossa (0 = ensimmäiset 20 päivää). */
export function huntCycleAt(worldMinutes: number): number {
  const days = Math.max(0, Number.isFinite(worldMinutes) ? worldMinutes : 0) / WORLD_MINUTES_PER_DAY;
  return Math.floor(days / HUNT_RULES.periodDays + 1e-9);
}

export interface HuntPlacementContext {
  map: WorldMapDefinition;
  start: MapPosition;
  /** Kaikki muut 3D-paikat: kiinteät ja instanssit (myös lukittu leiri ja muut apajat). */
  sites: readonly MapPosition[];
  hero: MapPosition;
}

/** Ruudut, joihin apajan voi arpoa. Järjestys on rivi kerrallaan, joten arvonta on deterministinen. */
export function huntCandidates(context: HuntPlacementContext): MapPosition[] {
  const minutes = travelMinutes(context.map, context.start);
  const out: MapPosition[] = [];
  for (let y = 0; y < context.map.height; y++) {
    for (let x = 0; x < context.map.width; x++) {
      const cell = mapCell(context.map, x, y);
      if (!cell || cell.siteId || cell.crossingId) continue;
      if (!(HUNT_RULES.terrains as readonly string[]).includes(cell.terrainId)) continue;
      if (!Number.isFinite(minutes[mapIndex(context.map, x, y)])) continue;
      const p = { x, y };
      if (chebyshev(p, context.hero) < HUNT_RULES.minHeroDistance) continue;
      if (context.sites.some((site) => chebyshev(p, site) < HUNT_RULES.minSiteDistance)) continue;
      out.push(p);
    }
  }
  return out;
}

/** Kaikkien 3D-paikkojen sijainnit tilasta: kiinteät määritelmät ja kaikki instanssit. */
function sitePositions(state: CampaignState): MapPosition[] {
  return [
    ...Object.values(MAP_SITE_DEFINITIONS).map((site) => site.position),
    ...state.world.siteInstances.map((instance) => ({ x: instance.x, y: instance.y })),
  ];
}

function contextFor(state: CampaignState, map: WorldMapDefinition, hero: MapPosition): HuntPlacementContext {
  return { map, start: PROTOTYPE_START, sites: sitePositions(state), hero };
}

function placeOne(state: CampaignState, map: WorldMapDefinition, id: string, rng: () => number, hero: MapPosition): CampaignState {
  const candidates = huntCandidates(contextFor(state, map, hero));
  // Täysi kartta ei kaada peliä: apaja vain jää tältä kerralta syntymättä.
  if (candidates.length === 0) return state;
  const pick = candidates[Math.floor(rng() * candidates.length)];
  const instance: SiteInstance = { id, kind: "hunt", x: pick.x, y: pick.y, archer: false };
  return { ...state, world: { ...state.world, siteInstances: [...state.world.siteInstances, instance] } };
}

/** Poistaa apajan kartalta ja pelaajan tiedosta. Muu tila säilyy. */
export function removeHuntGround(state: CampaignState, id: string): CampaignState {
  if (!state.world.siteInstances.some((instance) => instance.id === id && isHuntInstance(instance))) return state;
  return {
    ...state,
    world: {
      ...state.world,
      siteInstances: state.world.siteInstances.filter((instance) => instance.id !== id),
      knownSiteIds: state.world.knownSiteIds.filter((siteId) => siteId !== id),
    },
  };
}

/**
 * Uuden matkan tai vanhan tallennuksen alkuapajat (3–6). Tehdään kerran: `huntCycle` asetetaan
 * nykyiseen jaksoon, joten vanha tallennus ei saa ryöppyä apajia kuluneista päivistä.
 */
export function ensureHuntGrounds(state: CampaignState, map: WorldMapDefinition = PROTOTYPE_MAP): CampaignState {
  if (state.world.huntCycle >= 0) return state;
  const cycleNow = huntCycleAt(state.world.worldMinutes);
  // Kelvoton jaksokenttä mutta apajat tallessa: ei arvota uusia päällekkäin.
  if (state.world.siteInstances.some(isHuntInstance)) return { ...state, world: { ...state.world, huntCycle: cycleNow } };
  const rng = rngStream(state.world.worldSeed, "hunt-initial");
  const [lo, hi] = HUNT_RULES.initial;
  const count = lo + Math.floor(rng() * (hi - lo + 1));
  let next: CampaignState = { ...state, world: { ...state.world, huntCycle: cycleNow } };
  // Alussa sankari on aloituspaikassa; vanhassa tallennuksessa hän voi olla jo muualla.
  const hero = { x: state.world.x, y: state.world.y };
  for (let i = 1; i <= count; i++) next = placeOne(next, map, `${HUNT_INSTANCE_PREFIX}a${i}`, rng, hero);
  return next;
}

/**
 * Ajan kuluessa: jokaista alkanutta 20 päivän jaksoa kohti yksi uusi apaja. Jos aktiivisia on jo
 * kuusi, vanhin (listan ensimmäinen) väistyy ensin. Uusi apaja ei ole tunnettu.
 */
export function advanceHuntGrounds(state: CampaignState, map: WorldMapDefinition = PROTOTYPE_MAP): CampaignState {
  if (state.world.huntCycle < 0) return state;
  const target = huntCycleAt(state.world.worldMinutes);
  let next = state;
  const hero = { x: state.world.x, y: state.world.y };
  for (let cycle = state.world.huntCycle + 1; cycle <= target; cycle++) {
    const hunts = next.world.siteInstances.filter(isHuntInstance);
    if (hunts.length >= HUNT_RULES.maxActive) next = removeHuntGround(next, hunts[0].id);
    next = placeOne(next, map, `${HUNT_INSTANCE_PREFIX}c${cycle}`, rngStream(state.world.worldSeed, `hunt-${cycle}`), hero);
    next = { ...next, world: { ...next.world, huntCycle: cycle } };
  }
  return next;
}
