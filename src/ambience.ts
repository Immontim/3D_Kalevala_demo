// Äänimaiseman puhtaat säännöt (ei riippuvuuksia, joten testattavissa ilman selainta).

/** Etäisyys (m), jota lähempänä kuppikiveä linnut ovat täysin hiljaa. */
export const BIRDS_SILENT_WITHIN = 4;
/** Etäisyys (m), jonka päässä lintujen laulu on taas täydellä voimalla. */
export const BIRDS_FULL_BEYOND = 11;

/** Lintujen laulun taso 0..1 etäisyyden mukaan (smoothstep hiljaisesta täyteen). */
export function birdLevelAtDistance(distance: number): number {
  const t = Math.min(1, Math.max(0, (distance - BIRDS_SILENT_WITHIN) / (BIRDS_FULL_BEYOND - BIRDS_SILENT_WITHIN)));
  return t * t * (3 - 2 * t);
}
