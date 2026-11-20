// Leirin aaltotaistelun kiinteä aaltolista (V7). Puhdas data: ei Three.js:ää, joten sisältö on testattavissa.
//
// Vastustajat pysyvät perusarvoissaan kaikissa aalloissa: ei elämän tai voiman lisäystä aallon mukaan
// eikä ryhmäkerrointa monivihuisissa aalloissa (omistajan päätös). Vain tekoälyn taito nousee hitaasti
// (`aiLevelForWave`): ensimmäinen aalto on aallon 0 arvoilla, ja jokainen seuraava on hieman taitavampi.
import type { Loadout } from "./combat";
import type { CharacterId } from "./fighter";

export interface WaveEnemy {
  character: Exclude<CharacterId, "hero">;
  loadout: Loadout;
}

/** Viisi aaltoa; viimeisessä on kolme vihollista. Voitto = viimeisen aallon kaatuminen. */
export const CAMPAIGN_WAVES: readonly (readonly WaveEnemy[])[] = [
  /* 1 */ [{ character: "urho", loadout: "sword" }],
  /* 2 */ [{ character: "pohja", loadout: "sword_shield" }],
  /* 3 */ [{ character: "urho", loadout: "spear" }, { character: "pohja", loadout: "sword" }],
  /* 4 */ [{ character: "pohja", loadout: "spear" }, { character: "pohja", loadout: "sword_shield" }],
  /* 5 */ [{ character: "urho", loadout: "spear" }, { character: "pohja", loadout: "sword_shield" }, { character: "pohja", loadout: "sword" }],
];

export const FINAL_WAVE = CAMPAIGN_WAVES.length;

/** Vihollisten kokonaismäärä koko taistelussa (loppuruudun tilasto). */
export const TOTAL_ENEMIES = CAMPAIGN_WAVES.reduce((sum, wave) => sum + wave.length, 0);

/** Aallon (1-pohjainen) vastustajat; ulkopuolinen numero rajataan. */
export function waveEnemies(wave: number): readonly WaveEnemy[] {
  return CAMPAIGN_WAVES[Math.max(1, Math.min(FINAL_WAVE, Math.round(wave))) - 1];
}

/** Tekoälyn taso aallolla: aalto 1 = taso 0 (perus), sitten +1 aaltoa kohti. Vaikuttaa vain torjuntaan ja ennakointiin. */
export function aiLevelForWave(wave: number): number {
  return Math.max(0, wave - 1);
}
