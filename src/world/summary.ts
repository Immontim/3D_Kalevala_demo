// Säännöistä ja dialogeista generoitu suomenkielinen yhteenveto. Omistaja ei lue dataa:
// hän hyväksyy tämän proosan ja jokaisen säännön "suunnitteluaie"-lauseen.
import type { TextKey } from "../i18n";
import { ITEMS } from "../map/campaign";
import { itemLabel, moonPhaseNames } from "./conditions";
import type { Condition, Dialogue, Effect, EventPattern, Rule, WorldData } from "./types";

export type TextLookup = (key: TextKey) => string;

const TAKE_MODE_TEXT = { allowed: "luvalliseksi", theft: "varkaudeksi" } as const;

function itemName(itemId: keyof typeof ITEMS, text: TextLookup): string {
  return text(ITEMS[itemId].nameKey).toLowerCase();
}

export function describeCondition(cond: Condition, data: WorldData): string {
  switch (cond.kind) {
    case "all": return cond.of.map((c) => describeCondition(c, data)).join(" ja ");
    case "any": return `(${cond.of.map((c) => describeCondition(c, data)).join(" tai ")})`;
    case "not": return `ei pidä, että ${describeCondition(cond.of, data)}`;
    case "flag": {
      const label = data.flags[cond.flag]?.label ?? cond.flag;
      return `${cond.value === false ? "ei päde:" : "pätee:"} ${label}`;
    }
    case "counter": {
      const label = data.counters[cond.counter]?.label ?? cond.counter;
      const ops = { "<": "alle", "<=": "enintään", "=": "täsmälleen", ">=": "vähintään", ">": "yli" } as const;
      return `${label}: ${ops[cond.op]} ${cond.value}`;
    }
    case "moonPhase": return `kuu on vaiheessa: ${moonPhaseNames(cond.phases)}`;
    case "itemTaken": return `${itemLabel(cond.instanceId)} on otettu`;
  }
}

export function describeEffect(effect: Effect, data: WorldData, text: TextLookup): string {
  switch (effect.kind) {
    case "setFlag": {
      const label = data.flags[effect.flag]?.label ?? effect.flag;
      return effect.value === false ? `poistetaan merkintä: ${label}` : `merkitään: ${label}`;
    }
    case "addCounter": {
      const label = data.counters[effect.counter]?.label ?? effect.counter;
      return `${effect.amount >= 0 ? "kasvatetaan" : "vähennetään"} laskuria "${label}" ${Math.abs(effect.amount)}:llä`;
    }
    case "giveItem": return `pelaaja saa: ${itemName(effect.itemId, text)} ×${effect.quantity}`;
    case "takeItem": return `pelaajalta otetaan: ${itemName(effect.itemId, text)} ×${effect.quantity}`;
    case "setSceneItemTakeMode": return `${itemLabel(effect.instanceId)} muuttuu ${TAKE_MODE_TEXT[effect.takeMode]} otettavaksi`;
    case "message": return `näytetään viesti "${text(effect.text)}"${effect.sub ? ` / "${text(effect.sub)}"` : ""}`;
    case "revealSite": return `karttapaikka "${effect.siteId}" paljastuu kartalle`;
    case "setNpcState": return `hahmon "${effect.npcId}" tila vaihtuu: ${effect.state}`;
    case "removeNpc": return `hahmo "${effect.npcId}" poistuu kohtauksesta`;
    case "startSongLesson": return `aloitetaan laulun "${effect.songId}" opettelu (rytmiharjoitus)`;
  }
}

export function describePattern(on: EventPattern): string {
  const extra: string[] = [];
  const rec = on as unknown as Record<string, unknown>;
  const detail = (key: string, label: string) => { if (rec[key] !== undefined) extra.push(`${label} ${String(rec[key])}`); };
  switch (on.type) {
    case "item.taken": {
      detail("instanceId", "esine");
      detail("takeMode", "otto");
      detail("sceneId", "kohtaus");
      return `Kun esine otetaan${extra.length ? ` (${extra.join(", ")})` : ""}`;
    }
    case "npc.talked": {
      detail("npcId", "hahmo");
      detail("sceneId", "kohtaus");
      return `Kun hahmolle puhutaan${extra.length ? ` (${extra.join(", ")})` : ""}`;
    }
    case "scene.entered": {
      detail("sceneId", "kohtaus");
      return `Kun kohtaukseen siirrytään${extra.length ? ` (${extra.join(", ")})` : ""}`;
    }
    case "song.performed": {
      detail("songId", "laulu");
      detail("nearNpcId", "lähellä hahmo");
      detail("context", "yhteys");
      detail("success", "onnistui");
      detail("sceneId", "kohtaus");
      return `Kun laulu lauletaan${extra.length ? ` (${extra.join(", ")})` : ""}`;
    }
  }
}

/** Yksi sääntö proosana: aie, tapahtuma, ehto ja seuraukset. */
export function summarizeRule(rule: Rule, data: WorldData, text: TextLookup): string {
  const when = rule.when ? `, ja jos ${describeCondition(rule.when, data)}` : "";
  const then = rule.then.map((e) => describeEffect(e, data, text)).join("; ");
  return `Sääntö ${rule.id} — aie: ${rule.intent} ${describePattern(rule.on)}${when}: ${then}.`;
}

export function summarizeDialogue(dialogue: Dialogue, data: WorldData, text: TextLookup): string[] {
  const lines = [`Dialogi ${dialogue.id} (hahmo ${dialogue.npcId}, kohtaus ${dialogue.sceneId}) — aie: ${dialogue.intent}`];
  dialogue.entries.forEach((e) => {
    lines.push(`  Aloitus solmuun ${e.node}: ${e.when ? `jos ${describeCondition(e.when, data)}` : "muuten"}`);
  });
  for (const [id, node] of Object.entries(dialogue.nodes)) {
    lines.push(`  Solmu ${id}: "${text(node.text)}"`);
    for (const c of node.choices) {
      const cond = c.when ? ` (näkyy, jos ${describeCondition(c.when, data)})` : "";
      const fx = (c.effects ?? []).map((e) => describeEffect(e, data, text)).join("; ");
      lines.push(`    - "${text(c.text)}"${cond}${fx ? ` → ${fx}` : ""}${c.next ? ` → solmu ${c.next}` : " → päättyy"}`);
    }
  }
  return lines;
}

export function summarizeWorld(data: WorldData, text: TextLookup): string {
  const lines = ["Säännöt:", ...data.rules.map((r) => `- ${summarizeRule(r, data, text)}`)];
  if (data.dialogues.length) {
    lines.push("", "Dialogit:");
    for (const d of data.dialogues) lines.push(...summarizeDialogue(d, data, text));
  }
  return lines.join("\n");
}
