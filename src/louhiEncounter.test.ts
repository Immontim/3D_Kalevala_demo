import { describe, expect, it } from "vitest";
import {
  LOUHI_ENCOUNTER,
  createLouhiEncounterState,
  stepLouhiEncounter,
  type LouhiEncounterState,
} from "./louhiEncounter";

const challenge = (state = createLouhiEncounterState(), now = 10) =>
  stepLouhiEncounter(state, { type: "challenge", now });

describe("Louhen kalmistokohtaamisen tilakone", () => {
  it("haaste kutsuu tasan yhden kahden vartijan aallon", () => {
    const first = challenge();
    expect(first.state).toMatchObject({ battle: "active", guardsAlive: 2, guardsCalled: true, nextAbilityAt: 16 });
    expect(first.effects).toEqual([{ kind: "call-guards", count: 2, reason: "challenge" }]);

    const again = stepLouhiEncounter(first.state, { type: "challenge", now: 11 });
    expect(again.state).toBe(first.state);
    expect(again.effects).toEqual([]);
  });

  it("suora Pohjolan uni katkeaa deterministisesti riimulla 2 tai 3 ja kutsuu saman aallon", () => {
    const atTwo = stepLouhiEncounter(
      createLouhiEncounterState(),
      { type: "player-sleep-started", now: 1, nearLouhi: true },
      LOUHI_ENCOUNTER,
      () => 0,
    );
    expect(atTwo.state.pendingSleepInterruptBeat).toBe(2);
    expect(stepLouhiEncounter(atTwo.state, { type: "player-song-beat", songId: "sleep", beat: 1, now: 2 }).effects).toEqual([]);
    const called = stepLouhiEncounter(atTwo.state, { type: "player-song-beat", songId: "sleep", beat: 2, now: 3 });
    expect(called.effects).toEqual([
      { kind: "interrupt-player-sleep", afterBeat: 2 },
      { kind: "call-guards", count: 2, reason: "sleep" },
    ]);
    expect(called.state.pendingSleepInterruptBeat).toBeNull();

    const atThree = stepLouhiEncounter(
      createLouhiEncounterState(),
      { type: "player-sleep-started", now: 1, nearLouhi: true },
      LOUHI_ENCOUNTER,
      () => 0.999,
    );
    expect(atThree.state.pendingSleepInterruptBeat).toBe(3);
  });

  it("ei väijytä kaukaa aloitettua laulua", () => {
    const out = stepLouhiEncounter(
      createLouhiEncounterState(),
      { type: "player-sleep-started", now: 1, nearLouhi: false },
    );
    expect(out.state.pendingSleepInterruptBeat).toBeNull();
    expect(out.effects).toEqual([]);
  });

  it("rauhoittuu vasta molempien vartijoiden kaaduttua", () => {
    const active = challenge().state;
    const one = stepLouhiEncounter(active, { type: "guard-down", now: 20 });
    expect(one.state).toMatchObject({ battle: "active", guardsAlive: 1 });
    expect(one.effects).toEqual([]);

    const two = stepLouhiEncounter(one.state, { type: "guard-down", now: 21 });
    expect(two.state).toMatchObject({ battle: "cleared", guardsAlive: 0 });
    expect(two.effects).toEqual([{ kind: "battle-cleared" }]);
  });

  it("aloittaa Louhen laulun vain aktiivisessa taistelussa, kantamalla ja jäähyn jälkeen", () => {
    const active = challenge(createLouhiEncounterState(), 10).state;
    const early = stepLouhiEncounter(active, { type: "tick", now: 15.9, playerDistance: 4, playerRooted: false });
    expect(early.effects).toEqual([]);
    const far = stepLouhiEncounter(active, { type: "tick", now: 16, playerDistance: 8.1, playerRooted: false });
    expect(far.effects).toEqual([]);

    const started = stepLouhiEncounter(active, { type: "tick", now: 16, playerDistance: 8, playerRooted: false });
    expect(started.state.action).toEqual({ kind: "casting", ability: "bog-song", startedAt: 16, completesAt: 34 });
    expect(started.effects).toEqual([{ kind: "louhi-cast-started", ability: "bog-song", completesAt: 34 }]);
  });

  it("aseisku katkaisee Louhen laulun ja aloittaa jäähyn", () => {
    const active = challenge(createLouhiEncounterState(), 0).state;
    const casting = stepLouhiEncounter(active, { type: "tick", now: 6, playerDistance: 4, playerRooted: false }).state;
    const hit = stepLouhiEncounter(casting, { type: "louhi-hit", now: 9 });
    expect(hit.state.action).toEqual({ kind: "idle" });
    expect(hit.state.nextAbilityAt).toBe(21);
    expect(hit.effects).toEqual([{ kind: "louhi-cast-interrupted", ability: "bog-song", reason: "hit" }]);
  });

  it("valmis Louhen laulu tuottaa 4 sekunnin suon, 5 vahinkoa sekunnissa ja normaalin asevahingon", () => {
    const active = challenge(createLouhiEncounterState(), 0).state;
    const casting = stepLouhiEncounter(active, { type: "tick", now: 6, playerDistance: 4, playerRooted: false }).state;
    const before = stepLouhiEncounter(casting, { type: "tick", now: 23.99, playerDistance: 4, playerRooted: false });
    expect(before.effects).toEqual([]);
    const done = stepLouhiEncounter(casting, { type: "tick", now: 24, playerDistance: 4, playerRooted: false });
    expect(done.effects).toEqual([{ kind: "bog-player", seconds: 4, damagePerSecond: 5, meleeDamageMultiplier: 1 }]);
    expect(done.state).toMatchObject({ action: { kind: "idle" }, nextAbilityAt: 36 });
  });

  it("Louhen poistuminen katkaisee laulun mutta ei poista elossa olevia vartijoita", () => {
    const active = challenge(createLouhiEncounterState(), 0).state;
    const casting = stepLouhiEncounter(active, { type: "tick", now: 6, playerDistance: 4, playerRooted: false }).state;
    const gone = stepLouhiEncounter(casting, { type: "louhi-removed", now: 7 });
    expect(gone.state).toMatchObject({ battle: "active", presence: "banished", guardsAlive: 2, action: { kind: "idle" } });
    expect(gone.effects).toEqual([{ kind: "louhi-cast-interrupted", ability: "bog-song", reason: "removed" }]);
    expect(stepLouhiEncounter(gone.state, { type: "tick", now: 99, playerDistance: 1, playerRooted: false }).effects).toEqual([]);
  });

  it("taistelun loppu katkaisee keskeneräisen laulun ennen rauhoittumista", () => {
    const active = challenge(createLouhiEncounterState(), 0).state;
    const casting = stepLouhiEncounter(active, { type: "tick", now: 6, playerDistance: 4, playerRooted: false }).state;
    const oneLeft: LouhiEncounterState = { ...casting, guardsAlive: 1 };
    const out = stepLouhiEncounter(oneLeft, { type: "guard-down", now: 8 });
    expect(out.state).toMatchObject({ battle: "cleared", action: { kind: "idle" } });
    expect(out.effects).toEqual([
      { kind: "louhi-cast-interrupted", ability: "bog-song", reason: "battle-cleared" },
      { kind: "battle-cleared" },
    ]);
  });
});
