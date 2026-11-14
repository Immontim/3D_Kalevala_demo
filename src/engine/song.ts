import * as THREE from "three";
import { SONG_SLOT_ACTIONS, codeLabel } from "../bindings";
import { SONG, SONGS, SONG_SLOTS, SongId, beatGap, healOnHit, inZone, slotPositions, songLead, songOutcome, zoneHalf } from "../songLogic";
import { setState } from "./actor";
import { $, isTouch } from "./dom";
import { flash, showMsg } from "./hud";
import { bindings, clearInputs, lockPointer } from "./input";
import { paused } from "./loop";
import { fx, g, inputs, sfx } from "./state";
import { camera, canvas } from "./view";

// ---------- Laulu ----------
// Kulku: 1) maailma hidastuu, 2) pelaaja ottaa lauluasennon normaalinopeudella,
// 3) rytmipeli: välilyönti, kun merkki on riimun osuma-alueella, 4) loitsu laukeaa tai ei.
// Jos hidastettu vastustaja ehtii osua, laulu katkeaa heti.
export interface SongState {
  id: SongId;
  /** Parannuslaulun tähän mennessä palauttama elämä. */
  healed: number;
  start: number; // reaaliaika
  /** Rytmipeli alkaa, kun lauluasento on otettu. */
  playAt: number;
  shown: boolean;
  beats: number[];
  results: (boolean | null)[];
  runes: HTMLDivElement[];
  zones: HTMLDivElement[];
  /** Kun kaikki riimut on arvioitu: hetki, jolloin loitsu laukeaa. */
  endAt: number;
}
export let songState: SongState | null = null;

export const RUNES = ["ᚠ", "ᚹ", "ᛃ", "ᛟ", "ᚱ", "ᛉ", "ᛏ", "ᛗ"];

// ---------- Laulun valinta ----------
// Laulunappi pysäyttää pelin kokonaan ja näyttää laulupaikat hahmon ympärillä. Laulu alkaa heti,
// kun paikka valitaan pikanäppäimellä tai napsauttamalla; laulunappi uudestaan peruu valinnan.
export let choosing = false;

export const slotEls: HTMLDivElement[] = SONG_SLOTS.map((id, i) => {
  const d = document.createElement("div");
  d.className = "slot " + (id ?? "empty");
  const rune = document.createElement("span");
  rune.textContent = id ? SONGS[id].rune : "";
  const label = document.createElement("small");
  d.append(rune, label);
  d.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); inputs.pickQueued = i; });
  $("choice").appendChild(d);
  return d;
});
export function songAvailable(id: SongId | null): id is SongId {
  return id !== null && (!SONGS[id].needsEnemy || (g.enemy !== null && g.enemy.state !== "dead"));
}
export function openChoice() {
  choosing = true;
  clearInputs();
  setState(g.player, "idle");
  SONG_SLOTS.forEach((id, i) => {
    const key = codeLabel(bindings[SONG_SLOT_ACTIONS[i]].find((c) => c) ?? "");
    slotEls[i].classList.toggle("off", id !== null && !songAvailable(id));
    (slotEls[i].lastChild as HTMLElement).innerHTML = "";
    (slotEls[i].lastChild as HTMLElement).append(key === "–" ? "" : key, document.createElement("br"), id ? SONGS[id].name : "tyhjä");
  });
  $("choiceHint").textContent = isTouch ? "Valitse laulu napauttamalla" : `Valitse laulu: napsauta tai paina pikanäppäintä. ${codeLabel(bindings.song.find((c) => c) ?? "")} peruu.`;
  $("choice").classList.remove("hidden");
  canvas.classList.add("singing");
  $("vignette").classList.add("on");
  if (document.pointerLockElement) { g.choiceUnlock = true; document.exitPointerLock(); }
}
export function closeChoice() {
  choosing = false;
  inputs.pickQueued = null;
  $("choice").classList.add("hidden");
  canvas.classList.remove("singing");
  $("vignette").classList.remove("on");
  clearInputs();
  if (!paused) lockPointer();
}
/** Asettelee laulupaikat hahmon ympärille ruudulla ja käsittelee valinnan. */
export const choiceP = new THREE.Vector3();
export function updateChoice() {
  const w = window.innerWidth, h = window.innerHeight;
  const toScreen = (y: number) => {
    choiceP.copy(g.player.pos).setY(g.player.pos.y + y).project(camera);
    return [(choiceP.x * 0.5 + 0.5) * w, (-choiceP.y * 0.5 + 0.5) * h];
  };
  const [cx, cy] = toScreen(1.0);
  const pxPerM = Math.abs(toScreen(0.5)[1] - toScreen(1.5)[1]);
  // Paikka on noin pään kokoinen, mutta aina niin iso, että siihen osuu hiirellä ja sormella.
  const size = Math.max(56, Math.min(110, pxPerM * 0.34));
  const r = Math.max(size * 2.1, Math.min(pxPerM * 1.35, Math.min(w, h) * 0.42));
  slotPositions(cx, cy, r).forEach(([x, y], i) => {
    const el = slotEls[i];
    el.style.left = `${Math.max(size / 2 + 4, Math.min(w - size / 2 - 4, x))}px`;
    el.style.top = `${Math.max(size / 2 + 4, Math.min(h - size - 20, y))}px`;
    el.style.width = el.style.height = `${size}px`;
    el.style.fontSize = `${size * 0.58}px`;
  });
  if (inputs.songQueued) { closeChoice(); return; }
  if (inputs.pickQueued !== null) {
    const id = SONG_SLOTS[inputs.pickQueued] ?? null;
    inputs.pickQueued = null;
    if (songAvailable(id)) { closeChoice(); startSong(id); }
  }
}

export function startSong(id: SongId) {
  const verses = SONGS[id].verses;
  g.songPower = 0; // voima kuluu kokonaan, kävi laululle miten tahansa
  sfx.startDrone();
  const track = $("track");
  track.querySelectorAll(".rune, .zone").forEach((r) => r.remove());
  const playAt = g.realTime + SONG.intro;
  const beats = verses.map((_, i) => playAt + songLead() + i * beatGap());
  const zones = beats.map(() => {
    const d = document.createElement("div");
    d.className = "zone";
    track.appendChild(d);
    return d;
  });
  const runes = beats.map((_, i) => {
    const d = document.createElement("div");
    d.className = "rune";
    d.textContent = RUNES[i % RUNES.length];
    track.appendChild(d);
    return d;
  });
  songState = { id, healed: 0, start: g.realTime, playAt, shown: false, beats, results: beats.map(() => null), runes, zones, endAt: -1 };
  $("verse").textContent = "";
  canvas.classList.add("singing");
  $("vignette").classList.add("on");
  $("song").classList.toggle("heal", id === "heal");
  setState(g.player, "idle");
  showMsg(SONGS[id].name, "", 1);
}

export let lastTick = -1;
export function updateSong() {
  const s = songState;
  if (!s) return;
  if (g.realTime < s.playAt) return; // lauluasento kesken: painallukset eivät vielä laske
  if (!s.shown) { s.shown = true; $("song").classList.remove("hidden"); }
  const trackW = $("track").clientWidth;
  const markerX = trackW * 0.25;
  const pxPerSec = trackW * 0.45 * SONG.speed;
  s.beats.forEach((bt, i) => {
    const x = markerX + (bt - g.realTime) * pxPerSec;
    const w = 2 * zoneHalf(i) * pxPerSec;
    s.runes[i].style.left = `${x}px`;
    s.zones[i].style.left = `${x - w / 2}px`;
    s.zones[i].style.width = `${w}px`;
    if (s.results[i] === null && g.realTime > bt + zoneHalf(i)) judge(i, false);
  });
  // Tikitys ennen jokaista riimua.
  const next = s.beats.findIndex((b, i) => s.results[i] === null && b > g.realTime);
  if (next >= 0) {
    const tick = Math.floor((s.beats[next] - g.realTime) / (beatGap() / 2));
    if (tick !== lastTick && tick <= 1) { sfx.tick(); lastTick = tick; }
  }
  // Painallus arvioidaan aina seuraavaa riimua vastaan: alueen ulkopuolelle osunut painallus on huti.
  if (inputs.beatQueued) {
    const i = s.results.findIndex((r) => r === null);
    if (i >= 0) judge(i, inZone(g.realTime - s.beats[i], i));
  }
  if (s.endAt < 0 && s.results.every((r) => r !== null)) s.endAt = g.realTime + SONG.outro;
  if (s.endAt >= 0 && g.realTime >= s.endAt) {
    const out = songOutcome(s.results as boolean[]);
    endSong(s.id, out.success, out.rootTime, out.hits, s.healed);
  }
}

export function judge(i: number, hit: boolean) {
  const s = songState!;
  s.results[i] = hit;
  s.runes[i].classList.add(hit ? "hit" : "miss");
  s.zones[i].classList.add(hit ? "hit" : "miss");
  sfx.pluck(i + 1, hit);
  $("verse").textContent = hit ? SONGS[s.id].verses[i] : "…";
  if (hit && s.id === "heal") {
    // Parannus tulee heti jokaisesta osumasta, joten katkennutkin laulu ehtii auttaa.
    const before = g.player.hp;
    g.player.hp = healOnHit(g.player.hp, g.player.stats.maxHp);
    s.healed += g.player.hp - before;
    flash("#e8736a", 0.16);
  } else if (hit) flash("#f0c766", 0.14);
}

/** Sulkee laulun näkymän ja palauttaa ajan kulun. */
export function closeSong(instant = false) {
  songState = null;
  sfx.stopDrone();
  $("song").classList.add("hidden");
  canvas.classList.remove("singing");
  $("vignette").classList.remove("on");
  if (instant) g.timeScale = 1;
}

export function endSong(id: SongId, success: boolean, rootTime: number, hits: number, healed: number) {
  closeSong();
  const total = SONGS[id].verses.length;
  if (id === "heal") {
    if (hits > 0) showMsg("Veri seisoi kuin seinä", `${hits}/${total} osumaa: ${Math.round(healed)} elämää takaisin`, 2.4);
    else showMsg("Laulu katkesi", "Tahti ei pitänyt", 1.6);
  } else if (success && g.enemy && g.enemy.state !== "dead") {
    g.enemy.state = "rooted";
    g.enemy.stateTime = 0;
    g.enemy.rootTime = rootTime;
    sfx.swamp();
    fx.shake = 0.25;
    showMsg("Suohon suonivyötäisistä!", `${hits}/${total} osumaa: vastustaja on kiinni ${rootTime.toFixed(1)} s ja ottaa tuplavahingon`, 2.4);
  } else {
    showMsg("Laulu katkesi", "Tahti ei pitänyt", 1.6);
  }
}

/** Vastustajan isku osui kesken laulun: loitsu raukeaa ja aika palaa heti normaaliksi. */
export function interruptSong() {
  closeSong(true);
  showMsg("Laulu katkesi", "Isku osui kesken laulun", 1.6);
}
