// Pysyvä kampanjatila: maailmankartta, kylläisyys, inventaario ja varusteet.
// Moduuli on selaimesta ja Three.js:stä riippumaton, jotta tallennus voidaan validoida testeissä.
import type { Loadout } from "../combat";
import type { TextKey } from "../i18n";

export const CAMPAIGN_SCHEMA_VERSION = 3 as const;
export const INVENTORY_CAPACITY = 8;
export const SATIETY_MAX = 100;

export type PlayerGender = "male" | "female";
export type FoodId = "barley_flatbread" | "dried_fish";
export type EquipmentItemId = "sword" | "spear" | "round_shield";
export type ItemId = FoodId | EquipmentItemId;

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
  sword: { id: "sword", nameKey: "map.item.sword", stackMax: 1, equipmentSlot: "mainHand" },
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
  mainHand: Extract<EquipmentItemId, "sword" | "spear"> | null;
  offHand: Extract<EquipmentItemId, "round_shield"> | null;
}

export interface CampaignWorld {
  mapId: string;
  width: number;
  height: number;
  x: number;
  y: number;
  discovered: boolean[];
  worldMinutes: number;
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
}

export interface CampaignStart {
  mapId?: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  discovered?: readonly boolean[];
}

/** Uusi kampanja sisältää kaksi ruokalajia ja nykyistä 3D-oletusta vastaavat varusteet. */
export function createCampaign(start: CampaignStart = {}): CampaignState {
  const width = start.width ?? 20;
  const height = start.height ?? 20;
  const x = start.x ?? Math.floor(width / 2);
  const y = start.y ?? Math.floor(height / 2);
  const discovered = start.discovered ? [...start.discovered] : Array<boolean>(width * height).fill(false);
  if (discovered.length !== width * height) throw new Error("Paljastetun kartan koko ei vastaa karttaa");
  if (x < 0 || y < 0 || x >= width || y >= height) throw new Error("Aloituspaikka ei ole kartalla");
  return {
    schemaVersion: CAMPAIGN_SCHEMA_VERSION,
    world: { mapId: start.mapId ?? "prototype", width, height, x, y, discovered, worldMinutes: 0 },
    player: {
      gender: "male",
      satiety: SATIETY_MAX,
      inventory: {
        capacity: INVENTORY_CAPACITY,
        stacks: [
          { itemId: "barley_flatbread", quantity: 3 },
          { itemId: "dried_fish", quantity: 2 },
        ],
      },
      equipment: { mainHand: "sword", offHand: "round_shield" },
    },
  };
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

/** Muuntaa vain nykyisen 3D-moottorin tukemat käsi-varusteyhdistelmät Loadoutiksi. */
export function combatLoadout(equipment: Equipment): Loadout | null {
  if (equipment.mainHand === "sword" && equipment.offHand === "round_shield") return "sword_shield";
  if (equipment.mainHand === "sword" && equipment.offHand === null) return "sword";
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
  if (!isRecord(data) || !validWorld(data.world)) return null;
  if (data.schemaVersion === CAMPAIGN_SCHEMA_VERSION && validPlayer(data.player)) {
    return cloneCampaign(data as unknown as CampaignState);
  }
  if (data.schemaVersion === 2 && validVersion2Player(data.player)) {
    return cloneCampaign({
      schemaVersion: CAMPAIGN_SCHEMA_VERSION,
      world: data.world,
      player: { ...data.player, gender: "male" },
    });
  }
  if (data.schemaVersion === 1 && validLegacyPlayer(data.player)) {
    return cloneCampaign({
      schemaVersion: CAMPAIGN_SCHEMA_VERSION,
      world: data.world,
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

function validWorld(value: unknown): value is CampaignWorld {
  if (!isRecord(value) || typeof value.mapId !== "string" || value.mapId.length < 1 || value.mapId.length > 80) return false;
  const { width, height, x, y, worldMinutes, discovered } = value;
  if (!integerBetween(width, 1, 512) || !integerBetween(height, 1, 512)) return false;
  if (!integerBetween(x, 0, width - 1) || !integerBetween(y, 0, height - 1)) return false;
  if (!Number.isInteger(worldMinutes) || (worldMinutes as number) < 0) return false;
  return Array.isArray(discovered)
    && discovered.length === width * height
    && discovered.every((cell) => typeof cell === "boolean");
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
  const seen = new Set<ItemId>();
  for (const stack of value.stacks) {
    if (!isRecord(stack) || !isItemId(stack.itemId) || !Number.isInteger(stack.quantity)) return false;
    const quantity = stack.quantity as number;
    if (quantity < 1 || quantity > ITEMS[stack.itemId].stackMax || seen.has(stack.itemId)) return false;
    seen.add(stack.itemId);
  }
  return true;
}

function validEquipment(value: unknown): value is Equipment {
  if (!isRecord(value)) return false;
  const main = value.mainHand;
  const off = value.offHand;
  if (!(main === null || main === "sword" || main === "spear")
    || !(off === null || off === "round_shield")) return false;
  return combatLoadout({ mainHand: main, offHand: off }) !== null;
}

function cloneCampaign(state: CampaignState): CampaignState {
  return {
    schemaVersion: CAMPAIGN_SCHEMA_VERSION,
    world: { ...state.world, discovered: [...state.world.discovered] },
    player: {
      gender: state.player.gender,
      satiety: state.player.satiety,
      inventory: { capacity: INVENTORY_CAPACITY, stacks: state.player.inventory.stacks.map((stack) => ({ ...stack })) },
      equipment: { ...state.player.equipment },
    },
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

function integerBetween(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
