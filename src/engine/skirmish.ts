// Aaltotaistelu: vastustajat saapuvat yksi kerrallaan.
import * as THREE from "three";
import { WAVES } from "../combat";
import { FighterLook } from "../fighter";
import { ARENA_RADIUS } from "../world";
import { makeActor } from "./actor";
import { newAi } from "./ai";
import { $ } from "./dom";
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

export function spawnEnemy() {
  g.wave++;
  const def = ENEMIES[(g.wave - 1) % ENEMIES.length];
  // Ilmestyy aukion reunalta noin kuuden metrin päähän pelaajasta.
  const a = Math.atan2(-g.player.pos.x, -g.player.pos.z) + (Math.random() - 0.5);
  const pos = g.player.pos.clone().add(new THREE.Vector3(Math.sin(a) * 6, 0, Math.cos(a) * 6));
  const r = Math.hypot(pos.x, pos.z);
  if (r > ARENA_RADIUS - 1) pos.multiplyScalar((ARENA_RADIUS - 1) / r);
  g.enemy = makeActor(def.look, pos, g.wave, 0xff6a3a);
  g.ai = newAi();
  $("ename").textContent = def.name;
  $("wave").textContent = `Aalto ${g.wave}`;
  showMsg(`Aalto ${g.wave}`, def.name);
}

export function onEnemyDeath() {
  showMsg("Vastustaja kaatui", "Seuraava saapuu metsästä…", 2.4);
  g.nextWaveAt = g.gameTime + WAVES.nextWaveDelay;
}
