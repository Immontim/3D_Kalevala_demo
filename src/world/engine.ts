// Maailmamoottori v0: tapahtuma sisään, säännöt arvioidaan, efektit sovelletaan.
// Puhdas: ei Three.js:ää, DOM:ia, ajastimia eikä peruutussääntöjä. Yksi tapahtuma ajaa
// säännöt määrittelyjärjestyksessä (jokainen näkee edellisten muutokset), eikä efekti
// synnytä uusia tapahtumia, joten ketjureaktioita ja silmukoita ei ole.
import type { CampaignState } from "../map/campaign";
import { evaluate } from "./conditions";
import { applyEffects, type EffectFailure } from "./effects";
import type { EventPattern, GameEvent, OutAction, OutMessage, Rule, WorldData } from "./types";

export function matchesPattern(pattern: EventPattern, event: GameEvent): boolean {
  if (pattern.type !== event.type) return false;
  const want = pattern as unknown as Record<string, unknown>;
  const have = event as unknown as Record<string, unknown>;
  return Object.keys(want).every((key) => {
    if (key === "type" || want[key] === undefined) return true;
    if (key === "minHits") return typeof have.hits === "number" && have.hits >= (want.minHits as number);
    if (key === "maxHits") return typeof have.hits === "number" && have.hits <= (want.maxHits as number);
    return want[key] === have[key];
  });
}

export interface FiredRule { ruleId: string; messages: OutMessage[] }
export interface SkippedRule {
  ruleId: string;
  /** "condition" = ehto ei pitänyt; "effect" = efekti epäonnistui eikä sääntö vaikuttanut. */
  why: "condition" | "effect";
  reason: string;
  failure?: EffectFailure;
}

export interface PostResult {
  state: CampaignState;
  fired: FiredRule[];
  /** Säännöt, joiden tapahtumakuvio täsmäsi mutta jotka eivät vaikuttaneet, syineen. */
  skipped: SkippedRule[];
  messages: OutMessage[];
  /** Sääntöjen pyytämät UI-toimet (esim. laulun opettelu), joita moottori ei itse tee. */
  actions: OutAction[];
}

/** Ajaa tapahtuman sääntöjen läpi. Palauttaa uuden tilan; alkuperäinen ei muutu. */
export function postEvent(state: CampaignState, event: GameEvent, data: WorldData): PostResult {
  let current = state;
  const fired: FiredRule[] = [];
  const skipped: SkippedRule[] = [];
  const messages: OutMessage[] = [];
  const actions: OutAction[] = [];
  for (const rule of data.rules) {
    if (!matchesPattern(rule.on, event)) continue;
    if (rule.when) {
      const verdict = evaluate(rule.when, current, data);
      if (!verdict.pass) { skipped.push({ ruleId: rule.id, why: "condition", reason: verdict.reason }); continue; }
    }
    const applied = applyEffects(current, rule.then, data);
    if (!applied.ok) {
      skipped.push({ ruleId: rule.id, why: "effect", reason: applied.detail, failure: applied.reason });
      continue;
    }
    current = applied.state;
    fired.push({ ruleId: rule.id, messages: applied.messages });
    messages.push(...applied.messages);
    actions.push(...applied.actions);
  }
  return { state: current, fired, skipped, messages, actions };
}

export interface RuleExplanation {
  rule: Rule;
  /** Tila nyt: ehto pitää, ei pidä tai sääntöä ei ole ehdollistettu. */
  conditionPass: boolean | null;
  reason: string;
}

/** Arvioi säännön ehdon nykytilaa vasten ja kertoo suomeksi, miksi se pitää tai ei pidä. */
export function explainRule(state: CampaignState, rule: Rule, data: WorldData): RuleExplanation {
  if (!rule.when) return { rule, conditionPass: null, reason: "säännöllä ei ole lisäehtoa: se vaikuttaa aina, kun tapahtuma täsmää" };
  const verdict = evaluate(rule.when, state, data);
  return { rule, conditionPass: verdict.pass, reason: verdict.reason };
}
