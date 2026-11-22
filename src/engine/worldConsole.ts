// Konsoli `__world`: maailmamoottorin tila ja selitykset kehittäjälle ja savutesteille.
import { finnishText } from "../i18n";
import { ARENA, yardDebug } from "../world";
import type { GameEvent } from "../world/types";
import { focusedSceneItemId } from "./sceneItems";
import { worldRuntime } from "./store";
import { world } from "./view";

export function initWorldConsole() {
  const api = {
    /** Asetetut liput ja nollasta poikkeavat laskurit. */
    get flags() { return worldRuntime().flags(); },
    get counters() { return worldRuntime().counters(); },
    /** Lähettää tapahtuman moottorille (tallentuu kuten pelin oma tapahtuma). Palauttaa mitkä säännöt vaikuttivat. */
    post(event: GameEvent) {
      const { saved, result } = worldRuntime().post(event);
      return {
        saved,
        fired: result.fired.map((f) => f.ruleId),
        skipped: result.skipped.map((s) => ({ ruleId: s.ruleId, why: s.why, reason: s.reason })),
        messages: result.messages.map((m) => finnishText(m.text)),
      };
    },
    /** Säännön (tai kaikkien) suomenkielinen kuvaus ja ehtojen tila nyt. */
    explain(ruleId?: string) { return worldRuntime().explain(finnishText, ruleId); },
    /** Kaikki säännöt ja dialogit proosana omistajan hyväksyttäväksi. */
    describe() { return worldRuntime().describe(finnishText); },
    /** Viimeisin post-kutsun tulos (miksi säännöt eivät vaikuttaneet). */
    get last() { return worldRuntime().lastPost(); },
    scene: ARENA,
    /** Pihan arvottu eläinsijoittelu tällä käynnillä (kanat, kukko, koira). */
    get yard() { return yardDebug.animals ? { ...yardDebug.animals, people: { ...yardDebug.people }, spots: yardDebug.spots } : null; },
    /** Kohtauksen vielä paikallaan olevat poimittavat esineet ja se, jota katse osoittaa. */
    get items() {
      return {
        focused: focusedSceneItemId(),
        list: world.sceneItems().map((i) => ({ id: i.id, takeMode: i.takeMode, at: [+i.focusWorldPosition.x.toFixed(2), +i.focusWorldPosition.y.toFixed(2), +i.focusWorldPosition.z.toFixed(2)] })),
      };
    },
  };
  // `world.ts` on jo asettanut `__world`-olioon kohtauksen tilastot (puut, kolmiot, törmäykset):
  // liitetään moottorin rajapinta samaan olioon, ja getterit säilyvät elävinä.
  const host = window as unknown as { __world?: object };
  host.__world ??= {};
  Object.defineProperties(host.__world, Object.getOwnPropertyDescriptors(api));
}
