// Efektien soveltaminen. Efektilista on atominen: jos yksikin epäonnistuu (esim. tavarat eivät
// mahdu mukaan), mikään sen vaikutus ei tule voimaan. Efektit eivät kosketa maailma-aikaa
// (`worldMinutes`): 3D-kohtaus ei kuluta aikaa.
import { setSceneItemTakeMode, tryAddItem, tryRemoveItem, tryRemoveTagged, type CampaignState } from "../map/campaign";
import { nearestUnknownHuntGround } from "../map/huntGrounds";
import { tryAddLongEffect } from "../map/longEffects";
import { revealSiteOnMap } from "../map/reveal";
import { currentMoonMark } from "./conditions";
import { resolveInstanceId } from "./instances";
import { totalDays } from "../map/uiState";
import { withCounterAdded, withCounterSet, withFlag } from "./state";
import type { Effect, OutAction, OutMessage, WorldData } from "./types";

export type EffectFailure = "inventory-full" | "missing-item" | "unknown-flag" | "unknown-counter" | "unknown-site" | "effects-full";

export type ApplyResult =
  | { ok: true; state: CampaignState; messages: OutMessage[]; actions: OutAction[] }
  | { ok: false; reason: EffectFailure; detail: string; state: CampaignState; messages: []; actions: [] };

export function applyEffects(state: CampaignState, effects: readonly Effect[], data: WorldData): ApplyResult {
  let current = state;
  const messages: OutMessage[] = [];
  const actions: OutAction[] = [];
  for (const effect of effects) {
    switch (effect.kind) {
      case "setFlag": {
        if (!data.flags[effect.flag]) return fail(state, "unknown-flag", `tuntematon lippu ${effect.flag}`);
        const engine = withFlag(current.engine, effect.flag, effect.value ?? true);
        if (engine !== current.engine) current = { ...current, engine };
        break;
      }
      case "addCounter": {
        if (!data.counters[effect.counter]) return fail(state, "unknown-counter", `tuntematon laskuri ${effect.counter}`);
        const engine = withCounterAdded(current.engine, effect.counter, effect.amount, data.counters[effect.counter].max);
        if (engine !== current.engine) current = { ...current, engine };
        break;
      }
      case "giveItem": {
        const inventory = tryAddItem(current.player.inventory, effect.itemId, effect.quantity);
        if (!inventory) return fail(state, "inventory-full", `${effect.itemId} ×${effect.quantity} ei mahdu inventaarioon`);
        current = { ...current, player: { ...current.player, inventory } };
        break;
      }
      case "takeItem": {
        const inventory = tryRemoveItem(current.player.inventory, effect.itemId, effect.quantity);
        if (!inventory) return fail(state, "missing-item", `${effect.itemId} ×${effect.quantity} ei löydy inventaariosta`);
        current = { ...current, player: { ...current.player, inventory } };
        break;
      }
      case "takeTagged": {
        const inventory = tryRemoveTagged(current.player.inventory, effect.tag, effect.quantity);
        if (!inventory) return fail(state, "missing-item", `${effect.tag} ×${effect.quantity} ei löydy inventaariosta`);
        current = { ...current, player: { ...current.player, inventory } };
        break;
      }
      case "setSceneItemTakeMode": {
        const id = resolveInstanceId(current, effect.instanceId);
        if (!id) return fail(state, "unknown-site", `pihaa ei löydy esineelle ${effect.instanceId}`);
        current = setSceneItemTakeMode(current, id, effect.takeMode);
        break;
      }
      case "message":
        messages.push(effect.sub ? { text: effect.text, sub: effect.sub } : { text: effect.text });
        break;
      case "startSongLesson":
        actions.push({ kind: "songLesson", songId: effect.songId });
        break;
      case "revealSite": {
        const revealed = revealSiteOnMap(current, effect.siteId);
        if (!revealed) return fail(state, "unknown-site", `tuntematon karttapaikka ${effect.siteId}`);
        current = revealed;
        break;
      }
      case "removeNpc":
        actions.push({ kind: "removeNpc", npcId: effect.npcId });
        break;
      case "recordVictory": {
        const cells = current.world.discovered;
        const explored = cells.length ? (100 * cells.filter(Boolean).length) / cells.length : 0;
        let engine = withFlag(current.engine, "campaign.won", true);
        engine = withCounterSet(engine, "win.days", totalDays(current.world.worldMinutes), data.counters["win.days"]?.max ?? 9999);
        engine = withCounterSet(engine, "win.explored", explored, data.counters["win.explored"]?.max ?? 100);
        current = { ...current, engine };
        break;
      }
      case "setNpcState":
        actions.push({ kind: "npcState", npcId: effect.npcId, state: effect.state });
        break;
      case "startEncounter":
        actions.push({ kind: "startEncounter", encounterId: effect.encounterId });
        break;
      case "returnToMap":
        actions.push({ kind: "returnToMap" });
        break;
      case "markMoon": {
        if (!data.counters[effect.counter]) return fail(state, "unknown-counter", `tuntematon laskuri ${effect.counter}`);
        const engine = withCounterSet(current.engine, effect.counter, currentMoonMark(current), data.counters[effect.counter].max);
        if (engine !== current.engine) current = { ...current, engine };
        break;
      }
      case "revealHuntGround": {
        const ground = nearestUnknownHuntGround(current);
        const revealed = ground ? revealSiteOnMap(current, ground.id) : null;
        if (!revealed) return fail(state, "unknown-site", "kartalla ei ole tuntematonta metsästysapajaa");
        current = revealed;
        break;
      }
      case "addLongEffect": {
        const next = tryAddLongEffect(current, effect.effectId);
        if (!next) return fail(state, "effects-full", `efektipaikat ovat täynnä (${effect.effectId})`);
        current = next;
        break;
      }
    }
  }
  return { ok: true, state: current, messages, actions };
}

function fail(state: CampaignState, reason: EffectFailure, detail: string): ApplyResult {
  return { ok: false, reason, detail, state, messages: [], actions: [] };
}

/** Kaikki efektien viittaamat liput, laskurit ja instanssit tarkistuksia varten. */
export function effectRefs(effects: readonly Effect[], out: { flags: string[]; counters: string[]; instances: string[] } = { flags: [], counters: [], instances: [] }) {
  for (const e of effects) {
    if (e.kind === "setFlag") out.flags.push(e.flag);
    else if (e.kind === "addCounter" || e.kind === "markMoon") out.counters.push(e.counter);
    else if (e.kind === "setSceneItemTakeMode") out.instances.push(e.instanceId);
  }
  return out;
}
