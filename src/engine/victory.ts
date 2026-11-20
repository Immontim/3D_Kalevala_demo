// Voitto: leirin viimeisen aallon kaaduttua tulos kerrotaan maailmamoottorille (`battle.won`), jonka
// sääntö merkitsee kampanjan voitetuksi ja tallentaa loppuruudun tilastot, ja peli palaa kartalle,
// jossa loppuruutu näytetään (src/map/ending.ts).
import { mapUrl } from "../app/route";
import { t } from "../i18n";
import { createEmptySceneReturn, saveSceneReturn } from "../map/transition";
import { ARENA } from "../world";
import { FINAL_WAVE } from "../waves";
import { showMsg } from "./hud";
import { worldRuntime } from "./store";

/** Palauttaa false, jos tallennus epäonnistui (voittoa ei merkitty, ja kutsuja yrittää uudelleen). */
export function finishVictory(): boolean {
  const posted = worldRuntime().post({ type: "battle.won", sceneId: ARENA, wave: FINAL_WAVE });
  if (!posted.saved) {
    showMsg(t("dialogue.saveFailed"), "", 2);
    return false;
  }
  // Paluukuorma on tyhjä (ei palkintoja): kartta näyttää loppuruudun kampanjan lipun perusteella.
  saveSceneReturn(createEmptySceneReturn("clearing"));
  location.href = mapUrl(location.href).href;
  return true;
}
