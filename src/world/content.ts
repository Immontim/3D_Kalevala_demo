// Pelin varsinainen maailmadata: säännöt ja dialogit. Tyypitettyä dataa, ei skriptiä.
// NPC:iden repliikeillä on vähintään kolme samaa tarkoittavaa muunnelmaa (`lines`), joista näytetään yksi.
import type { TextKey } from "../i18n";
import { COUNTERS, FLAGS } from "./registry";
import type { Condition, Dialogue, DialogueChoice, Rule, WorldData } from "./types";

const SAGE_PACK = "lakeside.sage-pack";
/** Jousineidon haava vaatii vähintään näin monta osumaa parannuslaulun kahdeksasta säkeestä (omistaja 2026-11-22). */
export const HEAL_ARCHER_HITS = 6;
/** Parannusyrityksiä on näin monta; viimeisen epäonnistuessa jousineito kuolee. */
export const HEAL_ARCHER_TRIES = 3;
const ARCHER_WOUNDED: Condition = {
  kind: "all",
  of: [{ kind: "flag", flag: "archer.healed", value: false }, { kind: "flag", flag: "archer.dead", value: false }],
};

/** Repliikki ja sen kaksi samaa tarkoittavaa muunnelmaa: avaimet `<avain>`, `<avain>.2` ja `<avain>.3`. */
type Varied = { [K in TextKey]: `${K}.2` extends TextKey ? (`${K}.3` extends TextKey ? K : never) : never }[TextKey];
const lines = (key: Varied): readonly TextKey[] => [key, `${key}.2` as TextKey, `${key}.3` as TextKey];

/** "Ei ole tältä kuulta uutta kuultu": emännän vastaus, kun kerrottavaa ei ole. Omistaja toivoi runsaasti vaihtelua. */
const NO_NEWS: readonly TextKey[] = [
  "dialogue.emanta.noNews", "dialogue.emanta.noNews.2", "dialogue.emanta.noNews.3",
  "dialogue.emanta.noNews.4", "dialogue.emanta.noNews.5", "dialogue.emanta.noNews.6",
];

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
    id: "campaign.victory",
    intent: "Kun leirin viimeinen aalto kaatuu, kampanja on voitettu: päivät ja tutkittu kartta kirjataan loppuruutua varten.",
    on: { type: "battle.won", sceneId: "clearing" },
    when: { kind: "flag", flag: "campaign.won", value: false },
    then: [{ kind: "recordVictory" }],
  },
  {
    id: "player.death-counted",
    intent: "Jokainen sankarin kaatuminen taistelussa lasketaan loppuruudun tilastoon (ei rankaise muuten).",
    on: { type: "player.died" },
    then: [{ kind: "addCounter", counter: "player.deaths", amount: 1 }],
  },
  {
    id: "archer.healed",
    intent: "Kun pelaaja laulaa parannuslaulun loukkaantuneen jousineidon kuuluvilla pihassa ja vähintään kuusi säettä kahdeksasta osuu, jousineito paranee ja nousee seisomaan.",
    on: { type: "song.performed", songId: "heal", context: "cast", success: true, minHits: HEAL_ARCHER_HITS, sceneId: "yard", nearNpcId: "jousineito" },
    when: ARCHER_WOUNDED,
    then: [
      { kind: "setFlag", flag: "archer.healed" },
      { kind: "setNpcState", npcId: "jousineito", state: "healed" },
      { kind: "message", text: "world.archer.healed", sub: "world.archer.healedSub" },
    ],
  },
  {
    id: "archer.died-song",
    intent: "Kolmas liian heikko parannuslaulu ei pidätä jousineidon henkeä: hän kuolee vuoteelleen, eikä miekkaa voi enää saada.",
    on: { type: "song.performed", songId: "heal", context: "cast", maxHits: HEAL_ARCHER_HITS - 1, sceneId: "yard", nearNpcId: "jousineito" },
    when: { kind: "all", of: [ARCHER_WOUNDED, { kind: "counter", counter: "archer.healFails", op: ">=", value: HEAL_ARCHER_TRIES - 1 }] },
    then: [
      { kind: "addCounter", counter: "archer.healFails", amount: 1 },
      { kind: "setFlag", flag: "archer.dead" },
      { kind: "setNpcState", npcId: "jousineito", state: "dead" },
      { kind: "message", text: "world.archer.died", sub: "world.archer.diedSub" },
    ],
  },
  {
    id: "archer.heal-failed-second",
    intent: "Toinen liian heikko parannuslaulu: jousineito heikkenee, ja pelaaja kuulee, että yritys on enää yksi.",
    on: { type: "song.performed", songId: "heal", context: "cast", maxHits: HEAL_ARCHER_HITS - 1, sceneId: "yard", nearNpcId: "jousineito" },
    when: { kind: "all", of: [ARCHER_WOUNDED, { kind: "counter", counter: "archer.healFails", op: "=", value: 1 }] },
    then: [
      { kind: "addCounter", counter: "archer.healFails", amount: 1 },
      { kind: "message", text: "world.archer.songFailed", sub: "world.archer.lastTry" },
    ],
  },
  {
    id: "archer.heal-failed-first",
    intent: "Ensimmäinen liian heikko parannuslaulu (alle kuusi osumaa kahdeksasta) ei paranna jousineitoa; pelaaja kuulee, mitä haava vaatii.",
    on: { type: "song.performed", songId: "heal", context: "cast", maxHits: HEAL_ARCHER_HITS - 1, sceneId: "yard", nearNpcId: "jousineito" },
    when: { kind: "all", of: [ARCHER_WOUNDED, { kind: "counter", counter: "archer.healFails", op: "=", value: 0 }] },
    then: [
      { kind: "addCounter", counter: "archer.healFails", amount: 1 },
      { kind: "message", text: "world.archer.songFailed", sub: "world.archer.needsHits" },
    ],
  },
  {
    id: "archer.died-left",
    intent: "Jos pelaaja lähtee pihasta parantamatta jousineitoa, hän kuolee poissa ollessa: seuraavalla käynnillä vuode on tyhjä ja emäntä kertoo, mitä tapahtui.",
    on: { type: "npc.leftBehind", npcId: "jousineito", sceneId: "yard" },
    when: ARCHER_WOUNDED,
    then: [{ kind: "setFlag", flag: "archer.dead" }],
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
      text: lines("dialogue.sage.greet"),
      choices: [ASK_PACK, ASK_SONG, { id: "leave", text: "dialogue.sage.leave" }],
    },
    granted: { text: lines("dialogue.sage.granted"), choices: [ASK_SONG, { id: "thanks", text: "dialogue.sage.thanks" }] },
    afterTaken: { text: lines("dialogue.sage.afterTaken"), choices: [ASK_SONG, { id: "leave", text: "dialogue.sage.leave" }] },
    songIntro: {
      text: lines("dialogue.sage.songIntro"),
      choices: [
        { id: "ready", text: "dialogue.sage.ready", effects: [{ kind: "startSongLesson", songId: "sleep" }] },
        { id: "leave", text: "dialogue.sage.leave" },
      ],
    },
    taught: {
      text: lines("dialogue.sage.taught"),
      choices: [
        {
          ...ASK_PACK,
          when: { kind: "all", of: [{ kind: "flag", flag: "sage.permission", value: false }, { kind: "not", of: { kind: "itemTaken", instanceId: SAGE_PACK } }] },
        },
        { id: "leave", text: "dialogue.sage.leave" },
      ],
    },
    robbed: {
      text: lines("dialogue.sage.robbed"),
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
    forgiven: { text: lines("dialogue.sage.forgiven"), choices: [ASK_SONG, { id: "thanks", text: "dialogue.sage.thanks" }] },
  },
};

/**
 * Jousineito makaa loukkaantuneena vuoteella nuotion ääressä, kunnes pelaaja parantaa hänet laululla
 * (6/8 osumaa, kolme yritystä); sitten hän antaa taivaanrautamiekan. Kuolleelle ei voi puhua.
 */
export const ARCHER_DIALOGUE: Dialogue = {
  id: "archer.yard",
  sceneId: "yard",
  npcId: "jousineito",
  intent: "Loukkaantunut jousineito pyytää parannuslaulua ja kertoo, jos edellinen laulu ei tepsinyt; parannettuna hän antaa taivaanrautamiekan, jonka voi saada vain näin.",
  entries: [
    { when: { kind: "flag", flag: "archer.gaveSword" }, node: "after" },
    { when: { kind: "flag", flag: "archer.healed" }, node: "reward" },
    { when: { kind: "counter", counter: "archer.healFails", op: ">=", value: 1 }, node: "fading" },
    { node: "wounded" },
  ],
  nodes: {
    wounded: {
      text: lines("dialogue.archer.wounded"),
      choices: [
        { id: "ask-story", text: "dialogue.archer.askStory", next: "story" },
        { id: "leave", text: "dialogue.sage.leave" },
      ],
    },
    fading: {
      text: lines("dialogue.archer.fading"),
      choices: [
        { id: "ask-story", text: "dialogue.archer.askStory", next: "story" },
        { id: "leave", text: "dialogue.sage.leave" },
      ],
    },
    story: { text: lines("dialogue.archer.story"), choices: [{ id: "leave", text: "dialogue.sage.leave" }] },
    reward: {
      text: lines("dialogue.archer.reward"),
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
    after: { text: lines("dialogue.archer.after"), choices: [{ id: "leave", text: "dialogue.sage.leave" }] },
  },
};

/** Kysymys uutisista: sama sanamuoto molemmille emännille. */
const ASK_NEWS_TEXT: TextKey = "dialogue.emanta.askNews";

/**
 * Jousineidon talon emäntä (`emanta`): kertoo kerran huhun vainolaisista ja merkitsee tietäjän rannan
 * kartalle. Jos jousineito kuoli, hän kertoo siitä. Muuten uutta ei ole kuulunut.
 */
export const HOUSEWIFE_DIALOGUE: Dialogue = {
  id: "emanta.yard",
  sceneId: "yard",
  npcId: "emanta",
  intent: "Jousineidon talon emäntä kertoo huhun Pohjan akan vainolaisista ja neuvoo tietäjän luo (ranta kartalle); jos jousineito kuoli, emäntä kertoo, ettei ollut laulajaa eikä rohtojen sitojaa. Kun kaikki on kerrottu, uutta ei ole kuultu.",
  entries: [{ node: "greet" }],
  nodes: {
    greet: {
      text: lines("dialogue.emanta.greet"),
      choices: [
        {
          id: "ask-news",
          text: ASK_NEWS_TEXT,
          when: { kind: "flag", flag: "rumor.heard", value: false },
          effects: [
            { kind: "setFlag", flag: "rumor.heard" },
            { kind: "revealSite", siteId: "lakeside" },
            { kind: "message", text: "world.emanta.rumor", sub: "world.emanta.rumorSub" },
          ],
          next: "rumor",
        },
        { id: "ask-news-again", text: ASK_NEWS_TEXT, when: { kind: "flag", flag: "rumor.heard" }, next: "noNews" },
        { id: "ask-maiden", text: "dialogue.emanta.askMaiden", when: { kind: "flag", flag: "archer.dead" }, next: "maidenDied" },
        { id: "leave", text: "dialogue.sage.leave" },
      ],
    },
    rumor: { text: lines("dialogue.emanta.rumor"), choices: [{ id: "leave", text: "dialogue.sage.leave" }] },
    maidenDied: { text: lines("dialogue.emanta.maidenDied"), choices: [{ id: "leave", text: "dialogue.sage.leave" }] },
    noNews: { text: NO_NEWS, choices: [{ id: "leave", text: "dialogue.sage.leave" }] },
  },
};

/** Apajavinkki on tarjolla, kun tuntematon apaja on olemassa eikä emäntä ole vielä neuvonut tällä kuulla. */
const HUNT_TIP_AVAILABLE: Condition = {
  kind: "all",
  of: [{ kind: "unknownHuntGround" }, { kind: "not", of: { kind: "sameMoon", counter: "emanta.huntTipMoon" } }],
};

/**
 * Toisen talon emäntä (`emanta_b`): ei tiedä vainolaisista, mutta neuvoo kerran kuunkierrossa yhden
 * metsästysapajan, jota pelaaja ei vielä tunne. Jos sellaista ei ole tai hän on jo neuvonut, uutta ei ole.
 */
export const HOUSEWIFE_B_DIALOGUE: Dialogue = {
  id: "emanta_b.yard",
  sceneId: "yard",
  npcId: "emanta_b",
  intent: "Toisen talon emäntä neuvoo kerran kuunkierrossa yhden metsästysapajan, jota pelaaja ei vielä tunne (apaja kartalle); muuten tältä kuulta ei ole uutta kuultu.",
  entries: [{ node: "greet" }],
  nodes: {
    greet: {
      text: lines("dialogue.emanta.greet"),
      choices: [
        {
          id: "ask-news",
          text: ASK_NEWS_TEXT,
          when: HUNT_TIP_AVAILABLE,
          effects: [
            { kind: "revealHuntGround" },
            { kind: "markMoon", counter: "emanta.huntTipMoon" },
            { kind: "message", text: "world.emanta.huntTip", sub: "world.emanta.huntTipSub" },
          ],
          next: "huntTip",
        },
        { id: "ask-news-none", text: ASK_NEWS_TEXT, when: { kind: "not", of: HUNT_TIP_AVAILABLE }, next: "noNews" },
        { id: "leave", text: "dialogue.sage.leave" },
      ],
    },
    huntTip: { text: lines("dialogue.emanta.huntTip"), choices: [{ id: "leave", text: "dialogue.sage.leave" }] },
    noNews: { text: NO_NEWS, choices: [{ id: "leave", text: "dialogue.sage.leave" }] },
  },
};

/** Nuori urho (pihassa ilman jousineitoa): vihjaa kalmiston lähettilääseen. */
export const YOUNG_WARRIOR_DIALOGUE: Dialogue = {
  id: "urho.yard",
  sceneId: "yard",
  npcId: "urho",
  intent: "Nuori urho kertoo, että kalmistolla seisoo Pohjan akan lähettiläs ja joku saa ajettua hänet pois: vihje pelaajalle.",
  entries: [{ node: "greet" }],
  nodes: { greet: { text: lines("dialogue.urho.greet"), choices: [{ id: "leave", text: "dialogue.sage.leave" }] } },
};

export const GAME_WORLD: WorldData = {
  flags: FLAGS,
  counters: COUNTERS,
  rules: RULES,
  dialogues: [SAGE_DIALOGUE, ARCHER_DIALOGUE, HOUSEWIFE_DIALOGUE, HOUSEWIFE_B_DIALOGUE, YOUNG_WARRIOR_DIALOGUE],
};
