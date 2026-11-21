// Lähitaistelu: iskun kulku, osuman seuraukset ja törmäykset.
import * as THREE from "three";
import { ActionState, BASH, COMBAT, StrikeStyle, StrikeWeight, angleBetween, bashPushStep, damageAfterArmour, graceAfter, graceCovers, helmetAbsorbsOverhead, inStrikeZone, attackPhase, enemyAttackTiming, lungeProgress, makeAttack, resolveHit, shieldWear, staminaAfterBlock, staminaTick, strikeCost, strikeDamage, strikeLands, strikeTier, styleFor, weakened } from "../combat";
import { FALLEN, GESTURE_TIME, Gesture } from "../fighter";
import { t } from "../i18n";
import { effectiveStats } from "../stats";
import { TALKABLES, TALK_ZONE, pickTarget } from "../interact";
import { ARENA, groundHeight } from "../world";
import { clampToWalkable, sceneLayout } from "../sceneLayout";
import { separateDiscBodies } from "../collision";
import { Actor, setState } from "./actor";
import { emitBlood, emitSparks } from "./effects";
import { STYLE_NAME, flash, showMsg } from "./hud";
import { onPlayerDeath } from "./loop";
import { enemyDown, lockTarget } from "./enemies";
import { interruptSong, songState } from "./song";
import { fx, g, sfx } from "./state";
import { scene, world } from "./view";
import { takeLockedSceneItem } from "./sceneItems";
import { talkTo } from "./dialogue";

export function startAttack(a: Actor, kind: StrikeStyle | "bash", weight: StrikeWeight = "light", charging = false) {
  setState(a, "windup");
  a.attack = kind === "bash" ? BASH : makeAttack(a.weapon, styleFor(a.weapon, kind), weight);
  a.timing = { ...(a === g.player ? a.attack.timing : enemyAttackTiming(a.attack, a.level)) };
  a.charging = charging;
  a.extraRecovery = 0;
  if (a === g.player) g.playerAttackId++;
}

/** Rauhan ele alkaa: puhe (vilkutus) tai käyttö (tartunta). Vaikutus ratkeaa eleen keskellä (gestureEffect). */
export function startGesture(a: Actor, kind: Gesture) {
  setState(a, kind);
}

/**
 * Eleen vaikutus: kohde etsitään kantaman ja sektorin sisältä samoin kuin lyönnin kohde.
 * Puhe ilmoittaa maailmamoottorille `npc.talked` ja avaa dialogin, jos hahmolla on sellainen. Käyttö ratkaisee katseella
 * lukitun maailmanesineen tartuntaeleen vaikutushetkellä.
 */
function gestureEffect(a: Actor, kind: Gesture) {
  const from = { x: a.pos.x, z: a.pos.z, yaw: a.yaw };
  if (kind === "talk") {
    const target = pickTarget(from, TALKABLES, TALK_ZONE);
    g.events.push(`pelaaja:puhe:${target ? target.id : "ei kohdetta"}`);
    // Hahmolla, jolla on dialogi tässä kohtauksessa, puhe avaa sen; muille näytetään vain nimi.
    if (target && !talkTo(target.id, target.name)) showMsg(target.name, t("talk.listens"), 1.4);
  } else {
    takeLockedSceneItem();
  }
  if (g.events.length > 30) g.events.shift();
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
  if (a === g.player) { showMsg(t("combat.yourShieldBroke"), t("combat.blockWithSword"), 1.6); flash("#b33a2e", 0.25); }
  else showMsg(t("combat.shieldBroke"), "", 1.1);
}

export function lerpAngle(a: number, b: number, t: number) { return a + angleBetween(a, b) * t; }

export function moveActor(a: Actor, dir: THREE.Vector3, speed: number, dt: number) {
  if (dir.lengthSq() > 1) dir.normalize();
  const ox = a.pos.x, oz = a.pos.z;
  const moved = world.collision.moveDisc(ox, oz, dir.x * speed * dt, dir.z * speed * dt, a.radius, "slide");
  a.pos.x = moved.x;
  a.pos.z = moved.z;
  a.moveSpeed = dt > 0 ? Math.hypot(moved.x - ox, moved.z - oz) / dt : 0;
}

/**
 * Esityskerroksen ympäristöosuma. Kohteen ollessa oikeassa iskusektorissa este
 * etsitään hänen suuntaansa; muulloin aseen omaan etusuuntaan. Näin myös tyhjässä
 * rauhallisessa kohtauksessa kiveen tai pöytään lyöminen antaa palautteen.
 */
function resolveEnvironmentStrike(att: Actor, def: Actor | null) {
  const atk = att.attack;
  let x1 = att.pos.x + Math.sin(att.yaw) * atk.range;
  let z1 = att.pos.z + Math.cos(att.yaw) * atk.range;
  if (def) {
    const toDef = def.pos.clone().sub(att.pos);
    const geometry = {
      distance: def.pos.distanceTo(att.stepFrom),
      angleToDefender: angleBetween(att.yaw, Math.atan2(toDef.x, toDef.z)),
    };
    if (inStrikeZone(geometry, atk)) { x1 = def.pos.x; z1 = def.pos.z; }
  }
  const obstruction = world.collision.firstMeleeHit(att.pos.x, att.pos.z, x1, z1);
  if (!obstruction) return false;
  const contact = new THREE.Vector3(obstruction.x, groundHeight(obstruction.x, obstruction.z) + 1.05, obstruction.z);
  const isPlayer = att === g.player;
  g.events.push(`${isPlayer ? "pelaaja" : "vihollinen"}:${atk.kind}/${atk.weight}:environment:${obstruction.collider.id}`);
  if (g.events.length > 30) g.events.shift();
  emitSparks(contact, atk.weight === "heavy" ? 30 : 20, 3.5, "environment");
  sfx.hit();
  fx.hitstop = Math.max(fx.hitstop, 0.05);
  fx.shake = Math.max(fx.shake, 0.05);
  return true;
}

export function resolveStrike(att: Actor, def: Actor) {
  const toDef = def.pos.clone().sub(att.pos);
  // Kantama lasketaan paikasta, josta tukiaskel lähti: askel ei pidennä ulottumaa.
  const dist = def.pos.distanceTo(att.stepFrom);
  const angleToDefender = angleBetween(att.yaw, Math.atan2(toDef.x, toDef.z));
  const angleToAttacker = angleBetween(def.yaw, Math.atan2(-toDef.x, -toDef.z));
  const atk = att.attack;
  const defState = def.state;
  const geometry = { distance: dist, angleToDefender };
  const defender = {
    state: defState, blockStart: def.blockStart, angleToAttacker,
    shield: def.shield, stance: def.stance, blockArc: def.weapon.blockArc,
  };
  let res = resolveHit(geometry, defender, g.gameTime, atk);
  // Suoja-aika: juuri torjuttu isku pysäyttää hetken myös muiden lyöjien iskut edestä.
  const arc = def.shield ? def.shield.blockArc : def.weapon.blockArc;
  const graced = atk.kind !== "bash" && res === "hit" && defState !== "stagger" && defState !== "rooted"
    && graceCovers(g.gameTime, def.graceUntil, def.graceFrom === att, angleToAttacker, arc);
  if (graced) res = "blocked";
  else if (graceAfter(res) > 0) { def.graceUntil = g.gameTime + graceAfter(res); def.graceFrom = att; }
  const contact = att.pos.clone().lerp(def.pos, 0.55).setY(groundHeight(def.pos.x, def.pos.z) + 1.3);
  const isPlayer = att === g.player;
  const heavy = atk.weight === "heavy";
  const unarmouredDamage = strikeDamage(att.stats.power, atk, res, defState) * def.stats.damageTaken;
  const damage = damageAfterArmour(unarmouredDamage, def.armour.ringMail, def.armour.greaves);
  const helmetSaved = res === "hit" && helmetAbsorbsOverhead(
    atk.kind as StrikeStyle,
    atk.weight,
    def.fighter.hasHelmet,
    def.hp - damage <= 0,
    Math.random(),
  );
  if (helmetSaved) {
    const away = toDef.clone().setY(0).normalize();
    const side = new THREE.Vector3(away.z, 0, -away.x);
    const prop = def.fighter.knockHelmet(away.addScaledVector(side, Math.random() - 0.5));
    if (prop) { scene.add(prop.group); g.debris.push(prop); }
  } else def.hp -= damage;
  g.events.push(`${isPlayer ? "pelaaja" : "vihollinen"}:${atk.kind}/${atk.weight}:${res}${graced ? "+suoja" : ""}${helmetSaved ? "+kypärä" : ""}`);
  if (g.events.length > 30) g.events.shift();
  // Kilpi kuluu torjutuista iskuista: puolivälissä siihen tulee lovi, lopussa se hajoaa.
  const wear = shieldWear(atk, res, defender);
  if (wear > 0 && def.shield) {
    def.shieldHp -= wear;
    if (def.shieldHp <= 0) breakShield(def);
    else if (def.shieldHp <= def.shield.durability * def.shield.notchAt) def.fighter.setShieldNotch(true);
  }
  if (res === "blocked" || res === "parried") def.stamina = staminaAfterBlock(def.stamina);
  const died = def.hp <= 0;
  const pushed = atk.kind === "bash" && (res === "hit" || res === "guardbreak") && defState !== "rooted";
  if (pushed && !died) {
    const away = def.pos.clone().sub(att.pos).setY(0);
    if (away.lengthSq() < 0.0001) away.set(Math.sin(att.yaw), 0, Math.cos(att.yaw));
    def.bashPushDir.copy(away.normalize());
    def.bashPushLeft = Math.max(def.bashPushLeft, COMBAT.bashPushDistance);
  }
  if (def === g.player && songState && (res === "hit" || res === "guardbreak")) interruptSong();
  if (died) killActor(def, Math.abs(angleToAttacker) > Math.PI / 2);

  if (res === "hit") {
    if (helmetSaved) {
      sfx.clang(false);
      emitSparks(contact, 42, 5);
      fx.hitstop = heavy ? 0.12 : 0.08;
      fx.shake = 0.16;
      if (!isPlayer) flash("#d9a441", 0.18);
    } else {
      sfx.hit();
      fx.hitstop = heavy ? 0.11 : 0.07;
      fx.shake = (isPlayer ? 0.12 : 0.22) * (heavy ? 1.5 : atk.kind === "bash" ? 0.7 : 1);
      emitBlood(contact, heavy ? 32 : 20, 2.8);
      if (isPlayer) g.songPower = Math.min(COMBAT.songMax, g.songPower + COMBAT.songGainHit);
      else flash("#b33a2e", heavy ? 0.45 : atk.kind === "bash" ? 0.15 : 0.35);
    }
    if (!helmetSaved && !isPlayer && defState === "block" && !died) showMsg(t("combat.wrongBlock"), t("combat.strikePassed", { strike: STYLE_NAME[atk.kind] }), 0.9);
    // Lyhyt horjahdus keskeyttää noston; kilpityöntö pysäyttää myös jo alkaneen iskun.
    const interrupts = atk.kind === "bash" ? defState !== "rooted" : defState === "idle" || defState === "block" || defState === "windup";
    if (!died && interrupts) {
      setState(def, "stagger");
      def.stateTime = COMBAT.staggerTime - COMBAT.hitStagger;
    }
  } else if (res === "guardbreak") {
    sfx.clang(false);
    sfx.hit();
    emitSparks(contact, 36, 5);
    fx.hitstop = 0.08;
    fx.shake = 0.18;
    if (!died) {
      setState(def, "stagger");
      def.stateTime = COMBAT.staggerTime - COMBAT.guardbreakStagger;
    }
    // Murtaja toipuu nopeasti ja ehtii iskeä ennen kuin puolustaja saa suojan takaisin.
    att.extraRecovery = -COMBAT.guardbreakAdvantage;
    if (att.ai) att.ai.counter = true;
    if (isPlayer) showMsg(t("combat.guardBroke"), t("combat.strikeNow"), 0.9);
    else { showMsg(t("combat.yourGuardBroke"), "", 0.8); flash("#b33a2e", 0.2); }
  } else if (res === "blocked") {
    sfx.clang(false);
    emitSparks(contact, 32, 4);
    att.extraRecovery = COMBAT.blockRecoil;
    fx.shake = 0.08;
    if (isPlayer) showMsg(t("combat.blocked"), "", 0.6);
    else if (graced) showMsg(t("combat.guardHeld"), "", 0.6);
  } else if (res === "parried") {
    sfx.clang(true);
    emitSparks(contact, 56, 6);
    fx.hitstop = 0.14;
    fx.shake = 0.18;
    setState(att, "stagger");
    if (!isPlayer) {
      g.songPower = Math.min(COMBAT.songMax, g.songPower + COMBAT.songGainParry);
      showMsg(t("combat.parried"), t("combat.enemyStaggers"), 1);
      flash("#f0c766", 0.25);
    }
  } else if (res === "dodged" && !isPlayer) {
    showMsg(t("combat.dodged"), "", 0.5);
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

/** Yhteinen kaatuminen myös maailman vaaratekijöille (esim. nuotio). */
export function killActor(a: Actor, fromBehind = false) {
  if (a.state === "dead") return;
  setState(a, "dead");
  fallDown(a, fromBehind);
  if (a === g.player) onPlayerDeath();
  else enemyDown(a);
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
  if (a.state === "rooted") {
    // Suohon juuttuminen katkaisee myös jo alkaneen horjahduksen; liike ei jatku vapautuessa.
    a.bashPushLeft = 0;
  } else if (a.bashPushLeft > 0) {
    const step = bashPushStep(a.bashPushLeft, dt);
    const ox = a.pos.x, oz = a.pos.z;
    const moved = world.collision.moveDisc(a.pos.x, a.pos.z, a.bashPushDir.x * step, a.bashPushDir.z * step, a.radius, "stop");
    a.pos.x = moved.x;
    a.pos.z = moved.z;
    a.bashPushLeft -= step;
    if (dt > 0) a.moveSpeed = Math.hypot(moved.x - ox, moved.z - oz) / dt;
  }
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
      const moved = world.collision.moveDisc(a.pos.x, a.pos.z, Math.sin(a.yaw) * step, Math.cos(a.yaw) * step, a.radius, "stop");
      a.pos.x = moved.x;
      a.pos.z = moved.z;
    }
    // Jos ruutu hyppäsi osumahetken yli suoraan palautumiseen, isku ratkeaa silti.
    const lands = phase === "release" ? strikeLands(inRelease, t.release) : phase !== "windup" && a.state === "release";
    if (lands && !a.struck) {
      const target = strikeTarget(a);
      a.struck = true;
      if (!resolveEnvironmentStrike(a, target) && target) {
        resolveStrike(a, target);
        if ((a.state as ActionState) === "stagger") return; // täydellinen torjunta keskeytti
      }
    }
    if (phase === "recovery") a.state = "recovery";
    if (phase === "done") setState(a, "idle");
  } else if (a.state === "talk" || a.state === "use") {
    const T = GESTURE_TIME[a.state];
    if (!a.struck && a.stateTime >= T.effectAt) {
      a.struck = true;
      if (a === g.player) gestureEffect(a, a.state);
    }
    if (a.stateTime >= T.total) setState(a, "idle");
  } else if (a.state === "stagger") {
    if (a.stateTime >= COMBAT.staggerTime) setState(a, "idle");
  } else if (a.state === "dodge") {
    const moved = world.collision.moveDisc(a.pos.x, a.pos.z, a.dodgeDir.x * COMBAT.dodgeSpeed * dt, a.dodgeDir.z * COMBAT.dodgeSpeed * dt, a.radius, "stop");
    a.pos.x = moved.x;
    a.pos.z = moved.z;
    if (a.stateTime >= COMBAT.dodgeTime) setState(a, "idle");
  } else if (a.state === "rooted") {
    a.rootTime -= dt;
    if (a.rootTime <= 0) setState(a, "idle");
  }
}

/** Kohtauksen kuljettava alue (data: sceneLayout.ts). */
const LAYOUT = sceneLayout(ARENA);

/** Pitää taistelijat kuljettavalla alueella ja erillään toisistaan. */
export function keepApartAndInside(actors: Actor[]) {
  const alive = actors.filter((a) => a.state !== "dead");
  // Useampi kierros ratkaisee tilanteen, jossa toinen hahmo on puristettu seinää
  // vasten: seinä ei anna periksi, joten liike palautuu lopulta toiseen hahmoon.
  for (let pass = 0; pass < 5; pass++) {
    for (const a of alive) {
      const c = clampToWalkable(LAYOUT, a.pos.x, a.pos.z, a.radius + 0.1);
      a.pos.x = c.x; a.pos.z = c.z;
    }
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i], b = alive[j];
        const ab = { x: a.pos.x, z: a.pos.z, radius: a.radius, immovable: a.state === "rooted" };
        const bb = { x: b.pos.x, z: b.pos.z, radius: b.radius, immovable: b.state === "rooted" };
        if (!separateDiscBodies(ab, bb)) continue;
        a.pos.x = ab.x; a.pos.z = ab.z;
        b.pos.x = bb.x; b.pos.z = bb.z;
      }
    }
    for (const a of alive) {
      const solved = world.collision.depenetrateDisc(a.pos.x, a.pos.z, a.radius);
      a.pos.x = solved.x;
      a.pos.z = solved.z;
    }
  }
}
