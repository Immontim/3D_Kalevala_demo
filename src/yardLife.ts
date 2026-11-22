// Pihan eläinten arvonta käyntikertaa kohti (omistajan toive 2026-11-22). Puhdas moduuli:
// ei Three.js:ää eikä DOM:ia. `world.ts` antaa pihan rajaukset ja luo mallit tuloksen mukaan.
//
// - Kanoja 2–4 ja kukko. Kanat ovat enimmäkseen animoitua mallia (kana.glb) maassa kopin
//   ympärillä, joskus joku kauempana pihalla. Paikallaan oleva kana (kukko_kana.glb `kana_b`)
//   on korkeintaan yksi, ja se istuu orrella tai kopin katolla. Kukko on orrella tai katolla.
// - Koira on useimmiten emännän ja ruokapöydän luona, välillä portinpielessä tai muualla pihassa.

export interface Point { x: number; z: number }
export interface Circle extends Point { r: number }

/** Kanakopin sijainti ja suunta (sama muoto kuin world.ts:n Footprint: eteen = +lz). */
export interface CoopFrame { x: number; z: number; yaw: number }

export interface YardLifeContext {
  coop: CoopFrame;
  /** Emännän paikka: koira viihtyy hänen lähellään. */
  housewife: Point;
  /** Koiran muut mahdolliset paikat (portinpieli, nuotio, kopin edusta, talon ovi...). */
  dogSpots: readonly Point[];
  /** Onko kohta rakennuksen, aidan, nuotion tai polun päällä (world.ts:n `blocked`). */
  blocked: (x: number, z: number, pad: number) => boolean;
  /** Muut esteet, joiden päälle eläintä ei laiteta (emäntä, padat, vuode, seisova väki). */
  avoid: readonly Circle[];
  /** Aidan säde: eläimet pysyvät sen sisäpuolella. */
  fenceRadius: number;
}

export type Roost = "perch" | "roof";

export interface HenPlacement extends Point { yaw: number }
export interface YardAnimals {
  /** Maassa olevat animoidut kanat. */
  hens: HenPlacement[];
  /** Paikallaan oleva kana orrella tai katolla, tai null. */
  roostingHen: Roost | null;
  rooster: Roost;
  dog: HenPlacement;
}

/** Arvonnan todennäköisyydet ja etäisyydet. */
export const YARD_LIFE = {
  hens: [2, 4] as const,
  /** Todennäköisyys, että yksi kanoista on paikallaan istuva malli orrella tai katolla. */
  roostingHenChance: 0.3,
  /** Todennäköisyys, että kukko on orrella (muuten katolla). */
  roosterPerchChance: 0.7,
  /** Todennäköisyys, että maassa oleva kana on kopin sijaan kauempana pihalla. */
  farHenChance: 0.15,
  /** Kopin ympärys, jolla kanat kuopsuttavat (m kopin keskeltä). */
  nearCoop: [1.1, 3.4] as const,
  /** Todennäköisyys, että koira on emännän luona. */
  dogNearHousewife: 0.6,
  dogNearHousewifeDist: [1.1, 2.6] as const,
  /** Eläinten välinen vähimmäisväli. */
  spacing: 0.6,
} as const;

const TRIES = 40;

/** Paikallinen piste kopin koordinaatistossa (sivulle, eteen) maailmaan, kuten world.ts:n `fromLocal`. */
function fromCoop(c: CoopFrame, lx: number, lz: number): Point {
  const s = Math.sin(c.yaw), co = Math.cos(c.yaw);
  return { x: c.x + lx * co + lz * s, z: c.z - lx * s + lz * co };
}

function freeSpot(ctx: YardLifeContext, taken: readonly Circle[], p: Point, pad: number): boolean {
  if (Math.hypot(p.x, p.z) > ctx.fenceRadius - 0.9) return false;
  if (ctx.blocked(p.x, p.z, pad)) return false;
  for (const c of ctx.avoid) if (Math.hypot(p.x - c.x, p.z - c.z) < c.r + pad) return false;
  for (const c of taken) if (Math.hypot(p.x - c.x, p.z - c.z) < c.r + YARD_LIFE.spacing) return false;
  return true;
}

const between = (rng: () => number, [a, b]: readonly [number, number]) => a + (b - a) * rng();

export function planYardAnimals(ctx: YardLifeContext, rng: () => number = Math.random): YardAnimals {
  const count = YARD_LIFE.hens[0] + Math.floor(rng() * (YARD_LIFE.hens[1] - YARD_LIFE.hens[0] + 1));
  const rooster: Roost = rng() < YARD_LIFE.roosterPerchChance ? "perch" : "roof";
  const roostingHen: Roost | null = rng() < YARD_LIFE.roostingHenChance ? (rooster === "perch" ? "roof" : "perch") : null;
  const taken: Circle[] = [];

  const dog = placeDog(ctx, rng, taken);
  taken.push({ x: dog.x, z: dog.z, r: 0.35 });

  const hens: HenPlacement[] = [];
  const ground = count - (roostingHen ? 1 : 0);
  for (let i = 0; i < ground; i++) {
    const far = rng() < YARD_LIFE.farHenChance;
    for (let k = 0; k < TRIES; k++) {
      let p: Point;
      if (far) {
        // Kauempana: mikä tahansa vapaa kohta aidan sisällä.
        const a = rng() * Math.PI * 2, d = 2 + rng() * (ctx.fenceRadius - 3);
        p = { x: Math.sin(a) * d, z: Math.cos(a) * d };
      } else {
        // Kopin edustalla ja sivuilla (kulkulauta on edessä); kopin taakse aidan viereen ei.
        const a = (rng() - 0.5) * Math.PI * 1.25, d = between(rng, YARD_LIFE.nearCoop);
        p = fromCoop(ctx.coop, Math.sin(a) * d, Math.cos(a) * d);
      }
      if (!freeSpot(ctx, taken, p, 0.2)) continue;
      hens.push({ ...p, yaw: rng() * Math.PI * 2 });
      taken.push({ ...p, r: 0.2 });
      break;
    }
  }
  return { hens, roostingHen, rooster, dog };
}

function placeDog(ctx: YardLifeContext, rng: () => number, taken: readonly Circle[]): HenPlacement {
  const facing = (p: Point, t: Point) => Math.atan2(t.x - p.x, t.z - p.z);
  const nearHousewife = rng() < YARD_LIFE.dogNearHousewife;
  const tryNear = () => {
    for (let k = 0; k < TRIES; k++) {
      const a = rng() * Math.PI * 2, d = between(rng, YARD_LIFE.dogNearHousewifeDist);
      const p = { x: ctx.housewife.x + Math.sin(a) * d, z: ctx.housewife.z + Math.cos(a) * d };
      // Koira katsoo emäntää (ja ruokaa) tai vähän ohi.
      if (freeSpot(ctx, taken, p, 0.35)) return { ...p, yaw: facing(p, ctx.housewife) + (rng() - 0.5) * 0.8 };
    }
    return null;
  };
  const trySpot = () => {
    const order = ctx.dogSpots.map((s) => ({ s, k: rng() })).sort((a, b) => a.k - b.k).map((e) => e.s);
    for (const s of order) {
      for (let k = 0; k < 8; k++) {
        const p = { x: s.x + (rng() - 0.5) * 0.8, z: s.z + (rng() - 0.5) * 0.8 };
        // Muualla koira katsoo pihan keskelle, mistä kulkija tulee.
        if (freeSpot(ctx, taken, p, 0.35)) return { ...p, yaw: facing(p, { x: 0, z: 3 }) + (rng() - 0.5) * 1.2 };
      }
    }
    return null;
  };
  const dog = nearHousewife ? tryNear() ?? trySpot() : trySpot() ?? tryNear();
  // Viimeinen varapaikka on pihan keskiosa (vanha kiinteä paikka).
  return dog ?? { x: -1.7, z: -3.9, yaw: facing({ x: -1.7, z: -3.9 }, { x: 1, z: 3 }) };
}
