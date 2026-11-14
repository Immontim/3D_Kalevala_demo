import { AttackDef, COMBAT, StrikeStyle, canStrikeHeavy, chargeLevel, exhausted, makeAttack } from "../combat";
import { Actor } from "./actor";
import { focusEnemy, lockTarget } from "./enemies";
import { paused } from "./loop";
import { $ } from "./dom";
import { g } from "./state";
import { camera } from "./view";

// ---------- HUD ----------
export let msgTimer = 0;
export function showMsg(text: string, sub = "", dur = 1.6) {
  $("msg").textContent = text;
  $("sub").textContent = sub;
  $("msg").style.opacity = "1";
  $("sub").style.opacity = "1";
  msgTimer = dur;
}
export function flash(color: string, strength: number) {
  const f = $("flash");
  f.style.background = color;
  f.style.transition = "none";
  f.style.opacity = String(strength);
  requestAnimationFrame(() => {
    f.style.transition = "opacity 0.35s";
    f.style.opacity = "0";
  });
}
/** Vastustaja, jonka mittarit näytetään: lukittu tai lähin. Kaatunut jää näkyviin, kunnes ruumis poistuu tai uusi saapuu. */
let shown: Actor | null = null;
function shownEnemy(): Actor | null {
  const f = focusEnemy();
  if (f) shown = f;
  else if (shown && !g.corpses.some((c) => c.actor === shown)) shown = null;
  return shown;
}

export function updateHud() {
  const foe = shownEnemy();
  // Ilman vastustajaa mittari on piilossa; tauolla se näkyy, jotta sen voi raahata paikalleen.
  $("meterEnemy").style.visibility = foe || paused ? "" : "hidden";
  $("ename").textContent = foe ? foe.name : "";
  $("php").style.width = `${(g.player.hp / g.player.stats.maxHp) * 100}%`;
  $("ehp").style.width = foe ? `${(Math.max(0, foe.hp) / foe.stats.maxHp) * 100}%` : "0%";
  // Lukuarvot: elämä pyöristetään ylöspäin (1 = vielä hengissä), kestävyys alaspäin (käytettävissä oleva).
  const num = (v: number, max: number, up: boolean) => `${up ? Math.ceil(Math.max(0, v)) : Math.floor(Math.max(0, v))} / ${Math.round(max)}`;
  $("phpNum").textContent = num(g.player.hp, g.player.stats.maxHp, true);
  // Lukitusmerkki lukitun vastustajan pään yläpuolella.
  const locked = lockTarget();
  const mark = $("lockMark");
  if (locked) {
    const p = locked.pos.clone().setY(locked.pos.y + 2.0).project(camera);
    const show = p.z < 1;
    mark.classList.toggle("hidden", !show);
    if (show) { mark.style.left = `${((p.x + 1) / 2) * innerWidth}px`; mark.style.top = `${((1 - p.y) / 2) * innerHeight}px`; }
  } else mark.classList.add("hidden");
  $("ehpNum").textContent = foe ? num(foe.hp, foe.stats.maxHp, true) : "";
  const staminaBar = (id: string, a: Actor | null) => {
    $(id + "Num").textContent = a ? num(a.stamina, a.stats.maxStamina, false) : "";
    $(id).style.width = a ? `${(a.stamina / a.stats.maxStamina) * 100}%` : "0%";
    $(id).parentElement!.classList.toggle("spent", !!a && a.state !== "dead" && exhausted(a.stamina));
  };
  staminaBar("psta", g.player);
  staminaBar("esta", foe);
  const s = $("psong");
  s.style.width = `${(g.songPower / COMBAT.songMax) * 100}%`;
  s.classList.toggle("full", g.songPower >= COMBAT.songMax);
  $("songReady").textContent = g.songPower >= COMBAT.songMax ? "· paina Q" : "";

  // Kilpien kesto.
  const shieldBar = (id: string, a: Actor | null) => {
    const wrap = $(id).parentElement!;
    wrap.style.visibility = a && a.fighter.look.loadout === "sword_shield" ? "visible" : "hidden";
    $(id).style.width = a && a.shield ? `${(a.shieldHp / a.shield.durability) * 100}%` : "0%";
    $(id).classList.toggle("worn", !!a && !!a.shield && a.shieldHp <= a.shield.durability * a.shield.notchAt);
  };
  shieldBar("pshield", g.player);
  shieldBar("eshield", foe);

  // Viritysmittari: täyttyy, kun iskunappi on pohjassa. Täysi = raskas isku viritetty.
  const p = g.player;
  let charge = 0;
  if (p.state === "windup" && p.attack.kind !== "bash") {
    charge = p.charging ? chargeLevel(p.stateTime, heavyOf(p)) : p.attack.weight === "heavy" ? 1 : 0;
  } else if (p.state === "release" && p.attack.weight === "heavy") charge = 1;
  // Jos voimat eivät riitä raskaaseen lyöntiin, mittari ei täyty.
  const tooTired = p.state === "windup" && p.charging && !canStrikeHeavy(p.stamina);
  if (tooTired) charge = Math.min(charge, 0.6);
  $("charge").classList.toggle("on", charge > 0.12);
  $("charge").classList.toggle("full", charge >= 1);
  $("chargeFill").style.width = `${charge * 100}%`;
  $("chargeLabel").textContent = charge >= 1 ? `${STYLE_NAME[p.attack.kind]} · raskas` : charge > 0 ? `${STYLE_NAME[p.attack.kind]}${tooTired ? " · voimat eivät riitä raskaaseen" : ""}` : "";

  // Vastustajan tuleva isku ja oma torjunta-asento tekstinä.
  const e = foe;
  $("cue").textContent = e && e.state === "windup" ? `${STYLE_ICON[e.attack.kind]} ${STYLE_NAME[e.attack.kind]}${e.attack.weight === "heavy" ? " (raskas)" : ""}` : "";
  $("pstance").textContent = p.state !== "dead" && exhausted(p.stamina) ? "Uupunut: et voi torjua, ja lyöntisi ovat heikkoja"
    : p.state === "block" && !p.shield ? `Torjunta: ${BLOCK_NAME[p.stance]}` : "";
}
export const STYLE_NAME: Record<AttackDef["kind"], string> = { overhead: "Ylälyönti", slash: "Sivallus", thrust: "Pisto", bash: "Kilpityöntö" };
export const STYLE_ICON: Record<AttackDef["kind"], string> = { overhead: "↓", slash: "→", thrust: "•", bash: "◐" };
export const BLOCK_NAME: Record<StrikeStyle, string> = { overhead: "ylä", slash: "sivu", thrust: "pisto" };
export function heavyOf(a: Actor) { return makeAttack(a.weapon, a.attack.kind === "bash" ? "slash" : a.attack.kind, "heavy"); }

/** Viesti häipyy, kun sen aika on kulunut. */
export function tickMsg(realDt: number) {
  if (msgTimer <= 0) return;
  msgTimer -= realDt;
  if (msgTimer <= 0) { $("msg").style.opacity = "0"; $("sub").style.opacity = "0"; }
}
