// Pelin varsinainen maailmadata: säännöt ja dialogit. Tyypitettyä dataa, ei skriptiä.
// NPC:iden repliikeillä on vähintään kolme samaa tarkoittavaa muunnelmaa (`lines`), joista näytetään yksi.
import type { TextKey } from "../i18n";
import { WORLD_MINUTES_PER_DAY } from "../map/uiState";
import { COUNTERS, FLAGS } from "./registry";
import type { Condition, Dialogue, DialogueChoice, DialogueEntry, DialogueNode, Rule, WorldData } from "./types";

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

/** Emäntien pöytäruoka: varkaus, sovitus kahdella jäniksellä ja ruoan pyytäminen (omistaja 2026-11-22). */
export const APPEASE_HARES = 2;
/** Todennäköisyys, että kalaa on kuunkierrolla noussut niin hyvin, että emäntä antaa sitä pyytämättä vastalahjaa. */
export const FISH_RUN_CHANCE = 0.5;
export const SMITHY_MEAT_PRICE = 8;
export const SMITHY_TRADE_COOLDOWN = WORLD_MINUTES_PER_DAY * 30;
export const SMITHY_SPEAR = "smithy.spear";
export const SMITHY_GREAVES = "smithy.greaves";

type HousewifeId = "emanta" | "emanta_b";
const HOUSEHOLD = {
  emanta: { yard: "@archerYard", name: "jousineidon talon emäntä" },
  emanta_b: { yard: "@otherYard", name: "toisen talon emäntä" },
} as const;

/** Emännän pöydältä varastaminen: emäntä huomaa sen heti ja muistaa, kunnes hänet lepytetään. */
function theftRule(npc: HousewifeId): Rule {
  return {
    id: `${npc}.theft-noticed`,
    intent: `Jos pelaaja vie ruokaa pöydältä kysymättä, ${HOUSEHOLD[npc].name} huomaa sen eikä puhu muusta ennen kuin saa kaksi jänislihaa hyvitykseksi.`,
    on: { type: "item.taken", takeMode: "theft", sceneId: "yard", ownerId: npc },
    then: [
      { kind: "setFlag", flag: `${npc}.robbed` },
      { kind: "addCounter", counter: "thefts.noticed", amount: 1 },
      { kind: "message", text: "world.emanta.theftNoticed", sub: "world.emanta.theftNoticedSub" },
    ],
  };
}

/**
 * Emännän ruokadialogin palat: varkauden jälkeinen aloitus, sovitus ja ruoan pyytäminen. Kalaa on
 * joka toisena kuunkiertona noussut hyvin (`moonChance`), jolloin emäntä antaa kalat pyytämällä;
 * muuten rieskat ja kalat saa yhdellä jänislihalla.
 */
function householdFood(npc: HousewifeId, greetChoices: DialogueChoice[]): {
  entry: DialogueEntry; greet: DialogueChoice[]; nodes: Record<string, DialogueNode>;
} {
  const bread = `${HOUSEHOLD[npc].yard}.table-flatbread`;
  const fish = `${HOUSEHOLD[npc].yard}.table-dried-fish`;
  const robbed = `${npc}.robbed`;
  const shared = `${npc}.foodShared`;
  const fishOffer: Condition = {
    kind: "all",
    of: [{ kind: "moonChance", salt: `${npc}.fish`, chance: FISH_RUN_CHANCE }, { kind: "not", of: { kind: "itemTaken", instanceId: fish } }],
  };
  const tableEmpty: Condition = { kind: "all", of: [{ kind: "itemTaken", instanceId: bread }, { kind: "itemTaken", instanceId: fish }] };
  const askFood: DialogueChoice[] = [
    {
      id: "ask-food-fish",
      text: "dialogue.emanta.askFood",
      when: { kind: "all", of: [{ kind: "flag", flag: shared, value: false }, fishOffer] },
      effects: [
        { kind: "setSceneItemTakeMode", instanceId: fish, takeMode: "allowed" },
        { kind: "message", text: "world.emanta.fishAllowed" },
      ],
      next: "foodFish",
    },
    {
      id: "ask-food-meat",
      text: "dialogue.emanta.askFood",
      when: {
        kind: "all",
        of: [{ kind: "flag", flag: shared, value: false }, { kind: "not", of: fishOffer }, { kind: "not", of: tableEmpty }],
      },
      next: "foodMeat",
    },
  ];
  const greet = [...greetChoices.slice(0, -1), ...askFood, ...greetChoices.slice(-1)];
  const leave: DialogueChoice = { id: "leave", text: "dialogue.sage.leave" };
  return {
    entry: { when: { kind: "flag", flag: robbed }, node: "robbed" },
    greet,
    nodes: {
      robbed: {
        text: lines("dialogue.emanta.robbed"),
        choices: [
          {
            id: "give-hares",
            text: "dialogue.emanta.giveHares",
            when: { kind: "hasItem", itemId: "hare_meat", quantity: APPEASE_HARES },
            effects: [
              { kind: "takeItem", itemId: "hare_meat", quantity: APPEASE_HARES },
              { kind: "setFlag", flag: robbed, value: false },
            ],
            next: "appeased",
          },
          leave,
        ],
      },
      appeased: { text: lines("dialogue.emanta.appeased"), choices: greet },
      foodFish: { text: lines("dialogue.emanta.foodFish"), choices: [leave] },
      foodMeat: {
        text: lines("dialogue.emanta.foodMeat"),
        choices: [
          {
            id: "offer-hare",
            text: "dialogue.emanta.offerHare",
            when: { kind: "hasItem", itemId: "hare_meat", quantity: 1 },
            effects: [
              { kind: "takeItem", itemId: "hare_meat", quantity: 1 },
              { kind: "setSceneItemTakeMode", instanceId: bread, takeMode: "allowed" },
              { kind: "setSceneItemTakeMode", instanceId: fish, takeMode: "allowed" },
              { kind: "setFlag", flag: shared },
              { kind: "message", text: "world.emanta.foodAllowed" },
            ],
            next: "foodTraded",
          },
          { id: "no-hare", text: "dialogue.emanta.noHare" },
        ],
      },
      foodTraded: { text: lines("dialogue.emanta.foodTraded"), choices: [leave] },
    },
  };
}

const SMITHY_ITEMS = [SMITHY_SPEAR, SMITHY_GREAVES] as const;

function smithyProductTakenRule(instanceId: (typeof SMITHY_ITEMS)[number]): Rule {
  return {
    id: `smithy.${instanceId === SMITHY_SPEAR ? "spear" : "greaves"}-taken`,
    intent: "Kun pelaaja ottaa lihavaihdolla valitsemansa tuotteen, toisen tuotteen lupa sulkeutuu heti eikä samalla käynnillä voi tehdä toista kauppaa.",
    on: { type: "item.taken", instanceId, takeMode: "allowed", sceneId: "smithy", ownerId: "seppa" },
    when: { kind: "flag", flag: "smithy.exchangeOpen" },
    then: [
      { kind: "setSceneItemTakeMode", instanceId: SMITHY_SPEAR, takeMode: "theft" },
      { kind: "setSceneItemTakeMode", instanceId: SMITHY_GREAVES, takeMode: "theft" },
      { kind: "setFlag", flag: "smithy.exchangeOpen", value: false },
      { kind: "setFlag", flag: "smithy.tradeThisVisit" },
    ],
  };
}

const SMITHY_RULES: Rule[] = [
  ...SMITHY_ITEMS.map(smithyProductTakenRule),
  {
    id: "smithy.trade-departure",
    intent: "Sepän 30 päivän odotus alkaa vasta, kun pelaaja lähtee pihasta tehdyn lihavaihdon jälkeen; pelkkä vierailu ei käynnistä aikaa.",
    on: { type: "npc.leftBehind", npcId: "seppa", sceneId: "smithy" },
    when: { kind: "flag", flag: "smithy.tradePendingDeparture" },
    then: [
      { kind: "markWorldTime", counter: "smithy.lastTradeAt" },
      { kind: "setFlag", flag: "smithy.tradePendingDeparture", value: false },
      { kind: "setFlag", flag: "smithy.tradeThisVisit", value: false },
    ],
  },
  {
    id: "smithy.trade-visit-cleared",
    intent: "Kun pelaaja lähtee sepän pihasta ilman uutta odottavaa aikaleimaa, saman käynnin yhden kaupan esto nollautuu seuraavaa käyntiä varten.",
    on: { type: "npc.leftBehind", npcId: "seppa", sceneId: "smithy" },
    when: { kind: "flag", flag: "smithy.tradeThisVisit" },
    then: [{ kind: "setFlag", flag: "smithy.tradeThisVisit", value: false }],
  },
  {
    id: "smithy.trade-reload-departure",
    intent: "Jos peli ladataan uudelleen kesken maksetun sepänkaupan, uusi sisääntulo tulkitaan lähdöksi ja odotuksen aikaleima kirjataan turvallisesti.",
    on: { type: "scene.entered", sceneId: "smithy" },
    when: { kind: "flag", flag: "smithy.tradePendingDeparture" },
    then: [
      { kind: "markWorldTime", counter: "smithy.lastTradeAt" },
      { kind: "setFlag", flag: "smithy.tradePendingDeparture", value: false },
      { kind: "setFlag", flag: "smithy.tradeThisVisit", value: false },
    ],
  },
];

export const RULES: Rule[] = [
  ...SMITHY_RULES,
  theftRule("emanta"),
  theftRule("emanta_b"),
  ...meetingRules("emanta"),
  ...meetingRules("emanta_b"),
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
    id: "sage.offering-awaited",
    intent: "Kun pelaaja lähtee rannalta sen jälkeen, kun tietäjä on vaatinut uhrin, tietäjä kysyy seuraavalla käynnillä, onko uhrit toimitettu.",
    on: { type: "npc.leftBehind", npcId: "tietaja", sceneId: "lakeside" },
    when: { kind: "flag", flag: "sage.offeringAsked" },
    then: [{ kind: "setFlag", flag: "sage.offeringAwaited" }],
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

/** Uhrikalmiston kuppikivelle vietävä lihamäärä (omistaja 2026-11-22). */
export const OFFERING_MEAT = 2;
const NOT_LEARNED: Condition = { kind: "flag", flag: "song.sleep.learned", value: false };
const OFFERING_MADE: Condition = { kind: "flag", flag: "offering.made" };
/**
 * Laulun pyyntö (V4 + uhri 2026-11-22). Ennen uhria tietäjä vaatii uhrin Ukolle, Tapiolle ja Manalle
 * menneille ja kertoo toisesta kalmistosta (paljastuu kartalle). Kun uhri on tehty, hän opettaa laulun.
 */
const ASK_SONG: DialogueChoice[] = [
  {
    id: "ask-song",
    text: "dialogue.sage.askSong",
    when: { kind: "all", of: [NOT_LEARNED, { kind: "flag", flag: "sage.offeringAsked", value: false }, { kind: "not", of: OFFERING_MADE }] },
    effects: [
      { kind: "setFlag", flag: "sage.offeringAsked" },
      { kind: "revealSite", siteId: "cairn-b" },
      { kind: "message", text: "world.sage.offeringCairn", sub: "world.sage.offeringCairnSub" },
    ],
    next: "offeringDemand",
  },
  { id: "ask-song-taught", text: "dialogue.sage.askSong", when: { kind: "all", of: [NOT_LEARNED, OFFERING_MADE] }, next: "songIntro" },
];
const LESSON_CHOICES: DialogueChoice[] = [
  { id: "ready", text: "dialogue.sage.ready", effects: [{ kind: "startSongLesson", songId: "sleep" }] },
  { id: "leave", text: "dialogue.sage.leave" },
];
const PACK_FREE: Condition = {
  kind: "all", of: [{ kind: "flag", flag: "sage.permission", value: false }, { kind: "not", of: { kind: "itemTaken", instanceId: SAGE_PACK } }],
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
  intent: "Tietäjä antaa ovensuun tuohikontin luvallisesti pyydettäessä. Laulua pyytävältä hän vaatii ensin uhrin Ukolle, Tapiolle ja Manalle menneille ja kertoo toisesta kalmistosta; seuraavalla käynnillä hän kysyy, onko uhrit toimitettu, ja uhrin jälkeen opettaa Pohjolan unen. Luvaton ottaja saa kuulla varkaudesta ja voi pyytää anteeksi.",
  entries: [
    { when: { kind: "flag", flag: "sage.robbed" }, node: "robbed" },
    { when: { kind: "flag", flag: "song.sleep.learned" }, node: "taught" },
    {
      when: { kind: "all", of: [{ kind: "flag", flag: "sage.offeringAwaited" }, { kind: "flag", flag: "sage.offeringConfirmed", value: false }] },
      node: "askOffering",
    },
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
      choices: [ASK_PACK, ...ASK_SONG, { id: "leave", text: "dialogue.sage.leave" }],
    },
    granted: { text: lines("dialogue.sage.granted"), choices: [...ASK_SONG, { id: "thanks", text: "dialogue.sage.thanks" }] },
    afterTaken: { text: lines("dialogue.sage.afterTaken"), choices: [...ASK_SONG, { id: "leave", text: "dialogue.sage.leave" }] },
    songIntro: { text: lines("dialogue.sage.songIntro"), choices: LESSON_CHOICES },
    offeringDemand: { text: lines("dialogue.sage.offeringDemand"), choices: [{ id: "leave", text: "dialogue.sage.willDo" }] },
    askOffering: {
      text: lines("dialogue.sage.askOffering"),
      choices: [
        {
          id: "offering-done",
          text: "dialogue.sage.offeringDone",
          when: OFFERING_MADE,
          effects: [{ kind: "setFlag", flag: "sage.offeringConfirmed" }],
          next: "offeringThanks",
        },
        { id: "offering-not-yet", text: "dialogue.sage.offeringNotYet", when: { kind: "not", of: OFFERING_MADE }, next: "offeringPending" },
        { ...ASK_PACK, when: PACK_FREE },
        { id: "leave", text: "dialogue.sage.leave" },
      ],
    },
    offeringThanks: { text: lines("dialogue.sage.offeringThanks"), choices: LESSON_CHOICES },
    offeringPending: { text: lines("dialogue.sage.offeringPending"), choices: [{ id: "leave", text: "dialogue.sage.leave" }] },
    taught: {
      text: lines("dialogue.sage.taught"),
      choices: [
        { ...ASK_PACK, when: PACK_FREE },
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
    forgiven: { text: lines("dialogue.sage.forgiven"), choices: [...ASK_SONG, { id: "thanks", text: "dialogue.sage.thanks" }] },
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

/** Apajavinkki on tarjolla, kun tuntematon apaja on olemassa eikä kumpikaan emäntä ole vielä neuvonut tällä kuulla. */
const HUNT_TIP_AVAILABLE: Condition = {
  kind: "all",
  of: [{ kind: "unknownHuntGround" }, { kind: "not", of: { kind: "sameMoon", counter: "emanta.huntTipMoon" } }],
};
const RUMOR_TOLD: Condition = { kind: "flag", flag: "rumor.heard" };

/**
 * Emännän tapaaminen muistetaan käynnin yli: puhe merkitsee `<npc>.greeted`, ja kun sankari lähtee
 * pihasta (`npc.leftBehind`), emäntä on tavattu (`<npc>.met`). Saman käynnin uusi puhe on yhä ensitapaaminen.
 */
function meetingRules(npc: HousewifeId): Rule[] {
  return [
    {
      id: `${npc}.greeted`,
      intent: `Kun pelaaja puhuu ${HOUSEHOLD[npc].name.replace("emäntä", "emännälle")}, siitä jää merkintä tätä käyntiä varten.`,
      on: { type: "npc.talked", npcId: npc, sceneId: "yard" },
      then: [{ kind: "setFlag", flag: `${npc}.greeted` }],
    },
    {
      id: `${npc}.met`,
      intent: `Kun pelaaja lähtee pihasta puhuttuaan emännälle, ${HOUSEHOLD[npc].name} muistaa hänet seuraavalla käynnillä ("taas tapaamme").`,
      on: { type: "npc.leftBehind", npcId: npc, sceneId: "yard" },
      when: { kind: "flag", flag: `${npc}.greeted` },
      then: [{ kind: "setFlag", flag: `${npc}.met` }],
    },
  ];
}

/**
 * Emäntä (`emanta` jousineidon talossa, `emanta_b` toisessa). Kumpi tahansa kertoo huhun vainolaisista,
 * jos sitä ei ole vielä kuultu (yksi huhu emäntien kesken); sen jälkeen kumpi tahansa neuvoo kerran
 * kuunkierrossa apajan. Tervehdys riippuu tapaamisesta ja jousineidosta. Jousineidon talon emäntä
 * kertoo kuolleesta neidosta. Ruoka ja varkaus: `householdFood`.
 */
function housewifeDialogue(npc: HousewifeId): Dialogue {
  const archerHouse = npc === "emanta";
  const met: Condition = { kind: "flag", flag: `${npc}.met` };
  const food = householdFood(npc, [
    {
      id: "ask-news",
      text: ASK_NEWS_TEXT,
      when: { kind: "not", of: RUMOR_TOLD },
      effects: [
        { kind: "setFlag", flag: "rumor.heard" },
        { kind: "revealSite", siteId: "lakeside" },
        { kind: "message", text: "world.emanta.rumor", sub: "world.emanta.rumorSub" },
      ],
      next: "rumor",
    },
    {
      id: "ask-news-tip",
      text: ASK_NEWS_TEXT,
      when: { kind: "all", of: [RUMOR_TOLD, HUNT_TIP_AVAILABLE] },
      effects: [
        { kind: "revealHuntGround" },
        { kind: "markMoon", counter: "emanta.huntTipMoon" },
        { kind: "message", text: "world.emanta.huntTip", sub: "world.emanta.huntTipSub" },
      ],
      next: "huntTip",
    },
    { id: "ask-news-none", text: ASK_NEWS_TEXT, when: { kind: "all", of: [RUMOR_TOLD, { kind: "not", of: HUNT_TIP_AVAILABLE }] }, next: "noNews" },
    ...(archerHouse ? [{ id: "ask-maiden", text: "dialogue.emanta.askMaiden" as TextKey, when: { kind: "flag", flag: "archer.dead" } as Condition, next: "maidenDied" }] : []),
    { id: "leave", text: "dialogue.sage.leave" },
  ]);
  const leave: DialogueChoice[] = [{ id: "leave", text: "dialogue.sage.leave" }];
  return {
    id: `${npc}.yard`,
    sceneId: "yard",
    npcId: npc,
    intent: `${archerHouse ? "Jousineidon talon" : "Toisen talon"} emäntä tervehtii ensikertalaista${archerHouse ? " (haavoittuneen neidon aikaan: \"ehjin nahoin\")" : ""} ja tuttua eri tavoin${archerHouse ? " (neidon parantajaa erikseen)" : ""}. Kumpi tahansa emäntä kertoo huhun vainolaisista, jos sitä ei vielä ole kuultu, ja muuten neuvoo kerran kuunkierrossa apajan; muuten tältä kuulta ei ole uutta.${archerHouse ? " Kuolleesta jousineidosta hän kertoo, ettei ollut laulajaa eikä rohtojen sitojaa." : ""} Ruokaa voi pyytää; pöydältä varastanut saa lepyttää emännän kahdella jänislihalla.`,
    entries: [
      food.entry,
      ...(archerHouse ? [{ when: { kind: "all", of: [met, { kind: "flag", flag: "archer.healed" }] } as Condition, node: "greetHealer" }] : []),
      { when: met, node: "greetAgain" },
      ...(archerHouse ? [{ when: ARCHER_WOUNDED, node: "greetWounded" }] : []),
      { node: "greet" },
    ],
    nodes: {
      greet: { text: lines("dialogue.emanta.greet"), choices: food.greet },
      greetAgain: { text: lines("dialogue.emanta.greetAgain"), choices: food.greet },
      ...(archerHouse ? {
        greetWounded: { text: lines("dialogue.emanta.greetWounded"), choices: food.greet },
        greetHealer: { text: lines("dialogue.emanta.greetHealer"), choices: food.greet },
        maidenDied: { text: lines("dialogue.emanta.maidenDied"), choices: leave },
      } : {}),
      ...food.nodes,
      rumor: { text: lines("dialogue.emanta.rumor"), choices: leave },
      huntTip: { text: lines("dialogue.emanta.huntTip"), choices: leave },
      noNews: { text: NO_NEWS, choices: leave },
    },
  };
}

export const HOUSEWIFE_DIALOGUE = housewifeDialogue("emanta");
export const HOUSEWIFE_B_DIALOGUE = housewifeDialogue("emanta_b");

/** Nuori urho (pihassa ilman jousineitoa): vihjaa kalmiston lähettilääseen. */
export const YOUNG_WARRIOR_DIALOGUE: Dialogue = {
  id: "urho.yard",
  sceneId: "yard",
  npcId: "urho",
  intent: "Nuori urho kertoo, että kalmistolla seisoo Pohjan akan lähettiläs ja joku saa ajettua hänet pois: vihje pelaajalle.",
  entries: [{ node: "greet" }],
  nodes: { greet: { text: lines("dialogue.urho.greet"), choices: [{ id: "leave", text: "dialogue.sage.leave" }] } },
};

const SMITHY_SOLD_OUT: Condition = {
  kind: "all",
  of: SMITHY_ITEMS.map((instanceId) => ({ kind: "itemTaken", instanceId })),
};
const SMITHY_COOLDOWN_DONE: Condition = {
  kind: "elapsedWorldMinutes",
  counter: "smithy.lastTradeAt",
  minutes: SMITHY_TRADE_COOLDOWN,
};

/** Seppä: kahdeksan mitä tahansa lihaa avaa yhden tuotteen, ja seuraava vaihto odottaa 30 pelipäivää. */
export const SMITH_DIALOGUE: Dialogue = {
  id: "seppa.smithy",
  sceneId: "smithy",
  npcId: "seppa",
  intent: "Seppä vaihtaa kahdeksan mitä tahansa lihaa keihääseen tai säärisuojiin, vain yhden tuotteen käyntiä kohti ja toisen aikaisintaan 30 pelipäivän kuluttua.",
  entries: [
    { when: SMITHY_SOLD_OUT, node: "soldOut" },
    { when: { kind: "flag", flag: "smithy.exchangeOpen" }, node: "chooseWare" },
    { when: { kind: "flag", flag: "smithy.tradeThisVisit" }, node: "onePerVisit" },
    {
      when: {
        kind: "all",
        of: [
          { kind: "flag", flag: "smithy.tradeMade" },
          { kind: "not", of: SMITHY_COOLDOWN_DONE },
        ],
      },
      node: "busy",
    },
    { node: "greet" },
  ],
  nodes: {
    greet: {
      text: lines("dialogue.smithy.smith.request"),
      choices: [
        {
          id: "trade-meat",
          text: "dialogue.smithy.smith.offerMeat",
          when: { kind: "hasTagged", tag: "meat", quantity: SMITHY_MEAT_PRICE },
          effects: [
            { kind: "takeTagged", tag: "meat", quantity: SMITHY_MEAT_PRICE },
            { kind: "setSceneItemTakeMode", instanceId: SMITHY_SPEAR, takeMode: "allowed" },
            { kind: "setSceneItemTakeMode", instanceId: SMITHY_GREAVES, takeMode: "allowed" },
            { kind: "setFlag", flag: "smithy.exchangeOpen" },
            { kind: "setFlag", flag: "smithy.tradeMade" },
            { kind: "setFlag", flag: "smithy.tradePendingDeparture" },
            { kind: "setFlag", flag: "smithy.tradeThisVisit" },
            { kind: "message", text: "world.smithy.tradeOpened", sub: "world.smithy.tradeOpenedSub" },
          ],
          next: "traded",
        },
        { id: "leave", text: "dialogue.sage.leave" },
      ],
    },
    traded: { text: lines("dialogue.smithy.smith.traded"), choices: [{ id: "leave", text: "dialogue.sage.leave" }] },
    chooseWare: { text: lines("dialogue.smithy.smith.chooseWare"), choices: [{ id: "leave", text: "dialogue.sage.leave" }] },
    onePerVisit: { text: lines("dialogue.smithy.smith.onePerVisit"), choices: [{ id: "leave", text: "dialogue.sage.leave" }] },
    busy: { text: lines("dialogue.smithy.smith.busy"), choices: [{ id: "leave", text: "dialogue.sage.leave" }] },
    soldOut: { text: lines("dialogue.smithy.smith.soldOut"), choices: [{ id: "leave", text: "dialogue.sage.leave" }] },
  },
};

function smithyChildDialogue(npcId: "pikkusalli" | "pikkusalli-koira", dogAbsent: boolean): Dialogue {
  const returnChoices: DialogueChoice[] = [
    { id: "ask-another", text: "dialogue.smithy.askAnother", next: "greet" },
    { id: "leave", text: "dialogue.sage.leave" },
  ];
  return {
    id: `${npcId}.smithy`,
    sceneId: "smithy",
    npcId,
    intent: `Pikkusälli kertoo pajatyöstään ja oppimisestaan${dogAbsent ? " sekä sisällä olevasta koirasta" : "; koira on hänen vierellään"}.`,
    entries: [{ node: "greet" }],
    nodes: {
      greet: {
        text: dogAbsent ? lines("dialogue.smithy.child.greetWork") : lines("dialogue.smithy.child.greetDog"),
        choices: [
          ...(dogAbsent ? [{ id: "ask-dog", text: "dialogue.smithy.child.askDog" as TextKey, next: "dog" }] : []),
          { id: "ask-water", text: "dialogue.smithy.child.askWater", next: "water" },
          { id: "ask-learning", text: "dialogue.smithy.child.askLearning", next: "learning" },
          { id: "leave", text: "dialogue.sage.leave" },
        ],
      },
      ...(dogAbsent ? { dog: { text: lines("dialogue.smithy.child.dog"), choices: returnChoices } } : {}),
      water: { text: lines("dialogue.smithy.child.water"), choices: returnChoices },
      learning: { text: lines("dialogue.smithy.child.learning"), choices: returnChoices },
    },
  };
}

export const SMITHY_CHILD_DIALOGUE = smithyChildDialogue("pikkusalli", true);
export const SMITHY_CHILD_DOG_DIALOGUE = smithyChildDialogue("pikkusalli-koira", false);

/** Aikuinen sälli: maatilahuhu on kertakäyttöinen, pajatyöstä voi kysellä aina. */
export const SMITHY_APPRENTICE_DIALOGUE: Dialogue = {
  id: "salli.smithy",
  sceneId: "smithy",
  npcId: "salli",
  intent: "Sepän aikuinen sälli paljastaa kerran jousineidon maatilan, jos se ei ole vielä tiedossa, ja kertoo muuten sepäntyön oppimisesta.",
  entries: [{ node: "greet" }],
  nodes: {
    greet: {
      text: lines("dialogue.smithy.apprentice.greet"),
      choices: [
        {
          id: "ask-sweetheart",
          text: "dialogue.smithy.apprentice.askSweetheart",
          when: {
            kind: "all",
            of: [
              { kind: "flag", flag: "smithy.salliToldArcherYard", value: false },
              { kind: "not", of: { kind: "siteKnown", siteId: "@archerYard" } },
            ],
          },
          effects: [
            { kind: "setFlag", flag: "smithy.salliToldArcherYard" },
            { kind: "revealSite", siteId: "@archerYard" },
          ],
          next: "sweetheart",
        },
        { id: "ask-craft", text: "dialogue.smithy.apprentice.askCraft", next: "craft" },
        { id: "leave", text: "dialogue.sage.leave" },
      ],
    },
    sweetheart: {
      text: lines("dialogue.smithy.apprentice.sweetheart"),
      choices: [
        { id: "ask-another", text: "dialogue.smithy.askAnother", next: "greet" },
        { id: "leave", text: "dialogue.sage.leave" },
      ],
    },
    craft: {
      text: lines("dialogue.smithy.apprentice.craft"),
      choices: [
        { id: "ask-another", text: "dialogue.smithy.askAnother", next: "greet" },
        { id: "leave", text: "dialogue.sage.leave" },
      ],
    },
  },
};

/**
 * Louhen kalmisto: pelaaja voi vetäytyä suoraan kartalle tai haastaa Louhen, jolloin 3D käynnistää
 * paikallisen yhteenoton. Valinnat eivät muuta kampanjatilaa: paluu tai kuolema nollaa keskeneräisen
 * kohtaamisen, ja pysyvä eteneminen syntyy vasta Louhen onnistuneesta karkotuksesta.
 */
export const LOUHI_DIALOGUE: Dialogue = {
  id: "louhi.cairnfield",
  sceneId: "cairnfield",
  npcId: "louhi",
  intent: "Louhi käskee kalmistolle tullutta pelaajaa poistumaan; pelaaja voi vetäytyä heti kartalle tai haastaa Louhen, jolloin Louhi kutsuu Pohjan urhot yhteenottoon.",
  entries: [{ node: "greet" }],
  nodes: {
    greet: {
      text: lines("dialogue.louhi.greet"),
      choices: [
        { id: "retreat", text: lines("dialogue.louhi.retreat"), effects: [{ kind: "returnToMap" }] },
        { id: "challenge", text: "dialogue.louhi.challenge", effects: [{ kind: "startEncounter", encounterId: "louhi" }] },
      ],
    },
  },
};

/**
 * Kuppikivi kummallakin kalmistolla (sama kohtaus `cairnfield`): Louhen kalmistolla `kuppikivi`, toisella
 * kalmistolla `uhrikivi`. Ukon muistaminen antaa Ukon siunauksen (+20 kestävyyden yläraja 15 päiväksi)
 * kerran kuunkierrossa yhteensä molemmilla kivillä (omistaja 2026-11-22); saman kuun aikana kivi vain
 * vaikenee, ja tarjolla on tyhjä muistelu. Uhrikivellä voi lisäksi uhrata kaksi lihaa (mitä tahansa
 * lihaa), mikä avaa tietäjän laulunopetuksen eikä anna buffia.
 */
function cupstoneDialogue(npcId: "kuppikivi" | "uhrikivi"): Dialogue {
  const offering = npcId === "uhrikivi";
  const offer: DialogueChoice[] = offering ? [{
    id: "offer",
    text: "dialogue.cupstone.offer",
    when: { kind: "all", of: [{ kind: "hasTagged", tag: "meat", quantity: OFFERING_MEAT }, { kind: "not", of: OFFERING_MADE }] },
    effects: [
      { kind: "takeTagged", tag: "meat", quantity: OFFERING_MEAT },
      { kind: "setFlag", flag: "offering.made" },
      { kind: "message", text: "world.offering.made", sub: "world.offering.madeSub" },
    ],
    next: "offered",
  }] : [];
  const leave: DialogueChoice = { id: "leave", text: "dialogue.cupstone.leave" };
  return {
    id: `${npcId}.cairnfield`,
    sceneId: "cairnfield",
    npcId,
    intent: offering
      ? "Toisen kalmiston kuppikivelle pelaaja voi uhrata kaksi lihaa Ukolle ja Manalle menneille (valinta näkyy vain, kun lihaa on mukana kaksi); uhri avaa tietäjän laulunopetuksen. Kivellä voi myös muistaa Ukkoa kuten Louhen kalmistolla: siunaus kerran kuunkierrossa kummalla tahansa kivellä."
      : "Kuppikivellä pelaaja voi muistaa Ukkoa, Tapiota ja Otavan tähtiä; siitä saa Ukon siunauksen (kestävyyden yläraja +20, 15 päivää) kerran kuunkierrossa, yhteensä kummallakin kalmistolla. Saman kuun aikana kivi on vaiti eikä muistelu tee mitään.",
    entries: [
      { when: { kind: "sameMoon", counter: "ukko.rememberedMoon" }, node: "silent" },
      { node: "stone" },
    ],
    nodes: {
      stone: {
        text: lines("dialogue.cupstone.stone"),
        choices: [
          ...offer,
          {
            id: "remember-ukko",
            text: "dialogue.cupstone.remember",
            effects: [
              { kind: "addLongEffect", effectId: "ukko_blessing" },
              { kind: "markMoon", counter: "ukko.rememberedMoon" },
              { kind: "message", text: "world.ukko.blessed", sub: "world.ukko.blessedSub" },
            ],
            next: "blessed",
          },
          leave,
        ],
      },
      blessed: { text: lines("dialogue.cupstone.blessed"), choices: [leave] },
      silent: {
        text: lines("dialogue.cupstone.silent"),
        choices: [...offer, { id: "recall", text: "dialogue.cupstone.recall" }, leave],
      },
      ...(offering ? { offered: { text: lines("dialogue.cupstone.offered"), choices: [leave] } } : {}),
    },
  };
}

export const CUPSTONE_DIALOGUE = cupstoneDialogue("kuppikivi");
export const OFFERING_STONE_DIALOGUE = cupstoneDialogue("uhrikivi");

export const GAME_WORLD: WorldData = {
  flags: FLAGS,
  counters: COUNTERS,
  rules: RULES,
  dialogues: [
    SAGE_DIALOGUE, ARCHER_DIALOGUE, HOUSEWIFE_DIALOGUE, HOUSEWIFE_B_DIALOGUE, YOUNG_WARRIOR_DIALOGUE,
    SMITH_DIALOGUE, SMITHY_CHILD_DIALOGUE, SMITHY_CHILD_DOG_DIALOGUE, SMITHY_APPRENTICE_DIALOGUE,
    LOUHI_DIALOGUE, CUPSTONE_DIALOGUE, OFFERING_STONE_DIALOGUE,
  ],
};
