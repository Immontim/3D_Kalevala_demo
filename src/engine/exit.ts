// Polunsuusta poistuminen: kun sankari kävelee polunsuuhun, ruutu häipyy mustaksi noin sekunnissa
// PELIN JATKUESSA (vihollinen voi vielä lyödä). Kuolema häivytyksen aikana peruu poistumisen.
// Häivytys kulkee oikeassa ajassa (realDt), joten laulun hidastus ei venytä sitä.
import { mapUrl, parseAppRoute } from "../app/route";
import { t } from "../i18n";
import { createEmptySceneReturn, saveSceneReturn } from "../map/transition";
import { exitCrossed, nearestExit, sceneLayout, type SceneExit } from "../sceneLayout";
import { ARENA } from "../world";
import { showMsg } from "./hud";
import { postLeftBehind } from "./leave";
import { g } from "./state";

export const EXIT_FADE_SECONDS = 1.0;
const HINT_NEAR = 6;
const HINT_RESET = 10;

const LAYOUT = sceneLayout(ARENA);
let fade = 0;
let active: SceneExit | null = null;
let finished = false;
let hintShown = false;
let overlay: HTMLElement | null = null;

function fadeEl(): HTMLElement | null {
  if (overlay || typeof document === "undefined") return overlay;
  overlay = document.getElementById("exitFade");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "exitFade";
    document.body.appendChild(overlay);
  }
  return overlay;
}

function setOpacity(v: number) {
  const el = fadeEl();
  if (el) el.style.opacity = String(v);
}

function cancel() {
  fade = 0;
  active = null;
  setOpacity(0);
}

/** Kutsutaan joka pelin askeleella, kun peli käy eikä ole tauolla, dialogissa tai laulun valinnassa. */
export function updateExit(realDt: number, fallback: () => void) {
  if (finished) return;
  if (g.gameOver) { if (active || fade > 0) cancel(); return; }
  const p = g.player.pos;
  const hit = exitCrossed(LAYOUT, p.x, p.z);
  if (!hit) {
    if (active) cancel();
    const near = nearestExit(LAYOUT, p.x, p.z);
    if (near) {
      if (!hintShown && near.distance < HINT_NEAR) { hintShown = true; showMsg(t("exit.near"), "", 2); }
      else if (hintShown && near.distance > HINT_RESET) hintShown = false;
    }
    return;
  }
  active = hit;
  hintShown = true;
  fade = Math.min(EXIT_FADE_SECONDS, fade + realDt);
  setOpacity(fade / EXIT_FADE_SECONDS);
  if (fade < EXIT_FADE_SECONDS) return;
  finished = true;
  const route = parseAppRoute(location.href);
  if (route.mode === "scene" && route.returnToMap) {
    postLeftBehind();
    saveSceneReturn(createEmptySceneReturn(route.scene, hit.mapDir));
    location.href = mapUrl(location.href).href;
  } else {
    finished = false;
    cancel();
    fallback();
  }
}

/** Savutestejä varten. */
export function exitState() {
  return { fading: active !== null, fade: +fade.toFixed(2), exit: active?.id ?? null, finished };
}
