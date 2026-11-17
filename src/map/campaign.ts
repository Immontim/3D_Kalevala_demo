// Pysyvä kampanjatila: maailmankartta, kylläisyys, inventaario ja varusteet.
// Moduuli on selaimesta ja Three.js:stä riippumaton, jotta tallennus voidaan validoida testeissä.
import type { Loadout } from "../combat";
import type { TextKey } from "../i18n";
import { createEngineState, parseEngineState, type EngineState } from "../world/state";

export const CAMPAIGN_SCHEMA_VERSION = 5 as const;
export const INVENTORY_CAPACITY = 8;
export const SATIETY_MAX = 100;

export type PlayerGender = "male" | "female";
export type FoodId = "barley_flatbread" | "dried_fish";
export type EquipmentItemId = "sword" | "sky_iron_sword" | "spear" | "round_shield";
export type ItemId = FoodId | EquipmentItemId | "birch_bark_pack";

export interface ItemDefinition {
  id: ItemId;
  nameKey: TextKey;
  stackMax: number;
  satietyGain?: number;
  equipmentSlot?: "mainHand" | "offHand";
}

export const ITEMS: Record<ItemId, ItemDefinition> = {
  barley_flatbread: {
    id: "barley_flatbread",
    nameKey: "map.item.barleyFlatbread",
    stackMax: 6,
    satietyGain: 24,
  },
  dried_fish: {
    id: "dried_fish",
    nameKey: "map.item.driedFish",
    stackMax: 4,
    satietyGain: 38,
  },
  birch_bark_pack: {
    id: "birch_bark_pack",
    nameKey: "map.item.birchBarkPack",
    stackMax: 1,
  },
  sword: { id: "sword", nameKey: "map.item.sword", stackMax: 1, equipmentSlot: "mainHand" },
  sky_iron_sword: { id: "sky_iron_sword", nameKey: "map.item.skyIronSword", stackMax: 1, equipmentSlot: "mainHand" },
  spear: { id: "spear", nameKey: "map.item.spear", stackMax: 1, equipmentSlot: "mainHand" },
  round_shield: { id: "round_shield", nameKey: "map.item.roundShield", stackMax: 1, equipmentSlot: "offHand" },
};

export interface ItemStack {
  itemId: ItemId;
  quantity: number;
}

export interface Inventory {
  capacity: typeof INVENTORY_CAPACITY;
  stacks: ItemStack[];
}

export interface Equipment {
  mainHand: Extract<EquipmentItemId, "sword" | "sky_iron_sword" | "spear"> | null;
  offHand: Extract<EquipmentItemId, "round_shield"> | null;
}

export type TakeMode = "allowed" | "theft";

/** Koodissa määritelty, pysyvällä tunnisteella varustettu maailmanesine. */
export interface SceneItemDefinition {
  instanceId: string;
  siteId: string;
  itemId: ItemId;
  quantity: number;
  takeMode: TakeMode;
  ownerId?: string;
}

export interface SceneItemTakeModeOverride {
  instanceId: string;
  takeMode: TakeMode;
}

export interface TheftRecord {
  type: "theft";
  instanceId: string;
  siteId: string;
  itemId: ItemId;
  quantity: number;
  ownerId?: string;
  atWorldMinutes: number;
}

/**
 * Pelaajan myöhemmin pudottama esine. Pudotus-UI ei vielä käytä tätä rakennetta,
 * mutta tallennusmuoto on valmis ilman seuraavaa skeemamuutosta.
 */
export interface DroppedSceneItem {
  instanceId: string;
  siteId: string;
  itemId: ItemId;
  quantity: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  takeMode: "allowed";
}

/** Tallennetaan vain poikkeamat koodissa olevien staattisten esineiden oletuksiin. */
export interface SceneItemState {
  takenInstanceIds: string[];
  takeModeOverrides: SceneItemTakeModeOverride[];
  thefts: TheftRecord[];
  droppedItems: DroppedSceneItem[];
  nextDroppedItemId: number;
}

/** Kartalle konkretisoitu paikkainstanssi. Tallennetaan tulos eikä vain siementä (generaattori muuttuu). */
export type SiteInstanceKind = "yard" | "camp";
export const SITE_INSTANCE_KINDS: readonly SiteInstanceKind[] = ["yard", "camp"];

export interface SiteInstance {
  /** Pysyvä tunniste, myös 3D-esineiden etuliite: "yard" (vanhan tallennuksen piha), "yard-b" ja vainolaisten leiri "camp". */
  id: string;
  kind: SiteInstanceKind;
  x: number;
  y: number;
  /** Pihan parametri: onko jousineito paikalla (V6: hän antaa taivaanrautamiekan). */
  archer: boolean;
}

export const SITE_INSTANCE_ID_PATTERN = /^[a-z][a-z0-9-]{0,39}$/;

export interface CampaignWorld {
  mapId: string;
  width: number;
  height: number;
  x: number;
  y: number;
  discovered: boolean[];
  /** Pelaajan todella näkemien tai muuten tietämien 2D-kohtaamisinstanssien tunnisteet. */
  knownSiteIds: string[];
  worldMinutes: number;
  sceneItems: SceneItemState;
  /** Paikkojen sijoittelun siemen (0 = ei vielä arvottu, vanha tallennus). Satunnaisuus ei arvota uudelleen latauksessa. */
  worldSeed: number;
  /** Konkretisoidut satunnaiset paikat. Tyhjä lista = vielä sijoittamatta (täydennetään latauksessa). */
  siteInstances: SiteInstance[];
}

export function createSceneItemState(): SceneItemState {
  return {
    takenInstanceIds: [],
    takeModeOverrides: [],
    thefts: [],
    droppedItems: [],
    nextDroppedItemId: 1,
  };
}

export interface CampaignPlayer {
  gender: PlayerGender;
  /** 100 = kylläinen, 0 = nääntynyt. Kylläisyys ei itsessään tapa. */
  satiety: number;
  inventory: Inventory;
  equipment: Equipment;
}

export interface CampaignState {
  schemaVersion: typeof CAMPAIGN_SCHEMA_VERSION;
  world: CampaignWorld;
  player: CampaignPlayer;
  /** Maailmamoottorin liput ja laskurit: oma versioitu lohkonsa, luetaan sallivasti. */
  engine: EngineState;
}

export interface CampaignStart {
  mapId?: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  discovered?: readonly boolean[];
  knownSiteIds?: readonly string[];
  worldSeed?: number;
  siteInstances?: readonly SiteInstance[];
}

/** Uusi kampanja alkaa kolmella rieskalla ja nykyistä 3D-oletusta vastaavilla varusteilla. */
export function createCampaign(start: CampaignStart = {}): CampaignState {
  const width = start.width ?? 20;
  const height = start.height ?? 20;
  const x = start.x ?? Math.floor(width / 2);
  const y = start.y ?? Math.floor(height / 2);
  const discovered = start.discovered ? [...start.discovered] : Array<boolean>(width * height).fill(false);
  const knownSiteIds = start.knownSiteIds ? [...new Set(start.knownSiteIds)] : [];
  if (discovered.length !== width * height) throw new Error("Paljastetun kartan koko ei vastaa karttaa");
  if (!validKnownSiteIds(knownSiteIds)) throw new Error("Tunnettujen paikkojen lista ei ole kelvollinen");
  if (x < 0 || y < 0 || x >= width || y >= height) throw new Error("Aloituspaikka ei ole kartalla");
  return {
    schemaVersion: CAMPAIGN_SCHEMA_VERSION,
    world: {
      mapId: start.mapId ?? "prototype",
      width,
      height,
      x,
      y,
      discovered,
      knownSiteIds,
      worldMinutes: 0,
      sceneItems: createSceneItemState(),
      worldSeed: start.worldSeed ?? 0,
      siteInstances: (start.siteInstances ?? []).map((instance) => ({ ...instance })),
    },
    player: {
      gender: "male",
      satiety: SATIETY_MAX,
      inventory: {
        capacity: INVENTORY_CAPACITY,
        stacks: [
          { itemId: "barley_flatbread", quantity: 3 },
        ],
      },
      equipment: { mainHand: "sword", offHand: "round_shield" },
    },
    engine: createEngineState(),
  };
}

/**
 * Lisää määrän inventaarioon atomisesti. Vajaat pinot täytetään ensin ja tarvittaessa
 * luodaan useita saman esinelajin pinoja. null tarkoittaa, ettei koko määrä mahdu.
 */
export function tryAddItem(inventory: Inventory, itemId: ItemId, quantity: number): Inventory | null {
  const def = ITEMS[itemId];
  if (!def || !Number.isInteger(quantity) || quantity < 1) return null;
  const stacks = inventory.stacks.map((stack) => ({ ...stack }));
  let remaining = quantity;
  for (const stack of stacks) {
    if (stack.itemId !== itemId || stack.quantity >= def.stackMax) continue;
    const add = Math.min(remaining, def.stackMax - stack.quantity);
    stack.quantity += add;
    remaining -= add;
    if (remaining === 0) return { capacity: INVENTORY_CAPACITY, stacks };
  }
  while (remaining > 0 && stacks.length < inventory.capacity) {
    const add = Math.min(remaining, def.stackMax);
    stacks.push({ itemId, quantity: add });
    remaining -= add;
  }
  return remaining === 0 ? { capacity: INVENTORY_CAPACITY, stacks } : null;
}

/** Ottaa määrän pois inventaariosta atomisesti. null tarkoittaa, ettei sitä ole tarpeeksi. */
export function tryRemoveItem(inventory: Inventory, itemId: ItemId, quantity: number): Inventory | null {
  if (!Number.isInteger(quantity) || quantity < 1) return null;
  const have = inventory.stacks.reduce((sum, stack) => sum + (stack.itemId === itemId ? stack.quantity : 0), 0);
  if (have < quantity) return null;
  let remaining = quantity;
  const stacks: ItemStack[] = [];
  // Tyhjennetään viimeisin pino ensin, jotta täydet pinot säilyvät.
  for (let i = inventory.stacks.length - 1; i >= 0; i--) {
    const stack = inventory.stacks[i];
    if (stack.itemId !== itemId || remaining === 0) { stacks.unshift({ ...stack }); continue; }
    const take = Math.min(remaining, stack.quantity);
    remaining -= take;
    if (stack.quantity - take > 0) stacks.unshift({ ...stack, quantity: stack.quantity - take });
  }
  return { capacity: INVENTORY_CAPACITY, stacks };
}

export function sceneItemTakeMode(state: CampaignState, item: Pick<SceneItemDefinition, "instanceId" | "takeMode">): TakeMode {
  return state.world.sceneItems.takeModeOverrides.find((entry) => entry.instanceId === item.instanceId)?.takeMode
    ?? item.takeMode;
}

/** Dialogi tai tapahtuma voi muuttaa ottamisen luvan muuttamatta staattista kohtaustietoa. */
export function setSceneItemTakeMode(state: CampaignState, instanceId: string, takeMode: TakeMode): CampaignState {
  const previous = state.world.sceneItems.takeModeOverrides;
  const existing = previous.find((entry) => entry.instanceId === instanceId);
  if (existing?.takeMode === takeMode) return state;
  const takeModeOverrides = existing
    ? previous.map((entry) => entry.instanceId === instanceId ? { instanceId, takeMode } : { ...entry })
    : [...previous.map((entry) => ({ ...entry })), { instanceId, takeMode }];
  return withSceneItems(state, { ...state.world.sceneItems, takeModeOverrides });
}

export type TakeSceneItemResult =
  | { state: CampaignState; status: "taken"; takeMode: TakeMode; theft: TheftRecord | null }
  | { state: CampaignState; status: "already-taken" | "inventory-full" };

/**
 * Siirtää staattisen maailmanesineen inventaarioon yhtenä muuttumattomana operaationa.
 * Varkaus ei estä ottamista, vaan tallentaa myöhempien seurausten tarvitseman faktan.
 */
export function tryTakeSceneItem(state: CampaignState, item: SceneItemDefinition): TakeSceneItemResult {
  if (state.world.sceneItems.takenInstanceIds.includes(item.instanceId)) {
    return { state, status: "already-taken" };
  }
  const inventory = tryAddItem(state.player.inventory, item.itemId, item.quantity);
  if (!inventory) return { state, status: "inventory-full" };
  const takeMode = sceneItemTakeMode(state, item);
  const theft: TheftRecord | null = takeMode === "theft" ? {
    type: "theft",
    instanceId: item.instanceId,
    siteId: item.siteId,
    itemId: item.itemId,
    quantity: item.quantity,
    ...(item.ownerId ? { ownerId: item.ownerId } : {}),
    atWorldMinutes: state.world.worldMinutes,
  } : null;
  const sceneItems: SceneItemState = {
    ...state.world.sceneItems,
    takenInstanceIds: [...state.world.sceneItems.takenInstanceIds, item.instanceId],
    takeModeOverrides: state.world.sceneItems.takeModeOverrides.map((entry) => ({ ...entry })),
    thefts: theft ? [...state.world.sceneItems.thefts.map((entry) => ({ ...entry })), theft]
      : state.world.sceneItems.thefts.map((entry) => ({ ...entry })),
    droppedItems: state.world.sceneItems.droppedItems.map((entry) => ({ ...entry })),
  };
  return {
    status: "taken",
    takeMode,
    theft,
    state: {
      ...state,
      world: { ...state.world, sceneItems },
      player: { ...state.player, inventory },
    },
  };
}

function withSceneItems(state: CampaignState, sceneItems: SceneItemState): CampaignState {
  return { ...state, world: { ...state.world, sceneItems } };
}

/** Vaihtaa karttasankarin ulkoasun muuttamatta matkan muuta tilaa. */
export function setPlayerGender(state: CampaignState, gender: PlayerGender): CampaignState {
  if (state.player.gender === gender) return state;
  return { ...state, player: { ...state.player, gender } };
}

/** Syö yhden ruuan. Palauttaa uuden tilan; epäkelpo tai loppunut ruoka ei muuta tilaa. */
export function consumeFood(state: CampaignState, itemId: FoodId): { state: CampaignState; consumed: boolean } {
  const def = ITEMS[itemId];
  const i = state.player.inventory.stacks.findIndex((stack) => stack.itemId === itemId && stack.quantity > 0);
  if (state.player.satiety >= SATIETY_MAX || i < 0 || def.satietyGain === undefined) {
    return { state, consumed: false };
  }
  const stacks = state.player.inventory.stacks.map((stack, index) =>
    index === i ? { ...stack, quantity: stack.quantity - 1 } : { ...stack });
  return {
    consumed: true,
    state: {
      ...state,
      player: {
        ...state.player,
        satiety: clamp(state.player.satiety + def.satietyGain, 0, SATIETY_MAX),
        inventory: { ...state.player.inventory, stacks: stacks.filter((stack) => stack.quantity > 0) },
      },
    },
  };
}

/** Vaihtaa paperinuken kädessä olevan esineen. Varusteiden omistajuus ratkaistaan UI:ssa. */
export function setEquipped(state: CampaignState, slot: keyof Equipment, itemId: EquipmentItemId | null): CampaignState {
  if (itemId !== null && ITEMS[itemId].equipmentSlot !== slot) return state;
  return {
    ...state,
    player: {
      ...state.player,
      equipment: { ...state.player.equipment, [slot]: itemId },
    },
  } as CampaignState;
}

function isSwordMain(item: Equipment["mainHand"]): boolean {
  return item === "sword" || item === "sky_iron_sword";
}

/** Onko pääkädessä taivaanrautamiekka? */
export function isSkyIron(equipment: Equipment): boolean {
  return equipment.mainHand === "sky_iron_sword";
}

/** Voiko pelaaja valita pääkätensä esineeksi (onko hänellä se)? Perusmiekka ja keihäs ovat aina käytössä. */
export function ownsMainHand(state: CampaignState, item: NonNullable<Equipment["mainHand"]>): boolean {
  return item !== "sky_iron_sword" || state.player.inventory.stacks.some((stack) => stack.itemId === "sky_iron_sword");
}

/** Muuntaa vain nykyisen 3D-moottorin tukemat käsi-varusteyhdistelmät Loadoutiksi. */
export function combatLoadout(equipment: Equipment): Loadout | null {
  // Taivaanrautamiekka käyttää samaa miekan mallia ja otetta; ero on aseen arvoissa (`isSkyIron`).
  if (isSwordMain(equipment.mainHand) && equipment.offHand === "round_shield") return "sword_shield";
  if (isSwordMain(equipment.mainHand) && equipment.offHand === null) return "sword";
  if (equipment.mainHand === "spear" && equipment.offHand === null) return "spear";
  return null;
}

export function serializeCampaign(state: CampaignState): string {
  return JSON.stringify(state);
}

/** Lukee JSON-merkkijonon tai jo parsitun arvon. Rikkinäinen tallennus ei pääse peliin. */
export function parseCampaign(value: unknown): CampaignState | null {
  let data: unknown = value;
  if (typeof value === "string") {
    try { data = JSON.parse(value); } catch { return null; }
  }
  if (!isRecord(data) || !validLegacyWorld(data.world)) return null;
  if (data.schemaVersion === CAMPAIGN_SCHEMA_VERSION
    && validKnownSiteIds(data.world.knownSiteIds)
    && validSceneItemState(data.world.sceneItems)
    && validPlayer(data.player)) {
    return cloneCampaign(data as unknown as ParsedCampaign);
  }
  if (data.schemaVersion === 4
    && validKnownSiteIds(data.world.knownSiteIds)
    && validPlayer(data.player)) {
    return cloneCampaign({
      schemaVersion: CAMPAIGN_SCHEMA_VERSION,
      world: withEmptySceneItems(data.world as unknown as Version4CampaignWorld),
      player: data.player,
      engine: data.engine,
    });
  }
  if (data.schemaVersion === 3 && validPlayer(data.player)) {
    return cloneCampaign({
      schemaVersion: CAMPAIGN_SCHEMA_VERSION,
      world: withEmptySiteKnowledge(data.world as unknown as LegacyCampaignWorld),
      player: data.player,
    });
  }
  if (data.schemaVersion === 2 && validVersion2Player(data.player)) {
    return cloneCampaign({
      schemaVersion: CAMPAIGN_SCHEMA_VERSION,
      world: withEmptySiteKnowledge(data.world as unknown as LegacyCampaignWorld),
      player: { ...data.player, gender: "male" },
    });
  }
  if (data.schemaVersion === 1 && validLegacyPlayer(data.player)) {
    return cloneCampaign({
      schemaVersion: CAMPAIGN_SCHEMA_VERSION,
      world: withEmptySiteKnowledge(data.world as unknown as LegacyCampaignWorld),
      player: {
        gender: "male",
        satiety: SATIETY_MAX - data.player.hunger,
        inventory: data.player.inventory,
        equipment: data.player.equipment,
      },
    });
  }
  return null;
}

type SiteGenerationFields = "worldSeed" | "siteInstances";
type Version4CampaignWorld = Omit<CampaignWorld, "sceneItems" | SiteGenerationFields>;
type LegacyCampaignWorld = Omit<CampaignWorld, "knownSiteIds" | "sceneItems" | SiteGenerationFields>;
type ParsedCampaignWorld = LegacyCampaignWorld & { knownSiteIds?: unknown; sceneItems?: unknown };

function validLegacyWorld(value: unknown): value is ParsedCampaignWorld {
  if (!isRecord(value) || typeof value.mapId !== "string" || value.mapId.length < 1 || value.mapId.length > 80) return false;
  const { width, height, x, y, worldMinutes, discovered } = value;
  if (!integerBetween(width, 1, 512) || !integerBetween(height, 1, 512)) return false;
  if (!integerBetween(x, 0, width - 1) || !integerBetween(y, 0, height - 1)) return false;
  if (!Number.isInteger(worldMinutes) || (worldMinutes as number) < 0) return false;
  return Array.isArray(discovered)
    && discovered.length === width * height
    && discovered.every((cell) => typeof cell === "boolean");
}

function validKnownSiteIds(value: unknown): value is string[] {
  if (!Array.isArray(value) || value.length > 2_048) return false;
  const unique = new Set<string>();
  for (const siteId of value) {
    if (typeof siteId !== "string" || siteId.length < 1 || siteId.length > 80 || unique.has(siteId)) return false;
    unique.add(siteId);
  }
  return true;
}

function withEmptySceneItems(world: Version4CampaignWorld): CampaignWorld {
  return {
    ...world,
    discovered: [...world.discovered],
    knownSiteIds: [...world.knownSiteIds],
    sceneItems: createSceneItemState(),
    worldSeed: 0,
    siteInstances: [],
  };
}

function withEmptySiteKnowledge(world: LegacyCampaignWorld): CampaignWorld {
  return { ...world, discovered: [...world.discovered], knownSiteIds: [], sceneItems: createSceneItemState(), worldSeed: 0, siteInstances: [] };
}

function validSceneItemState(value: unknown): value is SceneItemState {
  if (!isRecord(value)
    || !Array.isArray(value.takenInstanceIds)
    || !Array.isArray(value.takeModeOverrides)
    || !Array.isArray(value.thefts)
    || !Array.isArray(value.droppedItems)
    || !integerBetween(value.nextDroppedItemId, 1, 1_000_000_000)) return false;
  if (value.takenInstanceIds.length > 4_096 || value.takeModeOverrides.length > 4_096
    || value.thefts.length > 4_096 || value.droppedItems.length > 1_024) return false;

  const takenIds = new Set<string>();
  for (const id of value.takenInstanceIds) {
    if (!validId(id, 160) || takenIds.has(id)) return false;
    takenIds.add(id);
  }

  const overrideIds = new Set<string>();
  for (const entry of value.takeModeOverrides) {
    if (!isRecord(entry) || !validId(entry.instanceId, 160) || !isTakeMode(entry.takeMode)
      || overrideIds.has(entry.instanceId)) return false;
    overrideIds.add(entry.instanceId);
  }

  const theftIds = new Set<string>();
  for (const theft of value.thefts) {
    if (!isRecord(theft) || theft.type !== "theft" || !validId(theft.instanceId, 160)
      || theftIds.has(theft.instanceId) || !validId(theft.siteId, 80) || !isItemId(theft.itemId)
      || !integerBetween(theft.quantity, 1, 999) || !integerBetween(theft.atWorldMinutes, 0, Number.MAX_SAFE_INTEGER)
      || (theft.ownerId !== undefined && !validId(theft.ownerId, 80))) return false;
    theftIds.add(theft.instanceId);
  }

  const droppedIds = new Set<string>();
  for (const dropped of value.droppedItems) {
    if (!isRecord(dropped) || !validId(dropped.instanceId, 160) || droppedIds.has(dropped.instanceId)
      || !validId(dropped.siteId, 80) || !isItemId(dropped.itemId)
      || !integerBetween(dropped.quantity, 1, 999) || dropped.takeMode !== "allowed"
      || !finiteCoordinate(dropped.x) || !finiteCoordinate(dropped.y) || !finiteCoordinate(dropped.z)
      || typeof dropped.yaw !== "number" || !Number.isFinite(dropped.yaw) || Math.abs(dropped.yaw) > Math.PI * 2) return false;
    droppedIds.add(dropped.instanceId);
  }
  return true;
}

function validPlayer(value: unknown): value is CampaignPlayer {
  if (!isRecord(value) || !isPlayerGender(value.gender)
    || typeof value.satiety !== "number" || !Number.isFinite(value.satiety)
    || value.satiety < 0 || value.satiety > SATIETY_MAX) return false;
  if (!validInventory(value.inventory) || !validEquipment(value.equipment)) return false;
  return true;
}

interface Version2CampaignPlayer {
  satiety: number;
  inventory: Inventory;
  equipment: Equipment;
}

function validVersion2Player(value: unknown): value is Version2CampaignPlayer {
  if (!isRecord(value) || typeof value.satiety !== "number" || !Number.isFinite(value.satiety)
    || value.satiety < 0 || value.satiety > SATIETY_MAX) return false;
  return validInventory(value.inventory) && validEquipment(value.equipment);
}

interface LegacyCampaignPlayer {
  hunger: number;
  inventory: Inventory;
  equipment: Equipment;
}

function validLegacyPlayer(value: unknown): value is LegacyCampaignPlayer {
  if (!isRecord(value) || typeof value.hunger !== "number" || !Number.isFinite(value.hunger)
    || value.hunger < 0 || value.hunger > SATIETY_MAX) return false;
  return validInventory(value.inventory) && validEquipment(value.equipment);
}

function validInventory(value: unknown): value is Inventory {
  if (!isRecord(value) || value.capacity !== INVENTORY_CAPACITY || !Array.isArray(value.stacks)
    || value.stacks.length > INVENTORY_CAPACITY) return false;
  for (const stack of value.stacks) {
    if (!isRecord(stack) || !isItemId(stack.itemId) || !Number.isInteger(stack.quantity)) return false;
    const quantity = stack.quantity as number;
    if (quantity < 1 || quantity > ITEMS[stack.itemId].stackMax) return false;
  }
  return true;
}

function validEquipment(value: unknown): value is Equipment {
  if (!isRecord(value)) return false;
  const main = value.mainHand;
  const off = value.offHand;
  if (!(main === null || main === "sword" || main === "sky_iron_sword" || main === "spear")
    || !(off === null || off === "round_shield")) return false;
  return combatLoadout({ mainHand: main, offHand: off }) !== null;
}

/**
 * Jäsennetty kampanja ennen sallivaa lukua: moottoriosiota ja paikkainstansseja ei ole vanhoissa
 * tallennuksissa, ja ne luetaan aina sallivasti (virheellinen osa pudotetaan, tallennus säilyy).
 */
type ParsedCampaign = Omit<CampaignState, "engine" | "world"> & {
  engine?: unknown;
  world: Omit<CampaignWorld, SiteGenerationFields> & { worldSeed?: unknown; siteInstances?: unknown };
};

/** Pudottaa virheelliset ja päällekkäiset instanssit; ei koskaan hylkää koko kampanjaa. */
export function parseSiteInstances(value: unknown, width: number, height: number): SiteInstance[] {
  if (!Array.isArray(value)) return [];
  const result: SiteInstance[] = [];
  const ids = new Set<string>();
  const cells = new Set<string>();
  for (const entry of value.slice(0, 32)) {
    if (!isRecord(entry) || !SITE_INSTANCE_KINDS.includes(entry.kind as SiteInstanceKind) || typeof entry.id !== "string"
      || !SITE_INSTANCE_ID_PATTERN.test(entry.id) || ids.has(entry.id)
      || !integerBetween(entry.x, 0, width - 1) || !integerBetween(entry.y, 0, height - 1)
      || cells.has(`${entry.x},${entry.y}`) || typeof entry.archer !== "boolean") continue;
    ids.add(entry.id);
    cells.add(`${entry.x},${entry.y}`);
    result.push({ id: entry.id, kind: entry.kind as SiteInstanceKind, x: entry.x as number, y: entry.y as number, archer: entry.archer });
  }
  return result;
}

function cloneCampaign(state: ParsedCampaign): CampaignState {
  return {
    schemaVersion: CAMPAIGN_SCHEMA_VERSION,
    world: {
      ...state.world,
      discovered: [...state.world.discovered],
      knownSiteIds: [...state.world.knownSiteIds],
      worldSeed: integerBetween(state.world.worldSeed, 0, 0xffffffff) ? state.world.worldSeed as number : 0,
      siteInstances: parseSiteInstances(state.world.siteInstances, state.world.width, state.world.height),
      sceneItems: {
        takenInstanceIds: [...state.world.sceneItems.takenInstanceIds],
        takeModeOverrides: state.world.sceneItems.takeModeOverrides.map((entry) => ({ ...entry })),
        thefts: state.world.sceneItems.thefts.map((entry) => ({ ...entry })),
        droppedItems: state.world.sceneItems.droppedItems.map((entry) => ({ ...entry })),
        nextDroppedItemId: state.world.sceneItems.nextDroppedItemId,
      },
    },
    player: {
      gender: state.player.gender,
      satiety: state.player.satiety,
      inventory: { capacity: INVENTORY_CAPACITY, stacks: state.player.inventory.stacks.map((stack) => ({ ...stack })) },
      equipment: { ...state.player.equipment },
    },
    // Moottoriosio luetaan aina sallivasti: tuntematon lippu pudotetaan, tallennus säilyy.
    engine: parseEngineState(state.engine),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isItemId(value: unknown): value is ItemId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(ITEMS, value);
}

function isPlayerGender(value: unknown): value is PlayerGender {
  return value === "male" || value === "female";
}

function isTakeMode(value: unknown): value is TakeMode {
  return value === "allowed" || value === "theft";
}

function validId(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length >= 1 && value.length <= max;
}

function finiteCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 10_000;
}

function integerBetween(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
