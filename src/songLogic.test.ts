import { describe, expect, it } from "vitest";
import { SONG, SONG_VERSES, beatGap, inZone, songOutcome, zoneHalf } from "./songLogic";

describe("laulun osuma-alueet", () => {
  it("jokainen alue on edellistä lyhyempi", () => {
    for (let i = 1; i < SONG_VERSES.length; i++) expect(zoneHalf(i)).toBeLessThan(zoneHalf(i - 1));
    expect(zoneHalf(0)).toBeCloseTo(SONG.zoneFirst / SONG.speed);
  });
  it("nauhan nopeus lyhentää riimujen väliä ja alueita samassa suhteessa", () => {
    expect(SONG.speed).toBe(1.25);
    expect(beatGap()).toBeCloseTo(0.64);
    expect(zoneHalf(0)).toBeCloseTo(0.192);
  });
  it("painallus osuu, kun se on alueen sisällä, eikä vaadi täsmäosumaa", () => {
    expect(inZone(0, 0)).toBe(true);
    expect(inZone(-0.15, 0)).toBe(true);
    expect(inZone(0.3, 0)).toBe(false);
  });
  it("sama ohilyönti kelpaa ensimmäiseen alueeseen mutta ei viimeiseen", () => {
    expect(inZone(0.15, 0)).toBe(true);
    expect(inZone(0.15, SONG_VERSES.length - 1)).toBe(false);
  });
});

describe("laulun lopputulos", () => {
  const hits = (n: number) => SONG_VERSES.map((_, i) => i < n);
  it("riimuja on kahdeksan ja loitsuun vaaditaan puolet", () => {
    expect(SONG_VERSES.length).toBe(8);
    expect(SONG.minHits).toBe(4);
  });
  it("kesto kasvaa osumien määrän mukaan", () => {
    expect(songOutcome(hits(4)).rootTime).toBe(4 * SONG.rootTimePerHit);
    expect(songOutcome(hits(6)).rootTime).toBe(6 * SONG.rootTimePerHit);
    expect(songOutcome(hits(8)).rootTime).toBe(6);
  });
  it("liian vähillä osumilla loitsu epäonnistuu", () => {
    expect(songOutcome(hits(3))).toMatchObject({ success: false, rootTime: 0 });
    expect(songOutcome(hits(0)).success).toBe(false);
  });
});
