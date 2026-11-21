import { describe, expect, it } from "vitest";
import { CollisionWorld, separateDiscBodies } from "./collision";

const circle = (id = "rock") => ({
  id, kind: "circle" as const, x: 0, z: 0, radius: 1,
  blocksMovement: true, blocksMelee: true,
});

describe("2,5D-törmäykset", () => {
  it("pysäyttää pakotetun liikkeen ennen ympyräestettä", () => {
    const world = new CollisionWorld();
    world.add(circle());
    const p = world.moveDisc(-2, 0, 3, 0, 0.5, "stop");
    expect(p.x).toBeLessThanOrEqual(-1.5);
    expect(p.hit?.id).toBe("rock");
  });

  it("liukuu kävellessä laatikon reunaa pitkin", () => {
    const world = new CollisionWorld();
    world.add({ id: "wall", kind: "box", x: 0, z: 0, yaw: 0, halfX: 0.2, halfZ: 3, blocksMovement: true, blocksMelee: true });
    const p = world.moveDisc(-1, -1, 1.4, 1.2, 0.5, "slide");
    expect(p.x).toBeLessThanOrEqual(-0.7 + 1e-4);
    expect(p.z).toBeGreaterThan(-0.2);
  });

  it("ei tunneloi ohuen aidan läpi pitkällä väistöllä", () => {
    const world = new CollisionWorld();
    world.add({ id: "fence", kind: "box", x: 0, z: 0, yaw: 0, halfX: 0.08, halfZ: 2, blocksMovement: true, blocksMelee: true });
    const p = world.moveDisc(-2, 0, 5, 0, 0.5, "stop");
    expect(p.x).toBeLessThan(-0.5);
    expect(p.hit?.id).toBe("fence");
  });

  it("löytää ensimmäisen lähitaisteluiskun estävän kohteen ja kontaktikohdan", () => {
    const world = new CollisionWorld();
    world.add(circle("stone"));
    world.add({ id: "bush", kind: "circle", x: -2, z: 0, radius: 0.5, blocksMovement: false, blocksMelee: false });
    const hit = world.firstMeleeHit(-3, 0, 3, 0);
    expect(hit?.collider.id).toBe("stone");
    expect(hit?.x).toBeCloseTo(-1);
  });

  it("kameran osuma huomioi vain blocksCamera-esteet ja kasvattaa niitä padilla", () => {
    const world = new CollisionWorld();
    world.add({ id: "kivi", kind: "circle", x: -2, z: 0, radius: 0.5, blocksMovement: true, blocksMelee: true });
    world.add({ id: "puu", kind: "circle", x: 0, z: 0, radius: 0.3, blocksMovement: true, blocksMelee: true, blocksCamera: true });
    const hit = world.firstCameraHit(-4, 0, 4, 0, 0.25);
    expect(hit?.collider.id).toBe("puu");
    expect(hit?.x).toBeCloseTo(-0.55);
    expect(world.firstCameraHit(-4, 0.5, 4, 0.5, 0)).toBeNull();
    expect(world.firstCameraHit(-4, 0.5, 4, 0.5, 0.25)?.collider.id).toBe("puu");
    world.add({ id: "talo", kind: "box", x: 0, z: 5, yaw: 0, halfX: 1, halfZ: 1, blocksMovement: true, blocksMelee: true, blocksCamera: true });
    expect(world.firstCameraHit(0, 8, 0, 3, 0.25)?.z).toBeCloseTo(6.25);
  });

  it("tunnistaa vartalon reunan nuotion vaara-alueella", () => {
    const world = new CollisionWorld();
    world.addHazard({ id: "fire", kind: "circle", x: 0, z: 0, radius: 0.9, damagePerSecond: 10 });
    expect(world.hazardsAt(1.35, 0, 0.5)).toHaveLength(1);
    expect(world.hazardsAt(1.5, 0, 0.5)).toHaveLength(0);
  });

  it("erottaa dynaamiset vartalot ja kunnioittaa liikkumatonta vartaloa", () => {
    const a = { x: 0, z: 0, radius: 0.5, immovable: true };
    const b = { x: 0.4, z: 0, radius: 0.5 };
    expect(separateDiscBodies(a, b)).toBe(true);
    expect(a.x).toBe(0);
    expect(b.x).toBeCloseTo(1);
  });

  it("siirtää paineen hyökkääjään, kun toinen vartalo on seinää vasten", () => {
    const world = new CollisionWorld();
    world.add({ id: "wall", kind: "box", x: 0, z: 0, yaw: 0, halfX: 0.1, halfZ: 3, blocksMovement: true, blocksMelee: true });
    const attacker = { x: -1.25, z: 0, radius: 0.5 };
    const defender = { x: -0.6, z: 0, radius: 0.5 };
    for (let pass = 0; pass < 5; pass++) {
      separateDiscBodies(attacker, defender);
      const solvedDefender = world.depenetrateDisc(defender.x, defender.z, defender.radius);
      defender.x = solvedDefender.x;
      defender.z = solvedDefender.z;
    }
    expect(defender.x).toBeLessThanOrEqual(-0.6);
    expect(defender.x - attacker.x).toBeGreaterThan(0.98);
  });
});

describe("esteen poisto käytöstä", () => {
  it("poistettu hahmoeste ei enää työnnä eikä estä lyöntiä, ja tuntematon tunniste palauttaa false", () => {
    const world = new CollisionWorld();
    world.add({ id: "folk:louhi", kind: "circle", x: 0, z: 0, radius: 0.4, blocksMovement: true, blocksMelee: true });
    expect(world.depenetrateDisc(0.1, 0, 0.5).x).not.toBeCloseTo(0.1, 2);       // työntää ulos
    expect(world.disable("folk:louhi")).toBe(true);
    expect(world.depenetrateDisc(0.1, 0, 0.5).x).toBeCloseTo(0.1, 5);           // ei enää estä
    expect(world.firstMeleeHit(-2, 0, 2, 0)).toBeNull();
    expect(world.disable("folk:ei-ole")).toBe(false);
  });
});
