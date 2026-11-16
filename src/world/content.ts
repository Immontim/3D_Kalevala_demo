// Pelin varsinainen maailmadata: säännöt ja dialogit. Tyypitettyä dataa, ei skriptiä.
// Tällä hetkellä sisältö on yksi NPC (tietäjä rannalla) ja yksi esine (tuohikontti).
import { COUNTERS, FLAGS } from "./registry";
import type { Dialogue, Rule, WorldData } from "./types";

const SAGE_PACK = "lakeside.sage-pack";

export const RULES: Rule[] = [
  {
    id: "sage.theft-noticed",
    intent: "Jos pelaaja vie tietäjän tuohikontin luvatta, siitä jää näkyvä seuraus: tietäjä muistaa sen ja puhuu siitä.",
    on: { type: "item.taken", instanceId: SAGE_PACK, takeMode: "theft", sceneId: "lakeside" },
    then: [
      { kind: "setFlag", flag: "sage.robbed" },
      { kind: "setFlag", flag: "sage.forgiven", value: false },
      { kind: "addCounter", counter: "thefts.noticed", amount: 1 },
      { kind: "message", text: "world.sage.theftNoticed", sub: "world.sage.theftNoticedSub" },
    ],
  },
];

export const SAGE_DIALOGUE: Dialogue = {
  id: "sage.lakeside",
  sceneId: "lakeside",
  npcId: "tietaja",
  intent: "Tietäjä antaa tuohikontin luvallisesti pyydettäessä; luvaton ottaja saa kuulla siitä ja voi pyytää anteeksi.",
  entries: [
    { when: { kind: "flag", flag: "sage.robbed" }, node: "robbed" },
    { when: { kind: "flag", flag: "sage.forgiven" }, node: "forgiven" },
    {
      when: { kind: "all", of: [{ kind: "flag", flag: "sage.permission" }, { kind: "not", of: { kind: "itemTaken", instanceId: SAGE_PACK } }] },
      node: "granted",
    },
    { when: { kind: "itemTaken", instanceId: SAGE_PACK }, node: "afterTaken" },
    { node: "greet" },
  ],
  nodes: {
    greet: {
      text: "dialogue.sage.greet",
      choices: [
        {
          id: "ask-pack",
          text: "dialogue.sage.askPack",
          effects: [
            { kind: "setFlag", flag: "sage.permission" },
            { kind: "setSceneItemTakeMode", instanceId: SAGE_PACK, takeMode: "allowed" },
          ],
          next: "granted",
        },
        { id: "leave", text: "dialogue.sage.leave" },
      ],
    },
    granted: { text: "dialogue.sage.granted", choices: [{ id: "thanks", text: "dialogue.sage.thanks" }] },
    afterTaken: { text: "dialogue.sage.afterTaken", choices: [{ id: "leave", text: "dialogue.sage.leave" }] },
    robbed: {
      text: "dialogue.sage.robbed",
      choices: [
        {
          id: "apologize",
          text: "dialogue.sage.apologize",
          effects: [
            { kind: "setFlag", flag: "sage.robbed", value: false },
            { kind: "setFlag", flag: "sage.forgiven" },
          ],
          next: "forgiven",
        },
        { id: "leave", text: "dialogue.sage.leave" },
      ],
    },
    forgiven: { text: "dialogue.sage.forgiven", choices: [{ id: "thanks", text: "dialogue.sage.thanks" }] },
  },
};

export const GAME_WORLD: WorldData = {
  flags: FLAGS,
  counters: COUNTERS,
  rules: RULES,
  dialogues: [SAGE_DIALOGUE],
};
