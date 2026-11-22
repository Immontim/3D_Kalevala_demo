// Taukoikkuna: näppäinten vaihto, säätövälilehti ja siirrettävät mittarit.
import { ACTIONS, Bindings, DEFAULT_BINDINGS, RESERVED, SLOTS, assign, clearSlot, cloneBindings, codeLabel, mouseCode } from "../bindings";
import { $ } from "../engine/dom";
import { bindings, setBindings } from "../engine/input";
import { t } from "../i18n";
import { paused, restart, resume } from "../engine/loop";
import { bindUi } from "../engine/state";
import { DEFAULTS, FIELDS, applyChanges, changedValues, exportTuning, parseTuningText } from "../tuning";
import { VERSION } from "../version";
import { mountInventoryView, type InventoryView } from "./inventoryView";
import { campaignStore } from "../engine/store";
import { combatLoadout, isSkyIron } from "../map/campaign";
import { PLAYER_LOOK, refreshHeroLook } from "../engine/hero";
import { ARENA_PEACEFUL, sceneLoadout } from "../world";

// Säätövälilehdellä tehdyt muutokset ovat tallessa selaimen muistissa ja otetaan käyttöön
// ennen kuin yhtään hahmoa luodaan.
export const TUNE_STORE = "laulun-miekka.tuning.v1";
export function loadSavedTuning() {
  try {
    const saved = parseTuningText(localStorage.getItem(TUNE_STORE) ?? "");
    if (!("error" in saved)) applyChanges(saved.values);
  } catch { /* muisti ei käytössä: pelataan oletusarvoilla */ }
}

// ---------- Asetusikkuna: näppäinten vaihto ----------

export function renderBinds(note = "") {
  const rootEl = $("binds");
  rootEl.textContent = "";
  for (const { id, label } of ACTIONS) {
    const row = document.createElement("div");
    row.className = "bindrow";
    const name = document.createElement("span");
    name.textContent = label;
    row.appendChild(name);
    for (let slot = 0; slot < SLOTS; slot++) {
      const b = document.createElement("button");
      const listening = bindUi.capture?.action === id && bindUi.capture.slot === slot;
      b.className = "bind" + (listening ? " listening" : "") + (bindings[id][slot] ? "" : " empty");
      b.textContent = listening ? t("bindings.press") : codeLabel(bindings[id][slot]);
      b.addEventListener("click", () => {
        // Sama klikkaus, jolla hiiren nappi juuri sidottiin, ei avaa kuuntelua uudelleen.
        if (performance.now() - bindUi.endedAt < 350) return;
        bindUi.capture = { action: id, slot };
        renderBinds();
      });
      row.appendChild(b);
    }
    rootEl.appendChild(row);
  }
  $("bindNote").textContent = note || (bindUi.capture ? t("bindings.capture") : t("bindings.choose"));
}
export function endCapture(next: Bindings | null, note = "") {
  if (next) setBindings(next);
  bindUi.capture = null;
  bindUi.endedAt = performance.now();
  renderBinds(note);
}

// ---------- Säätövälilehti ----------
// Luonnos on polku → arvo ja sisältää vain oletuksista poikkeavat arvot. Kentät ja tekstialue
// näyttävät saman luonnoksen. Mikään ei muutu pelissä ennen kuin luonnos otetaan käyttöön;
// silloin se tallennetaan selaimen muistiin ja peli alkaa alusta.
export let tuneDraft = new Map<string, number>();
export const tuneInputs = new Map<string, HTMLInputElement>();
export const tuneText = $("tuneJson") as HTMLTextAreaElement;
export const fmtValue = (v: number) => String(+v.toFixed(4));

export function buildTuneFields() {
  const rootEl = $("tuneFields");
  let group = "";
  for (const f of FIELDS) {
    if (f.group !== group) {
      group = f.group;
      const h = document.createElement("h3");
      h.textContent = group;
      rootEl.appendChild(h);
    }
    const def = DEFAULTS.get(f.path)!;
    const row = document.createElement("label");
    row.className = "tunerow";
    const name = document.createElement("span");
    name.textContent = f.label;
    const input = document.createElement("input");
    input.type = "number";
    input.min = String(f.min);
    input.max = String(f.max);
    input.step = String(f.step);
    row.title = t("tune.defaultTitle", { default: fmtValue(def), min: f.min, max: f.max, path: f.path });
    const read = (final: boolean) => {
      const raw = input.valueAsNumber;
      if (!Number.isFinite(raw)) { if (final) refreshTune(); return; } // kenttä on kesken tai tyhjä
      const v = final ? Math.max(f.min, Math.min(f.max, raw)) : raw;
      if (Math.abs(v - def) < 1e-9) tuneDraft.delete(f.path);
      else tuneDraft.set(f.path, v);
      refreshTune(final ? undefined : input);
    };
    input.addEventListener("input", () => read(false));
    input.addEventListener("change", () => read(true)); // kentästä poistuttaessa arvo rajataan sallittuun väliin
    row.append(name, input);
    rootEl.appendChild(row);
    tuneInputs.set(f.path, input);
  }
}

export function sameDraft(a: ReadonlyMap<string, number>, b: ReadonlyMap<string, number>) {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) if (Math.abs((b.get(k) ?? NaN) - v) > 1e-9) return false;
  return true;
}

/** Päivittää kentät, tekstin ja tilarivin luonnoksesta. skip = kenttä, johon käyttäjä juuri kirjoittaa. */
export function refreshTune(skip?: HTMLInputElement | HTMLTextAreaElement, note = "") {
  for (const [path, input] of tuneInputs) {
    if (input !== skip) input.value = fmtValue(tuneDraft.get(path) ?? DEFAULTS.get(path)!);
    input.classList.toggle("changed", tuneDraft.has(path));
  }
  if (skip !== tuneText) tuneText.value = exportTuning(VERSION, tuneDraft);
  const pending = !sameDraft(tuneDraft, changedValues());
  $("tuneApply").classList.toggle("pending", pending);
  const count = tuneDraft.size === 0 ? t("tune.allDefault") : t("tune.changedCount", { count: tuneDraft.size });
  $("tuneNote").textContent = note || `${count} ${pending ? t("tune.pending") : t("tune.active")}`;
}

/** Kulmaan merkki, kun pelataan muilla kuin oletusarvoilla. */
export function showTunedBadge() {
  const n = changedValues().size;
  $("tuned").textContent = n > 0 ? t("tune.badge", { count: n }) : "";
}

export function openTune() {
  tuneDraft = new Map(changedValues());
  refreshTune();
}

export type PauseTab = "binds" | "tune" | "inventory";

export function showTab(tab: PauseTab) {
  for (const name of ["Binds", "Tune", "Inventory"] as const) {
    const active = name.toLowerCase() === tab;
    $(`pane${name}`).classList.toggle("hidden", !active);
    $(`tab${name}`).classList.toggle("on", active);
  }
  $("pause").classList.toggle("showing-inventory", tab === "inventory");
}

// Mittarit (oma ja vastustajan) voi tauon aikana raahata haluamaansa kohtaan. Paikka on siirtymä
// oletuspaikasta pikseleinä ja tallentuu selaimen muistiin.
export const METER_STORE = "laulun-miekka.meters.v1";
export const meterOff: Record<string, { x: number; y: number }> = { meterPlayer: { x: 0, y: 0 }, meterEnemy: { x: 0, y: 0 } };
let metersUnlocked = false;

/** Mittarit ovat tauolla oletuksena lukossa ja dialogin alla. */
export function setMetersUnlocked(unlocked: boolean) {
  metersUnlocked = unlocked;
  $("hud").classList.toggle("arrange", unlocked);
  const toggle = $("toggleMeters");
  toggle.textContent = t(unlocked ? "pause.lockMeters" : "pause.unlockMeters");
  toggle.setAttribute("aria-pressed", String(unlocked));
}

export function placeMeters(save = false) {
  for (const id of Object.keys(meterOff)) {
    const el = $(id), o = meterOff[id];
    // Mittari pysyy kokonaan ruudulla, vaikka ikkunan koko muuttuisi.
    el.style.transform = "";
    const r = el.getBoundingClientRect();
    o.x = Math.max(-r.left, Math.min(window.innerWidth - r.right, o.x));
    o.y = Math.max(-r.top, Math.min(window.innerHeight - r.bottom, o.y));
    el.style.transform = o.x || o.y ? `translate(${o.x}px, ${o.y}px)` : "";
  }
  if (save) { try { localStorage.setItem(METER_STORE, JSON.stringify(meterOff)); } catch { /* muisti ei käytössä */ } }
}

export function initPauseMenu() {
  // Kuuntelu sieppaa seuraavan painalluksen ennen pelin omia käsittelijöitä.
  window.addEventListener("keydown", (e) => {
    if (!bindUi.capture) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.code === "Escape") endCapture(null);
    else if (e.code === "Delete" || e.code === "Backspace") endCapture(clearSlot(bindings, bindUi.capture.action, bindUi.capture.slot));
    else if (RESERVED.includes(e.code)) endCapture(null, t("bindings.reserved", { key: codeLabel(e.code) }));
    else endCapture(assign(bindings, bindUi.capture.action, bindUi.capture.slot, e.code));
  }, true);
  window.addEventListener("mousedown", (e) => {
    if (!bindUi.capture) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    endCapture(assign(bindings, bindUi.capture.action, bindUi.capture.slot, mouseCode(e.button)));
  }, true);
  $("resetBinds").addEventListener("click", () => {
    if (performance.now() - bindUi.endedAt < 350) return;
    endCapture(cloneBindings(DEFAULT_BINDINGS), t("bindings.restored"));
  });
  renderBinds();

  $("tabBinds").addEventListener("click", () => showTab("binds"));
  $("tabTune").addEventListener("click", () => showTab("tune"));
  $("tabInventory").addEventListener("click", () => showTab("inventory"));

  let inventoryView: InventoryView;
  inventoryView = mountInventoryView($("pauseInventory"), {
    getState: () => campaignStore().get(),
    editable: ARENA_PEACEFUL,
    commit(next) {
      return campaignStore().update(() => next).ok;
    },
    onChange(state) {
      const loadout = combatLoadout(state.player.equipment);
      if (!loadout) return;
      PLAYER_LOOK.loadout = sceneLoadout(loadout);
      PLAYER_LOOK.skyIron = isSkyIron(state.player.equipment);
      PLAYER_LOOK.female = state.player.gender === "female";
      PLAYER_LOOK.helmet = state.player.equipment.head === "iron_helmet";
      PLAYER_LOOK.ringMail = state.player.equipment.torso === "ring_mail";
      PLAYER_LOOK.greaves = state.player.equipment.legs === "iron_greaves";
      PLAYER_LOOK.shoes = state.player.equipment.feet === "leather_shoes";
      refreshHeroLook();
    },
  });
  campaignStore().subscribe(() => inventoryView.render());

  tuneText.addEventListener("input", () => {
    const parsed = parseTuningText(tuneText.value);
    if ("error" in parsed) { $("tuneNote").textContent = t("tune.cannotRead", { error: parsed.error }); return; }
    tuneDraft = parsed.values;
    const notes: string[] = [];
    if (parsed.rejected.length) notes.push(t("tune.rejected", { paths: parsed.rejected.join(", ") }));
    if (parsed.clamped.length) notes.push(t("tune.clamped", { paths: parsed.clamped.join(", ") }));
    refreshTune(tuneText, notes.join(" "));
  });

  $("tuneApply").addEventListener("click", () => {
    applyChanges(tuneDraft);
    try {
      if (changedValues().size > 0) localStorage.setItem(TUNE_STORE, exportTuning(VERSION));
      else localStorage.removeItem(TUNE_STORE);
    } catch { /* muisti ei käytössä: arvot ovat voimassa tämän istunnon */ }
    showTunedBadge();
    openTune();
    restart();
    resume();
  });

  $("tuneCopy").addEventListener("click", async () => {
    let ok = false;
    try { await navigator.clipboard.writeText(tuneText.value); ok = true; } catch { /* leikepöytä ei sallittu: kokeillaan valintaa */ }
    if (!ok) { tuneText.select(); ok = document.execCommand("copy"); }
    refreshTune(tuneText, ok ? t("tune.copied") : t("tune.copyFailed"));
  });

  $("tuneReset").addEventListener("click", () => {
    tuneDraft = new Map();
    refreshTune();
  });

  buildTuneFields();
  showTunedBadge();

  // Taukoikkunan voi raahata sivuun, esimerkiksi kuvakaappausta varten. Siirretty ikkuna
  // poistaa myös ruudun tummennuksen. Paikka säilyy seuraavaan taukoon.
  {
    const overlay = $("pause");
    const panel = overlay.querySelector(".panel") as HTMLElement;
    const off = { x: 0, y: 0 };
    let drag: { x: number; y: number; ox: number; oy: number } | null = null;
    panel.addEventListener("pointerdown", (e) => {
      if (bindUi.capture || (e.target as HTMLElement).closest("button, input, textarea, label")) return;
      drag = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y };
      panel.setPointerCapture(e.pointerId);
    });
    panel.addEventListener("pointermove", (e) => {
      if (!drag) return;
      // Ikkunasta jää aina kaistale näkyviin, jotta sen saa takaisin.
      const maxX = (window.innerWidth + panel.offsetWidth) / 2 - 80;
      const maxY = (window.innerHeight + panel.offsetHeight) / 2 - 60;
      off.x = Math.max(-maxX, Math.min(maxX, drag.ox + e.clientX - drag.x));
      off.y = Math.max(-maxY, Math.min(maxY, drag.oy + e.clientY - drag.y));
      panel.style.left = `${off.x}px`;
      panel.style.top = `${off.y}px`;
      overlay.classList.toggle("moved", off.x !== 0 || off.y !== 0);
    });
    const drop = () => { drag = null; };
    panel.addEventListener("pointerup", drop);
    panel.addEventListener("pointercancel", drop);
  }

  try {
    const saved = JSON.parse(localStorage.getItem(METER_STORE) ?? "null") as Record<string, { x?: unknown; y?: unknown }> | null;
    for (const id of Object.keys(meterOff)) {
      const s = saved?.[id];
      if (s && Number.isFinite(s.x) && Number.isFinite(s.y)) meterOff[id] = { x: s.x as number, y: s.y as number };
    }
  } catch { /* rikkinäinen tallennus: oletuspaikat */ }
  for (const id of Object.keys(meterOff)) {
    const el = $(id);
    let drag: { x: number; y: number; ox: number; oy: number } | null = null;
    el.addEventListener("pointerdown", (e) => {
      if (!paused || !metersUnlocked) return;
      drag = { x: e.clientX, y: e.clientY, ox: meterOff[id].x, oy: meterOff[id].y };
      el.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    el.addEventListener("pointermove", (e) => {
      if (!drag || !paused || !metersUnlocked) return;
      meterOff[id] = { x: drag.ox + e.clientX - drag.x, y: drag.oy + e.clientY - drag.y };
      placeMeters();
    });
    const drop = () => { if (drag) { drag = null; placeMeters(true); } };
    el.addEventListener("pointerup", drop);
    el.addEventListener("pointercancel", drop);
  }
  $("resetMeters").addEventListener("click", () => {
    for (const id of Object.keys(meterOff)) meterOff[id] = { x: 0, y: 0 };
    placeMeters(true);
  });
  $("toggleMeters").addEventListener("click", () => setMetersUnlocked(!metersUnlocked));
  window.addEventListener("resize", () => placeMeters());
  setMetersUnlocked(false);
  placeMeters();
}
