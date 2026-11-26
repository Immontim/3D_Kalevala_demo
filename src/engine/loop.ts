// Pääsilmukka, uusi peli ja tauko.
import { SONG } from "../songLogic";
import { stepFreeCam } from "../freecam";
import { t } from "../i18n";
import { mapUrl, parseAppRoute } from "../app/route";
import { openTune, renderBinds, setMetersUnlocked, showTab, type PauseTab } from "../ui/pauseMenu";
import { ARENA, birdSongLevel, groundHeight } from "../world";
import { removeActor } from "./actor";
import { updateAi } from "./ai";
import { syncVisual } from "./animate";
import { updateCamera } from "./camera";
import { $, isTouch } from "./dom";
import { freeCam, startFreeCam, stopFreeCam } from "./freecam";
import { bog, updateRing, updateSparks } from "./effects";
import { clearEnemies } from "./enemies";
import { heroAtPeace, spawnHero, updatePlayer } from "./hero";
import { showMsg, tickMsg, updateHud } from "./hud";
import { clearInputs, lockPointer } from "./input";
import { keepApartAndInside, updateCombatant } from "./melee";
import { updateHazards } from "./hazards";
import { updateShowcase } from "./showcase";
import { choosing, closeChoice, closeSong, songState, updateChoice, updateSong } from "./song";
import { clearSongArcs, updateSongArcs } from "./songArcs";
import { aim, bindUi, fx, g, inputs, keys, sfx } from "./state";
import { camera, canvas, composer, updateSongLook, world } from "./view";
import { createEmptySceneReturn, saveSceneReturn } from "../map/transition";
import { worldRuntime } from "./store";
import { updateSceneItemFocus } from "./sceneItems";
import { closeDialogue, dialogueOpen } from "./dialogue";
import { updateExit } from "./exit";
import { postLeftBehind } from "./leave";
import { clearHuntDeath, hunt, huntDeathPending, huntDeathReturn, rebindHeroBow, updateHunt, updateHuntVisuals } from "./hunt";

export function onPlayerDeath() {
  g.gameOver = true;
  // Kaatuminen kirjataan loppuruudun tilastoon (moottorin sääntö `player.death-counted`).
  worldRuntime().post({ type: "player.died", sceneId: ARENA });
  // Metsästysapajalla kuolema palauttaa kartalle; inventaarioon jo otettu saalis säilyy (omistaja 2026-11-22).
  if (huntDeathReturn(toStartMenu)) { showMsg(t("hunt.deathTitle"), t("hunt.deathSub"), 9999); return; }
  // Väijytys: ruoat viedään ja paluu kartalle tapahtuu viiveellä (engine/ambush.ts).
  if (g.encounter.onPlayerDeath?.(toStartMenu)) return;
  showMsg(t("death.title"), isTouch ? t("death.touch") : t("death.keyboard"), 9999);
}
/** Tyhjentää kentän ja luo sankarin uudelleen aloituspaikalleen. */
function resetField() {
  clearHuntDeath();
  clearEnemies();
  for (const a of [g.player, ...g.corpses.map((c) => c.actor)]) removeActor(a);
  g.corpses.length = 0;
  for (const d of g.debris) d.dispose();
  g.debris.length = 0;
  spawnHero();
  rebindHeroBow();
  aim.yaw = 0;
  aim.pitch = 0;
  g.songPower = 0;
  if (songState) closeSong(true);
  clearSongArcs();
  if (choosing) closeChoice();
  closeDialogue(true);
  g.gameOver = false;
}

/** Uusi yritys samalla paikalla ja samoilla varusteilla. */
export function restart() {
  // Metsästysapajalla kaatunut palaa kartalle, ei aloita kohtausta alusta.
  if (huntDeathPending() || g.encounter.deathPending?.()) return;
  resetField();
  g.encounter.start();
  lockPointer();
}

/** Paluu aloitusikkunaan: taistelupaikan ja varusteet voi valita uudelleen. */
export function toStartMenu() {
  const route = parseAppRoute(location.href);
  if (route.mode === "scene" && route.returnToMap) {
    postLeftBehind();
    saveSceneReturn(createEmptySceneReturn(route.scene));
    location.href = mapUrl(location.href).href;
    return;
  }
  resetField();
  g.running = false;
  paused = false;
  $("pause").classList.add("hidden");
  setMetersUnlocked(false);
  showMsg("", "", 0.01);
  $("start").classList.remove("hidden");
  if (document.pointerLockElement) document.exitPointerLock();
}

// ---------- Pääsilmukka ----------
export let last = performance.now();
export let fpsAcc = 0, fpsFrames = 0;
export function frame(now: number) {
  const realDt = Math.min(0.05, (now - last) / 1000);
  last = now;
  simulate(realDt);
  updateSongLook(realDt);
  composer.render();
  requestAnimationFrame(frame);
}

/** Yksi pelin askel ilman piirtoa. Erillään, jotta savutesti voi ajaa peliä tasaisin askelin. */
export function simulate(realDt: number) {
  if (!paused) g.realTime += realDt; // tauko pysäyttää myös laulun riimut
  updateSongArcs(); // säekaaret hiipuvat reaaliajassa myös laulun jälkeen
  fpsAcc += realDt; fpsFrames++;
  if (fpsAcc > 0.5) { $("fps").textContent = String(Math.round(fpsFrames / fpsAcc)); fpsAcc = 0; fpsFrames = 0; }

  if (g.gameOver && isTouch && inputs.beatQueued) restart();

  // Laulu hidastaa maailman nopeasti; paluu normaaliin on pehmeämpi.
  const targetScale = songState && !songState.lesson ? SONG.slowmo : 1;
  g.timeScale += (targetScale - g.timeScale) * (1 - Math.exp(-(songState && !songState.lesson ? 16 : 6) * realDt));
  let dt = realDt * g.timeScale;
  if (fx.hitstop > 0) { fx.hitstop -= realDt; dt = 0; }

  // Laulun valinta pysäyttää maailman kokonaan; vain laulaja ottaa asentonsa.
  // Dialogi pysäyttää pelilogiikan (ei taistelua eikä pelin aikaa) mutta ei maisemaa.
  const talking = dialogueOpen && !paused;
  if (paused || choosing || talking) dt = 0;
  if (g.running && !paused && choosing) updateChoice();
  else if (g.running && talking) { /* hahmo seisoo ja kuuntelee: päivitetään vain visuaalit alla */ }
  else if (g.running && !paused) {
    g.gameTime += dt;
    updateSong();
    updatePlayer(dt);
    updateCombatant(g.player, dt);
    updateHunt(dt);
    // Kopio listasta: kesken kierroksen kaatunut vastustaja poistuu elävien listalta.
    for (const e of [...g.enemies]) {
      if (e.state === "dead") continue;
      const enemyDt = dt * (g.gameTime < e.tempoUntil ? e.tempoScale : 1);
      updateAi(e, enemyDt);
      updateCombatant(e, enemyDt);
    }
    keepApartAndInside([g.player, ...g.enemies]);
    updateHazards([g.player, ...g.enemies], dt);
    g.encounter.update(dt, realDt);
    updateExit(realDt, toStartMenu);
    for (let i = g.corpses.length - 1; i >= 0; i--) {
      if (g.gameTime > g.corpses[i].removeAt) {
        removeActor(g.corpses[i].actor);
        g.corpses.splice(i, 1);
      }
    }
  }

  // Laulaja liikkuu omassa ajassaan, vaikka maailma on hidastettu.
  syncVisual(g.player, (songState || choosing || talking) && !paused ? realDt : dt);
  for (const e of g.enemies) syncVisual(e, dt * (g.gameTime < e.tempoUntil ? e.tempoScale : 1));
  for (const c of g.corpses) syncVisual(c.actor, dt);
  updateShowcase(realDt);
  for (let i = g.debris.length - 1; i >= 0; i--) {
    if (!g.debris[i].update(dt, groundHeight)) { g.debris[i].dispose(); g.debris.splice(i, 1); }
  }

  // Suo
  bog.update(
    fx.bogDemo ? realDt : dt,
    fx.bogDemo ?? (g.player.state === "rooted" ? g.player.pos : g.enemies.find((e) => e.state === "rooted")?.pos) ?? null,
  );


  updateRing(realDt);


  world.update(g.realTime, talking ? realDt : dt, camera, g.player.pos);
  if (g.running && !paused) sfx.birds(realDt, birdSongLevel(g.player.pos.x, g.player.pos.z));
  updateSparks(dt);
  fx.shake = Math.max(0, fx.shake - realDt * 1.2);
  if (freeCam.active) stepFreeCam(freeCam.cam, (code) => keys.has(code), realDt);
  updateHuntVisuals();
  updateCamera(realDt);
  updateSceneItemFocus(g.running && !paused && !choosing && !dialogueOpen && songState === null && !freeCam.active && !g.gameOver && heroAtPeace() && !hunt.aiming);
  updateHud();


  tickMsg(realDt);

  inputs.strikeQueued = null;
  inputs.useQueued = false;
  inputs.dodgeQueued = inputs.songQueued = inputs.beatQueued = inputs.bowQueued = false;
  inputs.pickQueued = null;
}

// ---------- Hiiren lukitus ja tauko ----------
// Hiiri lukitaan pelin ajaksi, jotta kursori ei karkaa pelialueelta ja vie
// klikkauksia muualle. Jos lukitus ei ole saatavilla (esim. upotettu näkymä),
// peli pysähtyy, kun hiiri tai fokus lähtee ikkunasta.
export let paused = false;
export let pausedAt = 0;
export let pointerLockWorked = false;

export function pause(tab: PauseTab = "binds") {
  if (!g.running || paused || g.gameOver) return;
  paused = true;
  pausedAt = performance.now();
  clearInputs();
  renderBinds();
  openTune();
  showTab(tab);
  setMetersUnlocked(false);
  $("pause").classList.remove("hidden");
}

export function resume() {
  if (freeCam.active) return;
  if (performance.now() - bindUi.endedAt < 350) return; // klikkaus, jolla juuri sidottiin hiiren nappi
  bindUi.capture = null;
  paused = false;
  $("pause").classList.add("hidden");
  setMetersUnlocked(false);
  last = performance.now();
  if (!choosing && !dialogueOpen) lockPointer();
}

/** Tauon tarkastelu: valikko piiloon ja kamera vapaaksi. Peli pysyy pysäytettynä. */
export function enterFreeCam() {
  if (!paused || freeCam.active || bindUi.capture) return;
  setMetersUnlocked(false);
  startFreeCam();
  $("pause").classList.add("hidden");
  $("freecamHint").classList.remove("hidden");
  lockPointer();
}

/** Takaisin taukovalikkoon. Tauon alkuhetki päivitetään, jotta lukon vapauttava Esc ei jatka peliä. */
export function exitFreeCam() {
  if (!freeCam.active) return;
  stopFreeCam();
  keys.clear();
  $("freecamHint").classList.add("hidden");
  $("pause").classList.remove("hidden");
  pausedAt = performance.now();
  if (document.pointerLockElement) document.exitPointerLock();
}

export function autoPauseNow() { if (g.autoPause) pause(); }

export function initLoop() {
  document.addEventListener("pointerlockchange", () => {
    // Hiiren lukon vapautus (Esc) lopettaa vapaan kameran ja palaa taukovalikkoon.
    if (freeCam.active && document.pointerLockElement !== canvas) { exitFreeCam(); return; }
    if (document.pointerLockElement === canvas) pointerLockWorked = true;
    else if (g.choiceUnlock) g.choiceUnlock = false;
    else if (pointerLockWorked) autoPauseNow();
  });

  window.addEventListener("blur", () => { clearInputs(); autoPauseNow(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) autoPauseNow(); });
  document.addEventListener("mouseleave", () => { if (!pointerLockWorked && !isTouch) autoPauseNow(); });
  $("resumeBtn").addEventListener("click", resume);
  $("freeCamBtn").addEventListener("click", enterFreeCam);
  $("menuBtn").addEventListener("click", toStartMenu);
}
