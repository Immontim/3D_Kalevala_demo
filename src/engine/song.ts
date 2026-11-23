import * as THREE from "three";
import { SONG_SLOT_ACTIONS, codeLabel } from "../bindings";
import { renderVerbatim, t } from "../i18n";
import { SONG, SONGS, SONG_SLOTS, SongId, beatGap, healOnHit, inZone, slotPositions, songBeats, songOutcome, songSlots, zoneHalf } from "../songLogic";
import { ARENA } from "../world";
import { setState } from "./actor";
import { talkTo } from "./dialogue";
import { $, isTouch } from "./dom";
import { focusEnemy } from "./enemies";
import { flash, showMsg } from "./hud";
import { bindings, clearInputs, lockPointer } from "./input";
import { paused } from "./loop";
import { beginSongArcs, fadeSongArcs, revealVerse } from "./songArcs";
import { fx, g, inputs, sfx } from "./state";
import { campaignStore, worldRuntime } from "./store";
import { heroAtPeace } from "./hero";
import { TALKABLES, nearestTalkable } from "../interact";
import { camera, setSongLook, world } from "./view";

// ---------- Laulu ----------
// Kulku: 1) maailma hidastuu, 2) pelaaja ottaa lauluasennon normaalinopeudella,
// 3) rytmipeli: välilyönti, kun merkki on riimun osuma-alueella, 4) loitsu laukeaa tai ei.
// Jos hidastettu vastustaja ehtii osua, laulu katkeaa heti.
/** Tietäjän opetus: sama rytmipeli, mutta maailma ei hidastu ja säe näytetään etukäteen. */
export interface SongLesson { npcId: string; name: string }

export interface SongState {
  id: SongId;
  /** Opetuskerta (null = laulu taistelussa). */
  lesson: SongLesson | null;
  /** Opetuksessa viimeksi näytetyn säkeen indeksi. */
  verseShown: number;
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

/** Voimassa olevat laulupaikat: opeteltu laulu ilmestyy paikkaan kampanjan lipun mukaan. */
let slots: readonly (SongId | null)[] = SONG_SLOTS;
function refreshSlots() {
  slots = songSlots(campaignStore().get().engine.flags);
  slotEls.forEach((el, i) => {
    const id = slots[i] ?? null;
    el.className = "slot " + (id ?? "empty");
    (el.firstChild as HTMLElement).textContent = id ? SONGS[id].rune : "";
  });
}

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
  if (id === null) return false;
  if (heroAtPeace()) {
    // Rauhassa laulaa voi vain rauhan laulun (Pohjolan uni) tai laulun, jonka kohde on kuuluvilla (parannus jousineidolle).
    const def = SONGS[id];
    if (def.peaceful) return true;
    const listener = songListener(id);
    return !!def.peaceTargets && !!listener && def.peaceTargets.includes(listener.id);
  }
  const combatTargets = SONGS[id].combatTargets;
  if (combatTargets) {
    const listener = songListener(id);
    if (!listener || !combatTargets.includes(listener.id)) return false;
  }
  return !SONGS[id].needsEnemy || focusEnemy() !== null;
}

/** Onko pelaajalla opittu laulu, jonka voi laulaa rauhassa? Muuten rauhassa ei avata laulurengasta turhaan. */
export function canSingAtPeace(): boolean {
  return songSlots(campaignStore().get().engine.flags).some((id) => id !== null && songAvailable(id));
}

/** Kuinka kaukaa hahmo kuulee laulun (m). Louhen karkotus vaatii, että laulaja on tämän matkan sisällä. */
export const SONG_AUDIENCE_RANGE = 6;

/**
 * Laulun kuulija: laulun oma rauhan kohde (parannuksella jousineito), jos se on kuuluvilla, muuten lähin
 * puhuteltava. Näin pihan koira tai kana vuoteen vieressä ei vie parannuslaulua neidolta.
 */
function songListener(id: SongId) {
  const targets = SONGS[id].peaceTargets;
  if (targets) {
    const target = nearestTalkable(g.player.pos, SONG_AUDIENCE_RANGE, TALKABLES.filter((t) => targets.includes(t.id)));
    if (target) return target;
  }
  return nearestTalkable(g.player.pos, SONG_AUDIENCE_RANGE);
}
export function openChoice() {
  choosing = true;
  clearInputs();
  setState(g.player, "idle");
  refreshSlots();
  slots.forEach((id, i) => {
    const key = codeLabel(bindings[SONG_SLOT_ACTIONS[i]].find((c) => c) ?? "");
    slotEls[i].classList.toggle("off", id !== null && !songAvailable(id));
    (slotEls[i].lastChild as HTMLElement).innerHTML = "";
    (slotEls[i].lastChild as HTMLElement).append(key === "–" ? "" : key, document.createElement("br"), id ? SONGS[id].name : t("song.empty"));
  });
  $("choiceHint").textContent = isTouch ? t("song.chooseTouch") : t("song.choose", { key: codeLabel(bindings.song.find((c) => c) ?? "") });
  $("choice").classList.remove("hidden");
  setSongLook(true);
  if (document.pointerLockElement) { g.choiceUnlock = true; document.exitPointerLock(); }
}
export function closeChoice() {
  choosing = false;
  inputs.pickQueued = null;
  $("choice").classList.add("hidden");
  setSongLook(false);
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
    const id = slots[inputs.pickQueued] ?? null;
    inputs.pickQueued = null;
    if (songAvailable(id)) { closeChoice(); startSong(id); }
  }
}

/** Aloittaa tietäjän opettaman laulun harjoituksen. Harjoituksen päätyttyä dialogi avautuu uudelleen. */
export function startLesson(id: SongId, lesson: SongLesson) {
  startSong(id, lesson);
}

export function startSong(id: SongId, lesson: SongLesson | null = null) {
  const verses = SONGS[id].verses;
  g.songPower = 0; // voima kuluu kokonaan, kävi laululle miten tahansa
  sfx.startDrone();
  const track = $("track");
  track.querySelectorAll(".rune, .zone").forEach((r) => r.remove());
  const playAt = g.realTime + SONG.intro;
  // Riimut tulevat pareittain, ja parien väliin arvotaan tauko (SONG.pairPause).
  const beats = songBeats(verses.length, playAt);
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
  songState = { id, lesson, verseShown: -1, healed: 0, start: g.realTime, playAt, shown: false, beats, results: beats.map(() => null), runes, zones, endAt: -1 };
  $("verse").textContent = "";
  beginSongArcs(id, verses);
  setSongLook(true);
  $("song").classList.toggle("heal", id === "heal");
  $("songHint").textContent = t(lesson ? "song.lesson.hint" : "song.rhythmHint");
  setState(g.player, "idle");
  showMsg(SONGS[id].name, "", 1);
  if (!lesson) g.encounter.onPlayerSongStart?.(id, songListener(id)?.id ?? null);
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
    if (songState !== s) return;
    const x = markerX + (bt - g.realTime) * pxPerSec;
    const w = 2 * zoneHalf(i) * pxPerSec;
    s.runes[i].style.left = `${x}px`;
    s.zones[i].style.left = `${x - w / 2}px`;
    s.zones[i].style.width = `${w}px`;
    if (s.results[i] === null && g.realTime > bt + zoneHalf(i)) judge(i, false);
  });
  if (songState !== s) return;
  // Opetuksessa tietäjä laulaa säkeen etukäteen: seuraava arvioimaton säe näkyy ruudulla.
  if (s.lesson) {
    const n = s.results.findIndex((r) => r === null);
    if (n >= 0 && n !== s.verseShown) { s.verseShown = n; renderVerbatim($("verse"), SONGS[s.id].verses[n]); }
  }
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
  if (songState !== s) return;
  if (s.endAt < 0 && s.results.every((r) => r !== null)) s.endAt = g.realTime + SONG.outro;
  if (s.endAt >= 0 && g.realTime >= s.endAt) {
    const out = songOutcome(s.results as boolean[]);
    if (s.lesson) endLesson(s.id, s.lesson, out.success, out.hits);
    else endSong(s.id, out.success, out.rootTime, out.hits, s.healed, out.dotPerSec);
  }
}

export function judge(i: number, hit: boolean) {
  const s = songState!;
  s.results[i] = hit;
  s.runes[i].classList.add(hit ? "hit" : "miss");
  s.zones[i].classList.add(hit ? "hit" : "miss");
  sfx.pluck(i + 1, hit);
  // Säe singahtaa kaarelleen sankarin ylle (kulta = osuma, tuhka = ohi). Nauhan yläpuolinen
  // säerivi on käytössä vain opetuksessa, jossa tietäjä laulaa seuraavan säkeen etukäteen.
  revealVerse(i, hit);
  if (hit && s.id === "heal") {
    // Parannus tulee heti jokaisesta osumasta, joten katkennutkin laulu ehtii auttaa.
    const before = g.player.hp;
    g.player.hp = healOnHit(g.player.hp, g.player.stats.maxHp);
    s.healed += g.player.hp - before;
    flash("#e8736a", 0.16);
  } else if (hit) flash("#f0c766", 0.14);
  if (g.encounter.onPlayerSongBeat?.(s.id, i + 1)) {
    closeSong(true);
    g.encounter.afterPlayerSongInterrupted?.();
  }
}

/** Sulkee laulun näkymän ja palauttaa ajan kulun. */
export function closeSong(instant = false) {
  songState = null;
  fadeSongArcs();
  sfx.stopDrone();
  $("song").classList.add("hidden");
  setSongLook(false);
  if (instant) g.timeScale = 1;
}

/**
 * Opetus päättyy: tulos lähetetään moottorille (`song.performed`, lesson), jonka sääntö antaa
 * laulun lipulla. Sen jälkeen tietäjän dialogi avataan uudelleen (onnistuessa "opetettu"-solmu).
 */
export function endLesson(id: SongId, lesson: SongLesson, success: boolean, hits: number) {
  closeSong();
  const posted = worldRuntime().post({ type: "song.performed", songId: id, context: "lesson", success, hits, sceneId: ARENA });
  const message = posted.result.messages[0];
  // Dialogi ensin: sen avaus tyhjentää ruudun viestin, joten tulos näytetään vasta sen jälkeen.
  talkTo(lesson.npcId, lesson.name);
  if (!posted.saved) showMsg(t("dialogue.saveFailed"), "", 2);
  else if (message) showMsg(t(message.text), message.sub ? t(message.sub) : "", 2.6);
  else showMsg(t("song.lesson.failed"), t("song.lesson.failedSub"), 2.2);
}

export function endSong(id: SongId, success: boolean, rootTime: number, hits: number, healed: number, dotPerSec = 0) {
  closeSong();
  const total = SONGS[id].verses.length;
  // Laulu kerrotaan moottorille. Lähin kuulija (esim. Louhi kalmistolla) kulkee mukana: sääntö
  // `louhi.banished` vaatii hänen olevan kuuluvilla.
  const listener = songListener(id);
  const posted = worldRuntime().post({
    type: "song.performed", songId: id, context: "cast", success, hits, sceneId: ARENA,
    ...(listener ? { nearNpcId: listener.id } : {}),
  });
  // Sääntöjen pyytämät toimet: hahmo poistuu kohtauksesta heti (pysyvyys tulee säännön asettamasta lipusta).
  for (const action of posted.result.actions) {
    if (action.kind === "removeNpc") {
      world.removeNpc(action.npcId);
      g.encounter.onNpcRemoved?.(action.npcId);
    }
    else if (action.kind === "npcState") world.setNpcState(action.npcId, action.state);
  }
  // Suo lauletaan lukitun tai lähimmän vastustajan alle.
  const target = id === "heal" ? null : focusEnemy();
  if (id === "heal") {
    // Sääntöjen seuraus (jousineito paranee, laulu ei tepsinyt tai hän kuolee) menee laulun oman viestin edelle.
    const consequence = posted.saved ? posted.result.messages[0] : undefined;
    if (consequence) showMsg(t(consequence.text), consequence.sub ? t(consequence.sub) : "", 3.6);
    else if (hits > 0) showMsg(t("song.healSuccess"), t("song.healed", { hits, total, healed: Math.round(healed) }), 2.4);
    else showMsg(t("song.failed"), t("song.rhythmFailed"), 1.6);
  } else if (id === "sleep") {
    if (success) {
      for (const enemy of g.enemies) {
        enemy.tempoScale = Math.min(enemy.tempoScale, SONG.sleepSlowScale);
        enemy.tempoUntil = Math.max(enemy.tempoUntil, g.gameTime + SONG.sleepSlowSeconds);
      }
    }
    // Vaikutus tulee sääntöjen kautta (Louhen karkotus); ilman kuulijaa laulu vain kaikuu.
    const consequence = posted.saved ? posted.result.messages[0] : undefined;
    if (success && consequence) { sfx.swamp(); fx.shake = 0.2; showMsg(t(consequence.text), consequence.sub ? t(consequence.sub) : "", 3.6); }
    else if (success) showMsg(t("song.sleepSuccess"), t("song.sleepNoListener"), 2.4);
    else showMsg(t("song.failed"), t("song.rhythmFailed"), 1.6);
  } else if (success && target) {
    target.state = "rooted";
    target.stateTime = 0;
    target.rootTime = rootTime;
    // Yli kaksi osumaa: suo myös vahingoittaa koko juuttumisen ajan.
    target.bogDot = dotPerSec > 0 ? { perSec: dotPerSec, left: rootTime, acc: 0 } : null;
    sfx.swamp();
    fx.shake = 0.25;
    const sub = dotPerSec > 0
      ? t("song.rootedDot", { hits, total, seconds: rootTime.toFixed(1), dps: Math.round(dotPerSec) })
      : t("song.rooted", { hits, total, seconds: rootTime.toFixed(1) });
    showMsg(t("song.bogSuccess"), sub, 2.4);
  } else {
    showMsg(t("song.failed"), t("song.rhythmFailed"), 1.6);
  }
}

/** Vastustajan isku osui kesken laulun: loitsu raukeaa ja aika palaa heti normaaliksi. */
export function interruptSong() {
  closeSong(true);
  showMsg(t("song.failed"), t("song.interrupted"), 1.6);
}
