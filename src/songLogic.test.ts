import { describe, expect, it } from "vitest";
import { HEAL_VERSES, SONG, SONGS, SONG_SLOTS, SONG_VERSES, beatGap, healOnHit, inZone, slotPositions, songOutcome, zoneHalf } from "./songLogic";

describe("laulun osuma-alueet", () => {
  it("jokainen alue on edellistä lyhyempi", () => {
    for (let i = 1; i < SONG_VERSES.length; i++) expect(zoneHalf(i)).toBeLessThan(zoneHalf(i - 1));
    expect(zoneHalf(0)).toBeCloseTo(SONG.zoneFirst / SONG.speed);
  });
  it("nauhan nopeus lyhentää riimujen väliä ja alueita samassa suhteessa", () => {
    expect(SONG.speed).toBe(1.5);
    expect(beatGap()).toBeCloseTo(0.8 / 1.5);
    expect(zoneHalf(0)).toBeCloseTo(0.16);
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

describe("laulut ja laulupaikat", () => {
  it("lauluilla on yhtä monta säettä, joten sama rytmipeli käy molempiin", () => {
    expect(HEAL_VERSES.length).toBe(SONG_VERSES.length);
    expect(SONGS.bog.verses).toBe(SONG_VERSES);
    expect(SONGS.heal.needsEnemy).toBe(false);
    expect(SONGS.bog.needsEnemy).toBe(true);
  });
  it("paikkoja on viisi: kaksi laulua ja kolme tyhjää", () => {
    expect(SONG_SLOTS).toEqual(["bog", "heal", null, null, null]);
  });
  it("parannuslaulu antaa viisi elämää osumasta eikä ylitä enimmäismäärää", () => {
    expect(SONG.healPerHit).toBe(5);
    expect(healOnHit(40, 100)).toBe(45);
    expect(healOnHit(98, 100)).toBe(100);
  });
  it("hidastus laulun aikana on 1/15", () => {
    expect(SONG.slowmo).toBeCloseTo(1 / 15);
  });
  it("paikat ovat kaarella hahmon yläpuolella vasemmalta oikealle", () => {
    const p = slotPositions(500, 400, 100);
    expect(p).toHaveLength(5);
    for (let i = 1; i < p.length; i++) expect(p[i][0]).toBeGreaterThan(p[i - 1][0]);
    expect(p[2][0]).toBeCloseTo(500);
    expect(p[2][1]).toBeCloseTo(300);
    for (const [x, y] of p) expect(Math.hypot(x - 500, y - 400)).toBeCloseTo(100);
  });
});
