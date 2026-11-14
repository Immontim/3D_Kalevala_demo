// Käynnistys: kokoaa moottorin ja sivun käyttöliittymän.
import { VERSION } from "./version";
import { $ } from "./engine/dom";
import { initView } from "./engine/view";
import { initEffects } from "./engine/effects";
import { spawnHero } from "./engine/hero";
import { initInput } from "./engine/input";
import { frame, initLoop } from "./engine/loop";
import { initPauseMenu, loadSavedTuning } from "./ui/pauseMenu";
import { initStartMenu } from "./ui/startMenu";
import { initDebug } from "./debug";

$("ver").textContent = VERSION;
loadSavedTuning(); // ennen kuin yhtään hahmoa luodaan
initView();
initEffects();
spawnHero();
initInput();
initPauseMenu();
initLoop();
initStartMenu();
initDebug();
requestAnimationFrame(frame);
