/** Sepän pajan kiinteä sijoittelu. Pisteet ovat pajan paikallisia Three.js-koordinaatteja:
 *  x = sivulle ja z = pihan keskustaa kohti. */

export interface SmithyPoint { x: number; z: number }

export const SMITHY_ANGLE = (155 * Math.PI) / 180;
export const SMITHY_RADIUS = 10.9;
export const SMITHY_YAW = SMITHY_ANGLE + Math.PI;
export const SMITHY_WALK_RADIUS = 12.35;

export const SMITHY_TABLE_LOCAL = { x: -1.25, z: 4.15 } as const;
export const SMITHY_WORK_LOCAL = {
  smith: { x: 0.35, z: 0.4 },
  apprentice: { x: -3.15, z: -0.9 },
  child: { x: 1.0, z: -0.55 },
} as const;
export const SMITHY_TRADE_SMITH_LOCAL = { x: -1.25, z: 2.55 } as const;
export const SMITHY_REAR_WALL_LOCAL = { x: 0, z: -2 } as const;

export const SMITHY_ORIGIN: SmithyPoint = {
  x: Math.sin(SMITHY_ANGLE) * SMITHY_RADIUS,
  z: Math.cos(SMITHY_ANGLE) * SMITHY_RADIUS,
};

export function smithyPoint(local: Readonly<SmithyPoint>): SmithyPoint {
  const s = Math.sin(SMITHY_YAW), c = Math.cos(SMITHY_YAW);
  return {
    x: SMITHY_ORIGIN.x + local.x * c + local.z * s,
    z: SMITHY_ORIGIN.z - local.x * s + local.z * c,
  };
}
