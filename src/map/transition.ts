// Kartan ja 3D-kohtausten välinen tyypitetty silta. Moduuli ei riipu DOM:sta tai Three.js:stä,
// joten siirtymän tasapaino ja rajatapaukset voidaan testata ilman 3D-maailman lataamista.
import type { SceneId, SceneKind } from "../app/route";
import { MAP_DIRS, type MapDir } from "../sceneLayout";
import { effectiveStats, withModifier, type Modifier, type Stats } from "../stats";
import { LONG_EFFECT_MOD_PREFIX, longEffectModifiers } from "./longEffects";
import type { CampaignState } from "./campaign";

export interface SceneTransitionBalance {
  hungryBelow: number;
  hungryPenalty: number;
  starvingAt: number;
  starvingPenalty: number;
}

/** Yksi keskitetty säätöpiste kartalta alkavan taistelun kylläisyysvaikutukselle. */
export const SCENE_TRANSITION_BALANCE: Readonly<SceneTransitionBalance> = {
  hungryBelow: 50,
  hungryPenalty: 20,
  starvingAt: 0,
  starvingPenalty: 40,
};

export interface MapToSceneTransition {
  schemaVersion: 1;
  scene: SceneId;
  kind: SceneKind;
  satiety: number;
  maxHpPenalty: number;
  maxStaminaPenalty: number;
}

/** Paluukanava on nyt tarkoituksella tyhjä. Rewards-rakenne varaa paikan tuleville ruuille. */
export interface SceneReward {
  itemId: string;
  quantity: number;
}

export interface SceneToMapTransition {
  schemaVersion: 1;
  scene: SceneId;
  rewards: SceneReward[];
  /** Polunsuun suunta, jos kohtauksesta poistuttiin polkua pitkin; kartta siirtää sankaria yhden ruudun. */
  exitDir?: MapDir;
}

export const SCENE_RETURN_STORAGE_KEY = "laulun-miekka.scene-return.v1";

export interface TransitionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function satietyPenalty(
  satiety: number,
  kind: SceneKind,
  balance: Readonly<SceneTransitionBalance> = SCENE_TRANSITION_BALANCE,
): number {
  if (kind !== "battle") return 0;
  const safeSatiety = Number.isFinite(satiety) ? Math.max(0, Math.min(100, satiety)) : 100;
  if (safeSatiety <= balance.starvingAt) return Math.max(0, balance.starvingPenalty);
  if (safeSatiety < balance.hungryBelow) return Math.max(0, balance.hungryPenalty);
  return 0;
}

export function createMapToSceneTransition(
  scene: SceneId,
  kind: SceneKind,
  satiety: number,
  balance: Readonly<SceneTransitionBalance> = SCENE_TRANSITION_BALANCE,
): MapToSceneTransition {
  const safeSatiety = Number.isFinite(satiety) ? Math.max(0, Math.min(100, satiety)) : 100;
  const penalty = satietyPenalty(safeSatiety, kind, balance);
  return {
    schemaVersion: 1,
    scene,
    kind,
    satiety: safeSatiety,
    maxHpPenalty: penalty,
    maxStaminaPenalty: penalty,
  };
}

export function createEmptySceneReturn(scene: SceneId, exitDir?: MapDir | null): SceneToMapTransition {
  return exitDir ? { schemaVersion: 1, scene, rewards: [], exitDir } : { schemaVersion: 1, scene, rewards: [] };
}

/** Tallentaa 3D:n paluukuorman sivunlatauksen yli. Tallennuksen esto ei estä kartalle palaamista. */
export function saveSceneReturn(payload: SceneToMapTransition, storage?: TransitionStorage): boolean {
  try {
    (storage ?? localStorage).setItem(SCENE_RETURN_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/**
 * Kuluttaa paluukuorman korkeintaan kerran. Myös rikkinäinen arvo poistetaan, jotta peli ei
 * jää yrittämään samaa vioittunutta siirtymää jokaisella kartan käynnistyksellä.
 */
export function consumeSceneReturn(storage?: TransitionStorage): SceneToMapTransition | null {
  try {
    const target = storage ?? localStorage;
    const raw = target.getItem(SCENE_RETURN_STORAGE_KEY);
    if (raw === null) return null;
    target.removeItem(SCENE_RETURN_STORAGE_KEY);
    return parseSceneReturn(raw);
  } catch {
    return null;
  }
}

export function parseSceneReturn(value: unknown): SceneToMapTransition | null {
  let data: unknown = value;
  if (typeof value === "string") {
    try { data = JSON.parse(value); } catch { return null; }
  }
  if (!isRecord(data) || data.schemaVersion !== 1 || !isSceneId(data.scene)
    || !Array.isArray(data.rewards)) return null;
  const rewards: SceneReward[] = [];
  for (const reward of data.rewards) {
    if (!isRecord(reward) || typeof reward.itemId !== "string" || reward.itemId.length < 1
      || !Number.isInteger(reward.quantity) || (reward.quantity as number) < 1) return null;
    rewards.push({ itemId: reward.itemId, quantity: reward.quantity as number });
  }
  const result: SceneToMapTransition = { schemaVersion: 1, scene: data.scene, rewards };
  // Tuntematon suunta pudotetaan, mutta muuta kuorta ei hylätä.
  if (typeof data.exitDir === "string" && (MAP_DIRS as readonly string[]).includes(data.exitDir)) {
    result.exitDir = data.exitDir as MapDir;
  }
  return result;
}

interface TransitionActor {
  base: Stats;
  mods: Modifier[];
  stats: Stats;
  hp: number;
  stamina: number;
}

const HP_MOD = "map-transition:satiety-max-hp";
const STAMINA_MOD = "map-transition:satiety-max-stamina";

/**
 * Lisää siirtymän pysyvät taistelumodifierit sankariin. Samat tunnisteet korvataan, joten kutsu
 * on idempotentti eikä rangaistus pinoudu restartissa tai varusteen vaihdossa.
 */
export function applyMapToSceneTransition(
  actor: TransitionActor,
  transition: MapToSceneTransition,
  now = 0,
): void {
  actor.mods = actor.mods.filter((mod) => mod.id !== HP_MOD && mod.id !== STAMINA_MOD);
  if (transition.maxHpPenalty > 0) {
    actor.mods = withModifier(actor.mods, {
      id: HP_MOD,
      stat: "maxHp",
      add: -transition.maxHpPenalty,
    });
  }
  if (transition.maxStaminaPenalty > 0) {
    actor.mods = withModifier(actor.mods, {
      id: STAMINA_MOD,
      stat: "maxStamina",
      add: -transition.maxStaminaPenalty,
    });
  }
  actor.stats = effectiveStats(actor.base, actor.mods, now);
  actor.hp = Math.min(actor.hp, actor.stats.maxHp);
  actor.stamina = Math.min(actor.stamina, actor.stats.maxStamina);
}

/**
 * Pitkäkestoisten efektien (esim. Ukon siunaus) muuntimet sankariin kampanjan tilasta. Korvaa aiemmat
 * efektimuuntimet, joten kutsu on idempotentti ja sopii sekä spawniin että kesken käynnin saatuun
 * siunaukseen. Summautuu nälän rangaistukseen, koska tunnisteet ovat eri.
 */
export function applyLongEffects(actor: TransitionActor, state: Pick<CampaignState, "player" | "world">, now = 0): void {
  actor.mods = actor.mods.filter((mod) => !mod.id.startsWith(LONG_EFFECT_MOD_PREFIX));
  for (const mod of longEffectModifiers(state)) actor.mods = withModifier(actor.mods, mod);
  actor.stats = effectiveStats(actor.base, actor.mods, now);
  actor.hp = Math.min(actor.hp, actor.stats.maxHp);
  actor.stamina = Math.min(actor.stamina, actor.stats.maxStamina);
}

let activeTransition: MapToSceneTransition | null = null;

/** Asetetaan kerran ennen ensimmäistä spawnHero-kutsua; sama siirtymä koskee myös restarteja. */
export function configureMapToSceneTransition(transition: MapToSceneTransition | null): void {
  activeTransition = transition;
}

export function applyActiveMapTransition(actor: TransitionActor, now = 0): void {
  if (activeTransition) applyMapToSceneTransition(actor, activeTransition, now);
}

/** Tukee yhden julkaisun ajan myös v1-tallennuksen hunger-kenttää suoraa URL-käynnistystä varten. */
export function campaignSatiety(player: { satiety?: unknown; hunger?: unknown }): number {
  if (typeof player.satiety === "number" && Number.isFinite(player.satiety)) {
    return Math.max(0, Math.min(100, player.satiety));
  }
  if (typeof player.hunger === "number" && Number.isFinite(player.hunger)) {
    return Math.max(0, Math.min(100, 100 - player.hunger));
  }
  return 100;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSceneId(value: unknown): value is SceneId {
  return value === "clearing" || value === "homestead" || value === "yard" || value === "lakeside" || value === "lakeruin" || value === "cairnfield" || value === "wilds";
}
