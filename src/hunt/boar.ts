// Villisika: aggressiivinen riistaeläin ilman Three.js- tai DOM-riippuvuuksia. Tonkii ja kuljeskelee,
// huomaa sankarin ja joko vetäytyy tai varoittaa ja ryntää. Rynnäkkö kulkee lähes suoraan (viime
// hetken sivuväistö menee ohi), osuma horjuttaa sankaria, ja rynnäkön jälkeen sika toipuu ja valitsee
// uuden rynnäkön tai pakenee. Haavoittunut pakenee useammin ja kauemmas, jättää verijäljen ja asettuu
// lopulta makuulle. Omistajan päätökset 2026-11-22.

import type { FoodId } from "../map/campaign";

export type BoarState =
  | "root" | "walk" | "alert" | "threat" | "charge" | "recover" | "flinch" | "flee" | "bed" | "dead";

export const BOAR = {
  nameKey: "hunt.species.boar" as const,
  meat: { itemId: "boar_meat" as FoodId, quantity: [4, 6] as const },
  /** Elämä: täysin jännitetty nuoli tekee 1, joten kolme osumaa kaataa. */
  maxHp: 3,
  /** Törmäysympyrän säde (m) ja osumapallot rungon suuntaisesti (etu- ja takaosa). */
  radius: 0.42,
  hitSpheres: [{ along: 0.4, y: 0.6, r: 0.36 }, { along: -0.3, y: 0.58, r: 0.36 }] as const,
  /** Näkö ja kuulo (m). */
  sight: 15,
  hearing: 1.2,
  /** Terveen sian todennäköisyys rynnätä, kun se huomaa sankarin (muuten vetäytyy). */
  aggression: 0.35,
  alertTime: 0.5,
  /** Rynnäkön varoitus: pää alas, kuopii ja röhkii (s). Pelaajan merkki väistää tai tarttua aseeseen. */
  threatTime: 0.7,
  /** Suuttuneen sian lyhyempi varoitus (osuman jälkeen tai toisella rynnäköllä). */
  threatTimeAngry: 0.45,
  chargeSpeed: 9,
  /** Kääntyminen rynnäkössä (rad/s): pieni, joten viime hetken sivuaskel vie sankarin ohi. */
  chargeTurn: 1.1,
  chargeMaxTime: 3.2,
  /** Sankarin ohituksen jälkeen sika juoksee vielä näin pitkälle ennen jarrutusta (m). */
  overshoot: 3.5,
  /** Osuma sankariin: etäisyys (m) ja kulma rungon suunnasta (rad). */
  contactRange: 1.05,
  contactArc: 0.9,
  /** Rynnäkön vahinko ennen panssaria (sankarin elämä on noin 100). */
  damage: 22,
  recoverTime: 1.6,
  /** Pystyyn jäänyt rynnäkkö (puu, kivi): sika on pökerryksissä pidempään. */
  rammedTime: 2.4,
  flinchTime: 0.35,
  /** Rynnäkön jälkeinen pakotodennäköisyys: 50 % terveenä, enemmän haavoittuneena. */
  fleeAfterCharge: 0.5,
  /** Osuman jälkeinen pakotodennäköisyys: ensin harvoin (suuttuu), haavoittuneena useammin. */
  fleeAfterHit: 0.15,
  /** Lisä pakotodennäköisyyteen täydellä vahingolla (lineaarisesti menetetyn elämän mukaan). */
  woundFlee: 0.4,
  fleeSpeed: 7,
  /** Terve sika pakenee näin pitkälle (m), haavoittunut selvästi pidemmälle (jänis noin 24). */
  fleeDistance: 34,
  woundedFleeDistance: [70, 100] as const,
  walkSpeed: 1.2,
  rootTime: [3, 8] as const,
  wander: [1, 4] as const,
  homeRadius: 8,
  /** Haavoittunut makaa näin kauan pakonsa päässä (s) ja huomaa sankarin vain lähempää (m). */
  bedTime: [25, 50] as const,
  bedSight: 9,
  /** Makaavan haavoittuneen todennäköisyys rynnätä, kun sankari tulee lähelle ("ahdistettu"). */
  bedCharge: 0.5,
  /** Verijälki: tippa näin monen kuljetun metrin välein haavoittuneesta. */
  bloodEvery: 1.4,
};

export interface Boar {
  id: string;
  x: number;
  z: number;
  /** Suunta, johon sika katsoo (0 = +z, kuten hahmoilla). */
  yaw: number;
  state: BoarState;
  stateTime: number;
  timer: number;
  home: { x: number; z: number };
  target: { x: number; z: number } | null;
  hp: number;
  speed: number;
  /** Viimeksi havaittu sankarin paikka (pako ja rynnäkkö). */
  threat: { x: number; z: number } | null;
  /** Rynnäkkö: osuiko jo sankariin (yksi osuma rynnäkköä kohti) ja ohitettiinko hänet. */
  chargeHit: boolean;
  passed: boolean;
  /** Pako: kuljettu ja tavoiteltu matka (m). */
  travelled: number;
  fleeGoal: number;
  /** Rynnäkön jälkeen suuttunut: seuraava varoitus on lyhyempi. */
  angry: boolean;
  bloodAcc: number;
  /** Pakoreitin kierto esteen ohi: sekunteja, joina sika pitää uuden suuntansa. */
  detour: number;
  /** Kaadetussa jäljellä olevat lihapalat. */
  meat: number;
}

export interface BoarEnv {
  rng: () => number;
  /** Liike esteiden ja kohtauksen rajan kanssa: palauttaa uuden paikan. */
  move(x: number, z: number, dx: number, dz: number, radius: number): { x: number; z: number };
}

/** Sankari sian näkökulmasta. `hittable` = ei väistöaskeleella eikä kaatunut. */
export interface BoarHero { x: number; z: number; alive: boolean; hittable: boolean }
export interface BoarSound { x: number; z: number; loudness: number }

export type BoarEvent =
  | { kind: "noticed" }
  | { kind: "threat" }
  | { kind: "charge" }
  | { kind: "contact"; dirX: number; dirZ: number }
  | { kind: "rammed" }
  | { kind: "flee" }
  | { kind: "blood"; x: number; z: number };

export function spawnBoar(id: string, x: number, z: number, yaw = 0): Boar {
  return {
    id, x, z, yaw, state: "root", stateTime: 0, timer: 2 + (id.length % 3), home: { x, z }, target: null,
    hp: BOAR.maxHp, speed: 0, threat: null, chargeHit: false, passed: false, travelled: 0, fleeGoal: 0,
    angry: false, bloodAcc: 0, detour: 0, meat: 0,
  };
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const between = (rng: () => number, [lo, hi]: readonly [number, number]) => lo + rng() * (hi - lo);

export function boarWounded(b: Boar): boolean { return b.hp < BOAR.maxHp && b.state !== "dead"; }
/** Menetetty elämä 0..1. */
export function boarDamage(b: Boar): number { return Math.min(1, Math.max(0, (BOAR.maxHp - b.hp) / BOAR.maxHp)); }

/** Onko sika juuri nyt vaarallinen (varoittaa, ryntää, toipuu rynnäköstä tai osumasta). */
export function boarDangerous(b: Boar): boolean {
  return b.state === "threat" || b.state === "charge" || b.state === "recover" || (b.state === "flinch" && b.angry);
}

function setState(b: Boar, state: BoarState, timer = 0) {
  b.state = state;
  b.stateTime = 0;
  b.timer = timer;
}

function startThreat(b: Boar) {
  setState(b, "threat", b.angry ? BOAR.threatTimeAngry : BOAR.threatTime);
  b.speed = 0;
}

function startFlee(b: Boar, env: BoarEnv, farther = false) {
  setState(b, "flee");
  b.travelled = 0;
  b.fleeGoal = boarWounded(b) || farther ? between(env.rng, BOAR.woundedFleeDistance) : BOAR.fleeDistance;
}

/** Päätös: pako (todennäköisyys p) tai uusi rynnäkkö. */
function decide(b: Boar, env: BoarEnv, p: number, events: BoarEvent[]) {
  if (env.rng() < p) { startFlee(b, env); events.push({ kind: "flee" }); }
  else { b.angry = true; startThreat(b); events.push({ kind: "threat" }); }
}

/**
 * Osuma nuolesta tai aseesta. Palauttaa "dead", kun sika kaatuu (lihamäärä arvotaan), muuten "hurt":
 * sika hätkähtää hetken ja valitsee sitten rynnäkön tai paon (haavoittuneena useammin paon).
 */
export function damageBoar(b: Boar, amount: number, from: { x: number; z: number }, rng: () => number = Math.random): "dead" | "hurt" | "none" {
  if (b.state === "dead") return "none";
  b.hp -= amount;
  b.threat = { ...from };
  if (b.hp <= 1e-6) {
    b.hp = 0;
    setState(b, "dead");
    b.speed = 0;
    const [lo, hi] = BOAR.meat.quantity;
    b.meat = lo + Math.min(hi - lo, Math.floor(rng() * (hi - lo + 1)));
    return "dead";
  }
  b.angry = true;
  // Rynnäkkö jatkuu osumasta huolimatta: vahvan eläimen vauhti ei pysähdy nuoleen.
  if (b.state !== "charge") { setState(b, "flinch", BOAR.flinchTime); b.speed *= 0.3; }
  return "hurt";
}

function sees(b: Boar, hero: BoarHero | null, range: number): boolean {
  return !!hero && hero.alive && Math.hypot(hero.x - b.x, hero.z - b.z) <= range;
}

function hears(b: Boar, sounds: readonly BoarSound[]): BoarSound | null {
  return sounds.find((s) => Math.hypot(s.x - b.x, s.z - b.z) <= s.loudness * BOAR.hearing) ?? null;
}

/** Liikuttaa sikaa suuntaan yaw nopeudella speed; palauttaa todellisen kuljetun matkan. */
function travel(b: Boar, env: BoarEnv, dt: number): number {
  const dx = Math.sin(b.yaw) * b.speed * dt, dz = Math.cos(b.yaw) * b.speed * dt;
  const m = env.move(b.x, b.z, dx, dz, BOAR.radius);
  const moved = Math.hypot(m.x - b.x, m.z - b.z);
  b.x = m.x;
  b.z = m.z;
  return moved;
}

const turnToward = (from: number, to: number, max: number) => {
  const d = wrap(to - from);
  return from + Math.max(-max, Math.min(max, d));
};

/** Yksi päivitysaskel. Palauttaa tapahtumat, joihin pelimoottori reagoi (ääni, vahinko, verijälki). */
export function updateBoar(b: Boar, dt: number, hero: BoarHero | null, sounds: readonly BoarSound[], env: BoarEnv): BoarEvent[] {
  const events: BoarEvent[] = [];
  if (b.state === "dead") return events;
  b.stateTime += dt;
  const heroBearing = hero ? Math.atan2(hero.x - b.x, hero.z - b.z) : b.yaw;
  const heroDist = hero ? Math.hypot(hero.x - b.x, hero.z - b.z) : Infinity;
  if (hero && sees(b, hero, BOAR.sight * 1.5)) b.threat = { x: hero.x, z: hero.z };

  const calm = b.state === "root" || b.state === "walk";
  if (calm) {
    const sound = hears(b, sounds);
    if (sees(b, hero, BOAR.sight) || sound) {
      if (sound && !sees(b, hero, BOAR.sight)) b.threat = { x: sound.x, z: sound.z };
      setState(b, "alert", BOAR.alertTime);
      b.speed = 0;
      events.push({ kind: "noticed" });
    }
  }

  let moved = 0;
  switch (b.state) {
    case "root": {
      b.speed = 0;
      if (b.stateTime >= b.timer) {
        const a = env.rng() * Math.PI * 2, d = between(env.rng, BOAR.wander);
        let tx = b.x + Math.sin(a) * d, tz = b.z + Math.cos(a) * d;
        // Kotipaikan ulkopuolelta käännytään kotia kohti.
        if (Math.hypot(tx - b.home.x, tz - b.home.z) > BOAR.homeRadius) {
          const h = Math.atan2(b.home.x - b.x, b.home.z - b.z);
          tx = b.x + Math.sin(h) * d;
          tz = b.z + Math.cos(h) * d;
        }
        b.target = { x: tx, z: tz };
        setState(b, "walk", 6);
      }
      break;
    }
    case "walk": {
      const t = b.target;
      if (!t) { setState(b, "root", between(env.rng, BOAR.rootTime)); break; }
      b.yaw = turnToward(b.yaw, Math.atan2(t.x - b.x, t.z - b.z), 3 * dt);
      b.speed = BOAR.walkSpeed;
      moved = travel(b, env, dt);
      if (Math.hypot(t.x - b.x, t.z - b.z) < 0.3 || b.stateTime > b.timer || (dt > 0 && moved < b.speed * dt * 0.2)) {
        b.target = null;
        setState(b, "root", between(env.rng, BOAR.rootTime));
      }
      break;
    }
    case "alert": {
      if (b.threat) b.yaw = turnToward(b.yaw, Math.atan2(b.threat.x - b.x, b.threat.z - b.z), 5 * dt);
      if (b.stateTime >= b.timer) {
        // Terve sika ryntää vain osan ajasta; muuten se vetäytyy. Haavoittunut pakenee useammin.
        const charge = hero && sees(b, hero, BOAR.sight * 1.2) && env.rng() < BOAR.aggression * (1 - boarDamage(b));
        if (charge) { startThreat(b); events.push({ kind: "threat" }); }
        else { startFlee(b, env); events.push({ kind: "flee" }); }
      }
      break;
    }
    case "threat": {
      b.speed = 0;
      if (hero) b.yaw = turnToward(b.yaw, heroBearing, 6 * dt);
      if (b.stateTime >= b.timer) {
        if (!hero || !hero.alive) { setState(b, "root", between(env.rng, BOAR.rootTime)); break; }
        setState(b, "charge", BOAR.chargeMaxTime);
        b.chargeHit = false;
        b.passed = false;
        events.push({ kind: "charge" });
      }
      break;
    }
    case "charge": {
      b.speed = Math.min(BOAR.chargeSpeed, b.speed + BOAR.chargeSpeed * 3 * dt);
      if (hero && !b.passed) {
        const ahead = Math.cos(wrap(heroBearing - b.yaw)) * heroDist;
        // Kun sankari jää taakse, sika ei enää käänny (sitoutunut rynnäkkö).
        if (ahead < 0) b.passed = true;
        else if (heroDist > 1.5) b.yaw = turnToward(b.yaw, heroBearing, BOAR.chargeTurn * dt);
      }
      moved = travel(b, env, dt);
      if (hero && hero.alive && hero.hittable && !b.chargeHit && heroDist <= BOAR.contactRange
        && Math.abs(wrap(heroBearing - b.yaw)) <= BOAR.contactArc) {
        b.chargeHit = true;
        events.push({ kind: "contact", dirX: Math.sin(b.yaw), dirZ: Math.cos(b.yaw) });
      }
      const blocked = b.stateTime > 0.3 && dt > 0 && moved < b.speed * dt * 0.3;
      if (blocked) {
        setState(b, "recover", BOAR.rammedTime);
        b.speed = 0;
        events.push({ kind: "rammed" });
        break;
      }
      const behind = b.passed && heroDist >= BOAR.overshoot;
      if (behind || b.stateTime >= b.timer) setState(b, "recover", BOAR.recoverTime);
      break;
    }
    case "recover": {
      b.speed = Math.max(0, b.speed - BOAR.chargeSpeed * 2 * dt);
      moved = travel(b, env, dt);
      if (b.speed < 1 && hero) b.yaw = turnToward(b.yaw, heroBearing, 2.5 * dt);
      if (b.stateTime >= b.timer) {
        if (!hero || !hero.alive || heroDist > BOAR.sight * 1.5) { setState(b, "root", between(env.rng, BOAR.rootTime)); break; }
        decide(b, env, BOAR.fleeAfterCharge + BOAR.woundFlee * boarDamage(b), events);
      }
      break;
    }
    case "flinch": {
      b.speed = Math.max(0, b.speed - 10 * dt);
      if (b.stateTime >= b.timer) {
        if (!hero || !hero.alive) { startFlee(b, env); events.push({ kind: "flee" }); break; }
        decide(b, env, BOAR.fleeAfterHit + (BOAR.woundFlee + 0.2) * boarDamage(b), events);
      }
      break;
    }
    case "flee": {
      const t = b.threat;
      const away = t ? Math.atan2(b.x - t.x, b.z - t.z) : b.yaw;
      // Pieni kaari: sika ei juokse viivasuoraan, mutta pitää suunnan poispäin uhasta.
      const want = away + Math.sin(b.stateTime * 0.9 + b.id.length) * 0.35;
      // Kierto esteen tai kohtauksen reunan ohi: uusi suunta pidetään hetki, ettei sika kääntyisi
      // heti takaisin samaan esteeseen.
      if (b.detour > 0) b.detour -= dt;
      else b.yaw = turnToward(b.yaw, want, 2.2 * dt);
      b.speed = Math.min(BOAR.fleeSpeed, b.speed + BOAR.fleeSpeed * 2 * dt);
      moved = travel(b, env, dt);
      b.travelled += moved;
      // Este edessä: käännös sivulle (satunnaisesti kumpaan), jottei sika jää jumiin.
      if (dt > 0 && b.stateTime > 0.3 && b.detour <= 0.6 && moved < b.speed * dt * 0.3) {
        b.yaw += (Math.PI / 2) * (env.rng() < 0.5 ? 1 : -1);
        b.detour = 1.4;
      }
      if (b.travelled >= b.fleeGoal) {
        b.home = { x: b.x, z: b.z };
        b.angry = false;
        if (boarWounded(b)) setState(b, "bed", between(env.rng, BOAR.bedTime));
        else setState(b, "root", between(env.rng, BOAR.rootTime));
        b.speed = 0;
      }
      break;
    }
    case "bed": {
      b.speed = 0;
      if (sees(b, hero, BOAR.bedSight)) {
        // Ahdistettu haavoittunut: ryntää tai pakenee taas kauas.
        if (env.rng() < BOAR.bedCharge) { b.angry = true; startThreat(b); events.push({ kind: "threat" }); }
        else { startFlee(b, env, true); events.push({ kind: "flee" }); }
      } else if (b.stateTime >= b.timer) setState(b, "root", between(env.rng, BOAR.rootTime));
      break;
    }
  }

  // Verijälki: haavoittunut tiputtaa verta liikkuessaan, joten paennutta voi seurata.
  if (boarWounded(b) && moved > 0) {
    b.bloodAcc += moved;
    if (b.bloodAcc >= BOAR.bloodEvery) {
      b.bloodAcc = 0;
      events.push({ kind: "blood", x: b.x, z: b.z });
    }
  }
  return events;
}

/** Kuinka monta lihapalaa ruhosta otetaan, kun inventaarioon mahtuu `fits(n)`: suurin mahtuva. */
export function boarMeatToTake(b: Boar, fits: (n: number) => boolean): number {
  for (let n = b.meat; n > 0; n--) if (fits(n)) return n;
  return 0;
}

/** Osumapallot maailmassa (nuolet ja lyönnit): keskipisteet rungon suuntaisesti. */
export function boarHitSpheres(b: Boar, groundY: number): { x: number; y: number; z: number; r: number }[] {
  const dead = b.state === "dead";
  return BOAR.hitSpheres.map((s) => ({
    x: b.x + Math.sin(b.yaw) * s.along,
    y: groundY + (dead ? 0.3 : s.y),
    z: b.z + Math.cos(b.yaw) * s.along,
    r: dead ? s.r * 0.9 : s.r,
  }));
}

/** Nuolen vahinko jännityksen mukaan: täysi jännitys 1, vajaa vähemmän (vähintään 0,5). */
export function arrowDamage(draw: number): number {
  return 0.5 + 0.5 * Math.min(1, Math.max(0, draw));
}

/** Lähitaistelun vahinko sialle: keihäs on sianmetsästyksen ase, raskas isku tekee enemmän. */
export function meleeBoarDamage(weapon: "sword" | "spear" | "sky_iron_sword", heavy: boolean): number {
  const base = weapon === "spear" ? 1.25 : weapon === "sky_iron_sword" ? 1.2 : 1;
  return base * (heavy ? 1.5 : 1);
}

/** Apajan sikamäärä: 40 % ei yhtään, 40 % yksi, 20 % kaksi. */
export function boarCount(r: number): number {
  return r < 0.4 ? 0 : r < 0.8 ? 1 : 2;
}
