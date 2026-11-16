import atlasUrl from "../../assets/map/kalevala-map-atlas-v2.png?url";
import femaleMapHeroUrl from "../../assets/map/map-hero-female.png?url";
import femalePaperDollUrl from "../../assets/map/paper-doll-hero.png?url";
import malePaperDollUrl from "../../assets/map/paper-doll-hero-male.png?url";
import redHandUrl from "../../assets/map/red-hand-site.png?url";
import femaleSatietyFacesUrl from "../../assets/map/satiety-faces.png?url";
import maleSatietyFacesUrl from "../../assets/map/satiety-faces-male.png?url";
import { VERSION } from "../version";
import { getLanguage, setLanguage, t } from "../i18n";
import { mapUrl, sceneKind, sceneUrl, type SceneId } from "../app/route";
import {
  combatLoadout,
  consumeFood,
  ITEMS,
  setEquipped,
  setPlayerGender,
  type CampaignState,
  type FoodId,
  type PlayerGender,
} from "./campaign";
import { createWorldMapState, mapCell, moveOnMap, type MapDirection } from "./domain";
import { PROTOTYPE_MAP } from "./prototype";
import { clearCampaign, loadCampaign, newCampaign, saveCampaign } from "./storage";
import { riverTile, terrainFrame, type AtlasFrame } from "./tiles";
import { consumeSceneReturn } from "./transition";
import { mapCalendarTime, mapCellVisibility, satietyBand, sceneForMapSite } from "./uiState";

const TILE = 48;
const VIEW_COLS = 17;
const VIEW_ROWS = 13;
const SCENE_SHORTCUTS = ["yard", "lakeside", "clearing", "homestead"] as const satisfies readonly SceneId[];

const HERO_FRAME: Record<MapDirection, [number, number]> = {
  up: [0, 2], right: [1, 2], down: [2, 2], left: [3, 2],
};
const FEMALE_HERO_FRAME: Record<MapDirection, number> = {
  up: 0, right: 1, down: 2, left: 3,
};

let campaign: CampaignState;
let facing: MapDirection = "down";
let settingsOpen = false;
let settingsReturnFocus: HTMLElement | null = null;
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

  const layout = h("div", "map-layout");
  const status = h("aside", "map-panel map-status");
  status.innerHTML = `<h2>${t("map.journey")}</h2><canvas id="moonCanvas" width="72" height="72" aria-label="${t("map.moon")}"></canvas><div id="mapTime"></div><h3>${t("map.satiety")}</h3><div id="satietyFace" class="satiety-face" role="img"><span class="satiety-eyes" aria-hidden="true"></span><span class="satiety-mouth" aria-hidden="true"></span></div><div id="satietyText" role="status" aria-live="polite"></div><p class="map-help">${t("map.help")}</p>`;

  const mapFrame = h("section", "map-frame");
  const canvas = h("canvas") as HTMLCanvasElement;
  canvas.id = "mapCanvas";
  canvas.width = VIEW_COLS * TILE;
  canvas.height = VIEW_ROWS * TILE;
  canvas.setAttribute("aria-label", t("map.canvasLabel"));
  mapFrame.append(canvas);

  const paper = h("aside", "map-panel map-paper");
  const armourSlots = [
    "map.slot.headwear", "map.slot.shirt", "map.slot.gloves", "map.slot.trousers", "map.slot.shoes",
  ] as const;
  const armourSlotHtml = armourSlots
    .map((key) => `<div class="paper-armour-slot"><i aria-hidden="true">◇</i><span>${t(key)}</span></div>`)
    .join("");
  paper.innerHTML = `<h2>${t("map.paperDoll")}</h2><div class="paper-figure"><div class="paper-armour" aria-label="${t("map.clothingSlots")}">${armourSlotHtml}</div><div class="hero-portrait" aria-hidden="true"></div><div class="paper-hands"><label class="paper-hand paper-main-hand"><span>${t("map.mainHand")}</span><select id="mainHand"><option value="sword">${t("map.item.sword")}</option><option value="spear">${t("map.item.spear")}</option></select></label><label class="paper-hand paper-off-hand"><span>${t("map.offHand")}</span><select id="offHand"><option value="round_shield">${t("map.item.roundShield")}</option><option value="">${t("map.empty")}</option></select></label></div></div><div id="equipmentSummary" class="equipment-summary"></div><h3>${t("map.items")}</h3><div id="inventorySlots" class="inventory-slots"></div><p class="paper-hint">${t("map.foodHint")}</p>`;
  layout.append(status, mapFrame, paper);

  const footer = h("footer", "map-footer");
  footer.innerHTML = `<span id="mapMessage"></span><span>${VERSION}</span>`;
  const settings = h("div", "map-modal hidden");
  settings.id = "mapSettings";
  settings.setAttribute("role", "dialog");
  settings.setAttribute("aria-modal", "true");
  settings.setAttribute("aria-labelledby", "mapSettingsTitle");
  const sceneButtons = SCENE_SHORTCUTS.map((scene) => {
    const kind = sceneKind(scene);
    return `<button type="button" data-scene="${scene}"><span>${t(`arena.${scene}.name`)}</span><b class="scene-kind ${kind}">${t(kind === "friendly" ? "map.sceneFriendly" : "map.sceneBattle")}</b></button>`;
  }).join("");
  const languageButtons = (["fi", "en"] as const).map((language) => `<button type="button" class="map-choice${language === getLanguage() ? " on" : ""}" data-language="${language}" aria-pressed="${language === getLanguage()}"><span class="language-flag flag-${language}" aria-hidden="true"></span><span>${t(`language.${language}`)}</span></button>`).join("");
  const genderButtons = (["male", "female"] as const).map((gender) => `<button type="button" class="map-choice gender-choice${gender === campaign.player.gender ? " on" : ""}" data-gender="${gender}" aria-pressed="${gender === campaign.player.gender}"><span class="gender-face gender-face-${gender}" aria-hidden="true"></span><span>${t(`map.gender.${gender}`)}</span></button>`).join("");
  settings.innerHTML = `<div class="map-modal-card map-settings-card"><button id="closeSettings" class="map-close" type="button" aria-label="${t("map.close")}">×</button><h2 id="mapSettingsTitle">${t("map.settings")}</h2><p>${t("map.settingsHelp")}</p><div class="map-setting-grid"><section class="map-setting-group" aria-labelledby="mapLanguageTitle"><h3 id="mapLanguageTitle">${t("language.label")}</h3><div class="map-choice-row">${languageButtons}</div></section><section class="map-setting-group" aria-labelledby="mapGenderTitle"><h3 id="mapGenderTitle">${t("map.gender")}</h3><div class="map-choice-row">${genderButtons}</div></section></div><p id="mapSettingsError" class="map-settings-error" role="status" aria-live="polite"></p><button id="newJourney" class="map-danger" type="button">${t("map.newJourney")}</button><section class="scene-shortcuts"><h3>${t("map.sceneShortcuts")}</h3>${sceneButtons}</section></div>`;

  root.append(header, layout, footer, settings);
  root.querySelector("#closeSettings")!.addEventListener("click", () => toggleSettings(false));
  root.querySelector("#newJourney")!.addEventListener("click", restartJourney);
  root.querySelectorAll<HTMLButtonElement>("[data-language]").forEach((button) => {
    button.addEventListener("click", () => {
      const language = button.dataset.language as "fi" | "en";
      if (language !== getLanguage()) {
        setLanguage(language);
        location.reload();
      }
    });
  });
  root.querySelectorAll<HTMLButtonElement>("[data-gender]").forEach((button) => {
    button.addEventListener("click", () => selectGender(button.dataset.gender as PlayerGender));
  });
  root.querySelectorAll<HTMLButtonElement>("[data-scene]").forEach((button) => {
    button.addEventListener("click", () => openScene(button.dataset.scene as SceneId));
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
    satiety: campaign.player.satiety,
    discovered: campaign.world.discovered,
  });
  campaign = {
    ...campaign,
    world: { ...campaign.world, discovered: [...state.discovered] },
    player: { ...campaign.player, satiety: state.satiety },
  };
}

function currentMapState() {
  return createWorldMapState(PROTOTYPE_MAP, campaign.world, {
    worldMinutes: campaign.world.worldMinutes,
    satiety: campaign.player.satiety,
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
    player: { ...campaign.player, satiety: result.state.satiety },
  };
  setMessage(result.siteId === "yard" ? t("map.yardFound")
    : result.siteId === "lakeside" ? t("map.lakesideFound")
      : result.siteId === "campfire" ? t("map.campfireFound")
        : "");
  persistAndRender();
}

function enterSite() {
  const siteId = mapCell(PROTOTYPE_MAP, campaign.world.x, campaign.world.y)?.siteId;
  const scene = sceneForMapSite(siteId);
  if (scene) openScene(scene);
}

function openScene(scene: SceneId) {
  if (!saveCampaign(campaign)) {
    const error = t("map.saveFailed");
    setMessage(error);
    document.getElementById("mapSettingsError")!.textContent = settingsOpen ? error : "";
    return;
  }
  location.href = sceneUrl(location.href, scene, true).href;
}

function toggleSettings(open = !settingsOpen) {
  const root = document.getElementById("mapRoot")!;
  const background = root.querySelectorAll<HTMLElement>(".map-header, .map-layout, .map-footer");
  settingsOpen = open;
  document.getElementById("mapSettings")!.classList.toggle("hidden", !open);
  background.forEach((element) => { element.inert = open; });
  if (open) {
    document.getElementById("mapSettingsError")!.textContent = "";
    settingsReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.getElementById("closeSettings")!.focus();
  } else {
    settingsReturnFocus?.focus();
    settingsReturnFocus = null;
  }
  renderUi();
}

function restartJourney() {
  if (!confirm(t("map.newJourneyConfirm"))) return;
  clearCampaign();
  campaign = newCampaign();
  ensureRevealed();
  const saved = saveCampaign(campaign);
  toggleSettings(false);
  setMessage(saved ? t("map.journeyRestarted") : t("map.saveFailed"));
  renderMap();
  renderUi();
}

function selectGender(gender: PlayerGender) {
  if (gender === campaign.player.gender) return;
  const previous = campaign;
  campaign = setPlayerGender(campaign, gender);
  if (!saveCampaign(campaign)) {
    campaign = previous;
    document.getElementById("mapSettingsError")!.textContent = t("map.saveFailed");
    return;
  }
  document.getElementById("mapSettingsError")!.textContent = "";
  renderMap();
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
  const phase = mapCalendarTime(campaign.world.worldMinutes).phase;
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
  const root = document.getElementById("mapRoot")!;
  const female = campaign.player.gender === "female";
  root.dataset.gender = campaign.player.gender;
  root.style.setProperty("--paper-doll", `url(${JSON.stringify(female ? femalePaperDollUrl : malePaperDollUrl)})`);
  root.style.setProperty("--satiety-faces", `url(${JSON.stringify(female ? femaleSatietyFacesUrl : maleSatietyFacesUrl)})`);
  root.querySelectorAll<HTMLButtonElement>("[data-gender]").forEach((button) => {
    const selected = button.dataset.gender === campaign.player.gender;
    button.classList.toggle("on", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  const band = satietyBand(campaign.player.satiety);
  const satietyLabel = t(`map.satiety.${band}`);
  const face = document.getElementById("satietyFace")!;
  face.className = `satiety-face satiety-${band}`;
  face.setAttribute("aria-label", satietyLabel);
  document.getElementById("satietyText")!.textContent = satietyLabel;
  const calendar = mapCalendarTime(campaign.world.worldMinutes);
  document.getElementById("mapTime")!.textContent = calendar.moon === 0
    ? t("map.day", { day: calendar.day })
    : t("map.moonDay", { moon: calendar.moon, day: calendar.day });
  drawMoon();

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
      const itemName = t(ITEMS[stack.itemId].nameKey);
      slot.title = itemName;
      slot.setAttribute("aria-label", t("map.itemQuantity", { item: itemName, quantity: stack.quantity }));
      slot.append(h("span", `atlas-icon item-${stack.itemId}`), h("b", "", String(stack.quantity)));
      if (ITEMS[stack.itemId].satietyGain) slot.addEventListener("click", () => useFood(stack.itemId as FoodId));
    } else {
      slot.disabled = true;
      slot.setAttribute("aria-label", t("map.emptyItemSlot"));
    }
    slots.append(slot);
  }
  document.getElementById("mapMessage")!.textContent = message;
}

const atlas = new Image();
atlas.src = atlasUrl;
atlas.addEventListener("load", renderMap);
const redHand = new Image();
redHand.src = redHandUrl;
redHand.addEventListener("load", renderMap);
const femaleMapHero = new Image();
femaleMapHero.src = femaleMapHeroUrl;
femaleMapHero.addEventListener("load", renderMap);

function sprite(
  ctx: CanvasRenderingContext2D,
  frame: AtlasFrame,
  x: number,
  y: number,
  quarterTurns = 0,
) {
  if (quarterTurns === 0) {
    ctx.drawImage(atlas, frame[0] * TILE, frame[1] * TILE, TILE, TILE, x, y, TILE, TILE);
    return;
  }
  ctx.save();
  ctx.translate(x + TILE / 2, y + TILE / 2);
  ctx.rotate(quarterTurns * Math.PI / 2);
  ctx.drawImage(atlas, frame[0] * TILE, frame[1] * TILE, TILE, TILE, -TILE / 2, -TILE / 2, TILE, TILE);
  ctx.restore();
}

function drawHero(ctx: CanvasRenderingContext2D, x: number, y: number) {
  if (campaign.player.gender === "female" && femaleMapHero.complete && femaleMapHero.naturalWidth > 0) {
    ctx.drawImage(femaleMapHero, FEMALE_HERO_FRAME[facing] * TILE, 0, TILE, TILE, x, y, TILE, TILE);
    return;
  }
  sprite(ctx, HERO_FRAME[facing], x, y);
}

function drawRedHand(ctx: CanvasRenderingContext2D, x: number, y: number) {
  if (redHand.complete && redHand.naturalWidth > 0) {
    ctx.drawImage(redHand, x, y, TILE, TILE);
    return;
  }
  ctx.save();
  ctx.fillStyle = "#ead9b6";
  ctx.strokeStyle = "#492b20";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x + 5, y + 5, 38, 38, 5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#a7331d";
  ctx.fillRect(x + 18, y + 22, 15, 13);
  ctx.fillRect(x + 17, y + 11, 3, 14);
  ctx.fillRect(x + 22, y + 8, 3, 16);
  ctx.fillRect(x + 27, y + 9, 3, 15);
  ctx.fillRect(x + 32, y + 13, 3, 14);
  ctx.beginPath();
  ctx.moveTo(x + 19, y + 25);
  ctx.lineTo(x + 11, y + 20);
  ctx.lineTo(x + 9, y + 24);
  ctx.lineTo(x + 19, y + 32);
  ctx.fill();
  ctx.restore();
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
      const visibility = mapCellVisibility(
        campaign.world.discovered[i],
        campaign.world,
        { x, y },
      );
      if (visibility === "unknown") {
        ctx.fillStyle = (x + y) % 2 ? "#17140f" : "#1c1812";
        ctx.fillRect(vx * TILE, vy * TILE, TILE, TILE);
        continue;
      }
      if (cell.terrainId === "river") {
        const tile = riverTile(PROTOTYPE_MAP, x, y);
        sprite(ctx, tile.frame, vx * TILE, vy * TILE, tile.quarterTurns);
      } else {
        sprite(ctx, terrainFrame(cell.terrainId, x, y), vx * TILE, vy * TILE);
      }
      if (visibility === "visible") {
        if (cell.siteId === "yard") sprite(ctx, [2, 1], vx * TILE, vy * TILE);
        if (cell.siteId === "lakeside") sprite(ctx, [3, 1], vx * TILE, vy * TILE);
        if (cell.siteId === "campfire") drawRedHand(ctx, vx * TILE, vy * TILE);
      } else {
        ctx.fillStyle = "rgba(20, 17, 13, 0.44)";
        ctx.fillRect(vx * TILE, vy * TILE, TILE, TILE);
      }
    }
  }
  drawHero(ctx, (campaign.world.x - originX) * TILE, (campaign.world.y - originY) * TILE);
}

function onKeyDown(event: KeyboardEvent) {
  if (event.repeat) return;
  if (settingsOpen) {
    if (event.code === "Escape") { event.preventDefault(); toggleSettings(false); }
    return;
  }
  if (event.code === "Escape") { event.preventDefault(); toggleSettings(true); return; }
  if (event.target instanceof Element
    && event.target.closest("button, select, input, textarea, a, [contenteditable='true']")) return;
  const directions: Partial<Record<string, MapDirection>> = {
    ArrowUp: "up", KeyW: "up", ArrowRight: "right", KeyD: "right",
    ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left",
  };
  const direction = directions[event.code];
  if (direction) { event.preventDefault(); move(direction); return; }
  if (event.code === "Enter" || event.code === "Space") { event.preventDefault(); enterSite(); }
}

function currentSiteMessage() {
  const siteId = mapCell(PROTOTYPE_MAP, campaign.world.x, campaign.world.y)?.siteId;
  if (siteId === "yard") return t("map.yardFound");
  if (siteId === "lakeside") return t("map.lakesideFound");
  if (siteId === "campfire") return t("map.campfireFound");
  return t("map.welcome");
}

export function initMap() {
  document.body.classList.add("mode-map");
  document.body.classList.remove("mode-scene");
  const root = document.getElementById("mapRoot")!;
  root.style.setProperty("--map-atlas", `url(${JSON.stringify(atlasUrl)})`);
  root.style.setProperty("--satiety-faces-male", `url(${JSON.stringify(maleSatietyFacesUrl)})`);
  root.style.setProperty("--satiety-faces-female", `url(${JSON.stringify(femaleSatietyFacesUrl)})`);
  root.classList.add("has-satiety-art");
  root.classList.remove("hidden");
  // 3D-puoli kirjoittaa toistaiseksi tyhjän paluukuorman. Kulutuskohta on
  // valmiina myöhemmille ruoka- ja esinepalkinnoille ilman reittirefaktorointia.
  const sceneReturn = consumeSceneReturn();
  campaign = loadCampaign();
  ensureRevealed();
  saveCampaign(campaign);
  buildUi(root);
  setMessage(currentSiteMessage());
  renderMap();
  renderUi();
  window.addEventListener("keydown", onKeyDown);
  (window as unknown as { __map: unknown }).__map = {
    get state() { return structuredClone(campaign); },
    move,
    enterSite,
    sceneReturn,
    get route() { return mapUrl(location.href); },
  };
}
