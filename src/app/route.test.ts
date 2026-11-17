import { describe, expect, it } from "vitest";
import { mapUrl, parseAppRoute, sceneKind, sceneUrl } from "./route";

describe("sovelluksen reitit", () => {
  it("luokittelee nuotioaukion ja pihapiirin taisteluiksi mutta rauhallisen pihan ystävälliseksi", () => {
    expect(sceneKind("clearing")).toBe("battle");
    expect(sceneKind("homestead")).toBe("battle");
    expect(sceneKind("yard")).toBe("friendly");
    expect(sceneKind("lakeside")).toBe("friendly");
    expect(sceneKind("lakeruin")).toBe("friendly");
    expect(sceneKind("cairnfield")).toBe("friendly");
  });

  it("hyväksyy vain tunnetut 3D-paikat", () => {
    expect(parseAppRoute("https://example.test/game/?scene=clearing")).toEqual({
      mode: "scene", scene: "clearing", returnToMap: false, site: null,
    });
    expect(parseAppRoute("https://example.test/game/?scene=homestead&return=map")).toEqual({
      mode: "scene", scene: "homestead", returnToMap: true, site: null,
    });
    expect(parseAppRoute("https://example.test/game/?scene=yard&return=MAP")).toEqual({
      mode: "scene", scene: "yard", returnToMap: false, site: null,
    });
    expect(parseAppRoute("https://example.test/game/?scene=lakeside&return=map")).toEqual({
      mode: "scene", scene: "lakeside", returnToMap: true, site: null,
    });
    expect(parseAppRoute("https://example.test/game/?scene=cairnfield&return=map")).toEqual({
      mode: "scene", scene: "cairnfield", returnToMap: true, site: null,
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

  it("välittää pihainstanssin tunnisteen ja hylkää epäkelvon", () => {
    const url = sceneUrl("https://example.test/game/?lang=fi", "yard", true, "yard-b");
    expect(url.searchParams.get("site")).toBe("yard-b");
    expect(parseAppRoute(url)).toEqual({ mode: "scene", scene: "yard", returnToMap: true, site: "yard-b" });
    expect(parseAppRoute("https://example.test/?scene=yard&site=../x")).toMatchObject({ site: null });
    expect(parseAppRoute("https://example.test/?scene=yard&site=Yard")).toMatchObject({ site: null });
    expect(sceneUrl(url, "lakeside", true).searchParams.has("site")).toBe(false);
    expect(mapUrl(url).searchParams.has("site")).toBe(false);
    expect(sceneUrl("https://example.test/?site=%00", "yard", true, "bad id").searchParams.has("site")).toBe(false);
  });

  it("palaa kartalle poistamalla vain reitityksen omat parametrit", () => {
    const next = mapUrl("https://immontim.github.io/3D_Kalevala_demo/?lang=en&scene=yard&return=map#map");
    expect(next.href).toBe("https://immontim.github.io/3D_Kalevala_demo/?lang=en#map");
  });

  it("tekee kartta-piha-kartta-roundtripin", () => {
    const start = new URL("https://example.test/sub/game.html?lang=fi#status");
    const visit = sceneUrl(start, "yard", true);
    expect(parseAppRoute(visit)).toEqual({ mode: "scene", scene: "yard", returnToMap: true, site: null });

    const returned = mapUrl(visit);
    expect(parseAppRoute(returned)).toEqual({ mode: "map" });
    expect(returned.pathname).toBe(start.pathname);
    expect(returned.searchParams.get("lang")).toBe("fi");
    expect(returned.hash).toBe(start.hash);
  });
});
