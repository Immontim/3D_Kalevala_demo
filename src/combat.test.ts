import { describe, expect, it } from "vitest";
import {
  ATTACK_RANGE,
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
    expect(enemyTiming(50).windup).toBe(0.3);
  });
  it("suohon laulettu ottaa tuplavahingon", () => {
    expect(damageFor(20, "rooted")).toBe(40);
    expect(damageFor(20, "idle")).toBe(20);
  });
  it("kulmaero kiertyy välille -PI..PI", () => {
    expect(angleBetween(0.1, Math.PI * 2 - 0.1)).toBeCloseTo(-0.2);
  });
});
