import { describe, expect, it } from "vitest";
import { CHARACTERS } from "./combat";
import { baseStats } from "./stats";
import { CAMPAIGN_WAVES, FINAL_WAVE, TOTAL_ENEMIES, aiLevelForWave, waveEnemies } from "./waves";

const label = (wave: number) => waveEnemies(wave).map((e) => `${e.character}/${e.loadout}`);

describe("leirin aallot (V7)", () => {
  it("noudattaa omistajan listaa: viisi aaltoa, viimeisessä kolme vihollista", () => {
    expect(FINAL_WAVE).toBe(5);
    expect(label(1)).toEqual(["urho/sword"]);
    expect(label(2)).toEqual(["pohja/sword_shield"]);
    expect(label(3)).toEqual(["urho/spear", "pohja/sword"]);
    expect(label(4)).toEqual(["pohja/spear", "pohja/sword_shield"]);
    expect(label(5)).toEqual(["urho/spear", "pohja/sword_shield", "pohja/sword"]);
    expect(CAMPAIGN_WAVES.map((w) => w.length)).toEqual([1, 1, 2, 2, 3]);
    expect(TOTAL_ENEMIES).toBe(9);
  });

  it("aaltonumero rajataan listaan (savutestien ohitus ei ylitä loppua)", () => {
    expect(waveEnemies(0)).toBe(waveEnemies(1));
    expect(waveEnemies(99)).toBe(waveEnemies(5));
  });

  it("vastustajat pysyvät perusarvoissa: taso 0 ei lisää elämää tai voimaa, eikä ryhmä muuta niitä", () => {
    for (const wave of CAMPAIGN_WAVES) {
      for (const enemy of wave) {
        const stats = baseStats(enemy.character, 0);
        expect(stats.maxHp).toBe(CHARACTERS[enemy.character].hp);
        expect(stats.power).toBe(CHARACTERS[enemy.character].power);
      }
    }
  });

  it("tekoälyn taito kasvaa hitaasti: aalto 1 on perustasolla ja jokainen seuraava yhden askeleen taitavampi", () => {
    expect([1, 2, 3, 4, 5].map(aiLevelForWave)).toEqual([0, 1, 2, 3, 4]);
    expect(aiLevelForWave(0)).toBe(0);
  });
});
