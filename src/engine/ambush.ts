// Väijytys metsäpolulla: 1–3 Pohjan soturia hyökkää kerralla (ei aaltoja). Kaatuneet jäävät maahan koko
// kohtauksen ajaksi. Pako polunsuusta (exit.ts); kuolema vie ruoat ja palauttaa kartalle viiveellä.
// Joukko, tulopaikat ja säännöt ovat puhtaassa moduulissa src/ambush.ts.
import * as THREE from "three";
import { ambushExitDir, ambushRoster, ambushSpawns, parseAmbushSite, warriorNameKey } from "../ambush";
import { withoutFood } from "../map/campaign";
import type { MapDir, SceneExit } from "../sceneLayout";
import { t } from "../i18n";
import { groundHeight } from "../world";
import { $ } from "./dom";
import { addEnemy } from "./enemies";
import type { Encounter } from "./encounter";
import { showMsg } from "./hud";
import { g } from "./state";
import { campaignStore } from "./store";
import { world } from "./view";

/** Kuoleman jälkeinen viive ennen paluuta kartalle (reaaliaikaa, s); sama kuin metsästyksessä. */
const DEATH_RETURN_DELAY = 3.5;

/** Tämän käynnin väijytys: siemen ja kartan kulkusuunta (`?site=ambush-<siemen>-<suunta>`). */
export const ambushState: { seed: number; travel: MapDir; cleared: boolean } = {
  seed: 1, travel: "n", cleared: false,
};

/** Asettaa väijytyksen reitin site-parametrista; puuttuva tai tuntematon arpoo siemenen (suora avaus valikosta). */
export function configureAmbush(site: string | null) {
  const parsed = parseAmbushSite(site);
  ambushState.seed = parsed?.seed ?? Math.floor(Math.random() * 4294967296);
  ambushState.travel = parsed?.travel ?? "n";
  ambushState.cleared = false;
}

/** Polunsuun karttasuunta: taaksepäin palaa lähtöruutuun, eteenpäin jää kohderuutuun. */
export function ambushExitMapDir(exit: SceneExit): MapDir | null {
  return ambushExitDir(exit.id, ambushState.travel);
}

let deathReturn: { at: number; go: () => void } | null = null;

function spawnRoster() {
  const roster = ambushRoster(ambushState.seed);
  const spots = ambushSpawns(roster.length, ambushState.seed);
  roster.forEach((look, i) => {
    const { x, z } = world.collision.depenetrateDisc(spots[i].x, spots[i].z, 0.6);
    // Perusarvot kuten leirin ensimmäisessä aallossa: taso 0, tekoälyn taito 0.
    addEnemy({ name: t(warriorNameKey(look)), look, level: 0, aiLevel: 0 }, new THREE.Vector3(x, groundHeight(x, z), z));
  });
  return roster.length;
}

export const ambush: Encounter = {
  keepCorpses: true,
  /** Väijyjien kaaduttua kohtaus rauhoittuu: ase huotraan, polun voi kulkea rauhassa. */
  get peaceful() { return ambushState.cleared; },
  start() {
    ambushState.cleared = false;
    deathReturn = null;
    $("wave").textContent = "";
    const count = spawnRoster();
    showMsg(t("ambush.title"), count === 1 ? t("ambush.subOne") : t("ambush.subMany", { count }), 2.6);
  },
  update() {
    if (deathReturn && g.realTime >= deathReturn.at) {
      const go = deathReturn.go;
      deathReturn = null;
      go();
    }
  },
  onEnemyDown() {
    if (g.enemies.length > 0) {
      showMsg(t("wave.enemyDown"), t("wave.remaining", { count: g.enemies.length }), 1.4);
      return;
    }
    ambushState.cleared = true;
    showMsg(t("ambush.cleared"), t("ambush.clearedSub"), 3.2);
  },
  onPlayerDeath(goToMap) {
    // Väijyjät vievät kaikki ruoat (omistaja 2026-11-26). Epäonnistunut tallennus jättää ruoat; paluu tapahtuu silti.
    const update = campaignStore().update((state) => ({
      ...state,
      player: { ...state.player, inventory: withoutFood(state.player.inventory) },
    }));
    if (!update.ok) console.warn("Väijytys: ruokien poiston tallennus epäonnistui");
    deathReturn = { at: g.realTime + DEATH_RETURN_DELAY, go: goToMap };
    showMsg(t("ambush.deathTitle"), t("ambush.deathSub"), 9999);
    return true;
  },
  deathPending() { return deathReturn !== null; },
};
