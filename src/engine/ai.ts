import * as THREE from "three";
import { BASH, ENEMY_AI, STYLES, StrikeStyle, StrikeWeight, angleBetween, canStrikeHeavy, exhausted, makeAttack, mayStartAttack, styleFor, turnToward } from "../combat";
import { Actor, setState } from "./actor";
import { bearing } from "./camera";
import { moveActor, startAttack } from "./melee";
import { DEG, g } from "./state";

// ---------- Tekoäly ----------
export interface Ai {
  decide: number; strafeDir: number; reactedTo: number; counter: boolean;
  /** Suosta päässyt kääntyy vielä pelaajaa kohti. */ reorient: boolean;
  /** Uupunut: vetäytyy keräämään voimia. */ resting: boolean;
  /** Pelaajan paikka sellaisena kuin vastustaja sen hahmottaa: seuraa oikeaa paikkaa reaktioviiveen verran jäljessä. */
  seen: THREE.Vector3;
}

export function newAi(): Ai { return { decide: 1.2, strafeDir: Math.random() < 0.5 ? 1 : -1, reactedTo: -1, counter: false, reorient: false, resting: false, seen: g.player.pos.clone() }; }
// Tekoälyn luvut ovat taulukossa ENEMY_AI (combat.ts).


/** Kilpi torjuu useammin, keihäsmies harvemmin. */
export function blockChance(e: Actor) {
  const bonus = e.shield ? ENEMY_AI.blockShieldBonus : e.loadout === "spear" ? ENEMY_AI.blockSpearBonus : 0;
  return Math.min(ENEMY_AI.blockMax, ENEMY_AI.blockBase + ENEMY_AI.blockPerWave * e.level) + bonus;
}
/** Kuinka usein aseella torjuva vihollinen lukee iskun suunnan oikein. */
export function readChance(e: Actor) { return Math.min(ENEMY_AI.readMax, ENEMY_AI.readBase + ENEMY_AI.readPerWave * e.level); }

/** Pelaaja on seissyt torjunnassa niin pitkään, että suoja kannattaa murtaa. */
export function playerTurtles() { return g.player.state === "block" && g.gameTime - g.player.blockStart > ENEMY_AI.turtleTime; }

/** Minkä iskun vihollinen tältä etäisyydeltä aloittaisi, tai null jos mikään ei ylety. */
export function pickEnemyAttack(e: Actor, dist: number, quick = false): { kind: StrikeStyle | "bash"; weight: StrikeWeight } | null {
  // Kilpityöntö murtaa aseella torjuvan pelaajan suojan; kilpeä vastaan se ei auta.
  if (e.shield && !g.player.shield && playerTurtles() && dist < BASH.range - 0.1) return { kind: "bash", weight: "light" };
  const kind = styleFor(e.weapon, STYLES[Math.floor(Math.random() * STYLES.length)]);
  // Pelkällä miekalla taisteleva lyö usein raskaasti, kilpimies harvoin.
  // Kilven takana seisovaa pelaajaa vastaan kaikki lyövät raskaasti: kilpi kuluu nopeammin.
  let heavy = e.loadout === "sword" ? ENEMY_AI.heavySword : e.loadout === "spear" ? ENEMY_AI.heavySpear : ENEMY_AI.heavyShield;
  if (playerTurtles() && g.player.shield) heavy = ENEMY_AI.heavyVsTurtle;
  const weight: StrikeWeight = !quick && canStrikeHeavy(e.stamina) && Math.random() < heavy ? "heavy" : "light";
  const a = makeAttack(e.weapon, kind, weight);
  // Ei lyödä, jos pelaaja on kiertänyt iskun kaaren ulkopuolelle: isku menisi ohi.
  const off = Math.abs(angleBetween(e.yaw, bearing(e.pos, g.player.pos)));
  return dist < a.range + 0.2 && dist > a.minRange + 0.1 && off < a.arc * 0.9 ? { kind, weight } : null;
}

// Hyökkäysvuoro: viimeksi iskun aloittanut vastustaja ja hetki, josta alkaen toinen saa aloittaa.
let lastAttacker: Actor | null = null;
let attackFreeAt = 0;

function hasTurn(e: Actor) {
  const others = g.enemies.some((o) => o !== e && (o.state === "windup" || o.state === "release"));
  return mayStartAttack(others, g.gameTime, attackFreeAt, lastAttacker === e || !lastAttacker || !g.enemies.includes(lastAttacker));
}

function beginAttack(e: Actor, kind: StrikeStyle | "bash", weight: StrikeWeight) {
  startAttack(e, kind, weight);
  lastAttacker = e;
  attackFreeAt = g.gameTime + e.timing.windup + e.timing.release + ENEMY_AI.attackGap;
}

export function updateAi(e: Actor, dt: number) {
  const ai = e.ai;
  if (!ai) return;
  const toPlayer = g.player.pos.clone().sub(e.pos);
  const dist = toPlayer.length();
  // Vastustaja kääntyy sinne, missä se näkee pelaajan: hidas reaktio jättää kiertäjän sivulle.
  const r = e.stats.reaction;
  ai.seen.lerp(g.player.pos, r > 0 ? 1 - Math.exp(-dt / r) : 1);
  const facing = bearing(e.pos, ai.seen);
  if (e.state === "rooted") {
    // Suossa ei käännytä: pelaaja voi kiertää selän taakse.
    ai.reorient = true;
  } else if (ai.reorient) {
    // Suosta päässyt kääntyy pelaajaa kohti tasaista vauhtia eikä tee sinä aikana muuta.
    const diff = angleBetween(e.yaw, facing);
    const step = ENEMY_AI.reorientTurn * dt;
    e.yaw += Math.max(-step, Math.min(step, diff));
    if (Math.abs(diff) <= Math.max(step, ENEMY_AI.reorientDone)) ai.reorient = false;
  } else {
    const busy = e.state === "windup" || e.state === "release" || e.state === "recovery" || e.state === "stagger" || e.state === "dodge";
    e.yaw = turnToward(e.yaw, facing, e.stats.turnSpeed * DEG * (busy ? ENEMY_AI.attackTurnScale : 1) * dt);
  }

  if (e.state === "idle" && ai.reorient) {
    e.moveSpeed = 0;
  } else if (e.state === "idle") {
    // Reagoi pelaajan nostoon: torju joskus.
    if (g.player.state === "windup" && ai.reactedTo !== g.playerAttackId && dist < 3.2) {
      ai.reactedTo = g.playerAttackId;
      if (!exhausted(e.stamina) && Math.random() < blockChance(e)) {
        setState(e, "block");
        // Aseella torjuva arvaa iskun suunnan: myöhemmillä aalloilla useammin oikein.
        const real = g.player.attack.kind === "bash" ? "slash" : g.player.attack.kind;
        const wrong = STYLES.filter((st) => st !== real);
        e.stance = Math.random() < readChance(e) ? real : wrong[Math.floor(Math.random() * wrong.length)];
        e.blockStart = -99; // vihollinen ei tee täydellisiä torjuntoja
        return;
      }
    }
    // Liiku sopivalle etäisyydelle ja kierrä.
    // Keihäsmies pitää välimatkaa, kilpimies tulee iholle murtamaan pitkän torjunnan.
    if (exhausted(e.stamina)) ai.resting = true;
    else if (e.stamina >= Math.min(ENEMY_AI.restUntil, e.stats.maxStamina)) ai.resting = false;
    const spear = e.loadout === "spear";
    // Vuoroaan odottava jää hieman kauemmas, jotta lyöjällä on tilaa.
    const turn = hasTurn(e);
    const want = (turn ? 0 : ENEMY_AI.waitBack) + (ai.resting ? ENEMY_AI.restDistance : spear ? ENEMY_AI.distSpear : e.shield && !g.player.shield && playerTurtles() ? ENEMY_AI.distBash : ENEMY_AI.distSword);
    const dir = toPlayer.clone().normalize();
    if (g.enemies.length > 1) {
      // Ryhmässä ei kierretä sankarin selän taakse: sieltä palataan kylkeä kohti.
      const sideways = new THREE.Vector3(dir.z, 0, -dir.x);
      const off = (s: number) => Math.abs(angleBetween(g.player.yaw, bearing(g.player.pos, e.pos.clone().addScaledVector(sideways, s * 0.3))));
      if (off(0) > ENEMY_AI.flankMax * DEG) ai.strafeDir = off(1) < off(-1) ? 1 : -1;
    }
    const side = new THREE.Vector3(dir.z, 0, -dir.x).multiplyScalar(ai.strafeDir);
    const move = new THREE.Vector3();
    if (dist > want + 0.3) move.add(dir);
    else if (dist < want - 0.4) move.sub(dir);
    move.addScaledVector(side, 0.45);
    // Väli toisiin vastustajiin: ryhmä levittäytyy eikä seiso jonossa.
    for (const o of g.enemies) {
      if (o === e) continue;
      const away = e.pos.clone().sub(o.pos).setY(0);
      const d = away.length();
      if (d < ENEMY_AI.spread && d > 0.001) move.addScaledVector(away, (1 - d / ENEMY_AI.spread) * 1.2 / d);
    }
    // Kaukaa lähestytään juosten, ja keihäsmies perääntyy tavallista kävelyä nopeammin.
    const pace = dist > 4 ? ENEMY_AI.chaseScale : spear && dist < want - 0.4 ? ENEMY_AI.spearRetreatScale : 1;
    moveActor(e, move, e.stats.moveSpeed * pace, dt);

    ai.decide -= dt;
    // Lepäävä vastustaja ei hyökkää, ellei pelaaja tule iholle.
    const mayAttack = turn && (!ai.resting || dist < ENEMY_AI.restCornered);
    const counter = ai.counter && mayAttack ? pickEnemyAttack(e, dist, true) : null;
    if (counter) {
      ai.counter = false;
      beginAttack(e, counter.kind, counter.weight);
    } else if (ai.decide <= 0) {
      ai.decide = ENEMY_AI.decideMin + Math.random() * ENEMY_AI.decideRandom;
      if (Math.random() < 0.25) ai.strafeDir *= -1;
      const pick = mayAttack ? pickEnemyAttack(e, dist) : null;
      if (pick && g.player.state !== "dead" && Math.random() < (pick.kind === "bash" ? ENEMY_AI.bashChance : ENEMY_AI.attackChance)) beginAttack(e, pick.kind, pick.weight);
    }
  } else {
    e.moveSpeed = 0;
  }

  if (e.state === "block") {
    const playerBusy = g.player.state === "windup" || g.player.state === "release";
    if ((!playerBusy && e.stateTime > 0.25) || exhausted(e.stamina)) {
      setState(e, "idle");
      ai.counter = Math.random() < ENEMY_AI.counterChance;
    }
  }
}
