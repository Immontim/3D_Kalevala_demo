import { describe, expect, it } from "vitest";
import { createCampaign } from "./campaign";
import { PROTOTYPE_MAP_ID } from "./prototype";
import { revealSiteOnMap } from "./reveal";

const CAMP = { id: "camp", kind: "camp", x: 3, y: 4, archer: false } as const;

function campaign() {
  return createCampaign({ mapId: PROTOTYPE_MAP_ID, x: 10, y: 14, siteInstances: [CAMP] });
}

describe("kartan paikan paljastus (moottorin revealSite)", () => {
  it("tekee paikasta tunnetun ja paljastaa ruudun ympäristöineen", () => {
    const state = campaign();
    const next = revealSiteOnMap(state, "camp")!;
    const { x, y } = CAMP;
    expect(next.world.knownSiteIds).toEqual(["camp"]);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      expect(next.world.discovered[(y + dy) * state.world.width + (x + dx)]).toBe(true);
    }
    expect(next.world.discovered[0]).toBe(false);                      // kauempana ei paljastu mitään
    expect(state.world.knownSiteIds).toEqual([]);                      // alkuperäinen ei muutu
  });

  it("on idempotentti, tuntematon paikka palauttaa nullin ja vieras kartta ei kelpaa", () => {
    const once = revealSiteOnMap(campaign(), "lakeside")!;
    expect(revealSiteOnMap(once, "lakeside")).toBe(once);
    expect(revealSiteOnMap(campaign(), "ei-ole")).toBeNull();
    expect(revealSiteOnMap(createCampaign({ mapId: "muu" }), "lakeside")).toBeNull();
  });
});
