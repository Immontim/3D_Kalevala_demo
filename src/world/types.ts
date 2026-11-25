// Maailmamoottorin tyypit. Pelkkää dataa: ei skriptikieltä eikä eval-kutsuja.
// Sääntöjen kirjoittavat agentit; omistaja hyväksyy ne moottorin tulostaman suomenkielisen yhteenvedon kautta.
import type { TextKey } from "../i18n";
import type { ItemId, ItemTag, TakeMode } from "../map/campaign";
import type { LongEffectId } from "../map/longEffects";
import type { CounterDef, FlagDef } from "./registry";

// ---------- Ehdot ----------

export type CounterOp = "<" | "<=" | "=" | ">=" | ">";

export type Condition =
  | { kind: "all"; of: Condition[] }
  | { kind: "any"; of: Condition[] }
  | { kind: "not"; of: Condition }
  /** Lippu on asetettu (value oletuksena true) tai asettamatta (value false). */
  | { kind: "flag"; flag: string; value?: boolean }
  | { kind: "counter"; counter: string; op: CounterOp; value: number }
  /** Laskuriin merkitystä maailma-ajasta on kulunut vähintään annettu minuuttimäärä. */
  | { kind: "elapsedWorldMinutes"; counter: string; minutes: number }
  /** Kuun vaihe (0–7, kartan kalenterin mukaan) on jokin annetuista. */
  | { kind: "moonPhase"; phases: number[] }
  /**
   * Staattinen maailmanesine on jo otettu. Pihojen pöytäesineisiin viitataan pihan roolilla:
   * `@archerYard.<esine>` (jousineidon talo) ja `@otherYard.<esine>` (toinen talo), ks. `instances.ts`.
   */
  | { kind: "itemTaken"; instanceId: string }
  /** Pelaajan inventaariossa on vähintään `quantity` kappaletta esinettä. */
  | { kind: "hasItem"; itemId: ItemId; quantity: number }
  /** Pelaajalla on vähintään `quantity` kappaletta tämän tyypin esineitä yhteensä (esim. mitä tahansa lihaa). */
  | { kind: "hasTagged"; tag: ItemTag; quantity: number }
  /**
   * Kuunkierron arpa: pitää todennäköisyydellä `chance`, ja tulos pysyy samana koko kuunkierron
   * (siemen, kuunkierto ja `salt`). Esim. "kalaa on tällä kuulla noussut hyvin".
   */
  | { kind: "moonChance"; salt: string; chance: number }
  /** Laskuriin on kirjattu tämä kuunkierto (`markMoon`): esim. emäntä on jo neuvonut tällä kuulla. */
  | { kind: "sameMoon"; counter: string }
  /** Karttapaikka tai rooli (`@archerYard`) on pelaajan tiedossa. */
  | { kind: "siteKnown"; siteId: string }
  /** Kartalla on metsästysapaja, jota pelaaja ei vielä tunne. */
  | { kind: "unknownHuntGround" };

// ---------- Efektit ----------

export type Effect =
  | { kind: "setFlag"; flag: string; value?: boolean }
  | { kind: "addCounter"; counter: string; amount: number }
  | { kind: "giveItem"; itemId: ItemId; quantity: number }
  | { kind: "takeItem"; itemId: ItemId; quantity: number }
  /** Ottaa pelaajalta `quantity` kappaletta tämän tyypin esineitä (esim. kaksi lihaa uhriksi), lajista riippumatta. */
  | { kind: "takeTagged"; tag: ItemTag; quantity: number }
  /** Muuttaa ottamisen luvan. `instanceId` voi viitata pihan rooliin (`@archerYard.` / `@otherYard.`). */
  | { kind: "setSceneItemTakeMode"; instanceId: string; takeMode: TakeMode }
  /** Viesti pelaajalle. Ei muuta tilaa; moottori palauttaa sen kutsujalle näytettäväksi. */
  | { kind: "message"; text: TextKey; sub?: TextKey }
  /** Pyytää 3D:tä aloittamaan laulun opettelun (rytmiharjoitus). Ei muuta tilaa itse. */
  | { kind: "startSongLesson"; songId: string }
  /** Paljastaa kartalle paikan: lisää sen tunnetuksi ja paljastaa ruudun ympäristöineen. */
  | { kind: "revealSite"; siteId: string }
  /** Pyytää 3D:tä poistamaan hahmon kohtauksesta heti (pysyvyys tulee lipusta, jonka sääntö asettaa). */
  | { kind: "removeNpc"; npcId: string }
  /** Pyytää 3D:tä vaihtamaan hahmon tilan heti (esim. jousineito "healed": nousee seisomaan). Pysyvyys tulee lipusta. */
  | { kind: "setNpcState"; npcId: string; state: string }
  /** Pyytää 3D:tä käynnistämään nimetyn kohtaamisen. Kohtaamisen oma tila ei tallennu kampanjaan. */
  | { kind: "startEncounter"; encounterId: string }
  /** Pyytää 3D:tä palaamaan nykyisestä kohtauksesta heti kartalle. */
  | { kind: "returnToMap" }
  /** Kirjaa kampanjan voitetuksi ja tallentaa loppuruudun tilastot (päivät, tutkittu kartta) lipuiksi ja laskureiksi. */
  | { kind: "recordVictory" }
  /** Kirjaa laskuriin nykyisen kuunkierron (numero + 1), jota `sameMoon` vertaa. */
  | { kind: "markMoon"; counter: string }
  /** Kirjaa laskuriin nykyisen maailma-ajan aikaleimaksi. */
  | { kind: "markWorldTime"; counter: string }
  /** Paljastaa kartalle sankaria lähimmän apajan, jota pelaaja ei tunne. Epäonnistuu, jos sellaista ei ole. */
  | { kind: "revealHuntGround" }
  /**
   * Antaa pitkäkestoisen efektin (`map/longEffects.ts`), esim. Ukon siunauksen. Sama efekti uudelleen alkaa
   * alusta. Epäonnistuu, jos kaikki kolme efektipaikkaa ovat täynnä muita efektejä.
   */
  | { kind: "addLongEffect"; effectId: LongEffectId };

export interface OutMessage { text: TextKey; sub?: TextKey }

/** Efektin pyyntö kutsujalle (UI tekee sen tilanmuutoksen jälkeen). Moottori ei tee sitä itse. */
export type OutAction =
  | { kind: "songLesson"; songId: string }
  | { kind: "removeNpc"; npcId: string }
  | { kind: "npcState"; npcId: string; state: string }
  | { kind: "startEncounter"; encounterId: string }
  | { kind: "returnToMap" };

// ---------- Tapahtumat ----------

export type GameEvent =
  | { type: "item.taken"; instanceId: string; itemId: ItemId; siteId: string; sceneId: string; takeMode: TakeMode; ownerId?: string }
  | { type: "npc.talked"; npcId: string; sceneId: string }
  | { type: "scene.entered"; sceneId: string }
  /** Sankari poistui kohtauksesta polunsuusta tai valikosta, ja hahmo jäi sinne (puhuteltava väki). */
  | { type: "npc.leftBehind"; npcId: string; sceneId: string }
  /** Leirin viimeinen aalto kaatui. */
  | { type: "battle.won"; sceneId: string; wave: number }
  /** Sankari kaatui taistelussa (ennen uutta yritystä). */
  | { type: "player.died"; sceneId: string }
  /** Laulu laulettu: `lesson` = tietäjän opetus, `cast` = laulu taistelussa. */
  | {
    type: "song.performed"; songId: string; context: "lesson" | "cast"; success: boolean; hits: number; sceneId: string;
    /** Lähin puhuteltava hahmo laulajan lähellä (esim. "louhi"), jos sellainen on kuuluvilla. */
    nearNpcId?: string;
  };

/** Laulun osumaraja kuviossa: täsmää, kun osumia on vähintään `minHits` / enintään `maxHits`. */
interface HitRange { minHits?: number; maxHits?: number }
type PatternFor<E extends GameEvent> = { type: E["type"] } & Partial<Omit<E, "type">> & (E extends { hits: number } ? HitRange : unknown);
/** Tapahtumatyyppi ja valinnaisia kenttiä, joiden pitää täsmätä tapahtumaan. */
export type EventPattern = { [E in GameEvent as E["type"]]: PatternFor<E> }[GameEvent["type"]];

// ---------- Säännöt ----------

export interface Rule {
  id: string;
  /**
   * Suunnitteluaie: yksi omistajan hyväksymä lause siitä, mitä sääntö tekee pelin kannalta.
   * Pakollinen jokaiselle säännölle (testi vaatii).
   */
  intent: string;
  on: EventPattern;
  when?: Condition;
  then: Effect[];
}

// ---------- Dialogi ----------

export interface DialogueChoice {
  id: string;
  /** Valinnan teksti tai samaa tarkoittavat muunnelmat, joista UI näyttää yhden. */
  text: TextKey | readonly TextKey[];
  /** Valinta näkyy vain, kun ehto pitää. */
  when?: Condition;
  effects?: Effect[];
  /** Seuraava solmu; puuttuva tai null sulkee dialogin. */
  next?: string | null;
}

export interface DialogueNode {
  /** Repliikki tai sen samaa tarkoittavat muunnelmat, joista näytetään yksi kerrallaan. */
  text: TextKey | readonly TextKey[];
  choices: DialogueChoice[];
}

export interface DialogueEntry {
  /** Ensimmäinen merkintä, jonka ehto pitää (tai jolla ei ole ehtoa), valitsee aloitussolmun. */
  when?: Condition;
  node: string;
}

export interface Dialogue {
  id: string;
  /** Kohtaus, jossa dialogi on voimassa (esim. "lakeside"), ja puhuteltavan NPC:n tunniste. */
  sceneId: string;
  npcId: string;
  intent: string;
  entries: DialogueEntry[];
  nodes: Record<string, DialogueNode>;
}

/** Kaikki moottorin data yhdessä: rekisteri, säännöt ja dialogit. Testit voivat rakentaa omansa. */
export interface WorldData {
  flags: Record<string, FlagDef>;
  counters: Record<string, CounterDef>;
  rules: Rule[];
  dialogues: Dialogue[];
}
