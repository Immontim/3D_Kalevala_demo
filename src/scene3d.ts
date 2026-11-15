// Nykyisen Three.js-pelin käynnistys. Moduuli ladataan dynaamisesti vain 3D-reitillä.
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
import { visit } from "./engine/encounter";
import { ARENA_PEACEFUL } from "./world";
import { g } from "./engine/state";
import { initStartMenu } from "./ui/startMenu";
import { initDebug } from "./debug";
import { combatLoadout } from "./map/campaign";
import { loadCampaign } from "./map/storage";

export function initScene3d(route: Extract<AppRoute, { mode: "scene" }>) {
  document.body.classList.add("mode-scene");
  document.body.classList.toggle("from-map", route.returnToMap);
  $("ver").textContent = VERSION;
  const campaign = loadCampaign();
  const loadout = combatLoadout(campaign.player.equipment);
  if (!loadout) throw new Error("Kampanjan varusteyhdistelmää ei voi tuoda 3D-kohtaukseen.");
  PLAYER_LOOK.loadout = loadout;
  loadSavedTuning(); // ennen kuin yhtään hahmoa luodaan
  initView();
  initEffects();
  spawnHero();
  g.encounter = ARENA_PEACEFUL ? visit : skirmish;
  initInput();
  initPauseMenu();
  initLoop();
  initStartMenu({ returnToMap: route.returnToMap });
  initDebug();
  requestAnimationFrame(frame);
}
