// Lähitaistelu: iskun kulku, osuman seuraukset ja törmäykset.
import * as THREE from "three";
import { ActionState, BASH, COMBAT, StrikeStyle, StrikeWeight, angleBetween, inStrikeZone, attackPhase, enemyAttackTiming, lungeProgress, makeAttack, resolveHit, shieldWear, staminaAfterBlock, staminaTick, strikeCost, strikeDamage, strikeLands, strikeTier, styleFor, weakened } from "../combat";
import { FALLEN } from "../fighter";
import { effectiveStats } from "../stats";
import { ARENA_RADIUS, groundHeight } from "../world";
import { Actor, setState } from "./actor";
import { emitSparks } from "./effects";
import { STYLE_NAME, flash, showMsg } from "./hud";
import { onPlayerDeath } from "./loop";
import { enemyDown, lockTarget } from "./enemies";
import { interruptSong, songState } from "./song";
import { fx, g, sfx } from "./state";
import { scene } from "./view";

export function startAttack(a: Actor, kind: StrikeStyle | "bash", weight: StrikeWeight = "light", charging = false) {
  setState(a, "windup");
  a.attack = kind === "bash" ? BASH : makeAttack(a.weapon, styleFor(a.weapon, kind), weight);
  a.timing = { ...(a === g.player ? a.attack.timing : enemyAttackTiming(a.attack, a.level)) };
  a.charging = charging;
  a.extraRecovery = 0;
  if (a === g.player) g.playerAttackId++;
}

/** Kilpi hajoaa: palaset putoavat maahan, ja kantaja taistelee tästä eteenpäin ilman kilpeä. */
export function breakShield(a: Actor) {
  a.shield = null;
  a.shieldHp = 0;
  if (a.loadout === "sword_shield") a.loadout = "sword";
  const d = a.fighter.breakShield();
  if (d) { scene.add(d.group); g.debris.push(d); }
  sfx.clang(false);
  sfx.hit();
  fx.shake = Math.max(fx.shake, 0.25);
  fx.hitstop = Math.max(fx.hitstop, 0.1);
  if (a === g.player) { showMsg("Kilpesi hajosi!", "Torju nyt miekalla oikeaan suuntaan", 1.6); flash("#b33a2e", 0.25); }
  else showMsg("Kilpi hajosi!", "", 1.1);
}

export function lerpAngle(a: number, b: number, t: number) { return a + angleBetween(a, b) * t; }

export function moveActor(a: Actor, dir: THREE.Vector3, speed: number, dt: number) {
  if (dir.lengthSq() > 1) dir.normalize();
  a.pos.addScaledVector(dir, speed * dt);
  a.moveSpeed = dir.length() * speed;
}

export function resolveStrike(att: Actor, def: Actor) {
  const toDef = def.pos.clone().sub(att.pos);
  // Kantama lasketaan paikasta, josta tukiaskel lähti: askel ei pidennä ulottumaa.
  const dist = def.pos.distanceTo(att.stepFrom);
  const angleToDefender = angleBetween(att.yaw, Math.atan2(toDef.x, toDef.z));
  const angleToAttacker = angleBetween(def.yaw, Math.atan2(-toDef.x, -toDef.z));
  const atk = att.attack;
  const defState = def.state;
  const defender = {
    state: defState, blockStart: def.blockStart, angleToAttacker,
    shield: def.shield, stance: def.stance, blockArc: def.weapon.blockArc,
  };
  const res = resolveHit({ distance: dist, angleToDefender }, defender, g.gameTime, atk);
  const contact = att.pos.clone().lerp(def.pos, 0.55).setY(groundHeight(def.pos.x, def.pos.z) + 1.3);
  const isPlayer = att === g.player;
  g.events.push(`${isPlayer ? "pelaaja" : "vihollinen"}:${atk.kind}/${atk.weight}:${res}`);
  if (g.events.length > 30) g.events.shift();

  const heavy = atk.weight === "heavy";
  def.hp -= strikeDamage(att.stats.power, atk, res, defState) * def.stats.damageTaken;
  // Kilpi kuluu torjutuista iskuista: puolivälissä siihen tulee lovi, lopussa se hajoaa.
  const wear = shieldWear(atk, res, defender);
  if (wear > 0 && def.shield) {
    def.shieldHp -= wear;
    if (def.shieldHp <= 0) breakShield(def);
    else if (def.shieldHp <= def.shield.durability * def.shield.notchAt) def.fighter.setShieldNotch(true);
  }
  if (res === "blocked" || res === "parried") def.stamina = staminaAfterBlock(def.stamina);
  const died = def.hp <= 0;
  if (def === g.player && songState && (res === "hit" || res === "guardbreak")) interruptSong();
  if (died) {
    setState(def, "dead");
    fallDown(def, Math.abs(angleToAttacker) > Math.PI / 2);
    if (def === g.player) onPlayerDeath();
    else enemyDown(def);
  }

  if (res === "hit") {
    sfx.hit();
    fx.hitstop = heavy ? 0.11 : 0.07;
    fx.shake = (isPlayer ? 0.12 : 0.22) * (heavy ? 1.5 : atk.kind === "bash" ? 0.7 : 1);
    emitSparks(contact, heavy ? 18 : 10, 2);
    if (isPlayer) g.songPower = Math.min(COMBAT.songMax, g.songPower + COMBAT.songGainHit);
    else flash("#b33a2e", heavy ? 0.45 : atk.kind === "bash" ? 0.15 : 0.35);
    // Tehoste: sivallus tai ylälyönti voi lennättää vastustajan kypärän päästä. Ei vaikuta peliin.
    if (isPlayer && def.fighter.hasHelmet && (atk.kind === "slash" || atk.kind === "overhead")
      && Math.random() < (died ? 1 : heavy ? 0.6 : 0.25)) {
      const away = toDef.clone().setY(0).normalize();
      const side = new THREE.Vector3(away.z, 0, -away.x);
      // Sivallus vie kypärän sivulle, ylälyönti taakse.
      const dir = atk.kind === "slash" ? side.multiplyScalar(-1).addScaledVector(away, 0.4) : away.addScaledVector(side, Math.random() - 0.5);
      const prop = def.fighter.knockHelmet(dir);
      if (prop) { scene.add(prop.group); g.debris.push(prop); sfx.clang(false); }
    }
    if (!isPlayer && defState === "block" && !died) showMsg("Väärä torjunta", `${STYLE_NAME[atk.kind]} meni läpi`, 0.9);
    // Lyhyt horjahdus keskeyttää noston. Kilpityöntö ei riitä pysäyttämään jo alkanutta iskua.
    const interrupts = defState === "idle" || defState === "block" || (defState === "windup" && atk.kind !== "bash");
    if (!died && interrupts) {
      setState(def, "stagger");
      def.stateTime = COMBAT.staggerTime - COMBAT.hitStagger;
    }
  } else if (res === "guardbreak") {
    sfx.clang(false);
    sfx.hit();
    emitSparks(contact, 26, 5);
    fx.hitstop = 0.08;
    fx.shake = 0.18;
    if (!died) {
      setState(def, "stagger");
      def.stateTime = COMBAT.staggerTime - COMBAT.guardbreakStagger;
    }
    // Murtaja toipuu nopeasti ja ehtii iskeä ennen kuin puolustaja saa suojan takaisin.
    att.extraRecovery = -COMBAT.guardbreakAdvantage;
    if (att.ai) att.ai.counter = true;
    if (isPlayer) showMsg("Suoja murtui!", "Iske nyt", 0.9);
    else { showMsg("Suojasi murtui", "", 0.8); flash("#b33a2e", 0.2); }
  } else if (res === "blocked") {
    sfx.clang(false);
    emitSparks(contact, 18, 4);
    att.extraRecovery = COMBAT.blockRecoil;
    fx.shake = 0.08;
    if (isPlayer) showMsg("Torjuttu", "", 0.6);
  } else if (res === "parried") {
    sfx.clang(true);
    emitSparks(contact, 40, 6);
    fx.hitstop = 0.14;
    fx.shake = 0.18;
    setState(att, "stagger");
    if (!isPlayer) {
      g.songPower = Math.min(COMBAT.songMax, g.songPower + COMBAT.songGainParry);
      showMsg("Täydellinen torjunta!", "Vastustaja horjuu, iske nyt", 1);
      flash("#f0c766", 0.25);
    }
  } else if (res === "dodged" && !isPlayer) {
    showMsg("Väistit", "", 0.5);
  }
}

/** Lyönti laukeaa: kestävyys ratkaisee, onko se raskas, kevyt vai uupuneen heikko, ja hinta maksetaan. */
export function spendOnStrike(a: Actor) {
  const tier = strikeTier(a.stamina, a.attack.weight);
  if (tier !== "heavy" && a.attack.weight === "heavy" && a.attack.kind !== "bash") a.attack = makeAttack(a.weapon, a.attack.kind, "light");
  if (tier === "weak") a.attack = weakened(a.attack);
  a.stamina = Math.max(0, a.stamina - strikeCost(tier));
}

/**
 * Kaatuminen: valitaan makuuasento ja pudotetaan ase ja kilpi maahan.
 * Selkään lyöty kaatuu vatsalleen, edestä lyöty selälleen (kolme eri asentoa).
 */
export function fallDown(a: Actor, fromBehind: boolean) {
  const fits = FALLEN.filter((f) => f.prone === fromBehind);
  a.fighter.fallen = fits[Math.floor(Math.random() * fits.length)] ?? FALLEN[0];
  for (const d of a.fighter.dropGear()) { scene.add(d.group); g.debris.push(d); }
}

/** Kehen isku kohdistuu: vastustajan isku sankariin, sankarin isku lukittuun tai lähimpään ulottuvilla olevaan. */
function strikeTarget(att: Actor): Actor | null {
  if (att !== g.player) return g.player.state === "dead" ? null : g.player;
  const inZone = (e: Actor) => {
    const to = e.pos.clone().sub(att.pos);
    return inStrikeZone({ distance: e.pos.distanceTo(att.stepFrom), angleToDefender: angleBetween(att.yaw, Math.atan2(to.x, to.z)) }, att.attack);
  };
  const locked = lockTarget();
  if (locked && inZone(locked)) return locked;
  const near = [...g.enemies].sort((a, b) => a.pos.distanceToSquared(att.pos) - b.pos.distanceToSquared(att.pos));
  return near.find(inZone) ?? locked ?? near[0] ?? null;
}

export function updateCombatant(a: Actor, dt: number) {
  a.stateTime += dt;
  // Kyvyt lasketaan joka ruutu, jotta ajastetut vaikutukset (ruoka, loitsut) alkavat ja loppuvat itsestään.
  a.stats = effectiveStats(a.base, a.mods, g.gameTime);
  if (a.state !== "dead") {
    a.hp = Math.min(a.hp, a.stats.maxHp);
    a.stamina = staminaTick(a.stamina, a.stats.maxStamina, a.stats.staminaRegen, a.state === "block", dt);
  }
  a.dodgeCd -= dt;
  const t = a.timing;

  if (a.state === "windup" || a.state === "release" || a.state === "recovery") {
    const phase = a.charging ? "windup" : attackPhase(a.stateTime, { ...t, recovery: t.recovery + a.extraRecovery });
    if (phase === "release" && a.state !== "release") {
      a.state = "release";
      a.lunged = 0;
      a.stepFrom.copy(a.pos);
      spendOnStrike(a);
      sfx.swing();
    }
    const inRelease = a.stateTime - t.windup;
    if (phase === "release") {
      // Tukiaskel eteen iskuvaiheen alussa. Isku ratkeaa vasta, kun askel on otettu.
      const done = lungeProgress(inRelease, t.release);
      const step = (done - a.lunged) * a.attack.lunge;
      a.lunged = done;
      a.pos.x += Math.sin(a.yaw) * step;
      a.pos.z += Math.cos(a.yaw) * step;
    }
    // Jos ruutu hyppäsi osumahetken yli suoraan palautumiseen, isku ratkeaa silti.
    const lands = phase === "release" ? strikeLands(inRelease, t.release) : phase !== "windup" && a.state === "release";
    const target = lands && !a.struck ? strikeTarget(a) : null;
    if (target) {
      a.struck = true;
      resolveStrike(a, target);
      if ((a.state as ActionState) === "stagger") return; // täydellinen torjunta keskeytti
    }
    if (phase === "recovery") a.state = "recovery";
    if (phase === "done") setState(a, "idle");
  } else if (a.state === "stagger") {
    if (a.stateTime >= COMBAT.staggerTime) setState(a, "idle");
  } else if (a.state === "dodge") {
    a.pos.addScaledVector(a.dodgeDir, COMBAT.dodgeSpeed * dt);
    if (a.stateTime >= COMBAT.dodgeTime) setState(a, "idle");
  } else if (a.state === "rooted") {
    a.rootTime -= dt;
    if (a.rootTime <= 0) setState(a, "idle");
  }
}

/** Pitää taistelijat kehän sisällä ja erillään toisistaan. */
export function keepApartAndInside(actors: Actor[]) {
  for (const x of actors) {
    const r = Math.hypot(x.pos.x, x.pos.z);
    if (r > ARENA_RADIUS - 0.6) x.pos.multiplyScalar((ARENA_RADIUS - 0.6) / r);
  }
  for (let i = 0; i < actors.length; i++) {
    for (let j = i + 1; j < actors.length; j++) {
      const a = actors[i], b = actors[j];
      if (a.state === "dead" || b.state === "dead") continue;
      const d = b.pos.clone().sub(a.pos);
      const len = d.length();
      if (len >= 1.0 || len <= 0.0001) continue;
      // Suohon juuttunutta ei voi työntää: vain toinen osapuoli väistyy.
      const aStuck = a.state === "rooted", bStuck = b.state === "rooted";
      if (aStuck && bStuck) continue;
      const push = d.multiplyScalar((1.0 - len) / len / (aStuck || bStuck ? 1 : 2));
      if (!aStuck) a.pos.sub(push);
      if (!bStuck) b.pos.add(push);
    }
  }
}
