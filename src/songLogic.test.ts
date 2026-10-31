import { describe, expect, it } from "vitest";
import { judgeBeat, songOutcome } from "./songLogic";

describe("laulun rytmi", () => {
  it("arvioi painalluksen tarkkuuden", () => {
    expect(judgeBeat(0.02)).toBe("perfect");
    expect(judgeBeat(-0.15)).toBe("good");
    expect(judgeBeat(0.4)).toBe("miss");
  });
  it("hyvä laulu sitoo vihollisen pitkään, heikko lyhyesti, huono ei ollenkaan", () => {
    expect(songOutcome(["perfect", "perfect", "perfect", "good"]).rootTime).toBe(6);
    expect(songOutcome(["good", "good", "good", "good"]).rootTime).toBe(3.5);
    expect(songOutcome(["miss", "good", "miss", "good"]).success).toBe(false);
  });
});
