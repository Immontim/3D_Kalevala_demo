import { describe, expect, it } from "vitest";
import { createCampaign, setSceneItemTakeMode, tryTakeSceneItem, type SceneItemDefinition } from "./campaign";
import { createCampaignStore } from "./campaignStore";
import { withFlag } from "../world/state";

const PACK: SceneItemDefinition = {
  instanceId: "lakeside.sage-pack", siteId: "lakeside", itemId: "birch_bark_pack", quantity: 1, takeMode: "theft", ownerId: "tietaja",
};

function memoryStore() {
  const saved: string[] = [];
  const store = createCampaignStore(createCampaign(), (state) => { saved.push(JSON.stringify(state)); return true; });
  return { store, saved };
}

describe("CampaignStore", () => {
  it("tallentaa muutoksen ja ottaa uuden tilan käyttöön", () => {
    const { store, saved } = memoryStore();
    const result = store.update((s) => ({ ...s, engine: withFlag(s.engine, "rumor.heard", true) }));
    expect(result).toMatchObject({ ok: true, changed: true });
    expect(store.get().engine.flags["rumor.heard"]).toBe(true);
    expect(saved).toHaveLength(1);
  });

  it("ei kirjoita mitään, kun fn palauttaa saman tilan", () => {
    const { store, saved } = memoryStore();
    const before = store.get();
    expect(store.update((s) => s)).toMatchObject({ ok: true, changed: false });
    expect(store.get()).toBe(before);
    expect(saved).toHaveLength(0);
  });

  it("epäonnistunut tallennus jättää tilan ennalleen eikä ilmoita kuuntelijoille", () => {
    const store = createCampaignStore(createCampaign(), () => false);
    const before = store.get();
    let notified = 0;
    store.subscribe(() => { notified++; });
    const result = store.update((s) => ({ ...s, engine: withFlag(s.engine, "rumor.heard", true) }));
    expect(result.ok).toBe(false);
    expect(store.get()).toBe(before);
    expect(notified).toBe(0);
  });

  it("peräkkäinen otto ja lippumuutos eivät hävitä kumpaakaan (V1:n hyväksymiskriteeri)", () => {
    const { store } = memoryStore();
    // Ensin esineen otto, sitten dialogin tai säännön lippu, sitten uusi lupamuutos.
    store.update((s) => {
      const r = tryTakeSceneItem(s, PACK);
      return r.status === "taken" ? r.state : s;
    });
    store.update((s) => ({ ...s, engine: withFlag(s.engine, "sage.robbed", true) }));
    store.update((s) => setSceneItemTakeMode(s, "yard.table-flatbread", "allowed"));
    const state = store.get();
    expect(state.world.sceneItems.takenInstanceIds).toEqual(["lakeside.sage-pack"]);
    expect(state.world.sceneItems.thefts).toHaveLength(1);
    expect(state.player.inventory.stacks.some((st) => st.itemId === "birch_bark_pack")).toBe(true);
    expect(state.engine.flags["sage.robbed"]).toBe(true);
    expect(state.world.sceneItems.takeModeOverrides).toEqual([{ instanceId: "yard.table-flatbread", takeMode: "allowed" }]);
  });

  it("kuuntelija saa uuden ja edellisen tilan", () => {
    const { store } = memoryStore();
    const seen: boolean[] = [];
    const off = store.subscribe((next, prev) => { seen.push(next !== prev); });
    store.update((s) => ({ ...s, engine: withFlag(s.engine, "rumor.heard", true) }));
    off();
    store.update((s) => ({ ...s, engine: withFlag(s.engine, "rumor.heard", false) }));
    expect(seen).toEqual([true]);
  });
});
