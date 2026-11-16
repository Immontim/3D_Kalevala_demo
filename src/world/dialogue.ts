// Dialogi v0. Käyttää samoja ehtoja ja efektejä kuin säännöt: ei omaa ehtojärjestelmää.
// Puhdas moduuli: näkymä lasketaan tilasta, valinta palauttaa uuden tilan ja seuraavan näkymän.
import type { CampaignState } from "../map/campaign";
import { evaluate } from "./conditions";
import { applyEffects, type EffectFailure } from "./effects";
import type { TextKey } from "../i18n";
import type { Dialogue, DialogueChoice, OutMessage, WorldData } from "./types";

export interface DialogueView {
  dialogueId: string;
  nodeId: string;
  npcId: string;
  text: TextKey;
  /** Vain ne valinnat, joiden ehto pitää. */
  choices: { id: string; text: TextKey }[];
}

export function findDialogue(data: WorldData, sceneId: string, npcId: string): Dialogue | null {
  return data.dialogues.find((d) => d.sceneId === sceneId && d.npcId === npcId) ?? null;
}

function viewOf(dialogue: Dialogue, nodeId: string, state: CampaignState, data: WorldData): DialogueView {
  const node = dialogue.nodes[nodeId];
  if (!node) throw new Error(`Dialogi ${dialogue.id}: solmua ${nodeId} ei ole`);
  const choices = node.choices
    .filter((c) => !c.when || evaluate(c.when, state, data).pass)
    .map((c) => ({ id: c.id, text: c.text }));
  return { dialogueId: dialogue.id, nodeId, npcId: dialogue.npcId, text: node.text, choices };
}

/** Aloitussolmu: ensimmäinen merkintä, jonka ehto pitää. */
export function startDialogue(dialogue: Dialogue, state: CampaignState, data: WorldData): DialogueView {
  const entry = dialogue.entries.find((e) => !e.when || evaluate(e.when, state, data).pass);
  if (!entry) throw new Error(`Dialogilla ${dialogue.id} ei ole voimassa olevaa aloitusta`);
  return viewOf(dialogue, entry.node, state, data);
}

export type ChooseResult =
  | { ok: true; state: CampaignState; messages: OutMessage[]; next: DialogueView | null }
  | { ok: false; reason: EffectFailure | "no-such-choice"; detail: string; state: CampaignState };

/** Suorittaa valinnan efektit atomisesti ja palauttaa seuraavan näkymän (null = dialogi päättyy). */
export function chooseDialogue(
  dialogue: Dialogue,
  state: CampaignState,
  nodeId: string,
  choiceId: string,
  data: WorldData,
): ChooseResult {
  const choice: DialogueChoice | undefined = dialogue.nodes[nodeId]?.choices.find((c) => c.id === choiceId);
  if (!choice) return { ok: false, reason: "no-such-choice", detail: `solmussa ${nodeId} ei ole valintaa ${choiceId}`, state };
  if (choice.when && !evaluate(choice.when, state, data).pass) {
    return { ok: false, reason: "no-such-choice", detail: `valinta ${choiceId} ei ole nyt saatavilla`, state };
  }
  const applied = applyEffects(state, choice.effects ?? [], data);
  if (!applied.ok) return { ok: false, reason: applied.reason, detail: applied.detail, state };
  const next = choice.next ? viewOf(dialogue, choice.next, applied.state, data) : null;
  return { ok: true, state: applied.state, messages: applied.messages, next };
}
