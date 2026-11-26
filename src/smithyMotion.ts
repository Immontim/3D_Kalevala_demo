export const HAMMER_PERIOD = 1.2;
export const BELLOWS_PERIOD = 1.0;

export interface MotionPoint { x: number; y: number; z: number }

/** Sama iskuajoitus kuin työanimaatiossa: nosto, nopea isku, kosketus ja paluu. */
export function hammerMotion(time: number) {
  const cycle = Math.floor(Math.max(0, time) / HAMMER_PERIOD);
  const phase = ((time % HAMMER_PERIOD) + HAMMER_PERIOD) % HAMMER_PERIOD / HAMMER_PERIOD;
  const mix = phase < 0.46 ? 0
    : phase < 0.62 ? smoothstep(phase, 0.46, 0.62)
      : phase < 0.74 ? 1
        : 1 - smoothstep(phase, 0.74, 1);
  return { cycle, phase, mix, impact: phase >= 0.62 && phase < 0.74 };
}

/**
 * Palkeiden todellinen kahvaliike kisällin omassa koordinaatistossa.
 * x = sivulle, y = ylös, z = eteen. Arvot tulevat smithy.py:n kannen geometriasta;
 * GLB:n morph target liikkuu avoimen ja suljetun päätepisteen välillä lineaarisesti.
 */
const HANDLE_OPEN = { y: 1.142521, z: 0.451783 } as const;
const HANDLE_SHUT = { y: 0.970389, z: 0.290847 } as const;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (x: number, a: number, b: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function handle(side: 1 | -1, weight: number): MotionPoint {
  return { x: side * 0.25, y: lerp(HANDLE_OPEN.y, HANDLE_SHUT.y, weight), z: lerp(HANDLE_OPEN.z, HANDLE_SHUT.z, weight) };
}

export function bellowsMotion(time: number) {
  const phase = ((time % BELLOWS_PERIOD) + BELLOWS_PERIOD) % BELLOWS_PERIOD / BELLOWS_PERIOD;
  const leftWeight = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
  const rightWeight = 1 - leftWeight;
  return {
    phase,
    leftWeight,
    rightWeight,
    left: handle(1, leftWeight),
    right: handle(-1, rightWeight),
  };
}
