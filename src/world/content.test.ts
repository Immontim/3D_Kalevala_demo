// Pelin oikean maailmadatan tarkistukset ja ensimmäinen dialogipolku: tietäjä ja tuohikontti.
import { describe, expect, it } from "vitest";
import { finnishText } from "../i18n";
import { createCampaign, type SceneItemDefinition } from "../map/campaign";
import { createCampaignStore } from "../map/campaignStore";
import { conditionRefs } from "./conditions";
import { GAME_WORLD } from "./content";
import { effectRefs } from "./effects";
import { createWorldRuntime } from "./runtime";
import { SCENE_ITEM_LABELS } from "./registry";
import { takeSceneItemWithEvents } from "./take";
import type { Condition, Effect } from "./types";

const PACK: SceneItemDefinition = {
  instanceId: "lakeside.sage-pack", siteId: "lakeside", itemId: "birch_bark_pack", quantity: 1, takeMode: "theft", ownerId: "tietaja",
};

function setup() {
  const store = createCampaignStore(createCampaign(), () => true);
  const runtime = createWorldRuntime(store, GAME_WORLD);
  return { store, runtime };
}

/** Sama kuin 3D:n otto: esineen otto ja `item.taken`-tapahtuma yhtenä store-päivityksenä. */
function takePack(store: ReturnType<typeof setup>["store"], sceneId = "lakeside") {
  let outcome = "";
  store.update((s) => {
    const r = takeSceneItemWithEvents(s, PACK, sceneId, GAME_WORLD);
    outcome = r.take.status === "taken" ? r.take.takeMode : r.take.status;
    return r.state;
  });
  return outcome;
}

describe("maailmadatan eheys", () => {
  it("jokaisella säännöllä ja dialogilla on suunnitteluaie-lause", () => {
    for (const rule of GAME_WORLD.rules) expect(rule.intent.trim().length, rule.id).toBeGreaterThan(10);
    for (const d of GAME_WORLD.dialogues) expect(d.intent.trim().length, d.id).toBeGreaterThan(10);
  });

  it("säännöt ja dialogit käyttävät vain rekisteröityjä lippuja, laskureita ja instansseja", () => {
    const flags: string[] = [], counters: string[] = [], instances: string[] = [];
    const addCond = (c?: Condition) => { if (c) { const r = conditionRefs(c); flags.push(...r.flags); counters.push(...r.counters); instances.push(...r.instances); } };
    const addFx = (e?: readonly Effect[]) => { if (e) { const r = effectRefs(e); flags.push(...r.flags); counters.push(...r.counters); instances.push(...r.instances); } };
    for (const rule of GAME_WORLD.rules) { addCond(rule.when); addFx(rule.then); }
    for (const d of GAME_WORLD.dialogues) {
      d.entries.forEach((e) => addCond(e.when));
      for (const n of Object.values(d.nodes)) n.choices.forEach((c) => { addCond(c.when); addFx(c.effects); });
    }
    flags.forEach((f) => expect(GAME_WORLD.flags[f], f).toBeDefined());
    counters.forEach((c) => expect(GAME_WORLD.counters[c], c).toBeDefined());
    instances.forEach((i) => expect(SCENE_ITEM_LABELS[i], i).toBeDefined());
  });

  it("dialogin solmut ja siirtymät ovat ehjiä ja jokaisessa solmussa on poistumistie", () => {
    for (const d of GAME_WORLD.dialogues) {
      d.entries.forEach((e) => expect(d.nodes[e.node], e.node).toBeDefined());
      expect(d.entries[d.entries.length - 1].when, "viimeinen aloitus on ehdoton").toBeUndefined();
      for (const [id, node] of Object.entries(d.nodes)) {
        expect(node.choices.length, id).toBeGreaterThan(0);
        node.choices.forEach((c) => { if (c.next) expect(d.nodes[c.next], c.next).toBeDefined(); });
        expect(node.choices.some((c) => !c.next), `${id}: sulkeva valinta`).toBe(true);
      }
    }
  });

  it("jokaisessa tilassa on avattavissa dialogi, jolla on valittavia vaihtoehtoja", () => {
    const { runtime } = setup();
    const active = runtime.startDialogue("lakeside", "tietaja");
    expect(active?.view.choices.length).toBeGreaterThan(0);
  });

  it("yhteenveto tulostuu suomeksi ja mainitsee tietäjän säännön", () => {
    const { runtime } = setup();
    const text = runtime.describe(finnishText);
    expect(text).toContain("sage.theft-noticed");
    expect(text).toContain("tuohikontti");
    expect(text).toContain("Dialogi sage.lakeside");
  });
});

describe("tietäjä ja tuohikontti", () => {
  it("tietäjällä on dialogi vain rannalla, ei pihalla eikä hävitetyllä rannalla", () => {
    const { runtime } = setup();
    expect(runtime.startDialogue("lakeside", "tietaja")).not.toBeNull();
    expect(runtime.startDialogue("yard", "tietaja")).toBeNull();
    expect(runtime.startDialogue("lakeruin", "tietaja")).toBeNull();
  });

  it("luvallinen polku: pyyntö antaa luvan, otto ei ole varkaus eikä jätä lokia", () => {
    const { store, runtime } = setup();
    const start = runtime.startDialogue("lakeside", "tietaja")!;
    expect(start.view.nodeId).toBe("greet");
    const asked = runtime.choose(start, "ask-pack");
    expect(asked.saved).toBe(true);
    if (!asked.saved) return;
    expect(asked.next?.view.nodeId).toBe("granted");
    expect(store.get().engine.flags["sage.permission"]).toBe(true);
    expect(store.get().world.sceneItems.takeModeOverrides).toEqual([{ instanceId: PACK.instanceId, takeMode: "allowed" }]);

    expect(takePack(store)).toBe("allowed");
    const state = store.get();
    expect(state.world.sceneItems.thefts).toHaveLength(0);
    expect(state.engine.flags["sage.robbed"]).toBeUndefined();
    expect(state.player.inventory.stacks.some((s) => s.itemId === "birch_bark_pack")).toBe(true);
    // Oton jälkeen tietäjä on tyytyväinen.
    expect(runtime.startDialogue("lakeside", "tietaja")!.view.nodeId).toBe("afterTaken");
  });

  it("luvaton polku: otto kirjaa varkauden, asettaa lipun ja laskurin ja tietäjä muistaa sen", () => {
    const { store, runtime } = setup();
    expect(takePack(store)).toBe("theft");
    const state = store.get();
    expect(state.world.sceneItems.thefts).toHaveLength(1);        // varkausloki säilyy
    expect(state.engine.flags["sage.robbed"]).toBe(true);          // moottorin seuraus samassa tallennuksessa
    expect(state.engine.counters["thefts.noticed"]).toBe(1);
    expect(state.world.sceneItems.takenInstanceIds).toContain(PACK.instanceId);

    const talk = runtime.startDialogue("lakeside", "tietaja")!;
    expect(talk.view.nodeId).toBe("robbed");
    expect(talk.view.choices.map((c) => c.id)).toEqual(["apologize", "leave"]);
    const apology = runtime.choose(talk, "apologize");
    expect(apology.saved && apology.next?.view.nodeId).toBe("forgiven");
    expect(store.get().engine.flags["sage.robbed"]).toBeUndefined();
    expect(store.get().engine.flags["sage.forgiven"]).toBe(true);
    expect(store.get().world.sceneItems.thefts).toHaveLength(1);   // anteeksianto ei pyyhi lokia
  });

  it("varkaus hävitetyllä rannalla ei herätä tietäjän seurausta", () => {
    const { store } = setup();
    takePack(store, "lakeruin");
    expect(store.get().engine.flags["sage.robbed"]).toBeUndefined();
    expect(store.get().world.sceneItems.thefts).toHaveLength(1);
  });

  it("explain kertoo varkaussäännön tilan", () => {
    const { runtime } = setup();
    const text = runtime.explain(finnishText, "sage.theft-noticed");
    expect(text).toContain("aie:");
    expect(text).toContain("Kun esine otetaan");
  });
});
