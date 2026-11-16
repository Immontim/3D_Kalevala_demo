// Rauhallisten kohtausten esinekohdistus ja pysyvä otto. Maailma omistaa renderöidyt
// instanssit, kampanjadomain inventaarion ja pysyvyyden; tämä moduuli sitoo ne yhteen.
import * as THREE from "three";
import { t } from "../i18n";
import {
  ITEMS,
  sceneItemTakeMode,
  tryAddItem,
  tryTakeSceneItem,
  type CampaignState,
  type ItemId,
  type SceneItemDefinition,
} from "../map/campaign";
import { saveCampaign } from "../map/storage";
import { ITEM_TAKE_RANGE, gazeDirection, gazeOrigin, pickGazeTarget, pointOnGaze, type GazeTarget } from "../sceneInteraction";
import type { RuntimeSceneItem } from "../world";
import { $ } from "./dom";
import { showMsg } from "./hud";
import { aim, g } from "./state";
import { camera, world } from "./view";

let campaign: CampaignState | null = null;
let focusedId: string | null = null;
let lockedId: string | null = null;

export function configureSceneItemCampaign(state: CampaignState) {
  campaign = state;
  focusedId = null;
  lockedId = null;
  world.setTakenSceneItemIds(state.world.sceneItems.takenInstanceIds);
}

function itemIdOf(item: RuntimeSceneItem): ItemId | null {
  return Object.prototype.hasOwnProperty.call(ITEMS, item.itemId) ? item.itemId as ItemId : null;
}

function definitionOf(item: RuntimeSceneItem): SceneItemDefinition | null {
  const itemId = itemIdOf(item);
  if (!itemId) return null;
  return {
    instanceId: item.id,
    siteId: item.siteId,
    itemId,
    quantity: item.quantity,
    takeMode: item.takeMode,
    ...(item.ownerId ? { ownerId: item.ownerId } : {}),
  };
}

function blockedByBuilding(item: RuntimeSceneItem): boolean {
  const p = g.player.pos;
  const q = item.focusWorldPosition;
  const hit = world.collision.firstMeleeHit(p.x, p.z, q.x, q.z);
  return !!hit?.collider.id.startsWith("building:");
}

function eligibleItems(): (RuntimeSceneItem & GazeTarget)[] {
  return world.sceneItems().filter((item) => !blockedByBuilding(item)).map((item) => ({
    ...item,
    x: item.focusWorldPosition.x,
    y: item.focusWorldPosition.y,
    z: item.focusWorldPosition.z,
    radius: item.focusRadius,
  }));
}

function projectToHud(point: { x: number; y: number; z: number }) {
  const p = new THREE.Vector3(point.x, point.y, point.z).project(camera);
  if (p.z < -1 || p.z > 1 || Math.abs(p.x) > 1.1 || Math.abs(p.y) > 1.1) return null;
  return { left: ((p.x + 1) / 2) * innerWidth, top: ((1 - p.y) / 2) * innerHeight };
}

function hideFocus() {
  focusedId = null;
  const el = $("gazeFocus");
  el.classList.add("hidden");
  el.classList.remove("target", "theft", "blocked");
  $("gazePrompt").textContent = "";
}

/** Päivittää katseesta projisoidun pisteen vasta kameran päivityksen jälkeen. */
export function updateSceneItemFocus(active: boolean) {
  if (!active || !campaign || aim.override) { hideFocus(); return; }
  const hero = g.player.pos;
  const origin = gazeOrigin(hero);
  const direction = gazeDirection(aim.yaw, aim.pitch);
  const focused = pickGazeTarget(hero, aim.yaw, aim.pitch, eligibleItems());
  focusedId = focused?.id ?? null;

  // Kohteen kohdalla piste pysyy edelleen katseakselilla, mutta samalla syvyydellä kuin esine.
  let marker = pointOnGaze(origin, direction);
  if (focused) {
    const dx = focused.x - origin.x, dy = focused.y - origin.y, dz = focused.z - origin.z;
    const along = Math.max(0.4, dx * direction.x + dy * direction.y + dz * direction.z);
    marker = pointOnGaze(origin, direction, along);
  }
  const screen = projectToHud(marker);
  if (!screen) { hideFocus(); return; }

  const el = $("gazeFocus");
  el.style.left = `${screen.left}px`;
  el.style.top = `${screen.top}px`;
  el.classList.remove("hidden");
  el.classList.toggle("target", !!focused);

  if (!focused) {
    el.classList.remove("theft", "blocked");
    $("gazePrompt").textContent = "";
    return;
  }
  const item = world.sceneItem(focused.id);
  const def = item ? definitionOf(item) : null;
  if (!item || !def) { hideFocus(); return; }
  const mode = sceneItemTakeMode(campaign, def);
  const room = tryAddItem(campaign.player.inventory, def.itemId, def.quantity) !== null;
  el.classList.toggle("theft", mode === "theft" && room);
  el.classList.toggle("blocked", !room);
  const name = t(ITEMS[def.itemId].nameKey);
  $("gazePrompt").textContent = room
    ? t(mode === "theft" ? "interact.takeTheft" : "interact.take", { item: name })
    : t("interact.inventoryFull");
}

/** Tartuntaele lukitsee juuri sen esineen, jonka leijuteksti näytti painallushetkellä. */
export function lockFocusedSceneItem() {
  lockedId = focusedId;
}

/** Tartuntaeleen effectAt-hetki: tallenna ensin, poista renderöity juuri vasta onnistumisen jälkeen. */
export function takeLockedSceneItem() {
  const id = lockedId;
  lockedId = null;
  if (!id || !campaign) return;
  const item = world.sceneItem(id);
  const def = item ? definitionOf(item) : null;
  if (!item || !def || blockedByBuilding(item)) return;

  // Kamera saa liikkua eleen aikana, mutta sankari ei: lukittu kohde tarkistetaan vielä kantamasta.
  const distance = Math.hypot(item.focusWorldPosition.x - g.player.pos.x, item.focusWorldPosition.z - g.player.pos.z);
  if (distance > ITEM_TAKE_RANGE) return;
  const result = tryTakeSceneItem(campaign, def);
  if (result.status === "inventory-full") {
    showMsg(t("interact.inventoryFull"), "", 1.5);
    return;
  }
  if (result.status !== "taken") return;
  if (!saveCampaign(result.state)) {
    showMsg(t("interact.saveFailed"), "", 1.6);
    return;
  }

  campaign = result.state;
  world.removeSceneItem(id);
  focusedId = null;
  const name = t(ITEMS[def.itemId].nameKey);
  showMsg(t(result.takeMode === "theft" ? "interact.takenTheft" : "interact.taken", { item: name }), "", 1.6);
  g.events.push(`pelaaja:otti:${id}:${result.takeMode}`);
  if (g.events.length > 30) g.events.shift();
}

export function focusedSceneItemId() { return focusedId; }
