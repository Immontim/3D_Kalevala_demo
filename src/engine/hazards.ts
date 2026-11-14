// Maailman läpikuljettavat vaara-alueet. Kiinteä törmäys (esim. nuotion
// kivikehä) ratkaistaan collision.ts:ssä, mutta lämpö voi ulottua sen ulkopuolelle.
import { COLLISION } from "../collision";
import type { Actor } from "./actor";
import { flash } from "./hud";
import { killActor } from "./melee";
import { g } from "./state";
import { world } from "./view";

const feedbackAt = new WeakMap<Actor, number>();

export function updateHazards(actors: Actor[], dt: number) {
  if (dt <= 0) return;
  for (const a of [...actors]) {
    if (a.state === "dead") continue;
    const zones = world.collision.hazardsAt(a.pos.x, a.pos.z, a.radius);
    if (!zones.length) continue;
    for (const zone of zones) a.hp -= zone.damagePerSecond * dt * a.stats.damageTaken;

    const next = feedbackAt.get(a) ?? 0;
    if (g.gameTime >= next) {
      feedbackAt.set(a, g.gameTime + COLLISION.fireFeedbackGap);
      const who = a === g.player ? "pelaaja" : "vihollinen";
      g.events.push(`${who}:hazard:${zones.map((z) => z.id).join("+")}`);
      if (g.events.length > 30) g.events.shift();
      if (a === g.player) flash("#e36b2c", 0.16);
    }
    if (a.hp <= 0) killActor(a);
  }
}
