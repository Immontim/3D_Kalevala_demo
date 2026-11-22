// Pelin oikean maailmadatan tarkistukset ja ensimmäinen dialogipolku: tietäjä ja tuohikontti.
import { describe, expect, it } from "vitest";
import { finnishText } from "../i18n";
import { BASE_INVENTORY_CAPACITY, createCampaign, parseCampaign, serializeCampaign, type SceneItemDefinition } from "../map/campaign";
import { createCampaignStore } from "../map/campaignStore";
import { PROTOTYPE_MAP_ID } from "../map/prototype";
import { newSiteInstances } from "../map/siteInstances";
import { conditionRefs } from "./conditions";
import { GAME_WORLD } from "./content";
import { effectRefs } from "./effects";
import { createWorldRuntime } from "./runtime";
import { SCENE_ITEM_LABELS } from "./registry";
import { takeSceneItemWithEvents } from "./take";
import type { Condition, Effect, GameEvent } from "./types";
import { nodeVariants } from "./dialogue";
import { WORLD_MINUTES_PER_MOON } from "../map/uiState";


const PACK: SceneItemDefinition = {
  instanceId: "lakeside.sage-pack", siteId: "lakeside", itemId: "birch_bark_pack", quantity: 1, takeMode: "theft", ownerId: "tietaja",
};

function setup() {
  const store = createCampaignStore(createCampaign({ mapId: PROTOTYPE_MAP_ID, siteInstances: newSiteInstances(1) }), () => true);
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
    expect(state.player.inventory.backpack).toBe("birch_bark_pack");
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

  it("laulun opettelu: valinta näkyy kunnes laulu on opittu ja pyytää harjoituksen UI:lta", () => {
    const { store, runtime } = setup();
    const start = runtime.startDialogue("lakeside", "tietaja")!;
    expect(start.view.choices.map((c) => c.id)).toEqual(["ask-pack", "ask-song", "leave"]);
    const intro = runtime.choose(start, "ask-song");
    expect(intro.saved && intro.next?.view.nodeId).toBe("songIntro");
    if (!intro.saved || !intro.next) return;
    const ready = runtime.choose(intro.next, "ready");
    expect(ready.saved && ready.actions).toEqual([{ kind: "songLesson", songId: "sleep" }]);
    expect(ready.saved && ready.next).toBeNull();
    // Valinta ei vielä opeta: lippu tulee vasta onnistuneesta harjoituksesta.
    expect(store.get().engine.flags["song.sleep.learned"]).toBeUndefined();
  });

  it("onnistunut harjoitus antaa laulun lipulla ja viestin; epäonnistunut, taisteluyhteys ja väärä paikka eivät", () => {
    const lesson = (success: boolean, context: "lesson" | "cast" = "lesson", sceneId = "lakeside", songId = "sleep") =>
      ({ type: "song.performed", songId, context, success, hits: success ? 6 : 2, sceneId }) as const;
    for (const event of [lesson(false), lesson(true, "cast"), lesson(true, "lesson", "yard"), lesson(true, "lesson", "lakeside", "bog")]) {
      const { store, runtime } = setup();
      runtime.post(event);
      expect(store.get().engine.flags["song.sleep.learned"], JSON.stringify(event)).toBeUndefined();
    }
    const { store, runtime } = setup();
    const first = runtime.post(lesson(true));
    expect(first.saved).toBe(true);
    expect(first.result.messages).toHaveLength(1);
    expect(store.get().engine.flags["song.sleep.learned"]).toBe(true);
    // Toinen onnistuminen ei toista viestiä.
    expect(runtime.post(lesson(true)).result.messages).toHaveLength(0);
  });

  it("opetuksen jälkeen tietäjä puhuu opetetusta laulusta, eikä opettelua enää tarjota", () => {
    const { runtime } = setup();
    runtime.post({ type: "song.performed", songId: "sleep", context: "lesson", success: true, hits: 7, sceneId: "lakeside" });
    const talk = runtime.startDialogue("lakeside", "tietaja")!;
    expect(talk.view.nodeId).toBe("taught");
    expect(talk.view.choices.map((c) => c.id)).toEqual(["ask-pack", "leave"]);   // tuohikonttia voi vielä pyytää
    const ask = runtime.choose(talk, "ask-pack");
    expect(ask.saved && ask.next?.view.choices.map((c) => c.id)).not.toContain("ask-song");
  });

  it("varas voi oppia laulun vasta anteeksiannon jälkeen, ja loukattu tietäjä ei opeta", () => {
    const { store, runtime } = setup();
    takePack(store);                                              // luvaton otto
    const robbed = runtime.startDialogue("lakeside", "tietaja")!;
    expect(robbed.view.choices.map((c) => c.id)).toEqual(["apologize", "leave"]);   // ei ask-song
    const forgiven = runtime.choose(robbed, "apologize");
    expect(forgiven.saved && forgiven.next?.view.choices.map((c) => c.id)).toEqual(["ask-song", "thanks"]);
  });

});

describe("Louhen karkotus (V5)", () => {
  const cast = (over: Record<string, unknown> = {}) => ({
    type: "song.performed", songId: "sleep", context: "cast", success: true, hits: 6,
    sceneId: "cairnfield", nearNpcId: "louhi", ...over,
  }) as import("./types").GameEvent;

  it("onnistunut laulu Louhen kuuluvilla asettaa lipun, paljastaa leirin ja pyytää poistamaan Louhen", () => {
    const { store, runtime } = setup();
    const out = runtime.post(cast());
    expect(out.saved).toBe(true);
    expect(out.result.fired.map((f) => f.ruleId)).toEqual(["louhi.banished"]);
    expect(out.result.actions).toEqual([{ kind: "removeNpc", npcId: "louhi" }]);
    expect(out.result.messages).toHaveLength(1);
    const state = store.get();
    expect(state.engine.flags["louhi.banished"]).toBe(true);
    expect(state.world.knownSiteIds).toContain("camp");
    expect(state.world.worldMinutes).toBe(0);                    // 3D ei kuluta maailma-aikaa
  });

  it("epäonnistunut yritys, kaukainen laulu, väärä kohtaus tai konteksti eivät karkota eivätkä rankaise", () => {
    for (const event of [
      cast({ success: false }), cast({ nearNpcId: undefined }), cast({ nearNpcId: "tietaja" }),
      cast({ sceneId: "lakeside" }), cast({ context: "lesson" }), cast({ songId: "bog" }),
    ]) {
      const { store, runtime } = setup();
      const before = store.get();
      const out = runtime.post(event);
      expect(out.result.fired, JSON.stringify(event)).toEqual([]);
      expect(out.result.actions).toEqual([]);
      expect(store.get(), JSON.stringify(event)).toBe(before);   // tila ei muutu lainkaan
    }
  });

  it("karkotus toimii vain kerran, ja uusi yritys onnistuneen jälkeen on harmiton", () => {
    const { runtime } = setup();
    runtime.post(cast({ success: false }));                       // epäonnistuminen ensin
    expect(runtime.post(cast()).result.fired).toHaveLength(1);
    const again = runtime.post(cast());
    expect(again.result.fired).toEqual([]);
    expect(again.result.skipped[0]).toMatchObject({ ruleId: "louhi.banished", why: "condition" });
    expect(again.result.actions).toEqual([]);
  });

  it("liput ja leiri säilyvät tallennuksen läpi (sivun uudelleenlataus)", () => {
    const { store, runtime } = setup();
    runtime.post(cast());
    const reloaded = parseCampaign(serializeCampaign(store.get()))!;
    expect(reloaded.engine.flags["louhi.banished"]).toBe(true);
    expect(reloaded.world.knownSiteIds).toContain("camp");
  });

  it("säännöstä generoitu yhteenveto kertoo karkotuksen suomeksi", () => {
    const { runtime } = setup();
    const text = runtime.describe(finnishText);
    expect(text).toContain("louhi.banished");
    expect(text).toContain("poistuu kohtauksesta");
    expect(text).toContain("paljastuu kartalle");
  });
});

describe("jousineito, emäntä ja nuori urho (V6)", () => {
  const heal = (over: Record<string, unknown> = {}) => ({
    type: "song.performed", songId: "heal", context: "cast", success: true, hits: 6,
    sceneId: "yard", nearNpcId: "jousineito", ...over,
  }) as import("./types").GameEvent;

  it("onnistunut parannuslaulu jousineidon kuuluvilla parantaa hänet ja pyytää 3D:tä nostamaan hänet seisomaan", () => {
    const { store, runtime } = setup();
    const out = runtime.post(heal());
    expect(out.result.fired.map((f) => f.ruleId)).toEqual(["archer.healed"]);
    expect(out.result.actions).toEqual([{ kind: "npcState", npcId: "jousineito", state: "healed" }]);
    expect(out.result.messages).toHaveLength(1);
    expect(store.get().engine.flags["archer.healed"]).toBe(true);
    expect(store.get().player.inventory.stacks.some((s) => s.itemId === "sky_iron_sword")).toBe(false);   // miekka vasta dialogissa
  });

  it("epäonnistunut (6 osumaa mutta ei onnistunut), kaukainen tai väärän kohtauksen parannus ei tee mitään; toistuva ei tee mitään", () => {
    for (const event of [heal({ success: false }), heal({ nearNpcId: undefined }), heal({ nearNpcId: "emanta" }), heal({ sceneId: "lakeside" }), heal({ context: "lesson" })]) {
      const { store, runtime } = setup();
      const before = store.get();
      expect(runtime.post(event).result.fired, JSON.stringify(event)).toEqual([]);
      expect(store.get()).toBe(before);
    }
    const { runtime } = setup();
    runtime.post(heal());
    expect(runtime.post(heal()).result.fired).toEqual([]);
  });

  it("jousineito antaa taivaanrautamiekan vain parannettuna, vain kerran ja vain laulamalla", () => {
    const { store, runtime } = setup();
    const wounded = runtime.startDialogue("yard", "jousineito")!;
    expect(wounded.view.nodeId).toBe("wounded");
    expect(wounded.view.choices.map((c) => c.id)).toEqual(["ask-story", "leave"]);    // ei miekkaa tarjolla
    runtime.post(heal());
    const reward = runtime.startDialogue("yard", "jousineito")!;
    expect(reward.view.nodeId).toBe("reward");
    const take = runtime.choose(reward, "take");
    expect(take.saved && take.messages).toHaveLength(1);
    const state = store.get();
    expect(state.player.inventory.stacks.some((s) => s.itemId === "sky_iron_sword")).toBe(true);
    expect(state.engine.flags["archer.gaveSword"]).toBe(true);
    expect(runtime.startDialogue("yard", "jousineito")!.view.nodeId).toBe("after");   // ei toista kertaa
  });

  it("täysi inventaario ei hävitä miekkaa: valinta epäonnistuu ja sen voi toistaa", () => {
    const { store, runtime } = setup();
    store.update((s) => ({
      ...s,
      player: { ...s.player, inventory: { ...s.player.inventory, stacks: Array.from({ length: BASE_INVENTORY_CAPACITY }, () => ({ itemId: "dried_fish" as const, quantity: 1 })) } },
    }));
    runtime.post(heal());
    const reward = runtime.startDialogue("yard", "jousineito")!;
    const failed = runtime.choose(reward, "take");
    expect(failed.saved).toBe(false);
    expect(store.get().engine.flags["archer.gaveSword"]).toBeUndefined();
    expect(runtime.startDialogue("yard", "jousineito")!.view.nodeId).toBe("reward");
  });

  it("jousineidon talon emäntä kertoo huhun kerran; sen jälkeen tältä kuulta ei ole uutta", () => {
    const { store, runtime } = setup();
    const talk = runtime.startDialogue("yard", "emanta")!;
    expect(talk.view.nodeId).toBe("greet");
    expect(talk.view.choices.map((c) => c.id)).toEqual(["ask-news", "leave"]);
    const asked = runtime.choose(talk, "ask-news");
    expect(asked.saved && asked.next?.view.nodeId).toBe("rumor");
    expect(store.get().engine.flags["rumor.heard"]).toBe(true);
    expect(store.get().world.knownSiteIds).toContain("lakeside");
    const again = runtime.startDialogue("yard", "emanta")!;
    expect(again.view.choices.map((c) => c.id)).toEqual(["ask-news-again", "leave"]);
    expect(again.view.choices[0].text).toBe(talk.view.choices[0].text);          // sama kysymys
    const none = runtime.choose(again, "ask-news-again");
    expect(none.saved && none.next?.view.nodeId).toBe("noNews");
  });

  it("toisen talon emäntä ei tunne huhua: kumpikin emäntä puhuu omasta asiastaan", () => {
    const { store, runtime } = setup();
    const b = runtime.startDialogue("yard", "emanta_b")!;
    expect(b.view.choices.some((c) => c.id === "ask-news-again")).toBe(false);
    runtime.choose(b, b.view.choices[0].id);
    expect(store.get().engine.flags["rumor.heard"]).toBeUndefined();               // ei väitä kertoneensa kaikkea
    expect(runtime.startDialogue("yard", "emanta")!.view.choices[0].id).toBe("ask-news");
  });

  it("nuorella urholla on dialogi pihassa, mutta tietäjällä ei enää ole (yksi tietäjä, rannalla)", () => {
    const { runtime } = setup();
    expect(runtime.startDialogue("yard", "urho")?.view.nodeId).toBe("greet");
    expect(runtime.startDialogue("yard", "tietaja")).toBeNull();
  });

  it("tietäjän opetus merkitsee kalmiston kartalle", () => {
    const { store, runtime } = setup();
    runtime.post({ type: "song.performed", songId: "sleep", context: "lesson", success: true, hits: 7, sceneId: "lakeside" });
    expect(store.get().world.knownSiteIds).toContain("cairnfield");
  });
});

describe("jousineidon parannus: 6/8 osumaa ja kolme yritystä (2026-11-22)", () => {
  const heal = (hits: number, over: Record<string, unknown> = {}) => ({
    type: "song.performed", songId: "heal", context: "cast", success: hits >= 4, hits,
    sceneId: "yard", nearNpcId: "jousineito", ...over,
  }) as GameEvent;
  const fired = (out: { result: { fired: { ruleId: string }[] } }) => out.result.fired.map((f) => f.ruleId);

  it("viisi osumaa ei riitä: yritys kirjataan, pelaaja kuulee vaatimuksen ja neito sanoo laulun ei tepsineen", () => {
    const { store, runtime } = setup();
    const out = runtime.post(heal(5));
    expect(fired(out)).toEqual(["archer.heal-failed-first"]);
    expect(out.result.messages[0]).toEqual({ text: "world.archer.songFailed", sub: "world.archer.needsHits" });
    expect(store.get().engine.counters["archer.healFails"]).toBe(1);
    expect(store.get().engine.flags["archer.healed"]).toBeUndefined();
    expect(runtime.startDialogue("yard", "jousineito")!.view.nodeId).toBe("fading");
  });

  it("kuusi osumaa parantaa myös kahden epäonnistumisen jälkeen", () => {
    const { store, runtime } = setup();
    runtime.post(heal(2));
    const second = runtime.post(heal(0, { success: false }));
    expect(fired(second)).toEqual(["archer.heal-failed-second"]);
    expect(second.result.messages[0].sub).toBe("world.archer.lastTry");
    expect(fired(runtime.post(heal(6)))).toEqual(["archer.healed"]);
    expect(store.get().engine.flags["archer.dead"]).toBeUndefined();
  });

  it("kolmas epäonnistuminen tappaa neidon vuoteelle; sen jälkeen laulu ei tee mitään", () => {
    const { store, runtime } = setup();
    runtime.post(heal(5));
    runtime.post(heal(4));
    const third = runtime.post(heal(3));
    expect(fired(third)).toEqual(["archer.died-song"]);
    expect(third.result.actions).toEqual([{ kind: "npcState", npcId: "jousineito", state: "dead" }]);
    expect(store.get().engine.flags["archer.dead"]).toBe(true);
    expect(store.get().engine.counters["archer.healFails"]).toBe(3);
    expect(fired(runtime.post(heal(8)))).toEqual([]);
    expect(fired(runtime.post(heal(1)))).toEqual([]);
  });

  it("pihasta lähtö parantamatta tappaa neidon; parannetulle lähtö ei tee mitään", () => {
    const leave = { type: "npc.leftBehind", npcId: "jousineito", sceneId: "yard" } as const;
    const { store, runtime } = setup();
    expect(fired(runtime.post({ type: "npc.leftBehind", npcId: "emanta", sceneId: "yard" }))).toEqual([]);
    expect(fired(runtime.post(leave))).toEqual(["archer.died-left"]);
    expect(store.get().engine.flags["archer.dead"]).toBe(true);

    const healed = setup();
    healed.runtime.post(heal(7));
    expect(fired(healed.runtime.post(leave))).toEqual([]);
    expect(healed.store.get().engine.flags["archer.dead"]).toBeUndefined();
  });

  it("emäntä kertoo kuolleesta neidosta: ei ollut laulajaa eikä rohtojen sitojaa", () => {
    const { runtime } = setup();
    expect(runtime.startDialogue("yard", "emanta")!.view.choices.some((c) => c.id === "ask-maiden")).toBe(false);
    runtime.post({ type: "npc.leftBehind", npcId: "jousineito", sceneId: "yard" });
    const talk = runtime.startDialogue("yard", "emanta")!;
    expect(talk.view.choices.map((c) => c.id)).toEqual(["ask-news", "ask-maiden", "leave"]);
    const told = runtime.choose(talk, "ask-maiden");
    expect(told.saved && told.next?.view.nodeId).toBe("maidenDied");
  });
});

describe("toisen talon emäntä neuvoo metsästysapajan kerran kuussa", () => {
  function withHunts(ids: string[]) {
    const ctx = setup();
    ctx.store.update((s) => ({
      ...s,
      world: {
        ...s.world,
        siteInstances: [
          ...s.world.siteInstances,
          ...ids.map((id, i) => ({ id, kind: "hunt" as const, x: 2 + i * 14, y: 2 + i * 14, archer: false })),
        ],
      },
    }));
    return ctx;
  }
  const ask = (runtime: ReturnType<typeof setup>["runtime"]) => {
    const talk = runtime.startDialogue("yard", "emanta_b")!;
    const choice = talk.view.choices.find((c) => c.id.startsWith("ask-news"))!;
    const out = runtime.choose(talk, choice.id);
    if (!out.saved) throw new Error("valinta epäonnistui");
    return out;
  };

  it("paljastaa sankaria lähimmän tuntemattoman apajan ja muistaa kuun", () => {
    const { store, runtime } = withHunts(["hunt-a", "hunt-b"]);
    const hero = { x: store.get().world.x, y: store.get().world.y };
    const near = [{ id: "hunt-a", x: 2, y: 2 }, { id: "hunt-b", x: 16, y: 16 }]
      .sort((a, b) => Math.max(Math.abs(a.x - hero.x), Math.abs(a.y - hero.y)) - Math.max(Math.abs(b.x - hero.x), Math.abs(b.y - hero.y)))[0].id;
    const out = ask(runtime);
    expect(out.next?.view.nodeId).toBe("huntTip");
    expect(out.messages[0].text).toBe("world.emanta.huntTip");
    expect(store.get().world.knownSiteIds).toContain(near);
    expect(store.get().engine.counters["emanta.huntTipMoon"]).toBe(1);
    // Samalla kuulla ei uutta, vaikka toinen apaja on vielä tuntematon.
    expect(ask(runtime).next?.view.nodeId).toBe("noNews");
    // Seuraavalla kuulla seuraava apaja.
    store.update((s) => ({ ...s, world: { ...s.world, worldMinutes: s.world.worldMinutes + WORLD_MINUTES_PER_MOON } }));
    expect(ask(runtime).next?.view.nodeId).toBe("huntTip");
    expect(store.get().world.knownSiteIds).toEqual(expect.arrayContaining(["hunt-a", "hunt-b"]));
    // Kaikki tiedossa: ei uutta, vaikka kuu vaihtuu.
    store.update((s) => ({ ...s, world: { ...s.world, worldMinutes: s.world.worldMinutes + WORLD_MINUTES_PER_MOON } }));
    expect(ask(runtime).next?.view.nodeId).toBe("noNews");
  });

  it("ilman apajia vastaus on aina, ettei tältä kuulta ole uutta", () => {
    const { store, runtime } = setup();
    store.update((s) => ({ ...s, world: { ...s.world, siteInstances: s.world.siteInstances.filter((i) => i.kind !== "hunt") } }));
    expect(ask(runtime).next?.view.nodeId).toBe("noNews");
  });
});

describe("repliikkien muunnelmat", () => {
  it("jokaisella NPC:n repliikillä on vähintään kolme erilaista muunnelmaa (englanninkieliset avaimet tarkistaa tyyppi)", () => {
    for (const d of GAME_WORLD.dialogues) {
      for (const [id, node] of Object.entries(d.nodes)) {
        const variants = nodeVariants(node);
        expect(variants.length, `${d.id}/${id}`).toBeGreaterThanOrEqual(3);
        expect(new Set(variants.map((k) => finnishText(k))).size, `${d.id}/${id} FI`).toBe(variants.length);
      }
    }
  });

  it("ei uutta -vastauksella on runsaasti vaihtelua (omistajan toive)", () => {
    const node = GAME_WORLD.dialogues.find((d) => d.npcId === "emanta_b")!.nodes.noNews;
    expect(nodeVariants(node).length).toBeGreaterThanOrEqual(6);
  });
});
