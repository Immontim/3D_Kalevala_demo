import { describe, expect, it } from "vitest";
import {
  BASH,
  SHIELDS,
  STRIKES,
  STYLES,
  WEAPONS,
  angleBetween,
  attackPhase,
  chargeLevel,
  damageFor,
  enemyAttackTiming,
  makeAttack,
  resolveHit,
  shieldWear,
  strikeDamage,
  styleFor,
  weaponOf,
} from "./combat";

const sword = WEAPONS.sword;
const spear = WEAPONS.spear;
const slash = makeAttack(sword, "slash", "light");
const heavySlash = makeAttack(sword, "slash", "heavy");
const overhead = makeAttack(sword, "overhead", "light");
const swordThrust = makeAttack(sword, "thrust", "light");
const spearThrust = makeAttack(spear, "thrust", "light");
const shield = SHIELDS.round;

const inFront = { distance: 1.5, angleToDefender: 0 };
const idle = { state: "idle" as const, blockStart: 0, angleToAttacker: 0 };

describe("resolveHit", () => {
  it("osuu suojaamattomaan", () => {
    expect(resolveHit(inFront, idle, 5)).toBe("hit");
  });
  it("ohi, jos liian kaukana tai sivulla", () => {
    expect(resolveHit({ distance: slash.range + 0.1, angleToDefender: 0 }, idle, 5)).toBe("miss");
    expect(resolveHit({ distance: 1, angleToDefender: Math.PI / 2 }, idle, 5)).toBe("miss");
  });
  it("myöhään aloitettu torjunta on täydellinen torjunta", () => {
    expect(resolveHit(inFront, { state: "block", blockStart: 4.9, angleToAttacker: 0 }, 5)).toBe("parried");
  });
  it("aikaisin aloitettu torjunta on tavallinen torjunta", () => {
    expect(resolveHit(inFront, { state: "block", blockStart: 3, angleToAttacker: 0 }, 5)).toBe("blocked");
  });
  it("selän takaa tulevaa iskua ei voi torjua", () => {
    expect(resolveHit(inFront, { state: "block", blockStart: 4.95, angleToAttacker: Math.PI }, 5)).toBe("hit");
  });
  it("väistö väistää", () => {
    expect(resolveHit(inFront, { state: "dodge", blockStart: 0, angleToAttacker: 0 }, 5)).toBe("dodged");
  });
});

describe("iskusuunnat ja suuntatorjunta", () => {
  const block = (stance: "overhead" | "slash" | "thrust") => ({ state: "block" as const, blockStart: 0, angleToAttacker: 0, stance });
  it("aseella torjunta onnistuu vain oikealla asennolla", () => {
    for (const style of STYLES) {
      const a = makeAttack(sword, style, "light");
      for (const stance of STYLES) {
        expect(resolveHit(inFront, block(stance), 5, a)).toBe(stance === style ? "blocked" : "hit");
      }
    }
  });
  it("väärä asento ei anna täydellistä torjuntaakaan", () => {
    expect(resolveHit(inFront, { ...block("slash"), blockStart: 4.95 }, 5, overhead)).toBe("hit");
    expect(resolveHit(inFront, { ...block("overhead"), blockStart: 4.95 }, 5, overhead)).toBe("parried");
  });
  it("kilpi torjuu kaikki suunnat, myös raskaat", () => {
    for (const style of STYLES) {
      for (const weight of ["light", "heavy"] as const) {
        expect(resolveHit(inFront, { ...block("slash"), shield }, 5, makeAttack(sword, style, weight))).toBe("blocked");
      }
    }
  });
  it("kilpi suojaa leveämmältä kuin miekka", () => {
    const side = { ...block("slash"), angleToAttacker: sword.blockArc + 0.3 };
    expect(resolveHit(inFront, side, 5)).toBe("hit");
    expect(resolveHit(inFront, { ...side, shield }, 5)).toBe("blocked");
  });
  it("kilpityöntö murtaa asetorjunnan asennosta riippumatta, mutta ei kilpeä", () => {
    for (const stance of STYLES) expect(resolveHit(inFront, block(stance), 5, BASH)).toBe("guardbreak");
    expect(resolveHit(inFront, { ...block("slash"), shield }, 5, BASH)).toBe("blocked");
  });
});

describe("aseet ja iskut parametreina", () => {
  it("jokaisella suunnalla on kevyt ja raskas isku: raskas on hitaampi ja kovempi", () => {
    for (const style of STYLES) {
      const l = STRIKES[style].light, h = STRIKES[style].heavy;
      expect(h.timing.windup).toBeGreaterThan(l.timing.windup);
      expect(h.damage).toBeGreaterThan(l.damage);
      expect(h.shieldDamage).toBeGreaterThan(l.shieldDamage);
    }
  });
  it("keihäs ylettää pidemmälle kuin miekka, mutta ei osu aivan lähelle", () => {
    expect(resolveHit({ distance: 3.0, angleToDefender: 0 }, idle, 5, swordThrust)).toBe("miss");
    expect(resolveHit({ distance: 3.0, angleToDefender: 0 }, idle, 5, spearThrust)).toBe("hit");
    expect(resolveHit({ distance: 1.1, angleToDefender: 0 }, idle, 5, spearThrust)).toBe("miss");
    // Kantama ja syöksy on mitoitettu mallin mukaan: 3,5 m ja 0,3 m miekkaa pidempi askel.
    expect(spearThrust.range).toBeCloseTo(3.5);
    expect(resolveHit({ distance: 3.4, angleToDefender: 0 }, idle, 5, spearThrust)).toBe("hit");
    expect(spearThrust.lunge).toBeCloseTo(swordThrust.lunge + 0.3);
  });
  it("piston kaari on kapea: sivuaskel riittää", () => {
    expect(resolveHit({ distance: 2.2, angleToDefender: 0.6 }, idle, 5, swordThrust)).toBe("miss");
    expect(resolveHit({ distance: 2.0, angleToDefender: 0.6 }, idle, 5, slash)).toBe("hit");
  });
  it("keihäällä voi vain pistää", () => {
    expect(styleFor(spear, "slash")).toBe("thrust");
    expect(styleFor(spear, "overhead")).toBe("thrust");
    expect(styleFor(sword, "overhead")).toBe("overhead");
    expect(weaponOf("spear")).toBe(spear);
    expect(weaponOf("sword_shield")).toBe(sword);
  });
  it("vahinko on lyöjän voima × ase × isku", () => {
    expect(strikeDamage(20, slash, "hit", "idle")).toBeCloseTo(20);
    expect(strikeDamage(20, heavySlash, "hit", "idle")).toBeCloseTo(34);
    expect(strikeDamage(20, slash, "hit", "rooted")).toBeCloseTo(40);
    expect(strikeDamage(20, slash, "blocked", "block")).toBe(0);
    expect(strikeDamage(20, BASH, "guardbreak", "block")).toBe(0);
    const fine = makeAttack({ ...sword, damage: 1.5 }, "slash", "light");
    expect(strikeDamage(20, fine, "hit", "idle")).toBeCloseTo(30);
  });
  it("hitaampi ase nostaa ja palautuu hitaammin", () => {
    expect(spearThrust.timing.windup).toBeGreaterThan(swordThrust.timing.windup);
    expect(spearThrust.timing.recovery).toBeGreaterThan(swordThrust.timing.recovery);
  });
});

describe("kilven kesto", () => {
  const blocking = { state: "block" as const, blockStart: 0, angleToAttacker: 0, shield };
  it("kestää 10 kevyttä tai 5 raskasta iskua", () => {
    expect(shield.durability / shieldWear(slash, "blocked", blocking)).toBe(10);
    expect(shield.durability / shieldWear(heavySlash, "blocked", blocking)).toBe(5);
  });
  it("täydellinen torjunta ja ohi mennyt isku eivät kuluta kilpeä", () => {
    expect(shieldWear(heavySlash, "parried", blocking)).toBe(0);
    expect(shieldWear(heavySlash, "miss", blocking)).toBe(0);
    expect(shieldWear(slash, "blocked", { ...blocking, shield: null })).toBe(0);
  });
});

describe("ajoitukset", () => {
  it("iskun vaiheet etenevät järjestyksessä", () => {
    const t = slash.timing;
    expect(attackPhase(0, t)).toBe("windup");
    expect(attackPhase(t.windup + 0.01, t)).toBe("release");
    expect(attackPhase(t.windup + t.release + 0.01, t)).toBe("recovery");
    expect(attackPhase(10, t)).toBe("done");
  });
  it("vihollisen nosto lyhenee aalloittain mutta ei juuri alle pelaajan noston", () => {
    expect(enemyAttackTiming(slash, 2).windup).toBeLessThan(enemyAttackTiming(slash, 1).windup);
    expect(enemyAttackTiming(slash, 50).windup).toBeCloseTo(slash.timing.windup - 0.02);
  });
  it("viritysmittari täyttyy raskaan iskun viritysajassa", () => {
    expect(chargeLevel(0, heavySlash)).toBe(0);
    expect(chargeLevel(heavySlash.timing.windup / 2, heavySlash)).toBeCloseTo(0.5);
    expect(chargeLevel(5, heavySlash)).toBe(1);
  });
  it("suohon laulettu ottaa tuplavahingon", () => {
    expect(damageFor(20, "rooted")).toBe(40);
    expect(damageFor(20, "idle")).toBe(20);
  });
  it("kulmaero kiertyy välille -PI..PI", () => {
    expect(angleBetween(0.1, Math.PI * 2 - 0.1)).toBeCloseTo(-0.2);
  });
});
