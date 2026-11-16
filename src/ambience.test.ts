import { describe, expect, it } from "vitest";
import { BIRDS_FULL_BEYOND, BIRDS_SILENT_WITHIN, birdLevelAtDistance } from "./ambience";

describe("lintujen laulu kuppikiven lähellä", () => {
  it("on täysin hiljaa kiven vieressä", () => {
    expect(birdLevelAtDistance(0)).toBe(0);
    expect(birdLevelAtDistance(BIRDS_SILENT_WITHIN)).toBe(0);
  });
  it("palaa täyteen voimaan kaukana", () => {
    expect(birdLevelAtDistance(BIRDS_FULL_BEYOND)).toBe(1);
    expect(birdLevelAtDistance(40)).toBe(1);
  });
  it("voimistuu tasaisesti etäisyyden mukana", () => {
    let prev = -1;
    for (let d = 0; d <= 14; d += 0.5) {
      const v = birdLevelAtDistance(d);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});
