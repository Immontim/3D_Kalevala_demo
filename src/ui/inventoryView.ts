import femalePaperDollUrl from "../../assets/map/paper-doll-hero.png?url";
import malePaperDollUrl from "../../assets/map/paper-doll-hero-male.png?url";
import inventoryAtlasUrl from "../../assets/map/inventory-atlas.png?url";
import ukkoBlessingUrl from "../../assets/map/effect-ukko-blessing.png?url";
import { t } from "../i18n";
import {
  BASE_INVENTORY_CAPACITY,
  ITEMS,
  consumeFood,
  inventoryCapacity,
  tryEquipItem,
  tryUnequipItem,
  type CampaignState,
  type EquipmentItemId,
  type EquipmentSlot,
  type FoodId,
  type ItemId,
  type StorageItemId,
} from "../map/campaign";
import { LONG_EFFECTS, LONG_EFFECT_SLOTS, activeLongEffects, longEffectDaysLeft, type LongEffectId } from "../map/longEffects";

const EFFECT_ICONS: Record<LongEffectId, string> = { ukko_blessing: ukkoBlessingUrl };

const EQUIPMENT_SLOTS: readonly EquipmentSlot[] = [
  "head", "torso", "hands", "legs", "feet", "mainHand", "offHand",
];

const SLOT_LABELS: Record<EquipmentSlot, Parameters<typeof t>[0]> = {
  head: "map.slot.headwear",
  torso: "map.slot.shirt",
  hands: "map.slot.gloves",
  legs: "map.slot.trousers",
  feet: "map.slot.shoes",
  mainHand: "map.mainHand",
  offHand: "map.offHand",
};

export interface InventoryViewModel {
  gender: CampaignState["player"]["gender"];
  equipment: ReadonlyArray<{ slot: EquipmentSlot; itemId: EquipmentItemId | null }>;
  backpack: StorageItemId | null;
  baseStacks: ReadonlyArray<{ itemId: ItemId; quantity: number } | null>;
  extraStacks: ReadonlyArray<{ itemId: ItemId; quantity: number } | null>;
  extraCapacity: number;
  /** Kolme pitkäkestoisen efektin paikkaa; tyhjä paikka on null. */
  effects: ReadonlyArray<{ id: LongEffectId; daysLeft: number } | null>;
}

export function inventoryViewModel(state: CampaignState): InventoryViewModel {
  const inventory = state.player.inventory;
  const extraCapacity = inventoryCapacity(inventory) - BASE_INVENTORY_CAPACITY;
  // V6-migraation ylivuoto näytetään häviöttömästi, vaikka aktiivista repputilaa ei olisi.
  const extraLength = Math.max(extraCapacity, inventory.stacks.length - BASE_INVENTORY_CAPACITY);
  const stackAt = (index: number) => {
    const stack = inventory.stacks[index];
    return stack ? { ...stack } : null;
  };
  return {
    gender: state.player.gender,
    equipment: EQUIPMENT_SLOTS.map((slot) => ({ slot, itemId: state.player.equipment[slot] })),
    backpack: inventory.backpack,
    baseStacks: Array.from({ length: BASE_INVENTORY_CAPACITY }, (_, index) => stackAt(index)),
    extraStacks: Array.from({ length: extraLength }, (_, index) => stackAt(BASE_INVENTORY_CAPACITY + index)),
    extraCapacity,
    effects: Array.from({ length: LONG_EFFECT_SLOTS }, (_, index) => {
      const effect = activeLongEffects(state)[index];
      return effect ? { id: effect.id, daysLeft: longEffectDaysLeft(effect, state.world.worldMinutes) } : null;
    }),
  };
}

export interface InventoryViewOptions {
  getState(): CampaignState;
  /** Tallentaa uuden tilan. false jättää näkymän ennalleen ja näyttää virheen. */
  commit(next: CampaignState): boolean;
  editable: boolean;
  onChange?(state: CampaignState): void;
}

export interface InventoryView {
  render(): void;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function itemIcon(itemId: ItemId) {
  const icon = element("span", `inventory-item-icon item-${itemId}`);
  icon.setAttribute("aria-hidden", "true");
  return icon;
}

export function mountInventoryView(root: HTMLElement, options: InventoryViewOptions): InventoryView {
  root.classList.add("inventory-view");
  root.style.setProperty("--inventory-atlas", `url(${JSON.stringify(inventoryAtlasUrl)})`);

  const setNote = (key: Parameters<typeof t>[0]) => {
    const note = root.querySelector<HTMLElement>(".inventory-note");
    if (note) note.textContent = t(key);
  };

  const commit = (next: CampaignState) => {
    if (next === options.getState()) return;
    if (!options.commit(next)) { setNote("map.saveFailed"); return; }
    options.onChange?.(next);
    render();
  };

  const equip = (itemId: EquipmentItemId) => {
    if (!options.editable) return;
    const result = tryEquipItem(options.getState(), itemId);
    if (result.status === "inventory-full") { setNote("inventory.full"); return; }
    if (result.status === "incompatible") { setNote("map.shieldNeedsSword"); return; }
    if (result.status !== "equipped") return;
    commit(result.state);
  };

  const unequip = (slot: EquipmentSlot) => {
    if (!options.editable) return;
    const result = tryUnequipItem(options.getState(), slot);
    if (result.status === "inventory-full") { setNote("inventory.full"); return; }
    if (result.status === "incompatible") { setNote("inventory.weaponRequired"); return; }
    commit(result.state);
  };

  const eat = (itemId: FoodId) => {
    if (!options.editable) return;
    const result = consumeFood(options.getState(), itemId);
    if (result.consumed) commit(result.state);
  };

  function render() {
    const model = inventoryViewModel(options.getState());
    root.textContent = "";
    root.dataset.gender = model.gender;
    root.style.setProperty("--paper-doll", `url(${JSON.stringify(model.gender === "female" ? femalePaperDollUrl : malePaperDollUrl)})`);

    const title = element("h2", "inventory-title");
    title.textContent = t("map.paperDoll");
    const content = element("div", "inventory-content");
    const armour = element("div", "inventory-equipment");
    armour.setAttribute("aria-label", t("map.clothingSlots"));
    const portrait = element("div", "inventory-portrait");
    portrait.setAttribute("aria-hidden", "true");
    const hands = element("div", "inventory-hands");

    for (const entry of model.equipment) {
      const target = entry.slot === "mainHand" || entry.slot === "offHand" ? hands : armour;
      const slot = element("button", `inventory-equipment-slot slot-${entry.slot}`);
      slot.type = "button";
      const label = element("span", "inventory-slot-label");
      label.textContent = t(SLOT_LABELS[entry.slot]);
      if (entry.itemId) {
        const itemName = t(ITEMS[entry.itemId].nameKey);
        slot.append(label, itemIcon(entry.itemId));
        slot.title = itemName;
        slot.setAttribute("aria-label", `${t(SLOT_LABELS[entry.slot])}: ${itemName}`);
        if (options.editable) slot.addEventListener("click", () => unequip(entry.slot));
      } else {
        const empty = element("span", "inventory-empty-mark");
        empty.textContent = "◇";
        slot.append(label, empty);
        slot.setAttribute("aria-label", `${t(SLOT_LABELS[entry.slot])}: ${t("map.empty")}`);
        slot.disabled = true;
      }
      if (!options.editable) slot.disabled = true;
      target.append(slot);
    }
    content.append(armour, portrait, hands);

    const itemsTitle = element("h3");
    itemsTitle.textContent = t("map.items");
    const makeItemSlot = (stack: InventoryViewModel["baseStacks"][number], overflow = false) => {
      const slot = element("button", "inventory-grid-slot");
      slot.type = "button";
      if (overflow) slot.classList.add("inventory-overflow-slot");
      if (!stack) {
        slot.disabled = true;
        slot.setAttribute("aria-label", t("map.emptyItemSlot"));
      } else {
        const definition = ITEMS[stack.itemId];
        const itemName = t(definition.nameKey);
        slot.append(itemIcon(stack.itemId));
        const count = element("b");
        count.textContent = String(stack.quantity);
        slot.append(count);
        slot.title = itemName;
        slot.setAttribute("aria-label", t("map.itemQuantity", { item: itemName, quantity: stack.quantity }));
        if (options.editable && definition.satietyGain !== undefined) {
          slot.addEventListener("click", () => eat(stack.itemId as FoodId));
        } else if (options.editable && definition.equipmentSlot) {
          slot.addEventListener("click", () => equip(stack.itemId as EquipmentItemId));
        } else slot.disabled = true;
      }
      if (!options.editable) slot.disabled = true;
      return slot;
    };

    const storage = element("div", "inventory-storage");
    const baseItems = element("div", "inventory-base-grid");
    baseItems.setAttribute("aria-label", t("map.items"));
    for (const stack of model.baseStacks) baseItems.append(makeItemSlot(stack));

    const backpackArea = element("div", "inventory-backpack-area");
    const backpackHeading = element("div", "inventory-backpack-heading");
    backpackHeading.textContent = t("map.backpackSlot");
    const backpackSlot = element("button", "inventory-backpack-slot");
    backpackSlot.type = "button";
    backpackSlot.disabled = true;
    if (model.backpack) {
      const itemName = t(ITEMS[model.backpack].nameKey);
      backpackSlot.append(itemIcon(model.backpack));
      backpackSlot.title = itemName;
      backpackSlot.setAttribute("aria-label", `${t("map.backpackSlot")}: ${itemName}`);
    } else {
      const empty = element("span", "inventory-empty-mark");
      empty.textContent = "◇";
      backpackSlot.append(empty);
      backpackSlot.setAttribute("aria-label", t("map.emptyBackpackSlot"));
    }
    const extraItems = element("div", "inventory-extra-grid");
    extraItems.setAttribute("aria-label", t("map.backpackExtraSlots"));
    extraItems.style.setProperty("--extra-columns", String(model.extraCapacity <= 6 ? 2 : 4));
    model.extraStacks.forEach((stack, index) => {
      extraItems.append(makeItemSlot(stack, index >= model.extraCapacity));
    });
    backpackArea.append(backpackHeading, backpackSlot, extraItems);
    storage.append(baseItems, backpackArea);

    const effectsTitle = element("h3");
    effectsTitle.textContent = t("map.longEffects");
    const effects = element("div", "inventory-effects");
    effects.setAttribute("aria-label", t("map.longEffects"));
    for (const effect of model.effects) {
      const slot = element("div", "inventory-effect-slot");
      slot.setAttribute("role", "img");
      if (effect) {
        const def = LONG_EFFECTS[effect.id];
        slot.classList.add(`effect-${def.kind}`);
        const icon = element("span", "inventory-effect-icon");
        icon.style.backgroundImage = `url(${JSON.stringify(EFFECT_ICONS[effect.id])})`;
        icon.setAttribute("aria-hidden", "true");
        const name = element("span", "inventory-effect-name");
        name.textContent = t(def.nameKey);
        const days = t(effect.daysLeft === 1 ? "map.effectDaysOne" : "map.effectDaysMany", { days: effect.daysLeft });
        const left = element("span", "inventory-effect-days");
        left.textContent = String(effect.daysLeft);
        slot.append(icon, left, name);
        slot.title = `${t(def.nameKey)}: ${t(def.descKey)} · ${days}`;
        slot.setAttribute("aria-label", slot.title);
      } else {
        const empty = element("span", "inventory-empty-mark");
        empty.textContent = "◇";
        slot.append(empty);
        slot.setAttribute("aria-label", t("map.emptyEffectSlot"));
      }
      effects.append(slot);
    }

    const note = element("p", "inventory-note");
    note.setAttribute("role", "status");
    note.textContent = options.editable ? t("inventory.hint") : t("inventory.readOnly");
    root.append(title, content, itemsTitle, storage, effectsTitle, effects, note);
  }

  render();
  return { render };
}
