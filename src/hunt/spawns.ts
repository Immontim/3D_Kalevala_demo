// Riistan arvonta metsästyskohtaukseen ilman Three.js- tai DOM-riippuvuuksia. Jokaisella käynnillä
// eläimet ovat eri paikoissa: osa suoniityllä, osa paloaukealla ja loput minne sattuu.

/** Alue ellipsinä (säteet x- ja z-suunnassa, m). */
export interface SpawnZone { x: number; z: number; rx: number; rz: number }

export interface HareSpawnOptions {
  rng: () => number;
  bog: SpawnZone;
  burn: SpawnZone;
  /** Koko kohtauksen arvonta-alue (vapaat paikat). */
  anywhere: SpawnZone;
  /** Kelpaako paikka eläimelle (kuljettava alue, ei puun tai kiven sisällä). */
  valid(x: number, z: number): boolean;
  /** Sankarin aloituspaikka: sen lähelle ei arvota, ettei jänis pakene heti. */
  avoid: { x: number; z: number; radius: number };
}

/** Omistajan päätös 2026-11-21: 7–9 jänistä, joista 1–3 suolla ja 1–3 paloaukealla. */
export const HARE_SPAWN = {
  total: [7, 9] as const,
  bog: [1, 3] as const,
  burn: [1, 3] as const,
  /** Kahden jäniksen väli vähintään (m), jotta yksi pako ei säikäytä koko joukkoa. */
  minGap: 7,
  /** Paikkayrityksiä yhtä eläintä kohti ennen kuin vaatimusta väljennetään. */
  tries: 60,
};

const intIn = (rng: () => number, [lo, hi]: readonly [number, number]) => lo + Math.floor(rng() * (hi - lo + 1));

function pointIn(rng: () => number, zone: SpawnZone) {
  // Tasainen jakauma ellipsin sisällä.
  const a = rng() * Math.PI * 2, r = Math.sqrt(rng());
  return { x: zone.x + Math.sin(a) * zone.rx * r, z: zone.z + Math.cos(a) * zone.rz * r };
}

export interface HareSpot { x: number; z: number; zone: "bog" | "burn" | "anywhere" }

/** Arpoo jänisten paikat. Palauttaa aina vähintään alueiden minimimäärät, jos alueilla on tilaa. */
export function pickHareSpots(o: HareSpawnOptions): HareSpot[] {
  const total = intIn(o.rng, HARE_SPAWN.total);
  const bog = intIn(o.rng, HARE_SPAWN.bog);
  const burn = intIn(o.rng, HARE_SPAWN.burn);
  const plan: HareSpot["zone"][] = [
    ...Array<"bog">(bog).fill("bog"),
    ...Array<"burn">(burn).fill("burn"),
    ...Array<"anywhere">(Math.max(0, total - bog - burn)).fill("anywhere"),
  ];
  const out: HareSpot[] = [];
  for (const zone of plan) {
    const area = zone === "bog" ? o.bog : zone === "burn" ? o.burn : o.anywhere;
    // Ensin täysi väli muihin, sitten puolikas: tiheä alue ei jätä eläintä pois.
    for (const gap of [HARE_SPAWN.minGap, HARE_SPAWN.minGap / 2]) {
      let placed = false;
      for (let i = 0; i < HARE_SPAWN.tries; i++) {
        const p = pointIn(o.rng, area);
        if (Math.hypot(p.x - o.avoid.x, p.z - o.avoid.z) < o.avoid.radius) continue;
        if (!o.valid(p.x, p.z)) continue;
        if (out.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < gap)) continue;
        out.push({ ...p, zone });
        placed = true;
        break;
      }
      if (placed) break;
    }
  }
  return out;
}
