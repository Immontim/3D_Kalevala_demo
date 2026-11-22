import * as THREE from "three";
import { BLOCK_RAISE, ENEMY_AI, STYLES, StrikeStyle, StrikeWeight, advancesInWindup, angleBetween, attackStartDelay, blockReactionDelay, canStrikeHeavy, exhausted, makeAttack, mayStartAttack, rollsAdvance, shouldShieldBash, styleFor, threatenedBy, timeToImpact, turnToward } from "../combat";
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
  /** Metsästä saapuva saa olla kuljettavan alueen ulkopuolella tähän pelin aikaan asti (−1 = ei saavu). */
  arriveUntil: number;
  /** Päätetty torjunta nousee tällä pelin hetkellä (oma reaktioviive; −1 = ei odottavaa torjuntaa). */
  blockAt: number;
  /** Tämän iskun noston aikana astutaan perääntyvän pelaajan perään (arvottu iskun alussa). */
  advance: boolean;
  /** Päätetty isku alkaa tällä pelin hetkellä (oma aloitusviive; −1 = ei odottavaa iskua), ja onko se nopea vastaisku. */
  attackAt: number;
  attackQuick: boolean;
  /** Hyökkäyskaton takia odottava pysyy kauempana tähän pelin aikaan asti. */
  waitUntil: number;
}

export function newAi(): Ai {
  return {
    // Ensimmäinen päätös arvotaan, ettei yhtä aikaa saapuva ryhmä päätä samassa ruudussa.
    decide: 1.0 + Math.random() * 0.6, strafeDir: Math.random() < 0.5 ? 1 : -1, reactedTo: -1, counter: false, reorient: false, resting: false,
    seen: g.player.pos.clone(), arriveUntil: -1, blockAt: -1, advance: false, attackAt: -1, attackQuick: false, waitUntil: -1,
  };
}
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
  // Vain Pohjan kilpisoturi käyttää kilpityöntöä: varmasti pitkään torjuvaa vastaan,
  // muuten pienellä satunnaisella mahdollisuudella lähietäisyydellä.
  const off = Math.abs(angleBetween(e.yaw, bearing(e.pos, g.player.pos)));
  if (shouldShieldBash(e.character === "pohja", !!e.shield, dist, off, playerTurtles(), quick, Math.random())) {
    return { kind: "bash", weight: "light" };
  }
  const kind = styleFor(e.weapon, STYLES[Math.floor(Math.random() * STYLES.length)]);
  // Pelkällä miekalla taisteleva lyö usein raskaasti, kilpimies harvoin.
  // Kilven takana seisovaa pelaajaa vastaan kaikki lyövät raskaasti: kilpi kuluu nopeammin.
  let heavy = e.loadout === "sword" ? ENEMY_AI.heavySword : e.loadout === "spear" ? ENEMY_AI.heavySpear : ENEMY_AI.heavyShield;
  if (playerTurtles() && g.player.shield) heavy = ENEMY_AI.heavyVsTurtle;
  const weight: StrikeWeight = !quick && canStrikeHeavy(e.stamina) && Math.random() < heavy ? "heavy" : "light";
  const a = makeAttack(e.weapon, kind, weight);
  // Ei lyödä, jos pelaaja on kiertänyt iskun kaaren ulkopuolelle: isku menisi ohi.
  return dist < a.range + 0.2 && dist > a.minRange + 0.1 && off < a.arc * 0.9 ? { kind, weight } : null;
}

/**
 * Hyökkäyskatto: saako tämä vastustaja aloittaa iskun juuri nyt. Lasketaan vain ne muut, jotka ovat
 * nostamassa tai lyömässä, joten paikan saa kuka tahansa asemissa oleva, kun lyöjiä on alle katon.
 */
function attackSlotFree(e: Actor) {
  let striking = 0;
  for (const o of g.enemies) if (o !== e && (o.state === "windup" || o.state === "release")) striking++;
  return mayStartAttack(striking);
}

/** Kuinka kauan vielä odotetaan, ennen kuin oma nosto saa alkaa toisen juuri alkaneen noston perään (0 = heti). */
function startSpacingLeft(e: Actor) {
  let left = 0;
  for (const o of g.enemies) if (o !== e && o.state === "windup") left = Math.max(left, ENEMY_AI.startSpacing - o.stateTime);
  return left;
}

function beginAttack(e: Actor, kind: StrikeStyle | "bash", weight: StrikeWeight) {
  startAttack(e, kind, weight);
  // Jokainen arpoo itse, astuuko tämän iskun noston aikana perääntyvän pelaajan perään.
  if (e.ai) e.ai.advance = rollsAdvance(kind, Math.random());
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

  // Odottava torjunta tai isku raukeaa, jos vastustaja ehti sillä välin lyödä, horjahtaa tai juuttua suohon.
  if (e.state !== "idle") { ai.blockAt = -1; ai.attackAt = -1; }

  if (e.state === "idle" && ai.reorient) {
    e.moveSpeed = 0;
  } else if (e.state === "idle") {
    // Reagoi pelaajan nostoon: torju joskus. Vain iskun edessä oleva harkitsee torjuntaa, ja jokainen
    // arpoo oman reaktioviiveensä, jotta ryhmän kilvet eivät nouse samassa ruudussa. Sivussa oleva
    // jatkaa liikettä ja voi aloittaa oman iskunsa; jos pelaaja kääntyy häntä kohti, hän reagoi silloin.
    const threatened = threatenedBy(angleBetween(g.player.yaw, bearing(g.player.pos, e.pos)), g.player.attack.arc);
    if (g.player.state === "windup" && ai.reactedTo !== g.playerAttackId && dist < 3.2 && threatened) {
      ai.reactedTo = g.playerAttackId;
      const delay = !exhausted(e.stamina) && Math.random() < blockChance(e)
        ? blockReactionDelay(timeToImpact(g.player.stateTime, g.player.timing), BLOCK_RAISE[e.loadout], Math.random())
        : null;
      if (delay !== null) ai.blockAt = g.gameTime + delay;
    }
    if (ai.blockAt >= 0 && g.gameTime >= ai.blockAt) {
      ai.blockAt = -1;
      const playerBusy = g.player.state === "windup" || g.player.state === "release";
      if (playerBusy && !exhausted(e.stamina)) {
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
    // Katon takia odottava jää hieman kauemmas, jotta lyöjillä on tilaa, ja pysyy siellä hetken katon vapauduttuakin.
    const slotFree = attackSlotFree(e);
    if (!slotFree) ai.waitUntil = g.gameTime + ENEMY_AI.waitHold;
    const waiting = g.gameTime < ai.waitUntil;
    const wantsBashRange = e.character === "pohja" && !!e.shield && playerTurtles();
    const want = (waiting ? ENEMY_AI.waitBack : 0) +(ai.resting ? ENEMY_AI.restDistance : spear ? ENEMY_AI.distSpear : wantsBashRange ? ENEMY_AI.distBash : ENEMY_AI.distSword);
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
    // Kaukaa tullaan suoraan kohti; kiertely alkaa vasta lähellä, ettei ryhmä saavu vinossa kaaressa.
    if (dist < ENEMY_AI.strafeRange) move.addScaledVector(side, 0.45);
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
    // Torjuntaa odottava ei aloita samalla omaa iskuaan. Hyökkäyskatto tarkistetaan sekä päätöksessä
    // että iskun alkaessa: jos kaksi ehti sillä välin aloittaa, kolmas jää odottamaan.
    const mayAttack = slotFree && ai.blockAt < 0 && (!ai.resting || dist < ENEMY_AI.restCornered) && g.player.state !== "dead";
    if (ai.attackAt >= 0) {
      // Jos joku toinen aloitti noston juuri äsken, oma isku siirtyy hieman, ettei kaksi nouse lähes samassa ruudussa.
      const wait = startSpacingLeft(e);
      if (wait > 0 && g.gameTime >= ai.attackAt) ai.attackAt = g.gameTime + wait + Math.random() * 0.05;
      else if (g.gameTime >= ai.attackAt) {
        ai.attackAt = -1;
        const pick = mayAttack ? pickEnemyAttack(e, dist, ai.attackQuick) : null;
        if (pick) beginAttack(e, pick.kind, pick.weight);
      }
    } else if (ai.counter && mayAttack && pickEnemyAttack(e, dist, true)) {
      // Vastaisku: jokainen torjunut arpoo oman viiveensä, jotta yhtä aikaa torjuneet eivät vastaa samassa ruudussa.
      ai.counter = false;
      ai.attackAt = g.gameTime + attackStartDelay(Math.random());
      ai.attackQuick = true;
    } else if (ai.decide <= 0) {
      ai.decide = ENEMY_AI.decideMin + Math.random() * ENEMY_AI.decideRandom;
      if (Math.random() < 0.25) ai.strafeDir *= -1;
      const pick = mayAttack ? pickEnemyAttack(e, dist) : null;
      if (pick && Math.random() < ENEMY_AI.attackChance) {
        ai.attackAt = g.gameTime + attackStartDelay(Math.random());
        ai.attackQuick = false;
      }
    }
  } else if (e.state === "windup" && advancesInWindup(ai.advance, dist, e.attack.range, angleBetween(e.yaw, bearing(e.pos, g.player.pos)))) {
    // Etenevä nosto: perääntyvän pelaajan perään astutaan katseen suuntaan hitaammin kuin pelaaja kävelee.
    // Sivulle kiertäminen pysäyttää etenemisen (advanceArc), ja kantaman sisällä seistään paikallaan.
    moveActor(e, new THREE.Vector3(Math.sin(e.yaw), 0, Math.cos(e.yaw)), e.stats.moveSpeed * ENEMY_AI.advanceScale, dt);
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
