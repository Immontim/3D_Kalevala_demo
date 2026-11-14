// Aaltotaistelu: vastustajat saapuvat aalloittain, ja seuraava aalto tulee, kun edellinen on kaatunut.
import * as THREE from "three";
import { WAVES } from "../combat";
import { FighterLook } from "../fighter";
import { ARENA_RADIUS } from "../world";
import { $ } from "./dom";
import { addEnemy, clearEnemies } from "./enemies";
import { Encounter } from "./encounter";
import { renewPlayerShield } from "./hero";
import { showMsg } from "./hud";
import { g } from "./state";

export const ENEMIES: { name: string; look: FighterLook }[] = [
  { name: "Nuori urho", look: { character: "urho", loadout: "sword" } },
  { name: "Pohjan soturi", look: { character: "pohja", loadout: "sword" } },
  { name: "Nuori urho, keihäs", look: { character: "urho", loadout: "spear" } },
  { name: "Pohjan soturi, kilpi", look: { character: "pohja", loadout: "sword_shield" } },
  { name: "Nuori urho, kilpi", look: { character: "urho", loadout: "sword_shield" } },
  { name: "Pohjan soturi, keihäs", look: { character: "pohja", loadout: "spear" } },
];

let wave = 0;
/** Pelin aika, jolloin seuraava aalto saapuu, tai -1. */
let nextWaveAt = -1;

function nextWave() {
  wave++;
  const def = ENEMIES[(wave - 1) % ENEMIES.length];
  // Ilmestyy aukion reunalta noin kuuden metrin päähän pelaajasta.
  const a = Math.atan2(-g.player.pos.x, -g.player.pos.z) + (Math.random() - 0.5);
  const pos = g.player.pos.clone().add(new THREE.Vector3(Math.sin(a) * 6, 0, Math.cos(a) * 6));
  const r = Math.hypot(pos.x, pos.z);
  if (r > ARENA_RADIUS - 1) pos.multiplyScalar((ARENA_RADIUS - 1) / r);
  addEnemy({ name: def.name, look: def.look, level: wave }, pos);
  $("wave").textContent = `Aalto ${wave}`;
  showMsg(`Aalto ${wave}`, def.name);
}

export const skirmish: Encounter = {
  start() {
    wave = 0;
    nextWaveAt = -1;
    nextWave();
  },
  update() {
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
    if (g.enemies.length > 0) return;
    showMsg("Vastustaja kaatui", "Seuraava saapuu metsästä…", 2.4);
    nextWaveAt = g.gameTime + WAVES.nextWaveDelay;
  },
};

/** Käynnissä olevan aallon numero (0 ennen ensimmäistä). */
export function currentWave() { return wave; }

/** Savutestit: vaihtaa suoraan annettuun aaltoon (1 = urho ja miekka, 3 = keihäs, 4 = kilpi). */
export function skipToWave(n: number) {
  clearEnemies();
  wave = Math.max(0, n - 1);
  nextWaveAt = -1;
  renewPlayerShield();
  nextWave();
}
