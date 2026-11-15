// Käynnistys: kokoaa moottorin ja sivun käyttöliittymän.
import { VERSION } from "./version";
import { $ } from "./engine/dom";
import { initView } from "./engine/view";
import { initEffects } from "./engine/effects";
import { spawnHero } from "./engine/hero";
import { initInput } from "./engine/input";
import { frame, initLoop } from "./engine/loop";
import { initPauseMenu, loadSavedTuning } from "./ui/pauseMenu";
import { skirmish } from "./engine/skirmish";
import { g } from "./engine/state";
import { initStartMenu } from "./ui/startMenu";
import { initDebug } from "./debug";
import { translateDocument } from "./i18n";

translateDocument();
$("ver").textContent = VERSION;
loadSavedTuning(); // ennen kuin yhtään hahmoa luodaan
initView();
initEffects();
spawnHero();
g.encounter = skirmish; // tämän sivun kohtaus on aaltotaistelu; se alkaa Aloita-napista
initInput();
initPauseMenu();
initLoop();
initStartMenu();
initDebug();
requestAnimationFrame(frame);
