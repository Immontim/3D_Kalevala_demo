import atlasUrl from "../../assets/map/kalevala-map-atlas.png?url";
import { VERSION } from "../version";
import { getLanguage, setLanguage, t } from "../i18n";
import { mapUrl, sceneUrl } from "../app/route";
import { combatLoadout, consumeFood, ITEMS, setEquipped, type CampaignState, type FoodId } from "./campaign";
import { createWorldMapState, mapCell, moveOnMap, type MapDirection, type TerrainId } from "./domain";
import { PROTOTYPE_MAP } from "./prototype";
import { clearCampaign, loadCampaign, saveCampaign } from "./storage";

const TILE = 48;
const VIEW_COLS = 13;
const VIEW_ROWS = 11;
const MOON_PHASE_MINUTES = 180;

const TERRAIN_FRAME: Record<TerrainId, [number, number]> = {
  water: [0, 0],
  deepForest: [1, 0],
  forest: [2, 0],
  meadow: [3, 0],
  bog: [0, 1],
  rock: [1, 1],
};
const HERO_FRAME: Record<MapDirection, [number, number]> = {
  up: [0, 2], right: [1, 2], down: [2, 2], left: [3, 2],
};

let campaign: CampaignState;
let facing: MapDirection = "down";
let inventoryOpen = false;
let message = "";

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}

function buildUi(root: HTMLElement) {
  root.innerHTML = "";
  const header = h("header", "map-header");
  header.innerHTML = `<span class="map-ornament" aria-hidden="true">◆ ❖ ◆</span><h1>${t("map.title")}</h1><span class="map-ornament" aria-hidden="true">◆ ❖ ◆</span>`;
  const languages = h("div", "map-languages");
  for (const language of ["fi", "en"] as const) {
    const button = h("button", language === getLanguage() ? "on" : "", language.toUpperCase());
    button.type = "button";
    button.addEventListener("click", () => { if (language !== getLanguage()) { setLanguage(language); location.reload(); } });
    languages.append(button);
  }
  header.append(languages);

  const layout = h("div", "map-layout");
  const status = h("aside", "map-panel map-status");
  status.innerHTML = `<h2>${t("map.journey")}</h2><canvas id="moonCanvas" width="72" height="72" aria-label="${t("map.moon")}"></canvas><div id="mapTime"></div><div id="hungerFace" aria-live="polite"></div><div id="hungerText"></div><p class="map-help">${t("map.help")}</p>`;

  const mapFrame = h("section", "map-frame");
  const canvas = h("canvas") as HTMLCanvasElement;
  canvas.id = "mapCanvas";
  canvas.width = VIEW_COLS * TILE;
  canvas.height = VIEW_ROWS * TILE;
  canvas.setAttribute("aria-label", t("map.canvasLabel"));
  mapFrame.append(canvas);

  const pack = h("aside", "map-panel map-pack");
  pack.innerHTML = `<h2>${t("map.pack")}</h2><div id="packSummary"></div><button id="openPack" type="button">${t("map.openPack")}</button><div class="map-equipment-summary"><h3>${t("map.equipment")}</h3><div id="equipmentSummary"></div></div>`;
  layout.append(status, mapFrame, pack);

  const footer = h("footer", "map-footer");
  footer.innerHTML = `<span id="mapMessage"></span><span>${VERSION}</span>`;
  const modal = h("div", "map-modal hidden");
  modal.id = "packModal";
  modal.innerHTML = `<div class="map-modal-card"><button id="closePack" class="map-close" type="button" aria-label="${t("map.close")}">×</button><h2>${t("map.heroAndPack")}</h2><div class="paper-layout"><section class="paper-doll"><div class="hero-portrait" aria-hidden="true"></div><label>${t("map.mainHand")}<select id="mainHand"><option value="sword">${t("map.item.sword")}</option><option value="spear">${t("map.item.spear")}</option></select></label><label>${t("map.offHand")}<select id="offHand"><option value="round_shield">${t("map.item.roundShield")}</option><option value="">${t("map.empty")}</option></select></label></section><section><h3>${t("map.pack")}</h3><div id="inventorySlots" class="inventory-slots"></div></section></div><button id="newJourney" class="map-secondary" type="button">${t("map.newJourney")}</button></div>`;

  root.append(header, layout, footer, modal);
  root.querySelector("#openPack")!.addEventListener("click", () => toggleInventory(true));
  root.querySelector("#closePack")!.addEventListener("click", () => toggleInventory(false));
  root.querySelector("#newJourney")!.addEventListener("click", () => {
    if (!confirm(t("map.newJourneyConfirm"))) return;
    clearCampaign();
    campaign = loadCampaign();
    ensureRevealed();
    toggleInventory(false);
    setMessage(t("map.journeyRestarted"));
    persistAndRender();
  });
  root.querySelector<HTMLSelectElement>("#mainHand")!.addEventListener("change", (event) => {
    const value = (event.target as HTMLSelectElement).value as "sword" | "spear";
    campaign = setEquipped(campaign, "mainHand", value);
    if (value === "spear") campaign = setEquipped(campaign, "offHand", null);
    persistAndRender();
  });
  root.querySelector<HTMLSelectElement>("#offHand")!.addEventListener("change", (event) => {
    const value = (event.target as HTMLSelectElement).value as "round_shield" | "";
    if (value && campaign.player.equipment.mainHand === "spear") {
      setMessage(t("map.shieldNeedsSword"));
      renderUi();
      return;
    }
    campaign = setEquipped(campaign, "offHand", value || null);
    persistAndRender();
  });
}

function ensureRevealed() {
  const state = createWorldMapState(PROTOTYPE_MAP, campaign.world, {
    worldMinutes: campaign.world.worldMinutes,
    hunger: campaign.player.hunger,
    discovered: campaign.world.discovered,
  });
  campaign = {
    ...campaign,
    world: { ...campaign.world, discovered: [...state.discovered] },
    player: { ...campaign.player, hunger: state.hunger },
  };
}

function currentMapState() {
  return createWorldMapState(PROTOTYPE_MAP, campaign.world, {
    worldMinutes: campaign.world.worldMinutes,
    hunger: campaign.player.hunger,
    discovered: campaign.world.discovered,
  });
}

function move(direction: MapDirection) {
  facing = direction;
  const result = moveOnMap(PROTOTYPE_MAP, currentMapState(), direction);
  if (!result.moved) {
    setMessage(t("map.blocked"));
    renderMap();
    return;
  }
  campaign = {
    ...campaign,
    world: {
      ...campaign.world,
      x: result.state.x,
      y: result.state.y,
      worldMinutes: result.state.worldMinutes,
      discovered: [...result.state.discovered],
    },
    player: { ...campaign.player, hunger: result.state.hunger },
  };
  setMessage(result.siteId === "yard" ? t("map.yardFound") : t("map.travelTime", { minutes: result.minutesSpent }));
  persistAndRender();
}

function enterSite() {
  if (mapCell(PROTOTYPE_MAP, campaign.world.x, campaign.world.y)?.siteId !== "yard") return;
  saveCampaign(campaign);
  location.href = sceneUrl(location.href, "yard", true).href;
}

function toggleInventory(open = !inventoryOpen) {
  inventoryOpen = open;
  document.getElementById("packModal")!.classList.toggle("hidden", !open);
  renderUi();
}

function useFood(itemId: FoodId) {
  const result = consumeFood(campaign, itemId);
  if (!result.consumed) return;
  campaign = result.state;
  setMessage(t("map.ate", { item: t(ITEMS[itemId].nameKey) }));
  persistAndRender();
}

function persistAndRender() {
  saveCampaign(campaign);
  renderMap();
  renderUi();
}

function setMessage(next: string) {
  message = next;
  const el = document.getElementById("mapMessage");
  if (el) el.textContent = next;
}

function drawMoon() {
  const canvas = document.getElementById("moonCanvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const phase = Math.floor(campaign.world.worldMinutes / MOON_PHASE_MINUTES) % 8;
  const waxing = phase <= 4;
  const light = phase <= 4 ? phase / 4 : (8 - phase) / 4;
  ctx.clearRect(0, 0, 72, 72);
  ctx.fillStyle = "#1b2230";
  ctx.beginPath(); ctx.arc(36, 36, 29, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(36, 36, 27, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = "#d7c58c";
  ctx.fillRect(9, 9, 54, 54);
  ctx.fillStyle = "#27251f";
  const shadowWidth = 54 * (1 - light);
  ctx.fillRect(waxing ? 9 : 63 - shadowWidth, 9, shadowWidth, 54);
  ctx.restore();
  ctx.strokeStyle = "#b24725"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(36, 36, 29, 0, Math.PI * 2); ctx.stroke();
}

function renderUi() {
  const hunger = campaign.player.hunger;
  const face = hunger < 34 ? ":)" : hunger < 67 ? ":|" : ":(";
  const hungerLabel = hunger < 34 ? t("map.sated") : hunger < 67 ? t("map.peckish") : t("map.hungry");
  document.getElementById("hungerFace")!.textContent = face;
  document.getElementById("hungerFace")!.setAttribute("aria-label", hungerLabel);
  document.getElementById("hungerText")!.textContent = `${hungerLabel} · ${Math.round(hunger)} / 100`;
  const hours = Math.floor(campaign.world.worldMinutes / 60);
  const minutes = campaign.world.worldMinutes % 60;
  document.getElementById("mapTime")!.textContent = t("map.elapsed", { hours, minutes: String(minutes).padStart(2, "0") });
  drawMoon();

  const pack = document.getElementById("packSummary")!;
  pack.innerHTML = "";
  for (const stack of campaign.player.inventory.stacks) {
    const line = h("div", "pack-line");
    const icon = h("span", `atlas-icon item-${stack.itemId}`);
    line.append(icon, h("span", "", `${t(ITEMS[stack.itemId].nameKey)} × ${stack.quantity}`));
    pack.append(line);
  }
  if (!pack.childElementCount) pack.textContent = t("map.packEmpty");

  const loadout = combatLoadout(campaign.player.equipment);
  const loadoutName = loadout === "sword_shield" ? t("loadout.swordShield.name")
    : loadout === "sword" ? t("loadout.sword.name")
      : loadout === "spear" ? t("loadout.spear.name") : t("map.noWeapon");
  document.getElementById("equipmentSummary")!.textContent = loadoutName;
  const main = document.getElementById("mainHand") as HTMLSelectElement;
  const off = document.getElementById("offHand") as HTMLSelectElement;
  main.value = campaign.player.equipment.mainHand ?? "";
  off.value = campaign.player.equipment.offHand ?? "";

  const slots = document.getElementById("inventorySlots")!;
  slots.innerHTML = "";
  for (let i = 0; i < campaign.player.inventory.capacity; i++) {
    const stack = campaign.player.inventory.stacks[i];
    const slot = h("button", "inventory-slot");
    slot.type = "button";
    if (stack) {
      slot.title = t(ITEMS[stack.itemId].nameKey);
      slot.append(h("span", `atlas-icon item-${stack.itemId}`), h("b", "", String(stack.quantity)));
      if (ITEMS[stack.itemId].hungerRelief) slot.addEventListener("click", () => useFood(stack.itemId as FoodId));
    } else slot.disabled = true;
    slots.append(slot);
  }
  document.getElementById("mapMessage")!.textContent = message;
}

const atlas = new Image();
atlas.src = atlasUrl;
atlas.addEventListener("load", renderMap);

function sprite(ctx: CanvasRenderingContext2D, frame: [number, number], x: number, y: number) {
  ctx.drawImage(atlas, frame[0] * TILE, frame[1] * TILE, TILE, TILE, x, y, TILE, TILE);
}

function renderMap() {
  const canvas = document.getElementById("mapCanvas") as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#16130f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const maxX = PROTOTYPE_MAP.width - VIEW_COLS;
  const maxY = PROTOTYPE_MAP.height - VIEW_ROWS;
  const originX = Math.max(0, Math.min(maxX, campaign.world.x - Math.floor(VIEW_COLS / 2)));
  const originY = Math.max(0, Math.min(maxY, campaign.world.y - Math.floor(VIEW_ROWS / 2)));
  for (let vy = 0; vy < VIEW_ROWS; vy++) {
    for (let vx = 0; vx < VIEW_COLS; vx++) {
      const x = originX + vx, y = originY + vy;
      const cell = mapCell(PROTOTYPE_MAP, x, y)!;
      const i = y * PROTOTYPE_MAP.width + x;
      if (!campaign.world.discovered[i]) {
        ctx.fillStyle = (x + y) % 2 ? "#17140f" : "#1c1812";
        ctx.fillRect(vx * TILE, vy * TILE, TILE, TILE);
        continue;
      }
      sprite(ctx, TERRAIN_FRAME[cell.terrainId], vx * TILE, vy * TILE);
      if (cell.siteId === "yard") sprite(ctx, [2, 1], vx * TILE, vy * TILE);
    }
  }
  sprite(ctx, HERO_FRAME[facing], (campaign.world.x - originX) * TILE, (campaign.world.y - originY) * TILE);
}

function onKeyDown(event: KeyboardEvent) {
  if (event.repeat) return;
  if (inventoryOpen) {
    if (event.code === "Escape" || event.code === "KeyI") { event.preventDefault(); toggleInventory(false); }
    return;
  }
  const directions: Partial<Record<string, MapDirection>> = {
    ArrowUp: "up", KeyW: "up", ArrowRight: "right", KeyD: "right",
    ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left",
  };
  const direction = directions[event.code];
  if (direction) { event.preventDefault(); move(direction); return; }
  if (event.code === "KeyI") { event.preventDefault(); toggleInventory(true); return; }
  if (event.code === "Enter" || event.code === "Space") { event.preventDefault(); enterSite(); }
}

export function initMap() {
  document.body.classList.add("mode-map");
  document.body.classList.remove("mode-scene");
  const root = document.getElementById("mapRoot")!;
  root.style.setProperty("--map-atlas", `url(${JSON.stringify(atlasUrl)})`);
  root.classList.remove("hidden");
  campaign = loadCampaign();
  ensureRevealed();
  saveCampaign(campaign);
  buildUi(root);
  setMessage(mapCell(PROTOTYPE_MAP, campaign.world.x, campaign.world.y)?.siteId === "yard" ? t("map.yardFound") : t("map.welcome"));
  renderMap();
  renderUi();
  window.addEventListener("keydown", onKeyDown);
  (window as unknown as { __map: unknown }).__map = {
    get state() { return structuredClone(campaign); },
    move,
    enterSite,
    get route() { return mapUrl(location.href); },
  };
}
