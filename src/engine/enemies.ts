// Vastustajat kentällä: tuonti, kaatuminen ja kohteen valinta.
import * as THREE from "three";
import { WAVES, angleBetween } from "../combat";
import { FighterLook } from "../fighter";
import { effectiveStats } from "../stats";
import { Actor, makeActor, removeActor } from "./actor";
import { newAi } from "./ai";
import { Encounter } from "./encounter";
import { aim, g } from "./state";

export interface EnemyDef {
  name: string;
  look: FighterLook;
  /** Taso kasvattaa elämää, voimaa ja tekoälyn taitoa (aaltotaistelussa aallon numero). */
  level: number;
  /** Elämän kerroin (ryhmässä alle 1). */
  hpScale?: number;
  /** Tekoälyn taito, jos se eroaa tasosta (leirin aalloissa elämä ja voima pysyvät perusarvoissa, taito kasvaa). */
  aiLevel?: number;
}

/** Tuo vastustajan kentälle annettuun paikkaan. */
export function addEnemy(def: EnemyDef, pos: THREE.Vector3): Actor {
  const a = makeActor(def.look, pos, def.level, 0xff6a3a);
  a.name = def.name;
  // Saapuu rintama valmiiksi pelaajaa kohti: hidas kääntyjä ei ehtisi kääntyä ennen kohtaamista.
  a.yaw = Math.atan2(g.player.pos.x - pos.x, g.player.pos.z - pos.z);
  if (def.aiLevel !== undefined) a.level = def.aiLevel;
  if (def.hpScale !== undefined && def.hpScale !== 1) {
    a.base = { ...a.base, maxHp: Math.round(a.base.maxHp * def.hpScale) };
    a.stats = effectiveStats(a.base, a.mods, g.gameTime);
    a.hp = a.stats.maxHp;
  }
  a.ai = newAi();
  g.enemies.push(a);
  return a;
}

/** Vastustaja kaatui: se jää maahan ruumiina ja kohtaus saa tiedon. */
export function enemyDown(e: Actor) {
  const i = g.enemies.indexOf(e);
  if (i >= 0) g.enemies.splice(i, 1);
  g.corpses.push({ actor: e, removeAt: g.gameTime + WAVES.corpseTime });
  g.encounter.onEnemyDown(e);
}

/** Poistaa elossa olevat vastustajat kentältä jälkiä jättämättä. */
export function clearEnemies() {
  for (const e of g.enemies) removeActor(e);
  g.enemies.length = 0;
  aim.target = null;
}

/** Vaihtaa kohtauksen: vanhat vastustajat poistuvat ja uusi kohtaus alkaa. */
export function startEncounter(enc: Encounter) {
  clearEnemies();
  g.encounter = enc;
  enc.start();
}

/** Lähin elossa oleva vastustaja, tai null. */
export function nearestEnemy(from: THREE.Vector3 = g.player.pos): Actor | null {
  let best: Actor | null = null, bestD = Infinity;
  for (const e of g.enemies) {
    const d = e.pos.distanceToSquared(from);
    if (d < bestD) { best = e; bestD = d; }
  }
  return best;
}

/** Vastustaja, johon katse on lukittu, tai null. Kaatuneen tilalle lukitaan lähin. */
export function lockTarget(): Actor | null {
  if (!aim.lockOn) return null;
  if (!aim.target || !g.enemies.includes(aim.target)) aim.target = nearestEnemy();
  return aim.target;
}

/** Vastustaja, jota mittarit ja laulut koskevat: lukittu, tai muuten lähin. */
export function focusEnemy(): Actor | null {
  return lockTarget() ?? nearestEnemy();
}

/** Siirtää lukituksen seuraavaan vastustajaan ruudulla: dir 1 = oikealle, -1 = vasemmalle. */
export function cycleLock(dir: number) {
  if (g.enemies.length < 2) return;
  const p = g.player.pos;
  // Katseen suunnasta mitattu kulma kasvaa vasemmalle, joten järjestys käännetään: vasemmalta oikealle.
  const side = (e: Actor) => -angleBetween(aim.yaw, Math.atan2(e.pos.x - p.x, e.pos.z - p.z));
  const order = [...g.enemies].sort((a, b) => side(a) - side(b));
  const i = order.indexOf(lockTarget() ?? order[0]);
  aim.target = order[(i + dir + order.length) % order.length];
}
