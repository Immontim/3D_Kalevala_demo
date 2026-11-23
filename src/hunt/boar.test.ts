import { describe, expect, it } from "vitest";
import {
  BOAR, type BoarEnv, type BoarEvent, type BoarHero, arrowDamage, boarCount, boarDangerous, boarMeatToTake,
  damageBoar, meleeBoarDamage, spawnBoar, updateBoar,
} from "./boar";

const free = (r = 0.5): BoarEnv => ({ rng: () => r, move: (x, z, dx, dz) => ({ x: x + dx, z: z + dz }) });
const hero = (x: number, z: number, hittable = true): BoarHero => ({ x, z, alive: true, hittable });

function run(b: ReturnType<typeof spawnBoar>, seconds: number, h: BoarHero | null | (() => BoarHero), env: BoarEnv) {
  const events: BoarEvent[] = [];
  for (let t = 0; t < seconds; t += 0.02) {
    events.push(...updateBoar(b, 0.02, typeof h === "function" ? h() : h, [], env));
  }
  return events;
}

describe("villisian havainto", () => {
  it("tonkii ja kuljeskelee kotipaikan lähellä, kun ketään ei näy", () => {
    const b = spawnBoar("b", 0, 0);
    const seen = new Set<string>();
    for (let t = 0; t < 60; t += 0.05) { updateBoar(b, 0.05, null, [], free(0.3)); seen.add(b.state); }
    expect(seen.has("root")).toBe(true);
    expect(seen.has("walk")).toBe(true);
    expect(Math.hypot(b.x, b.z)).toBeLessThan(BOAR.homeRadius + BOAR.wander[1] + 0.5);
  });

  it("huomaa sankarin 15 metristä ja vetäytyy, kun ei ole aggressiivinen", () => {
    const b = spawnBoar("b", 0, 0);
    const events = run(b, BOAR.alertTime + 0.1, hero(0, -14), free(0.9));
    expect(events.some((e) => e.kind === "noticed")).toBe(true);
    expect(b.state).toBe("flee");
    expect(b.fleeGoal).toBe(BOAR.fleeDistance);
  });

  it("aggressiivinen sika varoittaa ja ryntää", () => {
    const b = spawnBoar("b", 0, 0);
    const events = run(b, BOAR.alertTime + BOAR.threatTime + 0.1, hero(0, -12), free(0.1));
    expect(events.map((e) => e.kind)).toEqual(expect.arrayContaining(["noticed", "threat", "charge"]));
    expect(b.state).toBe("charge");
    expect(boarDangerous(b)).toBe(true);
  });

  it("ei huomaa kaukana olevaa", () => {
    const b = spawnBoar("b", 0, 0);
    run(b, 2, hero(0, -30), free(0.1));
    expect(["root", "walk"]).toContain(b.state);
  });
});

describe("rynnäkkö", () => {
  function charging(heroZ = -10) {
    const b = spawnBoar("b", 0, 0, Math.PI);
    run(b, BOAR.alertTime + BOAR.threatTime + 0.05, hero(0, heroZ), free(0.1));
    expect(b.state).toBe("charge");
    return b;
  }

  it("osuu paikallaan olevaan sankariin kerran ja kertoo suunnan", () => {
    const b = charging();
    const events = run(b, 1.6, hero(0, -10), free(0.1));
    const hits = events.filter((e) => e.kind === "contact");
    expect(hits).toHaveLength(1);
    const c = hits[0] as Extract<BoarEvent, { kind: "contact" }>;
    expect(c.dirZ).toBeLessThan(-0.9);
  });

  it("väistöaskeleella oleva sankari ei saa osumaa", () => {
    const b = charging();
    const events = run(b, 1.6, hero(0, -10, false), free(0.1));
    expect(events.some((e) => e.kind === "contact")).toBe(false);
  });

  it("viime hetken sivuaskel vie ohi: sika kääntyy huonosti", () => {
    const b = charging();
    let t = 0;
    // Sankari astuu 1,6 m sivuun, kun sika on noin kolmen metrin päässä.
    const events = run(b, 1.8, () => { t += 0.02; return hero(Math.abs(b.z + 10) < 3 ? 1.6 : 0, -10); }, free(0.1));
    expect(events.some((e) => e.kind === "contact")).toBe(false);
    void t;
  });

  it("ohittaa sankarin, jarruttaa ja toipuu, sitten valitsee rynnäkön tai paon", () => {
    const b = charging();
    run(b, 2.2, hero(0, -10, false), free(0.1));
    expect(b.state).toBe("recover");
    expect(b.z).toBeLessThan(-10 - BOAR.overshoot + 0.5);
    // Arvonta alle pakotodennäköisyyden (0,5) = pako, yli = uusi rynnäkkö.
    const again = run(b, BOAR.recoverTime + 0.1, hero(0, -10), free(0.9)).map((e) => e.kind);
    expect(again).toContain("threat");
    expect(again).not.toContain("flee");
    const c = spawnBoar("c", 0, 0, Math.PI);
    run(c, BOAR.alertTime + BOAR.threatTime + 0.05, hero(0, -10), free(0.1));
    run(c, 2.2, hero(0, -10, false), free(0.1));
    run(c, BOAR.recoverTime + 0.1, hero(0, -10), free(0.1));
    expect(c.state).toBe("flee");
  });

  it("rynnäkkö puuhun pysäyttää sian pidemmäksi aikaa", () => {
    const wall: BoarEnv = { rng: () => 0.1, move: (x, z, dx, dz) => ({ x: x + dx, z: Math.max(-3, z + dz) }) };
    const b = spawnBoar("b", 0, 0, Math.PI);
    const events = run(b, BOAR.alertTime + BOAR.threatTime + 1.2, hero(0, -10), wall);
    expect(events.some((e) => e.kind === "rammed")).toBe(true);
    expect(b.state).toBe("recover");
    expect(b.timer).toBe(BOAR.rammedTime);
  });
});

describe("haavoittuminen ja pako", () => {
  it("kolme täyttä nuolta kaataa, ja kaadosta saa 4–6 lihaa", () => {
    const b = spawnBoar("b", 0, 0);
    expect(damageBoar(b, arrowDamage(1), { x: 0, z: -10 }, () => 0.5)).toBe("hurt");
    expect(damageBoar(b, arrowDamage(1), { x: 0, z: -10 }, () => 0.5)).toBe("hurt");
    expect(damageBoar(b, arrowDamage(1), { x: 0, z: -10 }, () => 0.99)).toBe("dead");
    expect(b.meat).toBe(6);
    expect(boarMeatToTake(b, (n) => n <= 4)).toBe(4);
    const c = spawnBoar("c", 0, 0);
    for (let i = 0; i < 3; i++) damageBoar(c, arrowDamage(1), { x: 0, z: 0 }, () => 0);
    expect(c.meat).toBe(4);
  });

  it("vajaa jännitys tekee vähemmän, keihäs ja raskas isku enemmän", () => {
    expect(arrowDamage(0.3)).toBeLessThan(arrowDamage(1));
    expect(meleeBoarDamage("spear", false)).toBeGreaterThan(meleeBoarDamage("sword", false));
    expect(meleeBoarDamage("sword", true)).toBeGreaterThan(meleeBoarDamage("sword", false));
    expect(meleeBoarDamage("sword", false, true)).toBeLessThan(meleeBoarDamage("sword", false));
  });

  it("osuma suututtaa: terve sika useimmiten ryntää", () => {
    const b = spawnBoar("b", 0, 0);
    damageBoar(b, 1, { x: 0, z: -10 });
    expect(b.state).toBe("flinch");
    // Pakotodennäköisyys 0,15 + 0,6 · 1/3 = 0,35: arvo 0,5 ryntää.
    run(b, BOAR.flinchTime + 0.05, hero(0, -10), free(0.5));
    expect(b.state).toBe("threat");
  });

  it("pahasti haavoittunut pakenee useammin ja paljon kauemmas, ja jättää verijäljen", () => {
    const b = spawnBoar("b", 0, 0);
    damageBoar(b, 2, { x: 0, z: -10 });
    // Pakotodennäköisyys 0,15 + 0,6 · 2/3 = 0,55: arvo 0,5 pakenee.
    run(b, BOAR.flinchTime + 0.05, hero(0, -10), free(0.5));
    expect(b.state).toBe("flee");
    expect(b.fleeGoal).toBeGreaterThanOrEqual(BOAR.woundedFleeDistance[0]);
    const events = run(b, 6, hero(0, -10), free(0.5));
    const blood = events.filter((e) => e.kind === "blood");
    expect(blood.length).toBeGreaterThan(10);
    expect(b.z).toBeGreaterThan(25);
  });

  it("haavoittunut asettuu pakonsa päähän makuulle ja ahdistettuna ryntää tai pakenee", () => {
    const b = spawnBoar("b", 0, 0);
    damageBoar(b, 1, { x: 0, z: -10 });
    run(b, BOAR.flinchTime + 0.05, hero(0, -10), free(0.1));
    expect(b.state).toBe("flee");
    run(b, 20, hero(0, -10), free(0.1));
    expect(b.state).toBe("bed");
    run(b, 0.1, hero(b.x, b.z - 6), free(0.1));
    expect(b.state).toBe("threat");
  });

  it("terve paennut sika palaa tonkimaan uudessa paikassa", () => {
    const b = spawnBoar("b", 0, 0);
    run(b, BOAR.alertTime + 0.05, hero(0, -12), free(0.9));
    run(b, 8, null, free(0.9));
    expect(["root", "walk"]).toContain(b.state);
    // Pako kulkee loivana kaarena, joten suora etäisyys on hieman kuljettua lyhyempi.
    expect(Math.hypot(b.home.x, b.home.z)).toBeGreaterThan(BOAR.fleeDistance * 0.8);
  });

  it("kohtauksen reunalla pakeneva sika kiertää reunaa pitkin eikä jää paikalleen", () => {
    // Seinä z = 5: suoraan poispäin sankarista pääsee vain sivulle.
    const wall: BoarEnv = { rng: () => 0.3, move: (x, z, dx, dz) => ({ x: x + dx, z: Math.min(5, z + dz) }) };
    const b = spawnBoar("b", 0, 0);
    damageBoar(b, 1, { x: 0, z: -10 });
    run(b, BOAR.flinchTime + 0.05, hero(0, -10), { ...wall, rng: () => 0.1 });
    expect(b.state).toBe("flee");
    run(b, 8, hero(0, -10), wall);
    expect(Math.abs(b.x)).toBeGreaterThan(20);
  });

  it("uusi pako ei peri edellisen paon kiertosuuntaa", () => {
    // Este pysäyttää liikkeen kokonaan (kuten kivi), jolloin sika kääntyy kiertämään.
    const rock: BoarEnv = { rng: () => 0.3, move: (x, z, dx, dz) => (z + dz > 5 ? { x, z } : { x: x + dx, z: z + dz }) };
    const b = spawnBoar("b", 0, 0);
    damageBoar(b, 1, { x: 0, z: -10 });
    run(b, BOAR.flinchTime + 0.05, hero(0, -10), { ...rock, rng: () => 0.1 });
    let turned = false;
    for (let i = 0; i < 100 && !turned; i++) { updateBoar(b, 0.02, hero(0, -10), [], rock); turned = b.detour > 0; }
    expect(turned).toBe(true);
    damageBoar(b, 0.5, { x: 0, z: -10 });
    run(b, BOAR.flinchTime + 0.05, hero(0, -10), free(0.1));
    expect(b.state).toBe("flee");
    expect(b.detour).toBe(0);
  });

  it("kaadettu sika ei liiku eikä reagoi", () => {
    const b = spawnBoar("b", 0, 0);
    damageBoar(b, 5, { x: 0, z: 0 });
    expect(run(b, 2, hero(0, 1), free(0.1))).toEqual([]);
    expect(b.state).toBe("dead");
    expect(damageBoar(b, 1, { x: 0, z: 0 })).toBe("none");
  });
});

describe("apajan siat", () => {
  it("0–2 sikaa: 40 % ei yhtään, 40 % yksi, 20 % kaksi", () => {
    expect(boarCount(0.1)).toBe(0);
    expect(boarCount(0.5)).toBe(1);
    expect(boarCount(0.9)).toBe(2);
  });
});
