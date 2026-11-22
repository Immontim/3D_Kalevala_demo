import { describe, expect, it } from "vitest";
import { createCampaign, parseCampaign, parseSiteInstances, serializeCampaign, type SiteInstance } from "./campaign";
import { mapCellTravel, mapCell } from "./domain";
import {
  CAMP_PLACEMENT,
  SHORE_PLACEMENT,
  YARD_PLACEMENT,
  chebyshev,
  isShoreCell,
  placeYardInstances,
  rngStream,
  placeCampInstance,
  travelMinutes,
  validateCampPlacement,
  validateShorePlacement,
  validateYardPlacement,
} from "./placement";
import { PROTOTYPE_MAP, PROTOTYPE_START } from "./prototype";
import { PROTOTYPE_PLACEMENT, completeSiteInstances, newSiteInstances, newYardInstances, placementWith } from "./siteInstances";
import { LEGACY_SHORE_POSITIONS, LEGACY_YARD_POSITION } from "./sites";
import { newCampaign } from "./storage";

describe("satunnaisvirrat", () => {
  it("on deterministinen ja nimetyt virrat ovat erillisiä", () => {
    const a = rngStream(42, "placement"), b = rngStream(42, "placement"), c = rngStream(42, "archer");
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect([c(), c(), c()]).not.toEqual(first);
    for (const v of first) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
});

describe("pihapiirien sijoittelu (V3)", () => {
  it("1000 siementä tuottaa kelvollisen sijoittelun: kaksi pihaa, tasan yksi jousineito", () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const yards = newYardInstances(seed);
      expect(yards.map((y) => y.id), `siemen ${seed}`).toEqual(["yard", "yard-b"]);
      expect(validateYardPlacement(yards, PROTOTYPE_PLACEMENT), `siemen ${seed}`).toEqual([]);
      expect(yards.filter((y) => y.archer), `siemen ${seed}`).toHaveLength(1);
    }
  });

  it("on toistettavissa: sama siemen antaa saman tuloksen", () => {
    expect(newYardInstances(12345)).toEqual(newYardInstances(12345));
  });

  it("siemenet tuottavat vaihtelua, ja jousineito arvotaan kumpaan tahansa taloon", () => {
    const positions = new Set<string>();
    const archerIds = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      for (const y of newYardInstances(seed)) {
        positions.add(`${y.x},${y.y}`);
        if (y.archer) archerIds.add(y.id);
      }
    }
    expect(positions.size).toBeGreaterThan(15);
    expect([...archerIds].sort()).toEqual(["yard", "yard-b"]);
  });

  it("jokainen piha on saavutettavissa kohtuullisessa ajassa ja etäällä aloituksesta", () => {
    const minutes = travelMinutes(PROTOTYPE_PLACEMENT.map, PROTOTYPE_START);
    for (let seed = 1; seed <= 300; seed++) {
      for (const y of newYardInstances(seed)) {
        expect(minutes[y.y * 20 + y.x]).toBeLessThanOrEqual(YARD_PLACEMENT.maxStartMinutes);
        expect(chebyshev(y, PROTOTYPE_START)).toBeGreaterThanOrEqual(YARD_PLACEMENT.minStartDistance);
      }
    }
  });

  it("validaattori hylkää jokaisen rikkomustyypin", () => {
    const ok: SiteInstance = { id: "yard", kind: "yard", x: 8, y: 9, archer: true };
    const bad = (override: Partial<SiteInstance>, other?: SiteInstance) =>
      validateYardPlacement(other ? [{ ...ok, ...override }, other] : [{ ...ok, ...override }], PROTOTYPE_PLACEMENT);
    expect(bad({})).toEqual([]);
    expect(bad({ x: 1, y: 1 }).join()).toContain("keskialueella");
    expect(bad({ x: 13, y: 9 }).join()).toMatch(/maasto|ruudussa/);          // joen ruutu (13,9) ei kelpaa
    expect(bad({ x: 10, y: 14 }).join()).toContain("liian lähellä aloitusta");
    const nearSage = validateYardPlacement([{ ...ok, x: 9, y: 7 }], placementWith([{ id: "lakeside", kind: "lakeside", x: 9, y: 6, archer: false }]));
    expect(nearSage.join()).toContain("kiinteää paikkaa");                     // rannan mökin vieressä
    expect(bad({}, { id: "yard-b", kind: "yard", x: 9, y: 9, archer: false }).join()).toContain("liian lähellä toisiaan");
    expect(bad({}, { id: "yard", kind: "yard", x: 4, y: 4, archer: false }).join()).toContain("kahdesti");
    expect(bad({ x: 99 }).join()).toContain("kartan ulkopuolella");
  });

  it("jokainen sallittu keskialueen ruutu on kulkukelpoista maastoa (ehdokkaita on riittävästi)", () => {
    let count = 0;
    for (let y = YARD_PLACEMENT.centre.minY; y <= YARD_PLACEMENT.centre.maxY; y++) {
      for (let x = YARD_PLACEMENT.centre.minX; x <= YARD_PLACEMENT.centre.maxX; x++) {
        if (validateYardPlacement([{ id: "yard", kind: "yard", x, y, archer: false }], PROTOTYPE_PLACEMENT).length === 0) {
          count++;
          expect(mapCellTravel(mapCell(PROTOTYPE_PLACEMENT.map, x, y)!).passable).toBe(true);
        }
      }
    }
    expect(count).toBeGreaterThan(30);
  });

  it("heittää selvän virheen, jos kartta ei salli sijoittelua", () => {
    const tight = { ...PROTOTYPE_PLACEMENT, start: { x: 9, y: 9 } };
    expect(() => placeYardInstances(1, { ...tight, fixedSites: [] }, { ids: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"] }))
      .toThrow(/ei löydy kelvollista ruutua/);
  });
});

describe("paikkainstanssit kampanjassa", () => {
  it("uusi matka tallentaa siemenen ja konkretisoidut pihat, jotka säilyvät tallennuksen läpi", () => {
    const state = newCampaign(777);
    expect(state.world.worldSeed).toBe(777);
    // Metsästysapajat (kind "hunt") testataan huntGrounds.test.ts:ssä.
    const fixed = state.world.siteInstances.filter((i) => i.kind !== "hunt");
    expect(fixed).toEqual(newSiteInstances(777));
    expect(fixed.map((i) => i.id)).toEqual(["lakeside", "cairnfield", "cairn-b", "yard", "yard-b", "camp"]);
    expect(parseCampaign(serializeCampaign(state))?.world.siteInstances).toEqual(state.world.siteInstances);
    expect(parseCampaign(serializeCampaign(state))?.world.worldSeed).toBe(777);
  });

  it("salliva luku pudottaa virheelliset instanssit mutta säilyttää kampanjan", () => {
    const raw = JSON.parse(serializeCampaign(newCampaign(5)));
    raw.world.siteInstances = [
      { id: "yard", kind: "yard", x: 6, y: 7, archer: true },
      { id: "yard", kind: "yard", x: 7, y: 7, archer: false },        // sama tunniste
      { id: "yard-c", kind: "yard", x: 6, y: 7, archer: false },      // sama ruutu
      { id: "Huono Id", kind: "yard", x: 8, y: 8, archer: false },
      { id: "yard-d", kind: "castle", x: 8, y: 8, archer: false },
      { id: "yard-e", kind: "yard", x: 99, y: 8, archer: false },
      { id: "yard-f", kind: "yard", x: 8, y: 8, archer: "kyllä" },
      "roska",
    ];
    raw.world.worldSeed = -3;
    const parsed = parseCampaign(raw);
    expect(parsed?.world.siteInstances).toEqual([{ id: "yard", kind: "yard", x: 6, y: 7, archer: true }]);
    expect(parsed?.world.worldSeed).toBe(0);
    expect(parseSiteInstances("ei lista", 20, 20)).toEqual([]);
  });

  it("vanha tallennus ilman instansseja saa kiinteän pihansa 'yard' ja arvotun 'yard-b'", () => {
    const old = createCampaign();                              // ei instansseja, siemen 0
    const done = completeSiteInstances(old, 4242);
    const a = done.world.siteInstances.find((i) => i.id === "yard")!;
    const b = done.world.siteInstances.find((i) => i.id === "yard-b")!;
    expect(done.world.siteInstances.filter((i) => i.kind !== "hunt").map((i) => i.id))
      .toEqual(["yard", "lakeside", "cairnfield", "yard-b", "camp", "cairn-b"]);
    // Ennen v08:aa kiinteät paikat säilyvät entisillä ruuduillaan.
    expect(done.world.siteInstances.find((i) => i.id === "lakeside")).toMatchObject({ kind: "lakeside", ...LEGACY_SHORE_POSITIONS.lakeside });
    expect(done.world.siteInstances.find((i) => i.id === "cairnfield")).toMatchObject({ kind: "cairn", ...LEGACY_SHORE_POSITIONS.cairnfield });
    const cairnB = done.world.siteInstances.find((i) => i.id === "cairn-b")!;
    expect(validateShorePlacement(cairnB, PROTOTYPE_PLACEMENT, done.world.siteInstances)).toEqual([]);
    expect(a).toEqual({ id: "yard", kind: "yard", x: LEGACY_YARD_POSITION.x, y: LEGACY_YARD_POSITION.y, archer: true });
    expect(b).toMatchObject({ id: "yard-b", archer: false });
    expect(done.world.worldSeed).toBe(4242);
    expect(validateYardPlacement([b], placementWith(done.world.siteInstances.filter((i) => i.kind === "lakeside" || i.kind === "cairn"))).filter((p) => !p.includes("kahdesti"))).toEqual([]);
    expect(chebyshev(a, b)).toBeGreaterThanOrEqual(YARD_PLACEMENT.minMutualDistance);
    // Täydennys on idempotentti: valmis maailma ei arvota uudelleen.
    expect(completeSiteInstances(done, 999)).toBe(done);
  });

  it("täydennys ei muuta olemassa olevaa siementä ja arpoo vain puuttuvan pihan", () => {
    const partial = createCampaign({ worldSeed: 31, siteInstances: [{ id: "yard-b", kind: "yard", x: 8, y: 9, archer: true }] });
    const done = completeSiteInstances(partial, 1);
    expect(done.world.worldSeed).toBe(31);
    expect(done.world.siteInstances.filter((i) => i.kind !== "hunt").map((i) => i.id).sort())
      .toEqual(["cairn-b", "cairnfield", "camp", "lakeside", "yard", "yard-b"]);
    expect(done.world.siteInstances.find((i) => i.id === "yard-b")).toEqual({ id: "yard-b", kind: "yard", x: 8, y: 9, archer: true });
    expect(done.world.siteInstances.filter((i) => i.archer)).toHaveLength(1);
    expect(PROTOTYPE_START).toBeDefined();
  });
});

describe("vainolaisten leirin sijoittelu", () => {
  it("1000 siementä: leiri on kartan reunalla, kaukana aloituksesta, saavutettavissa ja pihoista etäällä", () => {
    const minutes = travelMinutes(PROTOTYPE_PLACEMENT.map, PROTOTYPE_START);
    for (let seed = 1; seed <= 1000; seed++) {
      const all = newSiteInstances(seed);
      const camp = all.find((i) => i.kind === "camp")!;
      const shore = all.filter((i) => i.kind === "lakeside" || i.kind === "cairn");
      expect(all).toHaveLength(6);
      expect(validateCampPlacement(camp, placementWith(shore), all), `siemen ${seed}`).toEqual([]);
      expect(validateYardPlacement(all.filter((i) => i.kind === "yard"), placementWith(shore)), `siemen ${seed}`).toEqual([]);
      expect(chebyshev(camp, PROTOTYPE_START)).toBeGreaterThanOrEqual(CAMP_PLACEMENT.minStartDistance);
      expect(minutes[camp.y * 20 + camp.x]).toBeLessThanOrEqual(CAMP_PLACEMENT.maxStartMinutes);
    }
  });

  it("leiri vaihtelee siemenestä ja on riippumaton pihojen virrasta", () => {
    const spots = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const camp = newSiteInstances(seed).find((i) => i.kind === "camp")!;
      spots.add(`${camp.x},${camp.y}`);
    }
    expect(spots.size).toBeGreaterThan(8);
    expect(newSiteInstances(99)).toEqual(newSiteInstances(99));
  });

  it("validaattori hylkää leirin, joka on keskellä, lähellä aloitusta, väärällä maastolla tai pihan vieressä", () => {
    const camp = placeCampInstance(5, PROTOTYPE_PLACEMENT, []);
    const bad = (over: Partial<SiteInstance>, others: SiteInstance[] = []) =>
      validateCampPlacement({ ...camp, ...over }, PROTOTYPE_PLACEMENT, others).join(" | ");
    expect(bad({})).toBe("");
    expect(bad({ x: 10, y: 10 })).toContain("ei ole kartan reunalla");
    expect(bad({ x: 8, y: 17 })).toContain("liian lähellä aloitusta");
    expect(bad({ x: 0, y: 0 })).toContain("maasto water");
    expect(bad({}, [{ id: "yard", kind: "yard", x: camp.x, y: camp.y, archer: false }])).toContain("liian lähellä paikkaa yard");
    expect(bad({ x: 99 })).toContain("kartan ulkopuolella");
    expect(CAMP_PLACEMENT.edgeBand).toBeGreaterThan(0);
  });
});

describe("tietäjän mökki ja kalmistot rannoille (v08)", () => {
  it("500 siementä: mökki ja kaksi kalmistoa rantaruuduilla, kalmistot erillään mökistä ja toisistaan", () => {
    const sagePlaces = new Set<string>();
    for (let seed = 1; seed <= 500; seed++) {
      const all = newSiteInstances(seed);
      const sage = all.find((i) => i.id === "lakeside")!;
      const cairns = all.filter((i) => i.kind === "cairn");
      expect(sage.kind).toBe("lakeside");
      expect(cairns.map((c) => c.id)).toEqual(["cairnfield", "cairn-b"]);
      for (const site of [sage, ...cairns]) {
        expect(isShoreCell(PROTOTYPE_MAP, site.x, site.y), `siemen ${seed} ${site.id}`).toBe(true);
        expect(validateShorePlacement(site, PROTOTYPE_PLACEMENT, all), `siemen ${seed}`).toEqual([]);
        expect(chebyshev(site, sage === site ? cairns[0] : sage)).toBeGreaterThanOrEqual(SHORE_PLACEMENT.minSageCairnDistance);
      }
      expect(chebyshev(cairns[0], cairns[1])).toBeGreaterThanOrEqual(SHORE_PLACEMENT.minCairnDistance);
      expect(SHORE_PLACEMENT.sageTerrains).toContain(mapCell(PROTOTYPE_MAP, sage.x, sage.y)!.terrainId);
      sagePlaces.add(`${sage.x},${sage.y}`);
    }
    expect(sagePlaces.size).toBeGreaterThan(15);                          // oikeasti eri paikkoja
  });

  it("rantaruutu vaatii viereen avoveden; joki ja viisto vesi eivät riitä", () => {
    expect(isShoreCell(PROTOTYPE_MAP, LEGACY_SHORE_POSITIONS.lakeside.x, LEGACY_SHORE_POSITIONS.lakeside.y)).toBe(true);
    expect(isShoreCell(PROTOTYPE_MAP, PROTOTYPE_START.x, PROTOTYPE_START.y)).toBe(false);
    expect(isShoreCell(PROTOTYPE_MAP, 0, 0)).toBe(false);                 // vesi itse ei ole ranta
  });
});
