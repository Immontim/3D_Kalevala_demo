import { Bindings, DEFAULT_BINDINGS, SONG_SLOT_ACTIONS, actionFor, cloneBindings, mouseCode, parseBindings } from "../bindings";
import { STYLES, StrikeStyle } from "../combat";
import { CONTROLS } from "../controls";
import { setState } from "./actor";
import { cycleLock, lockTarget } from "./enemies";
import { $, isTouch } from "./dom";
import { exitFreeCam, pause, paused, pausedAt, restart, resume, toStartMenu } from "./loop";
import { freeCam } from "./freecam";
import { lookFreeCam, scaleFreeCamSpeed } from "../freecam";
import { choosing, songState } from "./song";
import { closeDialogue, dialogueOpen } from "./dialogue";
import { DEG, aim, bindUi, g, inputs, keys } from "./state";
import { canvas } from "./view";
import { hunt } from "./hunt";
import { ARCHERY } from "../hunt/archery";

// ---------- Syöte ----------

// Kolme iskunappia, yksi kullekin iskusuunnalle. Pohjassa pidetty nappi virittää raskaan iskun.

export const strikeHeld: Record<StrikeStyle, boolean> = { overhead: false, slash: false, thrust: false };
export function pressStrike(style: StrikeStyle) { inputs.strikeQueued = style; strikeHeld[style] = true; }
export function releaseStrikes() { for (const st of STYLES) strikeHeld[st] = false; }

// Näppäinsidonnat: vaihdettavissa taukoikkunassa ja tallessa selaimen muistissa.
export const BIND_STORE = "laulun-miekka.bindings.v1";
export let bindings: Bindings = (() => {
  try { return parseBindings(JSON.parse(localStorage.getItem(BIND_STORE) ?? "null")); }
  catch { return cloneBindings(DEFAULT_BINDINGS); }
})();
export function saveBindings() {
  try { localStorage.setItem(BIND_STORE, JSON.stringify(bindings)); } catch { /* muisti ei käytössä: sidonnat ovat voimassa tämän istunnon */ }
}

export function setBindings(next: Bindings) {
  bindings = next;
  saveBindings();
}

/** Näppäin tai hiiren nappi painettiin. Palauttaa true, jos se oli sidottu johonkin. */
export function pressCode(code: string): boolean {
  const a = actionFor(bindings, code);
  if (!a) return false;
  if (a === "block") { inputs.blockHeld = true; inputs.useQueued = true; }
  else if (a === "dodge") inputs.dodgeQueued = true;
  else if (a === "song") inputs.songQueued = true;
  else if (a === "lock") { aim.lockOn = !aim.lockOn; aim.target = null; }
  else if (a === "bow") inputs.bowQueued = true;
  else if (a === "slash" || a === "overhead" || a === "thrust") pressStrike(a);
  else inputs.pickQueued = SONG_SLOT_ACTIONS.indexOf(a);
  return true;
}
export function releaseCode(code: string) {
  const a = actionFor(bindings, code);
  if (a === "block") inputs.blockHeld = false;
  else if (a === "slash" || a === "overhead" || a === "thrust") strikeHeld[a] = false;
}

/** Näppäily säätövälilehden kenttään ei ole pelin ohjausta. */
export function typing(e: Event) { return e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement; }

export function clearInputs() {
  keys.clear();
  inputs.blockHeld = false;
  inputs.useQueued = false;
  // Kesken jäänyt viritys perutaan, jottei isku laukea itsestään tauon jälkeen.
  if (g.player.state === "windup" && g.player.charging) setState(g.player, "idle");
  releaseStrikes();
  inputs.strikeQueued = null;
  inputs.dodgeQueued = inputs.songQueued = inputs.beatQueued = inputs.bowQueued = false;
  inputs.pickQueued = null;
}

export function lockPointer() {
  if (isTouch) return;
  try {
    const r = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
    if (r && typeof r.catch === "function") r.catch(() => {});
  } catch {
    /* lukitus ei ole sallittu: tauko hoitaa tilanteen */
  }
}

export function initInput() {
  window.addEventListener("keydown", (e) => {
    if (bindUi.capture || e.repeat) return;
    if (typing(e) && e.code !== "Escape") return;
    if (e.code === "Escape") {
      if (freeCam.active) { exitFreeCam(); return; }
      if (dialogueOpen && !paused) { closeDialogue(); return; }
      // Esc myös jatkaa peliä: sivuun raahatun taukoikkunan Jatka-nappi voi olla ruudun ulkopuolella.
      // Viive estää sen, että hiiren lukituksen vapauttava Esc sekä pysäyttäisi että jatkaisi.
      if (!paused) pause();
      else if (performance.now() - pausedAt > 400) resume();
      return;
    }
    if (e.code === "KeyB") {
      if (!paused) pause("inventory");
      return;
    }
    keys.add(e.code);
    if (freeCam.active) { if (e.code === "Space" || e.code === "Tab") e.preventDefault(); return; } // tarkastelutila: ei pelitoimintoja
    if (pressCode(e.code)) e.preventDefault();
    if (e.code === "Space") { inputs.beatQueued = true; e.preventDefault(); }
    if (e.code === "KeyR" && g.gameOver) restart();
    if ((e.code === "Enter" || e.code === "NumpadEnter") && g.gameOver) toStartMenu();
  });
  window.addEventListener("keyup", (e) => {
    keys.delete(e.code);
    releaseCode(e.code);
  });
  canvas.addEventListener("mousedown", (e) => {
    if (bindUi.capture) return;
    if (g.running && !choosing && !dialogueOpen && !document.pointerLockElement) lockPointer();
    if (freeCam.active) return;
    if (e.button === 0) inputs.beatQueued = true;
    pressCode(mouseCode(e.button));
  });
  window.addEventListener("mouseup", (e) => releaseCode(mouseCode(e.button)));
  // Hiiren liike kääntää katsetta, kun hiiri on lukittu peliin. Lukittuna sivuttaisliike ei käännä.
  window.addEventListener("mousemove", (e) => {
    // Vapaa kamera: hiiri katsoo lukittuna tai nappi pohjassa (jos lukitus ei ole saatavilla).
    if (freeCam.active) { if (document.pointerLockElement === canvas || e.buttons) lookFreeCam(freeCam.cam, e.movementX, e.movementY); return; }
    if (!g.running || paused || choosing || dialogueOpen || songState || document.pointerLockElement !== canvas) return;
    // Jousella tähdätessä kamera on lähempänä ja kapeampi: hiiri hieman hitaammin ja laajempi pystykulma.
    const bowAim = hunt.aiming;
    const k = CONTROLS.mouseSens * DEG * (bowAim ? 0.75 : 1);
    if (!lockTarget()) aim.yaw -= e.movementX * k;
    const lo = (bowAim ? ARCHERY.aimPitchMin : CONTROLS.pitchMin) * DEG, hi = (bowAim ? ARCHERY.aimPitchMax : CONTROLS.pitchMax) * DEG;
    aim.pitch = Math.max(lo, Math.min(hi, aim.pitch + e.movementY * k));
  });
  // Hiiren lisänapit (4 ja 5) eivät saa selata sivuhistoriaa kesken pelin.
  for (const type of ["mousedown", "mouseup", "auxclick"] as const) {
    window.addEventListener(type, (e) => { if (e.button >= 3) e.preventDefault(); });
  }
  // Rulla vaihtaa lukituksen kohdetta, kun vastustajia on useita.
  window.addEventListener("wheel", (e) => {
    if (freeCam.active) { scaleFreeCamSpeed(freeCam.cam, e.deltaY); return; }
    if (!g.running || paused || choosing || !aim.lockOn || e.deltaY === 0) return;
    cycleLock(e.deltaY > 0 ? 1 : -1);
  }, { passive: true });
  window.addEventListener("contextmenu", (e) => e.preventDefault());

  // Kosketusnapit

  if (isTouch) $("touch").classList.remove("hidden");
  document.querySelectorAll<HTMLButtonElement>("#touch button").forEach((b) => {
    const act = b.dataset.act;
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (act === "attack") { pressStrike("slash"); inputs.beatQueued = true; }
      if (act === "block") inputs.blockHeld = true;
      if (act === "dodge") inputs.dodgeQueued = true;
      if (act === "song") { inputs.songQueued = true; inputs.beatQueued = true; }
    });
    const release = () => {
      if (act === "block") inputs.blockHeld = false;
      if (act === "attack") strikeHeld.slash = false;
    };
    b.addEventListener("pointerup", release);
    b.addEventListener("pointerleave", release);
  });
  $("song").addEventListener("pointerdown", () => (inputs.beatQueued = true));
  canvas.addEventListener("touchstart", () => (inputs.beatQueued = true), { passive: true });
}
