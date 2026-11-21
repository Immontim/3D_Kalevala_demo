import atlasUrl from "../../assets/map/kalevala-map-atlas-v2.png?url";
import lakeShoreEdgeUrl from "../../assets/map/lake-shore-edge.png?url";
import riverFordOverlayUrl from "../../assets/map/river-ford-overlay.png?url";
import femaleMapHeroUrl from "../../assets/map/map-hero-female.png?url";
import cairnSiteUrl from "../../assets/map/cairn-site.png?url";
import redHandUrl from "../../assets/map/red-hand-site.png?url";
import femaleSatietyFacesUrl from "../../assets/map/satiety-faces.png?url";
import maleSatietyFacesUrl from "../../assets/map/satiety-faces-male.png?url";
import { VERSION } from "../version";
import { getLanguage, setLanguage, t } from "../i18n";
import { mapUrl, sceneKind, sceneUrl, type SceneId } from "../app/route";
import { setPlayerGender, type CampaignState, type PlayerGender } from "./campaign";
import { createWorldMapState, mapCell, moveOnMap, type MapDirection } from "./domain";
import { PROTOTYPE_MAP } from "./prototype";
import { discoverVisibleSites, mapSiteDefinition, mapSiteDisplay, sceneForMapSite, siteIdAt } from "./sites";
import { clearCampaign, loadCampaign, newCampaign, saveCampaign } from "./storage";
import { riverTile, shoreEdgeTurns, terrainFrame, waterShoreMask, type AtlasFrame } from "./tiles";
import { consumeSceneReturn } from "./transition";
import { endingSummary, isWon, shouldShowEnding } from "./ending";
import { withFlag } from "../world/state";
import { mapCalendarTime, mapCellVisibility, satietyBand } from "./uiState";
import { mountInventoryView, type InventoryView } from "../ui/inventoryView";

const TILE = 48;
const VIEW_COLS = 17;
const VIEW_ROWS = 13;
const SCENE_SHORTCUTS = ["yard", "lakeside", "lakeruin", "cairnfield", "clearing", "homestead"] as const satisfies readonly SceneId[];

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
let inventoryView: InventoryView | null = null;

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
  const inventoryRoot = h("div");
  paper.append(inventoryRoot);
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
  settings.innerHTML = `<div class="map-modal-card map-settings-card"><button id="closeSettings" class="map-close" type="button" aria-label="${t("map.close")}">×</button><h2 id="mapSettingsTitle">${t("map.settings")}</h2><p>${t("map.settingsHelp")}</p><div class="map-setting-grid"><section class="map-setting-group" aria-labelledby="mapLanguageTitle"><h3 id="mapLanguageTitle">${t("language.label")}</h3><div class="map-choice-row">${languageButtons}</div></section><section class="map-setting-group" aria-labelledby="mapGenderTitle"><h3 id="mapGenderTitle">${t("map.gender")}</h3><div class="map-choice-row">${genderButtons}</div></section></div><p id="mapSettingsError" class="map-settings-error" role="status" aria-live="polite"></p><button id="newJourney" class="map-danger" type="button">${t("map.newJourney")}</button><button id="showEnding" class="map-danger hidden" type="button">${t("ending.show")}</button><section class="scene-shortcuts"><h3>${t("map.sceneShortcuts")}</h3>${sceneButtons}</section></div>`;

  const ending = h("div", "map-modal hidden");
  ending.id = "mapEnding";
  ending.setAttribute("role", "dialog");
  ending.setAttribute("aria-modal", "true");
  ending.setAttribute("aria-labelledby", "endingTitle");
  ending.innerHTML = `<div class="map-modal-card ending-card"><div class="ending-band" aria-hidden="true"></div><div class="ending-ornament" aria-hidden="true">◆ ❖ ◆</div><h2 id="endingTitle">${t("ending.title")}</h2><p class="ending-subtitle">${t("ending.subtitle")}</p><div class="ending-ornament small" aria-hidden="true">❖</div><div class="ending-columns"><section><h3>${t("ending.statsTitle")}</h3><ul id="endingStats" class="ending-list"></ul></section><section><h3>${t("ending.sideTitle")}</h3><ul id="endingSide" class="ending-list"></ul></section></div><div class="ending-actions"><button id="endingContinue" type="button">${t("ending.continue")}</button><button id="endingNew" type="button">${t("ending.newJourney")}</button></div><div class="ending-ornament" aria-hidden="true">◆ ❖ ◆</div><div class="ending-band" aria-hidden="true"></div><p class="ending-version">${t("map.title")} · ${VERSION}</p></div>`;
  root.append(header, layout, footer, settings, ending);
  inventoryView = mountInventoryView(inventoryRoot, {
    getState: () => campaign,
    editable: true,
    commit(next) {
      if (!saveCampaign(next)) return false;
      campaign = next;
      return true;
    },
    onChange: () => { renderUi(); renderMap(); },
  });
  root.querySelector("#endingContinue")!.addEventListener("click", () => closeEnding());
  root.querySelector("#endingNew")!.addEventListener("click", () => { closeEnding(false); restartJourney(false); });
  root.querySelector("#showEnding")?.addEventListener("click", () => { toggleSettings(false); openEnding(); });
  root.querySelector("#closeSettings")!.addEventListener("click", () => toggleSettings(false));
  root.querySelector("#newJourney")!.addEventListener("click", () => restartJourney());
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
}

function ensureRevealed() {
  const state = createWorldMapState(PROTOTYPE_MAP, campaign.world, {
    worldMinutes: campaign.world.worldMinutes,
    satiety: campaign.player.satiety,
    discovered: campaign.world.discovered,
  });
  campaign = {
    ...campaign,
    world: {
      ...campaign.world,
      discovered: [...state.discovered],
      knownSiteIds: discoverVisibleSites(
        PROTOTYPE_MAP,
        campaign.world.knownSiteIds,
        state,
        campaign.world.siteInstances,
        undefined,
        campaign.engine.flags,
      ),
    },
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
      knownSiteIds: discoverVisibleSites(
        PROTOTYPE_MAP,
        campaign.world.knownSiteIds,
        result.state,
        campaign.world.siteInstances,
        undefined,
        campaign.engine.flags,
      ),
    },
    player: { ...campaign.player, satiety: result.state.satiety },
  };
  setMessage(siteMessage(siteIdAt(PROTOTYPE_MAP, campaign.world.siteInstances, result.state.x, result.state.y), ""));
  persistAndRender();
}

/** Paikan ilmoitus kartan alareunassa; kaikki pihainstanssit ovat "pihapiiri". */
function siteMessage(siteId: string | undefined, fallback: string) {
  const scene = sceneForMapSite(siteId, campaign.world.siteInstances, campaign.engine.flags);
  if (scene === "yard") return t("map.yardFound");
  if (scene === "lakeside") return t("map.lakesideFound");
  if (scene === "clearing") return t("map.campfireFound");
  if (scene === "cairnfield") return t("map.cairnfieldFound");
  return fallback;
}

function enterSite() {
  const siteId = siteIdAt(PROTOTYPE_MAP, campaign.world.siteInstances, campaign.world.x, campaign.world.y);
  const scene = sceneForMapSite(siteId, campaign.world.siteInstances, campaign.engine.flags);
  // Instanssin tunniste välitetään 3D:lle, jotta sama pihakohtaus saa instanssin omat parametrit.
  const instance = campaign.world.siteInstances.find((entry) => entry.id === siteId);
  if (scene) openScene(scene, instance?.id);
}

function openScene(scene: SceneId, site?: string) {
  if (!saveCampaign(campaign)) {
    const error = t("map.saveFailed");
    setMessage(error);
    document.getElementById("mapSettingsError")!.textContent = settingsOpen ? error : "";
    return;
  }
  location.href = sceneUrl(location.href, scene, true, site).href;
}

let endingOpen = false;

/** Loppuruutu: voitetun kampanjan tilasto kartan ilmeellä. Sulkeminen merkitsee sen nähdyksi. */
function openEnding() {
  const summary = endingSummary(campaign);
  if (!summary) return;
  const stats: string[] = [
    t(summary.days === 1 ? "ending.daysOne" : "ending.daysMany", { days: summary.days }),
  ];
  if (summary.moons > 0) stats.push(t("ending.moons", { moons: summary.moons }));
  stats.push(
    t("ending.explored", { percent: summary.explored }),
    t("ending.songs", { count: summary.songsKnown, total: summary.songsTotal }),
    t("ending.enemies", { count: summary.enemiesDefeated }),
    summary.deaths === 0 ? t("ending.noDeaths") : t("ending.deaths", { count: summary.deaths }),
    summary.thefts === 0 ? t("ending.noThefts") : t("ending.thefts", { count: summary.thefts }),
  );
  const fill = (id: string, rows: { text: string; done?: boolean }[]) => {
    const list = document.getElementById(id)!;
    list.replaceChildren(...rows.map((row) => {
      const li = h("li", row.done === undefined ? "" : row.done ? "done" : "undone", row.text);
      if (row.done !== undefined) li.prepend(h("b", "", row.done ? "✓" : "–"));
      return li;
    }));
  };
  fill("endingStats", stats.map((text) => ({ text })));
  fill("endingSide", summary.sideStories.map((story) => ({ text: t(`ending.side.${story.id}`), done: story.done })));
  const root = document.getElementById("mapRoot")!;
  root.querySelectorAll<HTMLElement>(".map-header, .map-layout, .map-footer").forEach((element) => { element.inert = true; });
  document.getElementById("mapEnding")!.classList.remove("hidden");
  endingOpen = true;
  document.getElementById("endingContinue")!.focus();
}

function closeEnding(markSeen = true) {
  const root = document.getElementById("mapRoot")!;
  document.getElementById("mapEnding")!.classList.add("hidden");
  root.querySelectorAll<HTMLElement>(".map-header, .map-layout, .map-footer").forEach((element) => { element.inert = false; });
  endingOpen = false;
  if (markSeen && campaign.engine.flags["campaign.endSeen"] !== true) {
    campaign = { ...campaign, engine: withFlag(campaign.engine, "campaign.endSeen", true) as typeof campaign.engine };
    saveCampaign(campaign);
  }
}

function toggleSettings(open = !settingsOpen) {
  const root = document.getElementById("mapRoot")!;
  const background = root.querySelectorAll<HTMLElement>(".map-header, .map-layout, .map-footer");
  settingsOpen = open;
  document.getElementById("showEnding")?.classList.toggle("hidden", !isWon(campaign));
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

function restartJourney(confirmFirst = true) {
  if (confirmFirst && !confirm(t("map.newJourneyConfirm"))) return;
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

  inventoryView?.render();
  document.getElementById("mapMessage")!.textContent = message;
}

const atlas = new Image();
atlas.src = atlasUrl;
atlas.addEventListener("load", renderMap);
const lakeShoreEdge = new Image();
lakeShoreEdge.src = lakeShoreEdgeUrl;
lakeShoreEdge.addEventListener("load", renderMap);
const riverFordOverlay = new Image();
riverFordOverlay.src = riverFordOverlayUrl;
riverFordOverlay.addEventListener("load", renderMap);
const redHand = new Image();
redHand.src = redHandUrl;
redHand.addEventListener("load", renderMap);
const cairnSite = new Image();
cairnSite.src = cairnSiteUrl;
cairnSite.addEventListener("load", renderMap);
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

function imageTile(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  quarterTurns = 0,
) {
  if (!image.complete || image.naturalWidth <= 0) return;
  ctx.save();
  ctx.translate(x + TILE / 2, y + TILE / 2);
  ctx.rotate(quarterTurns * Math.PI / 2);
  ctx.drawImage(image, -TILE / 2, -TILE / 2, TILE, TILE);
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

function drawCairnSite(ctx: CanvasRenderingContext2D, x: number, y: number) {
  if (cairnSite.complete && cairnSite.naturalWidth > 0) {
    ctx.drawImage(cairnSite, x, y, TILE, TILE);
    return;
  }
  // Varakuva: tumma kupukivi ja punainen hahmo kalpealla pohjalla.
  ctx.save();
  ctx.fillStyle = "#e8d6b0";
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = "#3c281e";
  ctx.beginPath();
  ctx.ellipse(x + 17, y + 34, 14, 9, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = "#a7331d";
  ctx.fillRect(x + 32, y + 12, 4, 22);
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
  const knownSiteIds = new Set(campaign.world.knownSiteIds);
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
        if (cell.crossingId === "ford") {
          imageTile(ctx, riverFordOverlay, vx * TILE, vy * TILE, tile.quarterTurns);
        }
      } else {
        sprite(ctx, terrainFrame(cell.terrainId, x, y), vx * TILE, vy * TILE);
        if (cell.terrainId === "water") {
          for (const turns of shoreEdgeTurns(waterShoreMask(PROTOTYPE_MAP, x, y))) {
            imageTile(ctx, lakeShoreEdge, vx * TILE, vy * TILE, turns);
          }
        }
      }
      const siteId = siteIdAt(PROTOTYPE_MAP, campaign.world.siteInstances, x, y);
      const siteDisplay = mapSiteDisplay(siteId, {
        active: true,
        known: siteId !== undefined && knownSiteIds.has(siteId),
        cellVisibility: visibility,
      }, campaign.world.siteInstances, campaign.engine.flags);
      if (siteDisplay !== "hidden") {
        const sceneId = mapSiteDefinition(siteId, campaign.world.siteInstances)?.sceneId;
        if (sceneId === "yard") sprite(ctx, [2, 1], vx * TILE, vy * TILE);
        if (sceneId === "lakeside") sprite(ctx, [3, 1], vx * TILE, vy * TILE);
        if (sceneId === "clearing") drawRedHand(ctx, vx * TILE, vy * TILE);
        if (sceneId === "cairnfield") drawCairnSite(ctx, vx * TILE, vy * TILE);
      }
      if (visibility === "remembered") {
        ctx.fillStyle = "rgba(20, 17, 13, 0.44)";
        ctx.fillRect(vx * TILE, vy * TILE, TILE, TILE);
      }
    }
  }
  drawHero(ctx, (campaign.world.x - originX) * TILE, (campaign.world.y - originY) * TILE);
}

function onKeyDown(event: KeyboardEvent) {
  if (event.repeat) return;
  if (endingOpen) {
    // Loppuruudun aikana kartta ei liiku; Esc vastaa "Jatka vaellusta".
    if (event.code === "Escape") { event.preventDefault(); closeEnding(); }
    return;
  }
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
  const siteId = siteIdAt(PROTOTYPE_MAP, campaign.world.siteInstances, campaign.world.x, campaign.world.y);
  return siteMessage(siteId, t("map.welcome"));
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
  if (shouldShowEnding(campaign)) openEnding();
  (window as unknown as { __map: unknown }).__map = {
    get state() { return structuredClone(campaign); },
    move,
    enterSite,
    sceneReturn,
    get route() { return mapUrl(location.href); },
  };
}
