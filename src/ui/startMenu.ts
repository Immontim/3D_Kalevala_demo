// Aloitusikkuna: taistelupaikan ja varusteiden valinta ja pelin aloitus.
import { Loadout } from "../combat";
import { removeActor } from "../engine/actor";
import { $ } from "../engine/dom";
import { LOADOUTS, LOADOUT_STORE, PLAYER_LOOK, spawnHero } from "../engine/hero";
import { lockPointer } from "../engine/input";

import { g, sfx } from "../engine/state";
import { ARENA, ARENAS, ArenaId, saveArena } from "../world";
import { Language, getLanguage, setLanguage, t } from "../i18n";
import { sceneKind, sceneUrl, type SceneId } from "../app/route";
import { friendlySceneSubtitleKey } from "./startMenuText";

export function initStartMenu(options: { returnToMap?: boolean; scene?: SceneId } = {}) {
  if (options.returnToMap) {
    document.body.classList.add("from-map");
    const friendly = options.scene !== undefined && sceneKind(options.scene) === "friendly";
    const tag = document.querySelector<HTMLElement>("#start .tag");
    if (tag) {
      tag.textContent = friendly && options.scene ? t(friendlySceneSubtitleKey(options.scene))
        : options.scene ? t(`arena.${options.scene}.desc`) : t("start.subtitle");
      tag.removeAttribute("data-i18n");
    }
    const startButton = $("startBtn");
    // Napin teksti paikan mukaan: ranta rannalle, kalmisto kalmistolle, Erämaa metsään, muut pihalle.
    const enter = options.scene === "lakeside" || options.scene === "lakeruin" ? "map.enterLakeside"
      : options.scene === "cairnfield" ? "map.enterCairnfield" : options.scene === "wilds" ? "map.enterWilds" : "map.enterYard";
    startButton.textContent = friendly ? t(enter) : t("map.enterBattle");
    startButton.removeAttribute("data-i18n");
    $("menuBtn").textContent = t("map.return");
    $("menuBtn").removeAttribute("data-i18n");
  }
  for (const btn of document.querySelectorAll<HTMLButtonElement>("#languagePick button[data-language]")) {
    const language = btn.dataset.language as Language;
    btn.classList.toggle("on", language === getLanguage());
    btn.setAttribute("aria-pressed", String(language === getLanguage()));
    btn.setAttribute("aria-label", t(language === "fi" ? "language.fi" : "language.en"));
    btn.addEventListener("click", () => {
      if (language === getLanguage()) return;
      setLanguage(language);
      location.reload();
    });
  }
  // Maaston valinta: maailma rakennetaan kerran latauksen alussa, joten toisen maaston valinta
  // tallentaa valinnan ja lataa sivun uudelleen. Aloitusikkuna on silloin yhä auki.
  {
    const box = $("arenaPick");
    for (const id of Object.keys(ARENAS) as ArenaId[]) {
      const btn = document.createElement("button");
      btn.className = "arena" + (id === ARENA ? " on" : "");
      btn.dataset.arena = id;
      btn.innerHTML = `<b>${ARENAS[id].name}</b><span>${ARENAS[id].desc}</span>`;
      btn.addEventListener("click", () => {
        if (id === ARENA) return;
        if (!saveArena(id)) { $("arenaNote").textContent = t("start.arenaSaveFailed"); return; }
        $("arenaNote").textContent = t("start.loading", { name: ARENAS[id].name });
        location.href = sceneUrl(location.href, id, !!options.returnToMap).href;
      });
      box.appendChild(btn);
    }
  }

  // Varusteiden valinta: sankari vaihdetaan heti, joten valinta näkyy taustalla.
  {
    const box = $("gearPick");
    for (const id of Object.keys(LOADOUTS) as Loadout[]) {
      const btn = document.createElement("button");
      btn.className = "arena" + (id === PLAYER_LOOK.loadout ? " on" : "");
      btn.dataset.loadout = id;
      btn.innerHTML = `<b>${LOADOUTS[id].name}</b><span>${LOADOUTS[id].desc}</span>`;
      btn.addEventListener("click", () => {
        if (id === PLAYER_LOOK.loadout || g.running) return;
        PLAYER_LOOK.loadout = id;
        try { localStorage.setItem(LOADOUT_STORE, id); } catch { /* valinta on voimassa tämän latauksen ajan */ }
        removeActor(g.player);
        spawnHero();
        for (const b of box.querySelectorAll("button")) b.classList.toggle("on", b === btn);
      });
      box.appendChild(btn);
    }
  }

  $("startBtn").addEventListener("click", () => {
    $("start").classList.add("hidden");
    sfx.start();
    g.running = true;
    g.encounter.start();
    lockPointer();
  });
}
