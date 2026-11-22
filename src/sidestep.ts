// Väistö sivu- tai taka-askeleena: johtava jalka astuu ensin liikkeen suuntaan, ja perässä tuleva
// jalka seuraa sen viereen (vaihtoaskel). Vartalo kulkee jalkojen keskellä, joten maassa oleva
// jalka ei liu'u. Puhdas moduuli: sama käyrä liikuttaa pelissä hahmoa (melee.ts) ja asettaa jalat (fighter.ts).

export const SIDESTEP = {
  /** Johtavan jalan askel päättyy tässä kohdassa väistöä (0–1). */
  leadEnd: 0.5,
  /**
   * Perässä tuleva jalka lähtee tässä kohdassa. Ei aiemmin kuin johtava jalka on laskeutunut: jos molemmat
   * ovat yhtä aikaa ilmassa, lantio laskeutuu alemman jalan varaan ja se laahaa maata (mitattu 0,56 m liukua).
   */
  trailStart: 0.5,
  /** Jalan nosto askeleen keskellä (m): sivuaskeleessa ja taka-askeleessa (matalampi ohitusaskel). */
  lift: 0.1, liftBack: 0.06,
  /** Polvien lisäkoukistus väistön keskellä (asennon crouch-yksikköinä). Iso arvo näytti sumokyykyltä. */
  crouch: 0.04,
  /** Lantion kallistus liikkeen suuntaan (rad). */
  roll: 0.06,
};

const smooth = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

export interface SidestepPose {
  /** Johtavan jalan, perässä tulevan jalan ja vartalon kulkema osuus koko matkasta (0–1). */
  lead: number; trail: number; body: number;
  /** Jalan nousu (0–1) heilahduksen aikana. */
  leadUp: number; trailUp: number;
}

/** Väistön vaihe u (0–1) jaloiksi ja vartaloksi. Alussa ja lopussa jalat ovat vartalon alla. */
export function sidestepPose(u: number): SidestepPose {
  const a = Math.min(1, Math.max(0, u / SIDESTEP.leadEnd));
  const b = Math.min(1, Math.max(0, (u - SIDESTEP.trailStart) / (1 - SIDESTEP.trailStart)));
  const lead = smooth(a), trail = smooth(b);
  return { lead, trail, body: (lead + trail) / 2, leadUp: Math.sin(Math.PI * a), trailUp: Math.sin(Math.PI * b) };
}

/**
 * Väistön suunta painetuista suuntanäppäimistä hahmon katseen suhteen: x = oikealle (+) tai vasemmalle (−),
 * back = taaksepäin. Pelkkä eteenpäin tai ei suuntaa = ei väistöä (null). Pituus on 1.
 */
export function dodgeDirection(left: boolean, right: boolean, back: boolean): { x: number; back: number } | null {
  const x = (right ? 1 : 0) - (left ? 1 : 0), bk = back ? 1 : 0;
  if (x === 0 && bk === 0) return null;
  const len = Math.hypot(x, bk);
  return { x: x / len, back: bk / len };
}
