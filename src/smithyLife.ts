/** Sepän pihan käyntikohtainen väkisuunnitelma. Puhdas moduuli pitää arvonnan testattavana. */

export type SmithySetup = "work" | "trade";

export interface SmithyYardSpot {
  key: string;
  child: { x: number; z: number; yaw: number };
  dog: { x: number; z: number; yaw: number };
}

/** Tarkistetut vapaat paikat aidatun pihan etelä- ja keskiosassa. */
export const SMITHY_TRADE_SPOTS: readonly SmithyYardSpot[] = [
  { key: "gate-west", child: { x: -3.8, z: 6.0, yaw: 2.65 }, dog: { x: -2.6, z: 5.6, yaw: -1.0 } },
  { key: "gate-east", child: { x: 2.7, z: 6.4, yaw: -2.75 }, dog: { x: 1.45, z: 5.95, yaw: 1.05 } },
  { key: "yard-centre", child: { x: -1.8, z: 1.8, yaw: 2.85 }, dog: { x: -0.55, z: 1.35, yaw: -1.0 } },
  { key: "house-side", child: { x: -7.0, z: 2.1, yaw: 2.0 }, dog: { x: -5.85, z: 2.75, yaw: -2.05 } },
];

export interface SmithyLifePlan {
  setup: SmithySetup;
  /** Vain kauppakokoonpanossa käytetty lapsen ja koiran paikka. */
  yardSpot: SmithyYardSpot | null;
}

export function planSmithyLife(rng: () => number = Math.random): SmithyLifePlan {
  const setup: SmithySetup = rng() < 0.5 ? "work" : "trade";
  if (setup === "work") return { setup, yardSpot: null };
  const i = Math.min(SMITHY_TRADE_SPOTS.length - 1, Math.floor(rng() * SMITHY_TRADE_SPOTS.length));
  return { setup, yardSpot: SMITHY_TRADE_SPOTS[i] };
}
