// Maailmamoottorin ajonaikainen kuori: yhdistää puhtaat säännöt kampanjan tilanomistajaan.
// DOM-vapaa. Kaikki tilamuutokset kulkevat `CampaignStore.update`:n kautta.
import type { CampaignState } from "../map/campaign";
import type { CampaignStore } from "../map/campaignStore";
import { chooseDialogue, findDialogue, startDialogue, type ChooseResult, type DialogueView } from "./dialogue";
import { explainRule, postEvent, type PostResult } from "./engine";
import { summarizeRule, summarizeWorld, type TextLookup } from "./summary";
import type { Dialogue, GameEvent, OutMessage, WorldData } from "./types";

export interface PostOutcome {
  /** false = tallennus epäonnistui eikä tapahtuma vaikuttanut. */
  saved: boolean;
  result: PostResult;
}

export interface ActiveDialogue {
  dialogue: Dialogue;
  view: DialogueView;
}

export type ChooseOutcome =
  | { saved: true; messages: OutMessage[]; next: ActiveDialogue | null }
  | { saved: false; reason: "save-failed" | Extract<ChooseResult, { ok: false }>["reason"] };

export interface WorldRuntime {
  readonly data: WorldData;
  post(event: GameEvent): PostOutcome;
  /** Viimeisimmän `post`-kutsun tulos (konsolia varten): mitkä säännöt vaikuttivat ja miksi ei. */
  lastPost(): PostResult | null;
  startDialogue(sceneId: string, npcId: string): ActiveDialogue | null;
  choose(active: ActiveDialogue, choiceId: string): ChooseOutcome;
  flags(): Record<string, boolean>;
  counters(): Record<string, number>;
  /** Suomenkielinen yhteenveto kaikista säännöistä ja dialogeista. */
  describe(text: TextLookup): string;
  /** Yhden säännön (tai kaikkien) proosa ja ehtojen tila nyt. */
  explain(text: TextLookup, ruleId?: string): string;
}

export function createWorldRuntime(store: CampaignStore, data: WorldData): WorldRuntime {
  let last: PostResult | null = null;
  return {
    data,
    post(event) {
      let result!: PostResult;
      const update = store.update((state) => {
        result = postEvent(state, event, data);
        return result.state;
      });
      last = result;
      return { saved: update.ok, result };
    },
    lastPost: () => last,
    startDialogue(sceneId, npcId) {
      const dialogue = findDialogue(data, sceneId, npcId);
      if (!dialogue) return null;
      return { dialogue, view: startDialogue(dialogue, store.get(), data) };
    },
    choose(active, choiceId) {
      let outcome!: ChooseResult;
      const update = store.update((state) => {
        outcome = chooseDialogue(active.dialogue, state, active.view.nodeId, choiceId, data);
        return outcome.state;
      });
      if (!outcome.ok) return { saved: false, reason: outcome.reason };
      if (!update.ok) return { saved: false, reason: "save-failed" };
      return {
        saved: true,
        messages: outcome.messages,
        next: outcome.next ? { dialogue: active.dialogue, view: outcome.next } : null,
      };
    },
    flags: () => ({ ...store.get().engine.flags }),
    counters: () => ({ ...store.get().engine.counters }),
    describe: (text) => summarizeWorld(data, text),
    explain(text, ruleId) {
      const state: CampaignState = store.get();
      const rules = ruleId ? data.rules.filter((r) => r.id === ruleId) : data.rules;
      if (ruleId && rules.length === 0) return `Sääntöä ${ruleId} ei ole. Säännöt: ${data.rules.map((r) => r.id).join(", ")}`;
      return rules.map((rule) => {
        const e = explainRule(state, rule, data);
        const verdict = e.conditionPass === null ? "ei lisäehtoa" : e.conditionPass ? "lisäehto pitää nyt" : "lisäehto EI pidä nyt";
        return `${summarizeRule(rule, data, text)}\n  Tilanne nyt (${verdict}): ${e.reason}`;
      }).join("\n\n");
    },
  };
}
