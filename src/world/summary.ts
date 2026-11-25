// Säännöistä ja dialogeista generoitu suomenkielinen yhteenveto. Omistaja ei lue dataa:
// hän hyväksyy tämän proosan ja jokaisen säännön "suunnitteluaie"-lauseen.
import type { TextKey } from "../i18n";
import { ITEMS } from "../map/campaign";
import { LONG_EFFECTS } from "../map/longEffects";
import { itemLabel, moonPhaseNames } from "./conditions";
import { choiceVariants, nodeVariants } from "./dialogue";
import type { Condition, Dialogue, Effect, EventPattern, Rule, WorldData } from "./types";

export type TextLookup = (key: TextKey) => string;

const TAKE_MODE_TEXT = { allowed: "luvalliseksi", theft: "varkaudeksi" } as const;
const TAG_TEXT = { meat: "lihaa" } as const;

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
    case "elapsedWorldMinutes": return `${data.counters[cond.counter]?.label ?? cond.counter} -aikaleimasta on kulunut vähintään ${cond.minutes} minuuttia`;
    case "moonPhase": return `kuu on vaiheessa: ${moonPhaseNames(cond.phases)}`;
    case "itemTaken": return `${itemLabel(cond.instanceId)} on otettu`;
    case "sameMoon": return `${data.counters[cond.counter]?.label ?? cond.counter} on tämä kuunkierto`;
    case "siteKnown": return `karttapaikka "${cond.siteId}" on pelaajan tiedossa`;
    case "hasItem": return `pelaajalla on mukana vähintään ${cond.quantity} × ${cond.itemId}`;
    case "hasTagged": return `pelaajalla on mukana vähintään ${cond.quantity} × ${TAG_TEXT[cond.tag]} (mitä tahansa lajia)`;
    case "moonChance": return `tämän kuunkierron arpa "${cond.salt}" osuu (${Math.round(cond.chance * 100)} %)`;
    case "unknownHuntGround": return "kartalla on metsästysapaja, jota pelaaja ei vielä tunne";
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
    case "takeTagged": return `pelaajalta otetaan ${effect.quantity} × ${TAG_TEXT[effect.tag]} (mitä tahansa lajia)`;
    case "setSceneItemTakeMode": return `${itemLabel(effect.instanceId)} muuttuu ${TAKE_MODE_TEXT[effect.takeMode]} otettavaksi`;
    case "message": return `näytetään viesti "${text(effect.text)}"${effect.sub ? ` / "${text(effect.sub)}"` : ""}`;
    case "revealSite": return `karttapaikka "${effect.siteId}" paljastuu kartalle`;
    case "recordVictory": return "kampanja merkitään voitetuksi ja loppuruudun tilastot (päivät, tutkittu kartta) kirjataan";
    case "setNpcState": return `hahmon "${effect.npcId}" tila vaihtuu: ${effect.state}`;
    case "removeNpc": return `hahmo "${effect.npcId}" poistuu kohtauksesta`;
    case "startEncounter": return `käynnistetään kohtaaminen "${effect.encounterId}"`;
    case "returnToMap": return "palataan heti 2D-kartalle";
    case "startSongLesson": return `aloitetaan laulun "${effect.songId}" opettelu (rytmiharjoitus)`;
    case "markMoon": return `kirjataan laskuriin "${data.counters[effect.counter]?.label ?? effect.counter}" nykyinen kuunkierto`;
    case "markWorldTime": return `kirjataan laskuriin "${data.counters[effect.counter]?.label ?? effect.counter}" nykyinen maailma-aika`;
    case "revealHuntGround": return "sankaria lähin tuntematon metsästysapaja paljastuu kartalle";
    case "addLongEffect": {
      const def = LONG_EFFECTS[effect.effectId];
      const mods = def.modifiers.map((m) => `${m.stat} ${m.add > 0 ? "+" : ""}${m.add}`).join(", ");
      return `pelaaja saa pitkäkestoisen efektin "${text(def.nameKey)}" (${mods}) ${def.durationDays} päiväksi`;
    }
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
    case "npc.leftBehind": {
      detail("npcId", "hahmo");
      detail("sceneId", "kohtaus");
      return `Kun sankari lähtee ja hahmo jää kohtaukseen${extra.length ? ` (${extra.join(", ")})` : ""}`;
    }
    case "battle.won": {
      detail("sceneId", "kohtaus");
      return `Kun leirin viimeinen aalto kaatuu${extra.length ? ` (${extra.join(", ")})` : ""}`;
    }
    case "player.died": {
      detail("sceneId", "kohtaus");
      return `Kun sankari kaatuu taistelussa${extra.length ? ` (${extra.join(", ")})` : ""}`;
    }
    case "song.performed": {
      detail("songId", "laulu");
      detail("nearNpcId", "lähellä hahmo");
      detail("context", "yhteys");
      detail("success", "onnistui");
      detail("minHits", "osumia vähintään");
      detail("maxHits", "osumia enintään");
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
    const variants = nodeVariants(node);
    lines.push(`  Solmu ${id}: "${text(variants[0])}"${variants.length > 1 ? ` (+ ${variants.length - 1} samaa tarkoittavaa muunnelmaa)` : ""}`);
    for (const c of node.choices) {
      const choiceTexts = choiceVariants(c);
      const cond = c.when ? ` (näkyy, jos ${describeCondition(c.when, data)})` : "";
      const fx = (c.effects ?? []).map((e) => describeEffect(e, data, text)).join("; ");
      const varied = choiceTexts.length > 1 ? ` (+ ${choiceTexts.length - 1} samaa tarkoittavaa muunnelmaa)` : "";
      lines.push(`    - "${text(choiceTexts[0])}"${varied}${cond}${fx ? ` → ${fx}` : ""}${c.next ? ` → solmu ${c.next}` : " → päättyy"}`);
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
