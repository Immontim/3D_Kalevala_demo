import { describe, expect, it } from "vitest";
import { createCampaign, type CampaignState } from "../map/campaign";
import { createCampaignStore } from "../map/campaignStore";
import { WORLD_MINUTES_PER_MOON } from "../map/uiState";
import { evaluate } from "./conditions";
import { applyEffects } from "./effects";
import { explainRule, matchesPattern, postEvent } from "./engine";
import { createWorldRuntime } from "./runtime";
import { summarizeRule } from "./summary";
import type { Condition, Rule, WorldData } from "./types";

// Testimaailma: tarinakäänne "emäntä kertoo huhun" (ROADMAP V2) ilman, että se kuuluu pelisisältöön.
const RUMOR: Rule = {
  id: "emanta.rumor",
  intent: "Kun sankari puhuu emännälle ensimmäistä kertaa, emäntä kertoo huhun vainolaisista.",
  on: { type: "npc.talked", npcId: "emanta" },
  when: { kind: "flag", flag: "rumor.heard", value: false },
  then: [
    { kind: "setFlag", flag: "rumor.heard" },
    { kind: "message", text: "dialogue.sage.greet" },
  ],
};

const TEST_WORLD: WorldData = {
  flags: { "rumor.heard": { label: "emäntä on kertonut huhun" }, "a": { label: "lippu A" }, "b": { label: "lippu B" } },
  counters: { "n": { label: "laskuri N", max: 5 } },
  rules: [RUMOR],
  dialogues: [],
};

function withFlags(state: CampaignState, ...flags: string[]): CampaignState {
  return { ...state, engine: { ...state.engine, flags: Object.fromEntries(flags.map((f) => [f, true])) } };
}

const TALK = { type: "npc.talked", npcId: "emanta", sceneId: "yard" } as const;

describe("tapahtumakuvio", () => {
  it("täsmää tyyppiin ja annettuihin kenttiin, muut kentät ovat vapaita", () => {
    expect(matchesPattern({ type: "npc.talked", npcId: "emanta" }, TALK)).toBe(true);
    expect(matchesPattern({ type: "npc.talked", npcId: "tietaja" }, TALK)).toBe(false);
    expect(matchesPattern({ type: "scene.entered" }, TALK)).toBe(false);
  });
});

describe("tarinakäänne: emäntä kertoo huhun", () => {
  it("ensimmäinen puhe asettaa lipun ja antaa viestin", () => {
    const result = postEvent(createCampaign(), TALK, TEST_WORLD);
    expect(result.state.engine.flags["rumor.heard"]).toBe(true);
    expect(result.fired.map((f) => f.ruleId)).toEqual(["emanta.rumor"]);
    expect(result.messages).toHaveLength(1);
  });

  it("toinen puhe ei toista huhua, ja explain kertoo syyn suomeksi", () => {
    const first = postEvent(createCampaign(), TALK, TEST_WORLD);
    const second = postEvent(first.state, TALK, TEST_WORLD);
    expect(second.fired).toHaveLength(0);
    expect(second.skipped).toHaveLength(1);
    expect(second.skipped[0].why).toBe("condition");
    expect(second.skipped[0].reason).toContain("emäntä on kertonut huhun");
    expect(second.skipped[0].reason).toContain("on asetettu");
    const explained = explainRule(first.state, RUMOR, TEST_WORLD);
    expect(explained.conditionPass).toBe(false);
    expect(explained.reason).toContain("vaikka sen piti olla asettamatta");
  });

  it("toinen hahmo ei laukaise sääntöä", () => {
    const result = postEvent(createCampaign(), { type: "npc.talked", npcId: "tietaja", sceneId: "yard" }, TEST_WORLD);
    expect(result.fired).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });

  it("runtime tallentaa lipun storen kautta ja kertoo explainilla nykytilan", () => {
    const saved: CampaignState[] = [];
    const store = createCampaignStore(createCampaign(), (s) => { saved.push(s); return true; });
    const runtime = createWorldRuntime(store, TEST_WORLD);
    expect(runtime.post(TALK).saved).toBe(true);
    expect(runtime.flags()).toEqual({ "rumor.heard": true });
    expect(saved).toHaveLength(1);
    const text = runtime.explain((k) => k, "emanta.rumor");
    expect(text).toContain("aie:");
    expect(text).toContain("lisäehto EI pidä nyt");
    expect(runtime.explain((k) => k, "olematon")).toContain("ei ole");
  });
});

describe("ehdot", () => {
  const state = createCampaign();
  const pass = (c: Condition, s = state) => evaluate(c, s, TEST_WORLD).pass;

  it("lippu, not, all ja any", () => {
    const s = withFlags(state, "a");
    expect(pass({ kind: "flag", flag: "a" }, s)).toBe(true);
    expect(pass({ kind: "flag", flag: "b" }, s)).toBe(false);
    expect(pass({ kind: "not", of: { kind: "flag", flag: "b" } }, s)).toBe(true);
    expect(pass({ kind: "all", of: [{ kind: "flag", flag: "a" }, { kind: "flag", flag: "b" }] }, s)).toBe(false);
    expect(pass({ kind: "any", of: [{ kind: "flag", flag: "a" }, { kind: "flag", flag: "b" }] }, s)).toBe(true);
    expect(pass({ kind: "any", of: [] }, s)).toBe(false);
    expect(pass({ kind: "all", of: [] }, s)).toBe(true);
  });

  it("laskuri vertailee kaikilla operaattoreilla ja puuttuva laskuri on 0", () => {
    const s: CampaignState = { ...state, engine: { ...state.engine, counters: { n: 3 } } };
    const c = (op: "<" | "<=" | "=" | ">=" | ">", value: number) => pass({ kind: "counter", counter: "n", op, value }, s);
    expect(c(">=", 3)).toBe(true);
    expect(c(">", 3)).toBe(false);
    expect(c("=", 3)).toBe(true);
    expect(c("<", 3)).toBe(false);
    expect(c("<=", 3)).toBe(true);
    expect(pass({ kind: "counter", counter: "n", op: "=", value: 0 })).toBe(true);
  });

  it("kuun vaihe luetaan kartan kalenterista", () => {
    const at = (minutes: number): CampaignState => ({ ...state, world: { ...state.world, worldMinutes: minutes } });
    const full: Condition = { kind: "moonPhase", phases: [4] };
    expect(pass(full, at(0))).toBe(false);                       // uusikuu
    expect(pass(full, at(WORLD_MINUTES_PER_MOON / 2))).toBe(true); // täysikuu kierron puolivälissä
    expect(evaluate(full, at(0), TEST_WORLD).reason).toContain("uusikuu");
  });

  it("itemTaken katsoo otettujen esineiden listaa", () => {
    const taken: CampaignState = { ...state, world: { ...state.world, sceneItems: { ...state.world.sceneItems, takenInstanceIds: ["x"] } } };
    expect(pass({ kind: "itemTaken", instanceId: "x" }, taken)).toBe(true);
    expect(pass({ kind: "itemTaken", instanceId: "x" })).toBe(false);
  });
});

describe("efektit", () => {
  it("antaa ja ottaa esineen, ja epäonnistuminen on atominen", () => {
    const state = createCampaign();
    const given = applyEffects(state, [{ kind: "giveItem", itemId: "birch_bark_pack", quantity: 1 }], TEST_WORLD);
    expect(given.ok && given.state.player.inventory.stacks.map((s) => s.itemId)).toContain("birch_bark_pack");

    // Toinen efekti epäonnistuu (ei kalaa): ensimmäinen lippu ei saa jäädä voimaan.
    const failed = applyEffects(state, [{ kind: "setFlag", flag: "a" }, { kind: "takeItem", itemId: "dried_fish", quantity: 1 }], TEST_WORLD);
    expect(failed.ok).toBe(false);
    expect(failed.state).toBe(state);
    if (!failed.ok) expect(failed.reason).toBe("missing-item");
  });

  it("täysi inventaario estää antamisen", () => {
    const base = createCampaign();
    const full: CampaignState = {
      ...base,
      player: { ...base.player, inventory: { ...base.player.inventory, stacks: Array.from({ length: base.player.inventory.capacity }, () => ({ itemId: "birch_bark_pack" as const, quantity: 1 })) } },
    };
    const r = applyEffects(full, [{ kind: "giveItem", itemId: "dried_fish", quantity: 1 }], TEST_WORLD);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("inventory-full");
  });

  it("tuntematon lippu hylätään, laskuri rajautuu ja lipun voi nollata", () => {
    const state = createCampaign();
    const unknown = applyEffects(state, [{ kind: "setFlag", flag: "ei-ole" }], TEST_WORLD);
    expect(unknown.ok).toBe(false);
    const counted = applyEffects(state, [{ kind: "addCounter", counter: "n", amount: 99 }], TEST_WORLD);
    expect(counted.ok && counted.state.engine.counters.n).toBe(5);
    const set = applyEffects(state, [{ kind: "setFlag", flag: "a" }, { kind: "setFlag", flag: "a", value: false }], TEST_WORLD);
    expect(set.ok && set.state.engine.flags).toEqual({});
  });

  it("setSceneItemTakeMode muuttaa ottolupaa", () => {
    const r = applyEffects(createCampaign(), [{ kind: "setSceneItemTakeMode", instanceId: "i", takeMode: "allowed" }], TEST_WORLD);
    expect(r.ok && r.state.world.sceneItems.takeModeOverrides).toEqual([{ instanceId: "i", takeMode: "allowed" }]);
  });

  it("mikään efekti ei kuluta maailma-aikaa (3D ei kuluta aikaa)", () => {
    const state = createCampaign();
    const r = applyEffects(state, [
      { kind: "setFlag", flag: "a" },
      { kind: "addCounter", counter: "n", amount: 1 },
      { kind: "giveItem", itemId: "dried_fish", quantity: 1 },
      { kind: "setSceneItemTakeMode", instanceId: "i", takeMode: "theft" },
      { kind: "message", text: "dialogue.sage.greet" },
    ], TEST_WORLD);
    expect(r.ok && r.state.world.worldMinutes).toBe(state.world.worldMinutes);
  });
});

describe("säännöt", () => {
  it("säännöt ajetaan järjestyksessä ja jokainen näkee edellisen muutokset", () => {
    const world: WorldData = {
      ...TEST_WORLD,
      rules: [
        { id: "first", intent: "a", on: { type: "scene.entered" }, then: [{ kind: "setFlag", flag: "a" }] },
        { id: "second", intent: "b", on: { type: "scene.entered" }, when: { kind: "flag", flag: "a" }, then: [{ kind: "setFlag", flag: "b" }] },
      ],
    };
    const r = postEvent(createCampaign(), { type: "scene.entered", sceneId: "yard" }, world);
    expect(r.fired.map((f) => f.ruleId)).toEqual(["first", "second"]);
    expect(r.state.engine.flags).toEqual({ a: true, b: true });
  });

  it("efektiltään epäonnistuva sääntö ei vaikuta ja sen syy kirjataan", () => {
    const world: WorldData = {
      ...TEST_WORLD,
      rules: [{ id: "pay", intent: "x", on: { type: "scene.entered" }, then: [{ kind: "takeItem", itemId: "dried_fish", quantity: 1 }] }],
    };
    const r = postEvent(createCampaign(), { type: "scene.entered", sceneId: "yard" }, world);
    expect(r.fired).toHaveLength(0);
    expect(r.skipped[0]).toMatchObject({ ruleId: "pay", why: "effect", failure: "missing-item" });
  });

  it("tapahtuma ei muuta alkuperäistä tilaa", () => {
    const state = createCampaign();
    const snapshot = JSON.stringify(state);
    postEvent(state, TALK, TEST_WORLD);
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it("yhteenveto on suomea ja sisältää aieen sekä seuraukset", () => {
    const text = summarizeRule(RUMOR, TEST_WORLD, (k) => `«${k}»`);
    expect(text).toContain("aie: Kun sankari puhuu emännälle");
    expect(text).toContain("Kun hahmolle puhutaan (hahmo emanta)");
    expect(text).toContain("ei päde: emäntä on kertonut huhun");
    expect(text).toContain("merkitään: emäntä on kertonut huhun");
    expect(text).toContain("näytetään viesti");
  });
});
