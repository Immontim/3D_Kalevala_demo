// Nykyisen Three.js-pelin käynnistys. Moduuli ladataan dynaamisesti vain 3D-reitillä.
import { LOUHI_CAIRN_ID } from "./map/sites";
import type { AppRoute } from "./app/route";
import { VERSION } from "./version";
import { $ } from "./engine/dom";
import { initView } from "./engine/view";
import { initEffects } from "./engine/effects";
import { PLAYER_LOOK, spawnHero } from "./engine/hero";
import { initInput } from "./engine/input";
import { frame, initLoop } from "./engine/loop";
import { initPauseMenu, loadSavedTuning } from "./ui/pauseMenu";
import { skirmish } from "./engine/skirmish";
import { cairnfieldVisit, lakeruinVisit, lakesideVisit, visit, wildsVisit } from "./engine/encounter";
import { ARENA, ARENA_PEACEFUL, cairnState, setSiteInstance, yardState } from "./world";
import { g } from "./engine/state";
import { initStartMenu } from "./ui/startMenu";
import { initDebug } from "./debug";
import { combatLoadout, isSkyIron } from "./map/campaign";
import { loadCampaign } from "./map/storage";
import { sceneKind } from "./app/route";
import {
  campaignSatiety,
  configureMapToSceneTransition,
  createMapToSceneTransition,
} from "./map/transition";
import { configureSceneItems, setPickableSource } from "./engine/sceneItems";
import { huntPickables, initHunt } from "./engine/hunt";
import { initCampaignStore, worldRuntime } from "./engine/store";
import { initWorldConsole } from "./engine/worldConsole";
import { initDialogue } from "./engine/dialogue";

export function initScene3d(route: Extract<AppRoute, { mode: "scene" }>) {
  document.body.classList.add("mode-scene");
  document.body.classList.toggle("from-map", route.returnToMap);
  $("ver").textContent = VERSION;
  const campaign = loadCampaign();
  const satiety = campaignSatiety(campaign.player);
  const mapTransition = route.returnToMap
    ? createMapToSceneTransition(route.scene, sceneKind(route.scene), satiety)
    : null;
  configureMapToSceneTransition(mapTransition);
  const loadout = combatLoadout(campaign.player.equipment);
  if (!loadout) throw new Error("Kampanjan varusteyhdistelmää ei voi tuoda 3D-kohtaukseen.");
  PLAYER_LOOK.loadout = loadout;
  PLAYER_LOOK.skyIron = isSkyIron(campaign.player.equipment);
  PLAYER_LOOK.female = campaign.player.gender === "female";
  PLAYER_LOOK.helmet = campaign.player.equipment.head === "iron_helmet";
  PLAYER_LOOK.ringMail = campaign.player.equipment.torso === "ring_mail";
  PLAYER_LOOK.greaves = campaign.player.equipment.legs === "iron_greaves";
  PLAYER_LOOK.shoes = campaign.player.equipment.feet === "leather_shoes";
  loadSavedTuning(); // ennen kuin yhtään hahmoa luodaan
  // Pihakohtaus saa instanssinsa parametrit (esinetunnisteet, jousineito) kampanjasta ennen rakentamista.
  if (route.scene === "yard") {
    const instance = campaign.world.siteInstances.find((entry) => entry.id === (route.site ?? "yard"));
    setSiteInstance(instance ? { id: instance.id, archer: instance.archer } : { id: "yard", archer: true });
  }
  // Louhi seisoo vain omalla kalmistollaan; suoraan avattu kalmisto (ei `site`-parametria) on hänen.
  cairnState.louhiHere = (route.site ?? LOUHI_CAIRN_ID) === LOUHI_CAIRN_ID;
  cairnState.louhiBanished = campaign.engine.flags["louhi.banished"] === true;
  yardState.archerHealed = campaign.engine.flags["archer.healed"] === true;
  yardState.archerDead = campaign.engine.flags["archer.dead"] === true;
  initView();
  initCampaignStore(campaign);
  configureSceneItems();
  initEffects();
  spawnHero();
  initHunt();
  setPickableSource(huntPickables);
  g.encounter = !ARENA_PEACEFUL ? skirmish : ARENA === "lakeside" ? lakesideVisit : ARENA === "lakeruin" ? lakeruinVisit : ARENA === "cairnfield" ? cairnfieldVisit : ARENA === "wilds" ? wildsVisit : visit;
  initInput();
  initDialogue();
  initPauseMenu();
  initLoop();
  initStartMenu({ returnToMap: route.returnToMap, scene: route.scene });
  initDebug();
  initWorldConsole();
  worldRuntime().post({ type: "scene.entered", sceneId: ARENA });
  requestAnimationFrame(frame);
}
