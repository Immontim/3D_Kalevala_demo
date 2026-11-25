import { describe, expect, it } from "vitest";
import { SMITHY_TRADE_SPOTS, planSmithyLife } from "./smithyLife";

describe("sepän pihan käyntikokoonpano", () => {
  it("arpoo työn ja kaupanteon erillisinä kokonaisuuksina", () => {
    expect(planSmithyLife(() => 0.1)).toEqual({ setup: "work", yardSpot: null });
    const rolls = [0.9, 0.6];
    const trade = planSmithyLife(() => rolls.shift() ?? 0);
    expect(trade.setup).toBe("trade");
    expect(trade.yardSpot).toBe(SMITHY_TRADE_SPOTS[2]);
  });

  it("ei koskaan palauta kauppakokoonpanolle tuntematonta pihapaikkaa", () => {
    for (let i = 0; i <= 100; i++) {
      const rolls = [0.75, i / 100];
      const plan = planSmithyLife(() => rolls.shift() ?? 0);
      expect(plan.setup).toBe("trade");
      expect(SMITHY_TRADE_SPOTS).toContain(plan.yardSpot);
    }
  });
});
