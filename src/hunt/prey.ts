// Riistaeläinten käytös ilman Three.js- tai DOM-riippuvuuksia: laidunnus, loikat, säikähdys ja pako.
// Havainto on jaettu näköön ja kuuloon, jotta tulevat eläimet (ja hiipiminen) voivat painottaa niitä
// eri tavoin. Jänis on ensimmäinen laji; uusi laji = uusi rivi SPECIES-taulukkoon.
import type { TextKey } from "../i18n";
import type { FoodId } from "../map/campaign";

export type SpeciesId = "hare";

export interface SpeciesDef {
  id: SpeciesId;
  nameKey: TextKey;
  /** Kaadetusta eläimestä poimittava saalis. */
  meat: { itemId: FoodId; quantity: number };
  /** Liikkeen törmäyssäde (m). */
  radius: number;
  /** Nuolen osumapallo: säde ja keskipisteen korkeus maasta (m). Hieman mallia suurempi. */
  hitRadius: number;
  hitHeight: number;
  senses: {
    /** Näkö: etäisyys (m) ja näkökentän leveys (astetta; 360 = näkee joka suuntaan). */
    sight: { range: number; fovDeg: number };
    /** Kuulo: ääni kuuluu, kun etäisyys <= äänen kantama × herkkyys. */
    hearing: { acuity: number };
  };
  /** Säikähdyksen jähmettyminen ennen pakoa (s). */
  alertTime: number;
  fleeSpeed: number;
  /** Pakojuoksun kesto (s) vähintään ja enintään. */
  fleeTime: [number, number];
  /** Pako jatkuu, kunnes uhka on vähintään näin kaukana (m). */
  safeDistance: number;
  /** Siksak: suunnan vaihtelu (rad) ja vaihtoväli (s). */
  zigAngle: number;
  zigEvery: [number, number];
  /** Laidunnus paikallaan (s) ja lyhyet loikat (m) kotipaikan lähellä. */
  grazeTime: [number, number];
  hopDistance: [number, number];
  hopSpeed: number;
  homeRadius: number;
}

export const SPECIES: Record<SpeciesId, SpeciesDef> = {
  hare: {
    id: "hare",
    nameKey: "hunt.species.hare",
    meat: { itemId: "hare_meat", quantity: 1 },
    radius: 0.2,
    hitRadius: 0.24,
    hitHeight: 0.2,
    // Omistajan päätös 2026-11-21: alkuun pako 12 m:stä. Näkö ja kuulo ovat silti erillisiä.
    senses: { sight: { range: 12, fovDeg: 360 }, hearing: { acuity: 1 } },
    alertTime: 0.18,
    // Omistajan pelitesti 2026-11-21: pako 20 % hitaammaksi (8,5 → 6,8 m/s), jotta pakenevaan ehtii tähdätä.
    fleeSpeed: 6.8,
    fleeTime: [2.2, 3.6],
    safeDistance: 24,
    zigAngle: 0.6,
    zigEvery: [0.35, 0.8],
    grazeTime: [1.8, 5.5],
    hopDistance: [0.6, 2.2],
    hopSpeed: 2.4,
    homeRadius: 5,
  },
};

export type PreyState = "graze" | "hop" | "alert" | "flee" | "dead";

export interface Prey {
  id: string;
  species: SpeciesId;
  x: number;
  z: number;
  /** Suunta, johon eläin katsoo (0 = +z, kuten hahmoilla). */
  yaw: number;
  state: PreyState;
  stateTime: number;
  /** Seuraavan päätöksen aikaraja tilan sisällä (s). */
  timer: number;
  home: { x: number; z: number };
  target: { x: number; z: number } | null;
  /** Mistä eläin pakenee (viimeisin havaittu uhka). */
  threat: { x: number; z: number } | null;
  zig: number;
  zigTimer: number;
  /** Nykyinen vauhti (m/s), loikkimisen animaatiota varten. */
  speed: number;
}

/** Havainto: näkyvä hahmo tai ääni. Äänen loudness = kantama metreinä. */
export type Stimulus =
  | { kind: "sight"; x: number; z: number }
  | { kind: "sound"; x: number; z: number; loudness: number };

export interface PreyEnv {
  /** Satunnaisluku 0..1 (testeissä kiinteä). */
  rng(): number;
  /** Liike esteet ja kuljettava alue huomioiden: palauttaa uuden paikan. */
  move(x: number, z: number, dx: number, dz: number, radius: number): { x: number; z: number };
}

const between = (env: PreyEnv, [a, b]: [number, number]) => a + (b - a) * env.rng();
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export function spawnPrey(id: string, species: SpeciesId, x: number, z: number, yaw = 0): Prey {
  return {
    id, species, x, z, yaw, state: "graze", stateTime: 0, timer: 1 + (id.length % 3),
    home: { x, z }, target: null, threat: null, zig: 0, zigTimer: 0, speed: 0,
  };
}

/** Huomaako eläin ärsykkeen. */
export function perceives(def: SpeciesDef, prey: Prey, s: Stimulus): boolean {
  const dx = s.x - prey.x, dz = s.z - prey.z;
  const dist = Math.hypot(dx, dz);
  if (s.kind === "sound") return dist <= s.loudness * def.senses.hearing.acuity;
  if (dist > def.senses.sight.range) return false;
  if (def.senses.sight.fovDeg >= 360 || dist < 1e-6) return true;
  const off = Math.abs(wrap(Math.atan2(dx, dz) - prey.yaw));
  return off <= (def.senses.sight.fovDeg * Math.PI) / 360;
}

function setState(p: Prey, state: PreyState, timer = 0) {
  p.state = state;
  p.stateTime = 0;
  p.timer = timer;
}

/** Tappaa eläimen (nuolen osuma). Kuollut ei enää liiku eikä havaitse. */
export function killPrey(p: Prey) {
  setState(p, "dead");
  p.speed = 0;
  p.target = null;
}

/** Kohta, jota kohti eläin pakenee: uhasta poispäin siksakin kulmalla. */
function fleeHeading(p: Prey): number {
  const t = p.threat ?? { x: p.x - Math.sin(p.yaw), z: p.z - Math.cos(p.yaw) };
  return Math.atan2(p.x - t.x, p.z - t.z) + p.zig;
}

/**
 * Yksi päivitysaskel. Palauttaa "startled", kun eläin säikähtää (alkaa paeta), muuten null.
 * Ärsykkeet ovat tämän ruudun havainnot: sankarin paikka ja kuuluneet äänet (nuolen isku).
 */
export function updatePrey(p: Prey, dt: number, stimuli: readonly Stimulus[], env: PreyEnv): "startled" | null {
  if (p.state === "dead") return null;
  const def = SPECIES[p.species];
  p.stateTime += dt;
  let event: "startled" | null = null;

  // Havainnot: lähin huomattu uhka. Pakeneva eläin päivittää uhan paikan mutta ei säikähdä uudelleen.
  let seen: { x: number; z: number } | null = null, best = Infinity;
  for (const s of stimuli) {
    if (!perceives(def, p, s)) continue;
    const d = Math.hypot(s.x - p.x, s.z - p.z);
    if (d < best) { best = d; seen = { x: s.x, z: s.z }; }
  }
  if (seen) {
    p.threat = seen;
    if (p.state === "graze" || p.state === "hop") {
      setState(p, "alert", def.alertTime);
      // Pää kohti uhkaa jähmettymisen ajaksi.
      p.yaw = Math.atan2(seen.x - p.x, seen.z - p.z);
      event = "startled";
    }
  }

  switch (p.state) {
    case "graze": {
      p.speed = 0;
      if (p.stateTime < p.timer) break;
      // Lyhyt loikka satunnaiseen suuntaan; kauas kotoa harhautunut palaa sitä kohti.
      const away = Math.hypot(p.x - p.home.x, p.z - p.home.z);
      const dir = away > def.homeRadius
        ? Math.atan2(p.home.x - p.x, p.home.z - p.z) + (env.rng() - 0.5) * 0.8
        : env.rng() * Math.PI * 2;
      const dist = between(env, def.hopDistance);
      p.target = { x: p.x + Math.sin(dir) * dist, z: p.z + Math.cos(dir) * dist };
      p.yaw = dir;
      setState(p, "hop", dist / def.hopSpeed + 0.6);
      break;
    }
    case "hop": {
      const t = p.target;
      const dx = t ? t.x - p.x : 0, dz = t ? t.z - p.z : 0;
      const d = Math.hypot(dx, dz);
      if (!t || d < 0.05 || p.stateTime > p.timer) {
        p.target = null;
        p.speed = 0;
        setState(p, "graze", between(env, def.grazeTime));
        break;
      }
      const step = Math.min(d, def.hopSpeed * dt);
      const moved = env.move(p.x, p.z, (dx / d) * step, (dz / d) * step, def.radius);
      p.speed = dt > 0 ? Math.hypot(moved.x - p.x, moved.z - p.z) / dt : 0;
      p.x = moved.x; p.z = moved.z;
      break;
    }
    case "alert": {
      p.speed = 0;
      if (p.stateTime < p.timer) break;
      p.zig = (env.rng() - 0.5) * 2 * def.zigAngle;
      p.zigTimer = between(env, def.zigEvery);
      setState(p, "flee", between(env, def.fleeTime));
      break;
    }
    case "flee": {
      p.zigTimer -= dt;
      if (p.zigTimer <= 0) {
        // Siksak: suunta vaihtaa puolta, ja vaihtojen väli vaihtelee.
        p.zig = -Math.sign(p.zig || 1) * def.zigAngle * (0.4 + 0.6 * env.rng());
        p.zigTimer = between(env, def.zigEvery);
      }
      const want = fleeHeading(p);
      p.yaw = want;
      const vx = Math.sin(want) * def.fleeSpeed * dt, vz = Math.cos(want) * def.fleeSpeed * dt;
      const moved = env.move(p.x, p.z, vx, vz, def.radius);
      const progress = Math.hypot(moved.x - p.x, moved.z - p.z);
      // Este edessä: käänny jyrkästi sivulle seuraavaksi askeleeksi.
      if (dt > 0 && progress < def.fleeSpeed * dt * 0.3) { p.zig += Math.PI / 2 * (env.rng() < 0.5 ? 1 : -1); p.zigTimer = 0.3; }
      p.speed = dt > 0 ? progress / dt : 0;
      p.x = moved.x; p.z = moved.z;
      const threatDist = p.threat ? Math.hypot(p.x - p.threat.x, p.z - p.threat.z) : Infinity;
      if (p.stateTime >= p.timer && threatDist >= def.safeDistance) {
        // Turvassa: uusi kotipaikka tähän, ja laidunnus jatkuu hetken päästä.
        p.home = { x: p.x, z: p.z };
        p.threat = null;
        p.speed = 0;
        setState(p, "graze", between(env, def.grazeTime) + 1.5);
      }
      break;
    }
  }
  return event;
}
