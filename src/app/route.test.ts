import { describe, expect, it } from "vitest";
import { mapUrl, parseAppRoute, sceneUrl } from "./route";

describe("sovelluksen reitit", () => {
  it("hyväksyy vain tunnetut 3D-paikat", () => {
    expect(parseAppRoute("https://example.test/game/?scene=clearing")).toEqual({
      mode: "scene", scene: "clearing", returnToMap: false,
    });
    expect(parseAppRoute("https://example.test/game/?scene=homestead&return=map")).toEqual({
      mode: "scene", scene: "homestead", returnToMap: true,
    });
    expect(parseAppRoute("https://example.test/game/?scene=yard&return=MAP")).toEqual({
      mode: "scene", scene: "yard", returnToMap: false,
    });
    expect(parseAppRoute("https://example.test/game/?scene=unknown&return=map")).toEqual({ mode: "map" });
    expect(parseAppRoute("https://example.test/game/?return=map")).toEqual({ mode: "map" });
  });

  it("säilyttää GitHub Pagesin alihakemiston, muut queryt ja ankkurin", () => {
    const base = new URL("https://immontim.github.io/3D_Kalevala_demo/?lang=fi&debug=1#inventory");
    const next = sceneUrl(base, "yard", true);

    expect(next.pathname).toBe("/3D_Kalevala_demo/");
    expect(next.searchParams.get("lang")).toBe("fi");
    expect(next.searchParams.get("debug")).toBe("1");
    expect(next.searchParams.get("scene")).toBe("yard");
    expect(next.searchParams.get("return")).toBe("map");
    expect(next.hash).toBe("#inventory");
    expect(base.searchParams.has("scene")).toBe(false);
  });

  it("korvaa aiemmat varatut parametrit eikä jätä paluuparametria debug-kohtaukseen", () => {
    const next = sceneUrl("https://example.test/game/?scene=yard&return=map&lang=en", "clearing", false);
    expect(next.searchParams.getAll("scene")).toEqual(["clearing"]);
    expect(next.searchParams.has("return")).toBe(false);
    expect(next.searchParams.get("lang")).toBe("en");
  });

  it("palaa kartalle poistamalla vain reitityksen omat parametrit", () => {
    const next = mapUrl("https://immontim.github.io/3D_Kalevala_demo/?lang=en&scene=yard&return=map#map");
    expect(next.href).toBe("https://immontim.github.io/3D_Kalevala_demo/?lang=en#map");
  });

  it("tekee kartta-piha-kartta-roundtripin", () => {
    const start = new URL("https://example.test/sub/game.html?lang=fi#status");
    const visit = sceneUrl(start, "yard", true);
    expect(parseAppRoute(visit)).toEqual({ mode: "scene", scene: "yard", returnToMap: true });

    const returned = mapUrl(visit);
    expect(parseAppRoute(returned)).toEqual({ mode: "map" });
    expect(returned.pathname).toBe(start.pathname);
    expect(returned.searchParams.get("lang")).toBe("fi");
    expect(returned.hash).toBe(start.hash);
  });
});
