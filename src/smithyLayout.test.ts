import { describe, expect, it } from "vitest";
import { sceneLayout, walkableDepth } from "./sceneLayout";
import {
  SMITHY_ORIGIN, SMITHY_REAR_WALL_LOCAL, SMITHY_TABLE_LOCAL, SMITHY_TRADE_SMITH_LOCAL,
  SMITHY_WORK_LOCAL, smithyPoint,
} from "./smithyLayout";

describe("sepän pajan saavutettava sijoittelu", () => {
  it("asettaa takakivimuurin aidan kehälle ja työalueen sen sisäpuolelle", () => {
    const wall = smithyPoint(SMITHY_REAR_WALL_LOCAL);
    expect(Math.hypot(wall.x, wall.z)).toBeCloseTo(12.9, 5);
    expect(Math.hypot(SMITHY_ORIGIN.x, SMITHY_ORIGIN.z)).toBeCloseTo(10.9, 5);
  });

  it("pitää kaikki hahmot puhuttavalla etäisyydellä kuljettavasta pihasta", () => {
    const layout = sceneLayout("smithy");
    const locals = [...Object.values(SMITHY_WORK_LOCAL), SMITHY_TRADE_SMITH_LOCAL];
    for (const local of locals) {
      const point = smithyPoint(local);
      expect(walkableDepth(layout, point.x, point.z)).toBeGreaterThan(0);
    }
  });

  it("tuo aihiopöydän selvästi katoksen etupuolelle ja keskelle pihaa", () => {
    const table = smithyPoint(SMITHY_TABLE_LOCAL);
    expect(Math.hypot(table.x, table.z)).toBeLessThan(7);
    expect(walkableDepth(sceneLayout("smithy"), table.x, table.z)).toBeGreaterThan(5);
  });
});
