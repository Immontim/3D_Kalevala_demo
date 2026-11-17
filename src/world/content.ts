// Pelin varsinainen maailmadata: säännöt ja dialogit. Tyypitettyä dataa, ei skriptiä.
// Tällä hetkellä sisältö on yksi NPC (tietäjä rannalla) ja yksi esine (tuohikontti).
import { COUNTERS, FLAGS } from "./registry";
import type { Dialogue, DialogueChoice, Rule, WorldData } from "./types";

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
  {
    id: "sage.song-learned",
    intent: "Kun pelaaja laulaa tietäjän opettaman laulun onnistuneesti harjoituksessa, hän oppii sen: laulu ilmestyy laulupaikkaan ja kalmisto, jossa Louhi seisoo, merkitään kartalle.",
    on: { type: "song.performed", songId: "sleep", context: "lesson", success: true, sceneId: "lakeside" },
    when: { kind: "flag", flag: "song.sleep.learned", value: false },
    then: [
      { kind: "setFlag", flag: "song.sleep.learned" },
      { kind: "revealSite", siteId: "cairnfield" },
      { kind: "message", text: "song.lesson.learned", sub: "song.lesson.learnedSub" },
    ],
  },
  {
    id: "archer.healed",
    intent: "Kun pelaaja laulaa onnistuneesti parannuslaulun loukkaantuneen jousineidon kuuluvilla pihassa, jousineito paranee ja nousee seisomaan; epäonnistunut yritys ei rankaise.",
    on: { type: "song.performed", songId: "heal", context: "cast", success: true, sceneId: "yard", nearNpcId: "jousineito" },
    when: { kind: "flag", flag: "archer.healed", value: false },
    then: [
      { kind: "setFlag", flag: "archer.healed" },
      { kind: "setNpcState", npcId: "jousineito", state: "healed" },
      { kind: "message", text: "world.archer.healed", sub: "world.archer.healedSub" },
    ],
  },
  {
    id: "louhi.banished",
    intent: "Kun pelaaja laulaa Pohjolan unen onnistuneesti kalmistolla Louhen kuuluvilla, Louhi vaipuu uneen ja poistuu, ja vainolaisten leiri paljastuu kartalle. Epäonnistunut yritys ei rankaise.",
    on: { type: "song.performed", songId: "sleep", context: "cast", success: true, sceneId: "cairnfield", nearNpcId: "louhi" },
    when: { kind: "flag", flag: "louhi.banished", value: false },
    then: [
      { kind: "setFlag", flag: "louhi.banished" },
      { kind: "revealSite", siteId: "camp" },
      { kind: "removeNpc", npcId: "louhi" },
      { kind: "message", text: "world.louhi.banished", sub: "world.louhi.banishedSub" },
    ],
  },
];

/** Laulun opettelun valinta (V4): näkyy, kunnes Pohjolan uni on opittu. */
const ASK_SONG: DialogueChoice = {
  id: "ask-song",
  text: "dialogue.sage.askSong",
  when: { kind: "flag", flag: "song.sleep.learned", value: false },
  next: "songIntro",
};
const ASK_PACK: DialogueChoice = {
  id: "ask-pack",
  text: "dialogue.sage.askPack",
  effects: [
    { kind: "setFlag", flag: "sage.permission" },
    { kind: "setSceneItemTakeMode", instanceId: SAGE_PACK, takeMode: "allowed" },
  ],
  next: "granted",
};

export const SAGE_DIALOGUE: Dialogue = {
  id: "sage.lakeside",
  sceneId: "lakeside",
  npcId: "tietaja",
  intent: "Tietäjä antaa tuohikontin luvallisesti pyydettäessä ja opettaa Pohjolan unen; luvaton ottaja saa kuulla varkaudesta ja voi pyytää anteeksi.",
  entries: [
    { when: { kind: "flag", flag: "sage.robbed" }, node: "robbed" },
    { when: { kind: "flag", flag: "song.sleep.learned" }, node: "taught" },
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
      choices: [ASK_PACK, ASK_SONG, { id: "leave", text: "dialogue.sage.leave" }],
    },
    granted: { text: "dialogue.sage.granted", choices: [ASK_SONG, { id: "thanks", text: "dialogue.sage.thanks" }] },
    afterTaken: { text: "dialogue.sage.afterTaken", choices: [ASK_SONG, { id: "leave", text: "dialogue.sage.leave" }] },
    songIntro: {
      text: "dialogue.sage.songIntro",
      choices: [
        { id: "ready", text: "dialogue.sage.ready", effects: [{ kind: "startSongLesson", songId: "sleep" }] },
        { id: "leave", text: "dialogue.sage.leave" },
      ],
    },
    taught: {
      text: "dialogue.sage.taught",
      choices: [
        {
          ...ASK_PACK,
          when: { kind: "all", of: [{ kind: "flag", flag: "sage.permission", value: false }, { kind: "not", of: { kind: "itemTaken", instanceId: SAGE_PACK } }] },
        },
        { id: "leave", text: "dialogue.sage.leave" },
      ],
    },
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
    forgiven: { text: "dialogue.sage.forgiven", choices: [ASK_SONG, { id: "thanks", text: "dialogue.sage.thanks" }] },
  },
};

/** Jousineito (V6): makaa loukkaantuneena, kunnes pelaaja parantaa hänet laululla; sitten hän antaa taivaanrautamiekan. */
export const ARCHER_DIALOGUE: Dialogue = {
  id: "archer.yard",
  sceneId: "yard",
  npcId: "jousineito",
  intent: "Loukkaantunut jousineito pyytää parannuslaulua; parannettuna hän antaa taivaanrautamiekan, jonka voi saada vain näin.",
  entries: [
    { when: { kind: "flag", flag: "archer.gaveSword" }, node: "after" },
    { when: { kind: "flag", flag: "archer.healed" }, node: "reward" },
    { node: "wounded" },
  ],
  nodes: {
    wounded: {
      text: "dialogue.archer.wounded",
      choices: [
        { id: "ask-story", text: "dialogue.archer.askStory", next: "story" },
        { id: "leave", text: "dialogue.sage.leave" },
      ],
    },
    story: { text: "dialogue.archer.story", choices: [{ id: "leave", text: "dialogue.sage.leave" }] },
    reward: {
      text: "dialogue.archer.reward",
      choices: [
        {
          id: "take",
          text: "dialogue.archer.take",
          effects: [
            { kind: "giveItem", itemId: "sky_iron_sword", quantity: 1 },
            { kind: "setFlag", flag: "archer.gaveSword" },
            { kind: "message", text: "world.archer.sword", sub: "world.archer.swordSub" },
          ],
        },
        { id: "leave", text: "dialogue.sage.leave" },
      ],
    },
    after: { text: "dialogue.archer.after", choices: [{ id: "leave", text: "dialogue.sage.leave" }] },
  },
};

/** Emäntä kertoo huhun vainolaisista ja merkitsee tietäjän rannan kartalle (ROADMAP: huhu). Molemmissa pihoissa. */
export const HOUSEWIFE_DIALOGUE: Dialogue = {
  id: "emanta.yard",
  sceneId: "yard",
  npcId: "emanta",
  intent: "Emäntä kertoo huhun Pohjan akan vainolaisista ja neuvoo tietäjän luo: tietäjän ranta merkitään kartalle.",
  entries: [{ when: { kind: "flag", flag: "rumor.heard" }, node: "again" }, { node: "greet" }],
  nodes: {
    greet: {
      text: "dialogue.emanta.greet",
      choices: [
        {
          id: "ask-news",
          text: "dialogue.emanta.askNews",
          effects: [
            { kind: "setFlag", flag: "rumor.heard" },
            { kind: "revealSite", siteId: "lakeside" },
            { kind: "message", text: "world.emanta.rumor", sub: "world.emanta.rumorSub" },
          ],
          next: "rumor",
        },
        { id: "leave", text: "dialogue.sage.leave" },
      ],
    },
    rumor: { text: "dialogue.emanta.rumor", choices: [{ id: "leave", text: "dialogue.sage.leave" }] },
    again: { text: "dialogue.emanta.again", choices: [{ id: "leave", text: "dialogue.sage.leave" }] },
  },
};

/** Nuori urho (pihassa ilman jousineitoa): vihjaa kalmiston lähettilääseen. */
export const YOUNG_WARRIOR_DIALOGUE: Dialogue = {
  id: "urho.yard",
  sceneId: "yard",
  npcId: "urho",
  intent: "Nuori urho kertoo, että kalmistolla seisoo Pohjan akan lähettiläs ja joku saa ajettua hänet pois: vihje pelaajalle.",
  entries: [{ node: "greet" }],
  nodes: { greet: { text: "dialogue.urho.greet", choices: [{ id: "leave", text: "dialogue.sage.leave" }] } },
};

export const GAME_WORLD: WorldData = {
  flags: FLAGS,
  counters: COUNTERS,
  rules: RULES,
  dialogues: [SAGE_DIALOGUE, ARCHER_DIALOGUE, HOUSEWIFE_DIALOGUE, YOUNG_WARRIOR_DIALOGUE],
};
