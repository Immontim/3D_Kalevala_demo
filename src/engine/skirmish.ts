// Aaltotaistelu: leirin viisi kiinteää aaltoa (src/waves.ts). Seuraava aalto tulee, kun edellinen on kaatunut,
// ja viimeisen aallon kaatuminen on voitto (finishVictory).
import * as THREE from "three";
import { WAVES } from "../combat";
import { FighterLook } from "../fighter";
import { t } from "../i18n";
import { FINAL_WAVE, aiLevelForWave, waveEnemies } from "../waves";
import { ARENA } from "../world";
import { clampToWalkable, sceneLayout } from "../sceneLayout";
import { $ } from "./dom";
import { addEnemy, clearEnemies } from "./enemies";
import { Encounter } from "./encounter";
import { renewPlayerShield } from "./hero";
import { showMsg } from "./hud";
import { g } from "./state";
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

function nextWave() {
  wave++;
  const group = waveEnemies(wave);
  const size = group.length;
  // Ryhmä ilmestyy aukion reunalta noin kuuden metrin päähän pelaajasta, vierekkäin.
  const mid = Math.atan2(-g.player.pos.x, -g.player.pos.z) + (Math.random() - 0.5);
  let first = "";
  group.forEach((member, i) => {
    const def = enemyDef(member.character, member.loadout);
    const a = mid + (i - (size - 1) / 2) * 0.45;
    const pos = g.player.pos.clone().add(new THREE.Vector3(Math.sin(a) * 6, 0, Math.cos(a) * 6));
    // Tulopaikka arenan ympyrän sisään ja sitten kuljettavalle alueelle.
    const dx = pos.x - LAYOUT.arena.x, dz = pos.z - LAYOUT.arena.z;
    const r = Math.hypot(dx, dz), max = LAYOUT.arena.radius - 1;
    if (r > max) { pos.x = LAYOUT.arena.x + (dx * max) / r; pos.z = LAYOUT.arena.z + (dz * max) / r; }
    const c = clampToWalkable(LAYOUT, pos.x, pos.z, 0.6);
    pos.x = c.x; pos.z = c.z;
    // Perusarvot joka aallossa: taso 0 ja ei ryhmäkerrointa. Vain tekoälyn taito kasvaa hitaasti.
    addEnemy({ name: def.name, look: def.look, level: 0, aiLevel: aiLevelForWave(wave) }, pos);
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
