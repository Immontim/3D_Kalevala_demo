// Aaltotaistelu: leirin viisi kiinteää aaltoa (src/waves.ts). Seuraava aalto tulee, kun edellinen on kaatunut,
// ja viimeisen aallon kaatuminen on voitto (finishVictory).
import * as THREE from "three";
import { WAVES } from "../combat";
import { FighterLook } from "../fighter";
import { t } from "../i18n";
import { FINAL_WAVE, aiLevelForWave, waveEnemies } from "../waves";
import { ARENA, groundHeight } from "../world";
import { approachSpawns, clampToWalkable, sceneLayout, walkableDepth } from "../sceneLayout";
import { $ } from "./dom";
import { addEnemy, clearEnemies } from "./enemies";
import { Encounter } from "./encounter";
import { renewPlayerShield } from "./hero";
import { showMsg } from "./hud";
import { g } from "./state";
import { world } from "./view";
import { finishVictory } from "./victory";

export const ENEMIES: { name: string; look: FighterLook }[] = [
  { name: t("enemy.urho"), look: { character: "urho", loadout: "sword", helmet: true } },
  { name: t("enemy.pohja"), look: { character: "pohja", loadout: "sword", helmet: true, ringMail: true, greaves: true } },
  { name: t("enemy.urhoSpear"), look: { character: "urho", loadout: "spear", helmet: true } },
  { name: t("enemy.pohjaShield"), look: { character: "pohja", loadout: "sword_shield", helmet: true, ringMail: true, greaves: true } },
  { name: t("enemy.urhoShield"), look: { character: "urho", loadout: "sword_shield", helmet: true } },
  { name: t("enemy.pohjaSpear"), look: { character: "pohja", loadout: "spear", helmet: true, ringMail: true, greaves: true } },
];

/** Aallon vihollisen nimi ja ulkonäkö nimilistasta (hahmo + varustus). */
function enemyDef(character: string, loadout: string) {
  const def = ENEMIES.find((e) => e.look.character === character && e.look.loadout === loadout);
  if (!def) throw new Error(`Aaltolistan vihollista ${character}/${loadout} ei ole nimilistassa`);
  return def;
}

let wave = 0;
/** Pelin aika, jolloin seuraava aalto saapuu, tai -1. */
let nextWaveAt = -1;
/** Pelin aika, jolloin voitto viimeistellään (siirtymä kartalle), tai -1. */
let victoryAt = -1;
const VICTORY_DELAY = 3.2;

const LAYOUT = sceneLayout(ARENA);
/** Metsästä tulevan on päästävä aukiolle tässä ajassa; muuten hänet siirretään reunalle. */
const ARRIVE_TIMEOUT = 12;

function nextWave() {
  wave++;
  const group = waveEnemies(wave);
  const size = group.length;
  // Ryhmä tulee vierekkäin pelaajan vastakkaiselta puolelta: aukiolla metsästä puiden välistä,
  // muualla kuljettavan alueen reunalta (sceneLayout.approachSpawns).
  const spots = approachSpawns(LAYOUT, g.player.pos, size, Math.random() - 0.5);
  let first = "";
  group.forEach((member, i) => {
    const def = enemyDef(member.character, member.loadout);
    // Ilman metsäkehää kuljettavalle alueelle, ja sitten puun tai rakennuksen sisältä ulos.
    let { x, z } = spots[i];
    if (LAYOUT.approach === undefined) ({ x, z } = clampToWalkable(LAYOUT, x, z, 0.6));
    ({ x, z } = world.collision.depenetrateDisc(x, z, 0.6));
    const pos = new THREE.Vector3(x, groundHeight(x, z), z);
    // Perusarvot joka aallossa: taso 0 ja ei ryhmäkerrointa. Vain tekoälyn taito kasvaa hitaasti.
    const enemy = addEnemy({ name: def.name, look: def.look, level: 0, aiLevel: aiLevelForWave(wave) }, pos);
    if (enemy.ai && walkableDepth(LAYOUT, x, z) < enemy.radius + 0.1) enemy.ai.arriveUntil = g.gameTime + ARRIVE_TIMEOUT;
    first ||= def.name;
  });
  $("wave").textContent = t("wave.titleOf", { wave, total: FINAL_WAVE });
  showMsg(t("wave.title", { wave }), size === 1 ? first : t("wave.opponents", { count: size }));
}

export const skirmish: Encounter = {
  start() {
    wave = 0;
    nextWaveAt = -1;
    victoryAt = -1;
    nextWave();
  },
  update() {
    if (victoryAt >= 0) {
      if (g.gameTime < victoryAt) return;
      // Tallennus voi epäonnistua: yritetään uudelleen hetken päästä, jotta voitto ei katoa.
      victoryAt = finishVictory() ? -1 : g.gameTime + 2;
      return;
    }
    if (nextWaveAt < 0 || g.gameTime < nextWaveAt) return;
    nextWaveAt = -1;
    // Hengähdys aaltojen välissä: elämää ja kestävyyttä takaisin ja uusi ehjä kilpi.
    const p = g.player;
    p.hp = Math.min(p.stats.maxHp, p.hp + WAVES.restHp);
    p.stamina = Math.min(p.stats.maxStamina, p.stamina + WAVES.restStamina);
    renewPlayerShield();
    nextWave();
  },
  onEnemyDown() {
    if (g.enemies.length > 0) {
      showMsg(t("wave.enemyDown"), t("wave.remaining", { count: g.enemies.length }), 1.4);
      return;
    }
    if (wave >= FINAL_WAVE) {
      showMsg(t("wave.victory"), t("wave.victorySub"), VICTORY_DELAY);
      victoryAt = g.gameTime + VICTORY_DELAY;
      return;
    }
    showMsg(t("wave.enemyDown"), t("wave.next"), 2.4);
    nextWaveAt = g.gameTime + WAVES.nextWaveDelay;
  },
};

/** Käynnissä olevan aallon numero (0 ennen ensimmäistä). */
export function currentWave() { return wave; }

/** Savutestit: vaihtaa suoraan annettuun aaltoon (1-5, ks. src/waves.ts). */
export function skipToWave(n: number) {
  clearEnemies();
  wave = Math.max(0, Math.min(FINAL_WAVE, Math.round(n)) - 1);
  nextWaveAt = -1;
  victoryAt = -1;
  renewPlayerShield();
  nextWave();
}
