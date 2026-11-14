// Aloitusikkuna: taistelupaikan ja varusteiden valinta ja pelin aloitus.
import { Loadout } from "../combat";
import { removeActor } from "../engine/actor";
import { $ } from "../engine/dom";
import { LOADOUTS, LOADOUT_STORE, PLAYER_LOOK, spawnHero } from "../engine/hero";
import { lockPointer } from "../engine/input";

import { g, sfx } from "../engine/state";
import { ARENA, ARENAS, ArenaId, saveArena } from "../world";

export function initStartMenu() {
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
        if (!saveArena(id)) { $("arenaNote").textContent = "Valintaa ei voitu tallentaa tähän selaimeen, joten maastoa ei voi vaihtaa."; return; }
        $("arenaNote").textContent = `Ladataan: ${ARENAS[id].name}…`;
        location.reload();
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
