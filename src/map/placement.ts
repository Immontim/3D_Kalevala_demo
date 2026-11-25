// Pihapiirien sijoittelu kartalle siemenestä. Puhdas moduuli: ei DOM:ia, ei Math.random-kutsuja.
//
// Sijoitus generoidaan rakentamalla (ehdokasruudut suodatetaan säännöillä), joten se onnistuu
// aina, ja riippumaton validaattori tarkistaa tuloksen. Tulos tallennetaan kampanjaan
// konkretisoituna (`siteInstances`): generaattori saa muuttua versioiden välillä ilman, että
// jo tallennettu maailma siirtyy.
import { mapCell, mapCellTravel, mapIndex, type MapPosition, type TerrainId, type WorldMapDefinition } from "./domain";
import type { SiteInstance } from "./campaign";

/** Pihapiirien sijoittelusäännöt. Luvut ovat ensimmäinen arvio; pelitesti säätää löydettävyyden (V8). */
export const YARD_PLACEMENT = {
  /** Kartan keskialue, sisältäen rajat. */
  centre: { minX: 4, maxX: 15, minY: 4, maxY: 15 },
  /** Sallitut maastot: niitty ja metsä (ei suota, kalliota, umpimetsää eikä vettä). */
  terrains: ["meadow", "forest"] as readonly TerrainId[],
  /** Vähintään näin kaukana aloituksesta (Chebyshev), ettei piha paljastu heti. */
  minStartDistance: 3,
  /** Enintään näin monta maailmaminuuttia kulkureittiä aloituksesta ("kohtuullinen matka"). */
  maxStartMinutes: 150,
  /** Kahden pihan väli (Chebyshev), jotta yksi lähinäkö ei paljasta molempia. */
  minMutualDistance: 5,
  /** Etäisyys tietäjän mökistä ja kalmistoista. */
  minFixedDistance: 3,
} as const;

export const YARD_INSTANCE_IDS = ["yard", "yard-b"] as const;
export const SMITHY_INSTANCE_ID = "smithy";
export const CAMP_INSTANCE_ID = "camp";

/**
 * Sepän paja on tavallisella kulkukelpoisella pihamaalla, kohtuullisen matkan päässä alusta ja
 * erillään muista pysyvistä paikoista. Oma satunnaisvirta pitää sen paikan vakaana, vaikka pihojen
 * tai rantapaikkojen sijoittelua myöhemmin säädetään.
 */
export const SMITHY_PLACEMENT = {
  terrains: ["meadow", "forest"] as readonly TerrainId[],
  minStartDistance: 3,
  maxStartMinutes: 180,
  minOtherDistance: 3,
} as const;

/**
 * Vainolaisten leirin sijoittelusäännöt: kartan reunalla, kaukana aloituksesta. Kartan uloin
 * kehä on vettä, joten "reuna" tarkoittaa maata aivan rannan tuntumassa.
 */
export const CAMP_PLACEMENT = {
  /** Ruudun etäisyys lähimmästä kartan reunasta (0 = uloin ruutu) on enintään tämä. */
  edgeBand: 4,
  terrains: ["meadow", "forest", "deepForest", "rock"] as readonly TerrainId[],
  /** Vähintään näin kaukana aloituksesta (Chebyshev): leiri on retken päässä, ei lähellä. */
  minStartDistance: 8,
  /** Enintään näin monta maailmaminuuttia reittiä aloituksesta (kampanjan pitää olla läpäistävissä). */
  maxStartMinutes: 600,
  /** Etäisyys pihoista ja kiinteistä paikoista (Chebyshev). */
  minOtherDistance: 4,
} as const;

/** Siemenestä ja nimestä johdettu oma satunnaisvirta (mulberry32), jotta virrat eivät sekoita toisiaan. */
export function rngStream(seed: number, name: string): () => number {
  let h = 2166136261 ^ (seed >>> 0);
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function chebyshev(a: MapPosition, b: MapPosition): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

const travelCache = new WeakMap<WorldMapDefinition, Map<string, number[]>>();

/** Pienin matka-aika (maailmaminuutteina) aloituksesta jokaiseen kulkukelpoiseen ruutuun; Infinity = ei saavuteta. */
export function travelMinutes(map: WorldMapDefinition, start: MapPosition): number[] {
  // Kartta on muuttumaton, joten tulos välimuistitetaan (validointi kutsuu tätä jokaiselle ehdokkaalle).
  const key = `${start.x},${start.y}`;
  let perStart = travelCache.get(map);
  if (!perStart) { perStart = new Map(); travelCache.set(map, perStart); }
  const cached = perStart.get(key);
  if (cached) return cached;
  const computed = computeTravelMinutes(map, start);
  perStart.set(key, computed);
  return computed;
}

function computeTravelMinutes(map: WorldMapDefinition, start: MapPosition): number[] {
  const cost = Array<number>(map.cells.length).fill(Infinity);
  if (!mapCell(map, start.x, start.y)) return cost;
  cost[mapIndex(map, start.x, start.y)] = 0;
  const open: MapPosition[] = [{ ...start }];
  while (open.length > 0) {
    // Kartta on pieni (400 ruutua): lineaarinen haku riittää eikä vaadi kekoa.
    let best = 0;
    for (let i = 1; i < open.length; i++) {
      if (cost[mapIndex(map, open[i].x, open[i].y)] < cost[mapIndex(map, open[best].x, open[best].y)]) best = i;
    }
    const current = open.splice(best, 1)[0];
    const base = cost[mapIndex(map, current.x, current.y)];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = current.x + dx, y = current.y + dy;
      const cell = mapCell(map, x, y);
      if (!cell) continue;
      const travel = mapCellTravel(cell);
      if (!travel.passable) continue;
      const next = base + travel.minuteCost;
      const i = mapIndex(map, x, y);
      if (next < cost[i]) {
        cost[i] = next;
        open.push({ x, y });
      }
    }
  }
  return cost;
}

export interface PlacementContext {
  map: WorldMapDefinition;
  start: MapPosition;
  /** Jo sijoitetut paikat (tietäjän mökki, kalmistot), joiden päälle tai lähelle ei sijoiteta. */
  fixedSites: readonly MapPosition[];
}

/** Rikkomukset suomeksi; tyhjä lista = sijoittelu kelpaa. Riippumaton generaattorista. */
export function validateYardPlacement(instances: readonly SiteInstance[], context: PlacementContext): string[] {
  const rules = YARD_PLACEMENT;
  const problems: string[] = [];
  const minutes = travelMinutes(context.map, context.start);
  const ids = new Set<string>();
  for (const instance of instances) {
    const label = `piha ${instance.id} (${instance.x},${instance.y})`;
    if (ids.has(instance.id)) problems.push(`${label}: tunniste esiintyy kahdesti`);
    ids.add(instance.id);
    const cell = mapCell(context.map, instance.x, instance.y);
    if (!cell) { problems.push(`${label}: ruutu on kartan ulkopuolella`); continue; }
    const c = rules.centre;
    if (instance.x < c.minX || instance.x > c.maxX || instance.y < c.minY || instance.y > c.maxY) {
      problems.push(`${label}: ei ole kartan keskialueella`);
    }
    if (!(rules.terrains as readonly string[]).includes(cell.terrainId) || cell.crossingId) {
      problems.push(`${label}: maasto ${cell.terrainId} ei kelpaa pihalle`);
    }
    if (cell.siteId) problems.push(`${label}: ruudussa on jo paikka ${cell.siteId}`);
    if (chebyshev(instance, context.start) < rules.minStartDistance) problems.push(`${label}: liian lähellä aloitusta`);
    const cost = minutes[mapIndex(context.map, instance.x, instance.y)];
    if (!Number.isFinite(cost)) problems.push(`${label}: ei saavuteta aloituksesta`);
    else if (cost > rules.maxStartMinutes) problems.push(`${label}: matka ${cost} min ylittää rajan ${rules.maxStartMinutes}`);
    for (const fixed of context.fixedSites) {
      if (chebyshev(instance, fixed) < rules.minFixedDistance) problems.push(`${label}: liian lähellä kiinteää paikkaa (${fixed.x},${fixed.y})`);
    }
  }
  for (let i = 0; i < instances.length; i++) {
    for (let j = i + 1; j < instances.length; j++) {
      if (chebyshev(instances[i], instances[j]) < rules.minMutualDistance) {
        problems.push(`pihat ${instances[i].id} ja ${instances[j].id} ovat liian lähellä toisiaan`);
      }
    }
  }
  return problems;
}

/**
 * Valitsee kelvolliset ruudut kahden uuden pihan paikoiksi ja arpoo jousineidon talon.
 * `existing` on jo sijoitetut (esim. vanhan tallennuksen piha), jotka säilyvät ja jotka uudet välttävät.
 * Palauttaa vain uudet instanssit. Heittää, jos kelvollista ruutua ei ole (kartta ei sovi sääntöihin).
 */
export function placeYardInstances(
  seed: number,
  context: PlacementContext,
  options: { ids?: readonly string[]; existing?: readonly SiteInstance[] } = {},
): SiteInstance[] {
  const ids = options.ids ?? YARD_INSTANCE_IDS;
  const existing = options.existing ?? [];
  const rules = YARD_PLACEMENT;
  const minutes = travelMinutes(context.map, context.start);
  const rng = rngStream(seed, "placement");
  const placed: SiteInstance[] = [];
  const all = () => [...existing, ...placed];

  for (const id of ids) {
    const candidates: MapPosition[] = [];
    for (let y = rules.centre.minY; y <= rules.centre.maxY; y++) {
      for (let x = rules.centre.minX; x <= rules.centre.maxX; x++) {
        const candidate: SiteInstance = { id, kind: "yard", x, y, archer: false };
        if (validateYardPlacement([candidate], context).length > 0) continue;
        if (!Number.isFinite(minutes[mapIndex(context.map, x, y)])) continue;
        if (all().some((other) => chebyshev(other, candidate) < rules.minMutualDistance)) continue;
        candidates.push({ x, y });
      }
    }
    if (candidates.length === 0) throw new Error(`Pihalle ${id} ei löydy kelvollista ruutua siemenellä ${seed}`);
    const pick = candidates[Math.floor(rng() * candidates.length)];
    placed.push({ id, kind: "yard", x: pick.x, y: pick.y, archer: false });
  }

  // Jousineidon talo arvotaan omasta virrastaan, jotta sijoittelusääntöjen muutos ei vaihda sitä.
  if (placed.length > 0 && !all().some((instance) => instance.archer)) {
    placed[Math.floor(rngStream(seed, "archer")() * placed.length)].archer = true;
  }
  return placed;
}

/** Sepän pajan sijoittelun rikkomukset (tyhjä = kelpaa). */
export function validateSmithyPlacement(
  smithy: SiteInstance,
  context: PlacementContext,
  others: readonly SiteInstance[],
): string[] {
  const rules = SMITHY_PLACEMENT;
  const problems: string[] = [];
  const label = `sepän paja ${smithy.id} (${smithy.x},${smithy.y})`;
  const cell = mapCell(context.map, smithy.x, smithy.y);
  if (!cell) return [`${label}: ruutu on kartan ulkopuolella`];
  if (!(rules.terrains as readonly string[]).includes(cell.terrainId) || cell.crossingId) {
    problems.push(`${label}: maasto ${cell.terrainId} ei kelpaa pajalle`);
  }
  if (cell.siteId) problems.push(`${label}: ruudussa on jo paikka ${cell.siteId}`);
  if (chebyshev(smithy, context.start) < rules.minStartDistance) problems.push(`${label}: liian lähellä aloitusta`);
  const cost = travelMinutes(context.map, context.start)[mapIndex(context.map, smithy.x, smithy.y)];
  if (!Number.isFinite(cost)) problems.push(`${label}: ei saavuteta aloituksesta`);
  else if (cost > rules.maxStartMinutes) problems.push(`${label}: matka ${cost} min ylittää rajan ${rules.maxStartMinutes}`);
  for (const fixed of context.fixedSites) {
    if (chebyshev(smithy, fixed) < rules.minOtherDistance) problems.push(`${label}: liian lähellä kiinteää paikkaa (${fixed.x},${fixed.y})`);
  }
  for (const other of others) {
    if (other.id !== smithy.id && chebyshev(smithy, other) < rules.minOtherDistance) {
      problems.push(`${label}: liian lähellä paikkaa ${other.id}`);
    }
  }
  return problems;
}

/** Arpoo yhden pysyvän sepän pajan omasta `smithy`-satunnaisvirrastaan. */
export function placeSmithyInstance(
  seed: number,
  context: PlacementContext,
  others: readonly SiteInstance[],
): SiteInstance {
  const candidates: MapPosition[] = [];
  for (let y = 0; y < context.map.height; y++) {
    for (let x = 0; x < context.map.width; x++) {
      const candidate: SiteInstance = { id: SMITHY_INSTANCE_ID, kind: "smithy", x, y, archer: false };
      if (validateSmithyPlacement(candidate, context, others).length === 0) candidates.push({ x, y });
    }
  }
  if (candidates.length === 0) throw new Error(`Sepän pajalle ei löydy kelvollista ruutua siemenellä ${seed}`);
  const pick = candidates[Math.floor(rngStream(seed, "smithy")() * candidates.length)];
  return { id: SMITHY_INSTANCE_ID, kind: "smithy", x: pick.x, y: pick.y, archer: false };
}

function edgeDistance(map: WorldMapDefinition, x: number, y: number): number {
  return Math.min(x, y, map.width - 1 - x, map.height - 1 - y);
}

/** Leirin sijoittelun rikkomukset suomeksi (tyhjä = kelpaa). `others` = pihat ym. muut instanssit. */
export function validateCampPlacement(camp: SiteInstance, context: PlacementContext, others: readonly SiteInstance[]): string[] {
  const rules = CAMP_PLACEMENT;
  const problems: string[] = [];
  const label = `leiri ${camp.id} (${camp.x},${camp.y})`;
  const cell = mapCell(context.map, camp.x, camp.y);
  if (!cell) return [`${label}: ruutu on kartan ulkopuolella`];
  if (edgeDistance(context.map, camp.x, camp.y) > rules.edgeBand) problems.push(`${label}: ei ole kartan reunalla`);
  if (!(rules.terrains as readonly string[]).includes(cell.terrainId) || cell.crossingId) {
    problems.push(`${label}: maasto ${cell.terrainId} ei kelpaa leirille`);
  }
  if (cell.siteId) problems.push(`${label}: ruudussa on jo paikka ${cell.siteId}`);
  if (chebyshev(camp, context.start) < rules.minStartDistance) problems.push(`${label}: liian lähellä aloitusta`);
  const cost = travelMinutes(context.map, context.start)[mapIndex(context.map, camp.x, camp.y)];
  if (!Number.isFinite(cost)) problems.push(`${label}: ei saavuteta aloituksesta`);
  else if (cost > rules.maxStartMinutes) problems.push(`${label}: matka ${cost} min ylittää rajan ${rules.maxStartMinutes}`);
  for (const fixed of context.fixedSites) {
    if (chebyshev(camp, fixed) < rules.minOtherDistance) problems.push(`${label}: liian lähellä kiinteää paikkaa (${fixed.x},${fixed.y})`);
  }
  for (const other of others) {
    if (other.id !== camp.id && chebyshev(camp, other) < rules.minOtherDistance) problems.push(`${label}: liian lähellä paikkaa ${other.id}`);
  }
  return problems;
}

/**
 * Arpoo vainolaisten leirin kartan reunalle kauas aloituksesta omasta satunnaisvirrastaan ("camp"),
 * joten pihojen sijoittelun muutos ei siirrä leiriä. `others` ovat jo sijoitetut pihat.
 */
export function placeCampInstance(seed: number, context: PlacementContext, others: readonly SiteInstance[]): SiteInstance {
  const rules = CAMP_PLACEMENT;
  const candidates: MapPosition[] = [];
  for (let y = 0; y < context.map.height; y++) {
    for (let x = 0; x < context.map.width; x++) {
      const candidate: SiteInstance = { id: CAMP_INSTANCE_ID, kind: "camp", x, y, archer: false };
      if (edgeDistance(context.map, x, y) > rules.edgeBand) continue;
      if (validateCampPlacement(candidate, context, others).length === 0) candidates.push({ x, y });
    }
  }
  if (candidates.length === 0) throw new Error(`Leirille ei löydy kelvollista ruutua siemenellä ${seed}`);
  const pick = candidates[Math.floor(rngStream(seed, "camp")() * candidates.length)];
  return { id: CAMP_INSTANCE_ID, kind: "camp", x: pick.x, y: pick.y, archer: false };
}

/**
 * Tietäjän mökin ja kalmistojen sijoittelusäännöt (omistaja 2026-11-22): kaikki rannalla, eli
 * ruudun vieressä (ei viistoon) on avovettä. Kalmistot vain rannoille toistaiseksi, koska kalmiston
 * 3D-kohtauksessa näkyy järvi; suo ja vaara lisätään, kun kohtauksesta on niille versiot.
 */
export const SHORE_PLACEMENT = {
  sageTerrains: ["meadow", "forest"] as readonly TerrainId[],
  cairnTerrains: ["meadow", "forest", "deepForest", "rock"] as readonly TerrainId[],
  /** Vähintään näin kaukana aloituksesta (Chebyshev). */
  minStartDistance: 4,
  /** Kampanjan pitää olla läpäistävissä: sama raja kuin leirillä. */
  maxStartMinutes: 600,
  /** Kalmisto ei ole tietäjän mökin lähellä. */
  minSageCairnDistance: 5,
  /** Kalmistot eivät ole toistensa lähellä. */
  minCairnDistance: 5,
  /** Etäisyys muista paikoista (pihat, leiri). */
  minOtherDistance: 3,
} as const;

/** Onko ruutu maata, jonka vieressä (pohjoinen, etelä, itä tai länsi) on avovettä? */
export function isShoreCell(map: WorldMapDefinition, x: number, y: number): boolean {
  const cell = mapCell(map, x, y);
  if (!cell || cell.terrainId === "water" || cell.terrainId === "river") return false;
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => mapCell(map, x + dx, y + dy)?.terrainId === "water");
}

/** Rantapaikan rikkomukset suomeksi (tyhjä = kelpaa). `others` = jo sijoitetut paikat. */
export function validateShorePlacement(site: SiteInstance, context: PlacementContext, others: readonly SiteInstance[]): string[] {
  const rules = SHORE_PLACEMENT;
  const problems: string[] = [];
  const label = `${site.kind === "lakeside" ? "tietäjän mökki" : "kalmisto"} ${site.id} (${site.x},${site.y})`;
  const cell = mapCell(context.map, site.x, site.y);
  if (!cell) return [`${label}: ruutu on kartan ulkopuolella`];
  const terrains = site.kind === "lakeside" ? rules.sageTerrains : rules.cairnTerrains;
  if (!(terrains as readonly string[]).includes(cell.terrainId) || cell.crossingId) problems.push(`${label}: maasto ${cell.terrainId} ei kelpaa`);
  if (!isShoreCell(context.map, site.x, site.y)) problems.push(`${label}: ei ole rannalla`);
  if (cell.siteId) problems.push(`${label}: ruudussa on jo paikka ${cell.siteId}`);
  if (chebyshev(site, context.start) < rules.minStartDistance) problems.push(`${label}: liian lähellä aloitusta`);
  const cost = travelMinutes(context.map, context.start)[mapIndex(context.map, site.x, site.y)];
  if (!Number.isFinite(cost)) problems.push(`${label}: ei saavuteta aloituksesta`);
  else if (cost > rules.maxStartMinutes) problems.push(`${label}: matka ${cost} min ylittää rajan ${rules.maxStartMinutes}`);
  for (const fixed of context.fixedSites) {
    if (chebyshev(site, fixed) < rules.minOtherDistance) problems.push(`${label}: liian lähellä paikkaa (${fixed.x},${fixed.y})`);
  }
  for (const other of others) {
    if (other.id === site.id) continue;
    const sageAndCairn = (other.kind === "lakeside" && site.kind === "cairn") || (other.kind === "cairn" && site.kind === "lakeside");
    const min = sageAndCairn ? rules.minSageCairnDistance
      : other.kind === "cairn" && site.kind === "cairn" ? rules.minCairnDistance : rules.minOtherDistance;
    if (chebyshev(site, other) < min) problems.push(`${label}: liian lähellä paikkaa ${other.id}`);
  }
  return problems;
}

/**
 * Arpoo rantapaikat (`ids`: tietäjän mökki "lakeside", kalmistot) järjestyksessä, kukin omasta
 * satunnaisvirrastaan, joten yhden säännön muutos ei siirrä muita. `existing` väistetään.
 */
export function placeShoreSites(
  seed: number,
  context: PlacementContext,
  ids: readonly string[],
  existing: readonly SiteInstance[] = [],
): SiteInstance[] {
  const placed: SiteInstance[] = [];
  for (const id of ids) {
    const kind = id === "lakeside" ? "lakeside" as const : "cairn" as const;
    const candidates: MapPosition[] = [];
    for (let y = 0; y < context.map.height; y++) {
      for (let x = 0; x < context.map.width; x++) {
        const candidate: SiteInstance = { id, kind, x, y, archer: false };
        if (validateShorePlacement(candidate, context, [...existing, ...placed]).length === 0) candidates.push({ x, y });
      }
    }
    if (candidates.length === 0) throw new Error(`Paikalle ${id} ei löydy rantaruutua siemenellä ${seed}`);
    const pick = candidates[Math.floor(rngStream(seed, `shore:${id}`)() * candidates.length)];
    placed.push({ id, kind, x: pick.x, y: pick.y, archer: false });
  }
  return placed;
}
