// Sankari: varusteet, luonti ja ohjaus.
import * as THREE from "three";
import { COMBAT, Loadout, SHIELDS, STYLES, canStrikeHeavy, exhausted, makeAttack, styleFor, turnToward } from "../combat";
import { CONTROLS } from "../controls";
import { FighterLook } from "../fighter";
import { makeActor, setState } from "./actor";
import { bearing } from "./camera";
import { lockTarget } from "./enemies";
import { strikeHeld } from "./input";
import { lerpAngle, moveActor, startAttack } from "./melee";
import { openChoice, songState } from "./song";
import { DEG, aim, g, inputs, keys, sfx } from "./state";
import { t } from "../i18n";
import { ARENA_PEACEFUL } from "../world";
import { applyActiveMapTransition } from "../map/transition";

// Sankarin varusteet valitaan aloitusikkunassa, ja valinta tallentuu selaimeen.
export const LOADOUT_STORE = "laulun-miekka.loadout.v1";
export const LOADOUTS: Record<Loadout, { name: string; desc: string }> = {
  sword_shield: { name: t("loadout.swordShield.name"), desc: t("loadout.swordShield.desc") },
  sword: { name: t("loadout.sword.name"), desc: t("loadout.sword.desc") },
  spear: { name: t("loadout.spear.name"), desc: t("loadout.spear.desc") },
};
export function savedLoadout(): Loadout {
  try {
    const v = localStorage.getItem(LOADOUT_STORE);
    if (v === "sword" || v === "sword_shield" || v === "spear") return v;
  } catch { /* muisti ei käytössä */ }
  return "sword_shield";
}
export const PLAYER_LOOK: FighterLook = { character: "hero", loadout: savedLoadout() };

/** Uusi ehjä kilpi pelaajalle jokaiseen aaltoon. */
export function renewPlayerShield() {
  if (PLAYER_LOOK.loadout !== "sword_shield") return;
  g.player.shield = SHIELDS.round;
  g.player.shieldHp = g.player.shield.durability;
  g.player.loadout = "sword_shield";
  g.player.fighter.restoreShield();
}

/** Luo sankarin aloituspaikalleen. Vanha sankari on poistettava ensin (removeActor). */
export function spawnHero() {
  g.player = makeActor(PLAYER_LOOK, new THREE.Vector3(0, 0, -3), 0, 0xffd27a);
  applyActiveMapTransition(g.player, g.gameTime);
  // Rauhallisessa paikassa sankari näkyy jo aloitusikkunan taustalla ase huotrassa.
  g.player.fighter.setSheathed(ARENA_PEACEFUL);
}

/** Rauha: kohtaus on rauhallinen eikä kentällä ole vastustajia. Silloin miekka on huotrassa ja
 *  kilpi selässä, eikä sankari lyö tai torju. Ensimmäinen vastustaja saa hänet vetämään aseen. */
export function heroAtPeace() { return !!g.encounter.peaceful && g.enemies.length === 0; }

export function updatePlayer(dt: number) {
  const p = g.player;
  if (p.state === "dead") return;
  const calm = heroAtPeace();
  p.fighter.setSheathed(calm);
  // Lukittuna katse seuraa vastustajaa; muuten sitä ohjaa hiiri. Sankari kääntyy katseen suuntaan.
  const target = lockTarget();
  if (target) aim.yaw = lerpAngle(aim.yaw, bearing(p.pos, target.pos), 1 - Math.exp(-CONTROLS.lockTurn * dt));
  if (!songState) p.yaw = turnToward(p.yaw, aim.yaw, p.stats.turnSpeed * DEG * dt);
  // Liike katseen suhteen: W eteen katseen suuntaan, A ja D sivulle.
  const fwd = new THREE.Vector3(Math.sin(aim.yaw), 0, Math.cos(aim.yaw));
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const move = new THREE.Vector3();
  if (keys.has("KeyW")) move.add(fwd);
  if (keys.has("KeyS")) move.sub(fwd);
  if (keys.has("KeyD")) move.add(right);
  if (keys.has("KeyA")) move.sub(right);

  if (songState) { p.moveSpeed = 0; return; }

  // Viritys: niin kauan kuin iskunappi on pohjassa, isku ei laukea. Kun viritysaika täyttyy,
  // isku muuttuu raskaaksi. Napin vapautus laukaisee iskun.
  if (p.state === "windup" && p.charging && p.attack.kind !== "bash") {
    const style = p.attack.kind;
    const heavy = makeAttack(p.weapon, style, "heavy");
    const full = p.stateTime >= heavy.timing.windup;
    if (full && p.attack.weight === "light" && canStrikeHeavy(p.stamina)) { p.attack = heavy; sfx.tick(); }
    // Nappi lasketaan pohjassa olevaksi myös, jos ase muunsi painetun suunnan toiseksi (keihäs).
    const held = STYLES.some((st) => strikeHeld[st] && styleFor(p.weapon, st) === style);
    if (!held || p.stateTime >= heavy.timing.windup + COMBAT.chargeHoldMax) {
      p.charging = false;
      // Kevyt isku laukeaa aikaisintaan oman nostonsa jälkeen, viritetty raskas heti.
      const lightWindup = makeAttack(p.weapon, style, "light").timing.windup;
      p.timing = { ...p.attack.timing, windup: full ? p.stateTime : Math.max(p.stateTime, lightWindup) };
    }
  }

  if (p.state === "idle" || p.state === "block") {
    if (inputs.songQueued && g.songPower >= COMBAT.songMax) {
      openChoice();
      return;
    }
    if (inputs.dodgeQueued && p.dodgeCd <= 0) {
      setState(p, "dodge");
      p.dodgeCd = COMBAT.dodgeCooldown;
      p.dodgeDir.copy(move.lengthSq() > 0 ? move.normalize() : right.clone().negate());
      return;
    }
    if (inputs.strikeQueued && !calm) {
      if (p.state === "idle") { startAttack(p, inputs.strikeQueued, "light", true); return; }
      // Torjunnan aikana: kilven kanssa kilpityöntö, pelkällä aseella torjunta-asennon vaihto.
      if (p.shield) { startAttack(p, "bash"); return; }
      // Asennon vaihto aloittaa torjunnan alusta, joten oikeaan aikaan vaihdettu asento on täydellinen torjunta.
      if (inputs.strikeQueued !== p.stance) { p.stance = inputs.strikeQueued; p.blockStart = g.gameTime; }
    }
    // Uupunut ei pysty torjumaan: suoja laskee itsestään.
    const tired = exhausted(p.stamina);
    if (inputs.blockHeld && !tired && !calm && p.state === "idle") { setState(p, "block"); p.blockStart = g.gameTime; }
    if ((!inputs.blockHeld || tired || calm) && p.state === "block") setState(p, "idle");
  }
  const walk = p.stats.moveSpeed;
  const speed = p.state === "idle" ? walk : p.state === "block" || p.state === "windup" || p.state === "recovery" ? walk * COMBAT.guardMoveScale : 0;
  if (speed > 0) moveActor(p, move, speed, dt);
  else p.moveSpeed = 0;
}
