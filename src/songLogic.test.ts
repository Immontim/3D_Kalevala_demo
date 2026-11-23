import { describe, expect, it } from "vitest";
import { ARC_ASPECT, HEAL_VERSES, PAUSE_MIN_SHARE, SLEEP_VERSES, SONG, SONGS, SONG_SLOTS, SONG_UNLOCK_FLAG, SONG_VERSES, arcExtent, arcLayout, arcMid, arcPath, halfLength, ringRadii, beatGap, fadeOpacity, healOnHit, inZone, slotPositions, songBeats, stepBogDot, songLead, songOutcome, songSlots, versePlace, zoneHalf } from "./songLogic";

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
  it("Kalevalan säkeet on merkitty alkuperäiskielisiksi eikä käännettäviksi", () => {
    expect(SONG_VERSES[0]).toMatchObject({ kind: "verbatim", lang: "fi", source: "Kalevala, runo 3" });
    expect(HEAL_VERSES[0]).toMatchObject({ kind: "verbatim", lang: "fi", source: "Kalevala, runo 9" });
    expect(SONG_VERSES[0].text).toBe("Lauloi vanha Väinämöinen:");
  });
  it("paikkoja on viisi: kaksi alkulaulua ja kolme tyhjää", () => {
    expect(SONG_SLOTS).toEqual(["bog", "heal", null, null, null]);
  });
  it("Pohjolan uni: kahdeksan Kalevalan 42. runon säettä, sama rytmipeli", () => {
    expect(SLEEP_VERSES).toHaveLength(SONG_VERSES.length);
    expect(SONGS.sleep.verses).toBe(SLEEP_VERSES);
    expect(SLEEP_VERSES.map((v) => v.text)).toEqual([
      "Väkeä väsyttelevi,", "rahvahaista raukaisevi:", "kaikki nukkui kuuntelijat", "sekä vaipui katselijat;",
      "pani pitkähän unehen,", "viikommaksi nukkumahan", "koko Pohjolan perehen", "ja kaiken kyläisen kansan.",
    ]);
    for (const verse of SLEEP_VERSES) expect(verse).toMatchObject({ kind: "verbatim", lang: "fi", source: "Kalevala, runo 42" });
    expect(SONGS.sleep.needsEnemy).toBe(false);
    expect(SONGS.sleep.peaceful).toBe(true);                       // vain tämän voi laulaa rauhassa
    expect(SONGS.sleep.combatTargets).toEqual(["louhi"]);          // taistelussa laulu vaatii Louhen kuuluville
    expect(SONGS.bog.peaceful).toBeUndefined();
    expect(SONGS.heal.peaceful).toBeUndefined();
    expect(SONGS.heal.peaceTargets).toEqual(["jousineito"]);       // parannus rauhassa vain loukkaantuneen jousineidon luona
  });
  it("opeteltu laulu ilmestyy laulupaikkaan vasta lipun jälkeen ja vie ensimmäisen vapaan paikan", () => {
    expect(songSlots({})).toEqual(["bog", "heal", null, null, null]);
    expect(songSlots({ "song.sleep.learned": false })).toEqual(["bog", "heal", null, null, null]);
    expect(songSlots({ "song.sleep.learned": true })).toEqual(["bog", "heal", "sleep", null, null]);
    expect(SONG_UNLOCK_FLAG.sleep).toBe("song.sleep.learned");
    expect(songSlots({ "muu.lippu": true })).toEqual([...SONG_SLOTS]);
  });
  it("parannuslaulu antaa viisi elämää osumasta eikä ylitä enimmäismäärää", () => {
    expect(SONG.healPerHit).toBe(5);
    expect(healOnHit(40, 100)).toBe(45);
    expect(healOnHit(98, 100)).toBe(100);
  });
  it("hidastus laulun aikana on 1/15", () => {
    expect(SONG.slowmo).toBeCloseTo(1 / 15);
  });
  it("onnistunut Pohjolan uni puolittaa vastustajien toimintanopeuden kuudeksi sekunniksi", () => {
    expect(SONG.sleepSlowScale).toBe(0.5);
    expect(SONG.sleepSlowSeconds).toBe(6);
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

describe("riimuparien tauko", () => {
  const restore = { pairPause: SONG.pairPause, pairSize: SONG.pairSize };
  const reset = () => Object.assign(SONG, restore);
  const gaps = (b: number[]) => b.slice(1).map((t, i) => t - b[i]);

  it("tauko nollassa: tasainen rytmi kuten ennen", () => {
    SONG.pairPause = 0;
    const b = songBeats(8, 10, () => 0.7);
    expect(b[0]).toBeCloseTo(10 + songLead());
    for (const d of gaps(b)) expect(d).toBeCloseTo(beatGap());
    reset();
  });
  it("tauko tulee vain jokaisen parin jälkeen ja pysyy 30–100 %:ssa maksimista", () => {
    SONG.pairPause = 0.5;
    for (const r of [0, 0.5, 0.999]) {
      const d = gaps(songBeats(8, 0, () => r));
      d.forEach((gap, i) => {
        const afterPair = (i + 1) % 2 === 0;
        if (!afterPair) expect(gap).toBeCloseTo(beatGap());
        else {
          const extra = gap - beatGap();
          expect(extra).toBeGreaterThanOrEqual(beatGap() * 0.5 * PAUSE_MIN_SHARE - 1e-9);
          expect(extra).toBeLessThanOrEqual(beatGap() * 0.5 + 1e-9);
        }
      });
    }
    reset();
  });
  it("taukoja on kahdeksan säkeen laulussa kolme, ja ryhmän kokoa voi muuttaa", () => {
    SONG.pairPause = 1;
    expect(gaps(songBeats(8, 0, () => 1)).filter((d) => d > beatGap() * 1.01)).toHaveLength(3);
    SONG.pairSize = 3;
    expect(gaps(songBeats(8, 0, () => 1)).filter((d) => d > beatGap() * 1.01)).toHaveLength(2);
    reset();
  });
  it("jokaisella laululla on oma hiipumisaika", () => {
    for (const id of Object.keys(SONGS)) expect(SONG.fade[id as keyof typeof SONG.fade]).toBeGreaterThan(0);
  });
});

describe("säekaaret", () => {
  it("säepari jakaa kaaren: parillinen vasemmalle, pariton oikealle, pari ulospäin", () => {
    expect(versePlace(0)).toEqual({ ring: 0, side: 0 });
    expect(versePlace(1)).toEqual({ ring: 0, side: 1 });
    expect(versePlace(7)).toEqual({ ring: 3, side: 1 });
  });
  it("pisin säe mahtuu sisimmän kaaren kummallekin puoliskolle", () => {
    const l = arcLayout(400, 30, 4);
    const [rx, ry] = ringRadii(l, 0);
    expect(rx).toBeCloseTo(ry * ARC_ASPECT);
    expect(halfLength(rx, ry, 0)).toBeGreaterThan(400);
    expect(halfLength(rx, ry, 1)).toBeGreaterThan(400);
    expect(ringRadii(l, 3)[1]).toBeCloseTo(l.inner + 3 * l.gap);
    expect(l.gap).toBeGreaterThan(30);
  });
  it("kaaret ovat leveämpiä kuin korkeita, ja tilantarve kasvaa renkaiden mukana", () => {
    const e4 = arcExtent(arcLayout(400, 30, 4));
    const e2 = arcExtent(arcLayout(400, 30, 2));
    expect(e4.halfWidth).toBeGreaterThan(e4.up);
    expect(e4.up).toBeGreaterThan(e2.up);
  });
  it("kaaren puoliskot ovat keskipisteen yläpuolella ja vasen on vasemmalla", () => {
    const [lx, ly] = arcMid(500, 500, 480, 300, 0);
    const [rx, ry] = arcMid(500, 500, 480, 300, 1);
    expect(lx).toBeLessThan(500);
    expect(rx).toBeGreaterThan(500);
    expect(ly).toBeLessThan(500);
    expect(ry).toBeCloseTo(ly);
    expect(arcPath(500, 500, 480, 300, 0)).toMatch(/^M[\d.]+,[\d.]+ A480.0,300.0 0 0 1 [\d.]+,[\d.]+$/);
  });
  it("hiipuminen: täysi alussa, puolivälissä puolet, lopussa näkymätön", () => {
    expect(fadeOpacity(0, 1.2)).toBe(1);
    expect(fadeOpacity(0.6, 1.2)).toBeCloseTo(0.5);
    expect(fadeOpacity(2, 1.2)).toBe(0);
    expect(fadeOpacity(0, 0)).toBe(0);
  });
});

describe("suon vahinko", () => {
  const hits = (n: number) => SONG_VERSES.map((_, i) => i < n);
  it("vahinko tulee vain onnistuneeseen suohon, kun osumia on yli kaksi", () => {
    expect(SONG.bogDotMinHits).toBe(3);
    expect(songOutcome(hits(8)).dotPerSec).toBe(10);
    expect(songOutcome(hits(4)).dotPerSec).toBe(10);
    // Kolme osumaa ylittää vahingon rajan, mutta oletuksilla suo vaatii neljä.
    expect(songOutcome(hits(3)).dotPerSec).toBe(0);
    const old = SONG.minHits;
    SONG.minHits = 3;
    expect(songOutcome(hits(3))).toMatchObject({ success: true, dotPerSec: 10 });
    SONG.minHits = 1;
    expect(songOutcome(hits(2))).toMatchObject({ success: true, dotPerSec: 0 });
    SONG.minHits = old;
  });
  it("tikit tulevat sekunnin välein ja koko vahinko on 10 × kesto", () => {
    const dot = { perSec: 10, left: 5.25, acc: 0 };
    const seen: number[] = [];
    let total = 0;
    for (let f = 0; f < 600 && dot.left > 0; f++) {
      const r = stepBogDot(dot, 1 / 60, 1);
      if (r.ticks) seen.push(+(f / 60 + 1 / 60).toFixed(2));
      total += r.damage;
    }
    expect(seen.slice(0, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(seen).toHaveLength(6);
    expect(total).toBeCloseTo(52.5);
  });
  it("iso ruutu ei hukkaa tikkejä", () => {
    const dot = { perSec: 10, left: 3, acc: 0 };
    expect(stepBogDot(dot, 2.5, 1)).toEqual({ ticks: 2, damage: 20 });
    expect(stepBogDot(dot, 2, 1).damage).toBeCloseTo(10);
    expect(dot.left).toBe(0);
    expect(stepBogDot(dot, 1, 1)).toEqual({ ticks: 0, damage: 0 });
  });
});
