import { describe, expect, it } from "vitest";
import { ROOT_TIME_PER_HIT, SONG_VERSES, ZONE_FIRST, inZone, songOutcome, zoneHalf } from "./songLogic";

describe("laulun osuma-alueet", () => {
  it("jokainen alue on edellistä lyhyempi", () => {
    for (let i = 1; i < SONG_VERSES.length; i++) expect(zoneHalf(i)).toBeLessThan(zoneHalf(i - 1));
    expect(zoneHalf(0)).toBe(ZONE_FIRST);
  });
  it("painallus osuu, kun se on alueen sisällä, eikä vaadi täsmäosumaa", () => {
    expect(inZone(0, 0)).toBe(true);
    expect(inZone(-0.2, 0)).toBe(true);
    expect(inZone(0.3, 0)).toBe(false);
  });
  it("sama ohilyönti kelpaa ensimmäiseen alueeseen mutta ei viimeiseen", () => {
    expect(inZone(0.2, 0)).toBe(true);
    expect(inZone(0.2, 3)).toBe(false);
  });
});

describe("laulun lopputulos", () => {
  it("kesto kasvaa osumien määrän mukaan", () => {
    expect(songOutcome([true, true, false, false]).rootTime).toBe(2 * ROOT_TIME_PER_HIT);
    expect(songOutcome([true, true, true, false]).rootTime).toBe(3 * ROOT_TIME_PER_HIT);
    expect(songOutcome([true, true, true, true]).rootTime).toBe(4 * ROOT_TIME_PER_HIT);
  });
  it("yhdellä osumalla tai ilman loitsu epäonnistuu", () => {
    expect(songOutcome([false, true, false, false])).toMatchObject({ success: false, rootTime: 0 });
    expect(songOutcome([false, false, false, false]).success).toBe(false);
  });
});
