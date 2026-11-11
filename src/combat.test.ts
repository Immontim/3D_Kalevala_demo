import { describe, expect, it } from "vitest";
import {
  ATTACKS,
  ATTACK_RANGE,
  BLOCK_ARC,
  attackFor,
  enemyAttackTiming,
  strikeDamage,
  PARRY_WINDOW,
  PLAYER_ATTACK,
  angleBetween,
  attackPhase,
  damageFor,
  enemyTiming,
  resolveHit,
} from "./combat";

const inFront = { distance: 1.5, angleToDefender: 0 };

describe("resolveHit", () => {
  it("osuu suojaamattomaan", () => {
    expect(resolveHit(inFront, { state: "idle", blockStart: 0, angleToAttacker: 0 }, 5)).toBe("hit");
  });
  it("ohi, jos liian kaukana tai sivulla", () => {
    const d = { state: "idle" as const, blockStart: 0, angleToAttacker: 0 };
    expect(resolveHit({ distance: ATTACK_RANGE + 0.1, angleToDefender: 0 }, d, 5)).toBe("miss");
    expect(resolveHit({ distance: 1, angleToDefender: Math.PI / 2 }, d, 5)).toBe("miss");
  });
  it("myöhään aloitettu torjunta on täydellinen torjunta", () => {
    expect(
      resolveHit(inFront, { state: "block", blockStart: 5 - PARRY_WINDOW / 2, angleToAttacker: 0 }, 5),
    ).toBe("parried");
  });
  it("aikaisin aloitettu torjunta on tavallinen torjunta", () => {
    expect(resolveHit(inFront, { state: "block", blockStart: 3, angleToAttacker: 0 }, 5)).toBe("blocked");
  });
  it("selän takaa tulevaa iskua ei voi torjua", () => {
    expect(resolveHit(inFront, { state: "block", blockStart: 4.95, angleToAttacker: Math.PI }, 5)).toBe(
      "hit",
    );
  });
  it("väistö väistää", () => {
    expect(resolveHit(inFront, { state: "dodge", blockStart: 0, angleToAttacker: 0 }, 5)).toBe("dodged");
  });
});

describe("ajoitukset", () => {
  it("iskun vaiheet etenevät järjestyksessä", () => {
    expect(attackPhase(0, PLAYER_ATTACK)).toBe("windup");
    expect(attackPhase(PLAYER_ATTACK.windup + 0.01, PLAYER_ATTACK)).toBe("release");
    expect(attackPhase(PLAYER_ATTACK.windup + PLAYER_ATTACK.release + 0.01, PLAYER_ATTACK)).toBe("recovery");
    expect(attackPhase(10, PLAYER_ATTACK)).toBe("done");
  });
  it("vihollisen nosto lyhenee aalloittain mutta ei alle 0,3 s", () => {
    expect(enemyTiming(2).windup).toBeLessThan(enemyTiming(1).windup);
    expect(enemyTiming(50).windup).toBeCloseTo(0.3);
  });
  it("suohon laulettu ottaa tuplavahingon", () => {
    expect(damageFor(20, "rooted")).toBe(40);
    expect(damageFor(20, "idle")).toBe(20);
  });
  it("kulmaero kiertyy välille -PI..PI", () => {
    expect(angleBetween(0.1, Math.PI * 2 - 0.1)).toBeCloseTo(-0.2);
  });
});

describe("varustuskohtainen taistelu", () => {
  const blocking = { state: "block" as const, blockStart: 0, angleToAttacker: 0 };
  it("keihään pisto ylettää pidemmälle kuin miekka, mutta ei osu aivan lähelle", () => {
    const d = { state: "idle" as const, blockStart: 0, angleToAttacker: 0 };
    expect(resolveHit({ distance: 3.0, angleToDefender: 0 }, d, 5, ATTACKS.slash)).toBe("miss");
    expect(resolveHit({ distance: 3.0, angleToDefender: 0 }, d, 5, ATTACKS.thrust)).toBe("hit");
    expect(resolveHit({ distance: 1.1, angleToDefender: 0 }, d, 5, ATTACKS.thrust)).toBe("miss");
  });
  it("piston kaari on kapea: sivuaskel riittää", () => {
    const d = { state: "idle" as const, blockStart: 0, angleToAttacker: 0 };
    expect(resolveHit({ distance: 2.5, angleToDefender: 0.6 }, d, 5, ATTACKS.thrust)).toBe("miss");
    expect(resolveHit({ distance: 2.0, angleToDefender: 0.6 }, d, 5, ATTACKS.slash)).toBe("hit");
  });
  it("raskas isku murtaa miekkatorjunnan mutta ei kilpeä", () => {
    expect(resolveHit(inFront, blocking, 5, ATTACKS.heavy)).toBe("guardbreak");
    expect(resolveHit(inFront, { ...blocking, shield: true }, 5, ATTACKS.heavy)).toBe("blocked");
  });
  it("kilpityöntö murtaa minkä tahansa torjunnan", () => {
    expect(resolveHit(inFront, blocking, 5, ATTACKS.bash)).toBe("guardbreak");
    expect(resolveHit(inFront, { ...blocking, shield: true }, 5, ATTACKS.bash)).toBe("guardbreak");
  });
  it("täydellinen torjunta pysäyttää myös raskaan iskun ja työnnön", () => {
    const parry = { state: "block" as const, blockStart: 4.95, angleToAttacker: 0 };
    expect(resolveHit(inFront, parry, 5, ATTACKS.heavy)).toBe("parried");
    expect(resolveHit(inFront, parry, 5, ATTACKS.bash)).toBe("parried");
  });
  it("kilpi suojaa leveämmältä kuin miekka", () => {
    const side = { state: "block" as const, blockStart: 0, angleToAttacker: BLOCK_ARC + 0.3 };
    expect(resolveHit(inFront, side, 5)).toBe("hit");
    expect(resolveHit(inFront, { ...side, shield: true }, 5)).toBe("blocked");
  });
  it("vahinko: raskas isku lyö kovempaa, murrettu torjunta päästää puolet läpi", () => {
    expect(strikeDamage(20, ATTACKS.slash, "hit", "idle")).toBe(20);
    expect(strikeDamage(20, ATTACKS.heavy, "hit", "idle")).toBe(36);
    expect(strikeDamage(20, ATTACKS.heavy, "guardbreak", "block")).toBe(18);
    expect(strikeDamage(20, ATTACKS.bash, "guardbreak", "block")).toBe(0);
    expect(strikeDamage(20, ATTACKS.slash, "blocked", "block")).toBe(0);
    expect(strikeDamage(20, ATTACKS.slash, "hit", "rooted")).toBe(40);
  });
  it("iskunappi valitsee iskun varustuksen mukaan", () => {
    expect(attackFor("spear", false)).toBe("thrust");
    expect(attackFor("sword_shield", true)).toBe("bash");
    expect(attackFor("sword_shield", false)).toBe("slash");
    expect(attackFor("sword", true)).toBe("slash");
  });
  it("vihollisen raskas isku on hitaampi kuin sivallus joka aallolla", () => {
    for (const w of [1, 4, 30]) {
      expect(enemyAttackTiming("heavy", w).windup).toBeGreaterThan(enemyAttackTiming("slash", w).windup);
    }
  });
});
