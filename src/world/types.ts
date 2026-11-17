// Maailmamoottorin tyypit. Pelkkää dataa: ei skriptikieltä eikä eval-kutsuja.
// Sääntöjen kirjoittavat agentit; omistaja hyväksyy ne moottorin tulostaman suomenkielisen yhteenvedon kautta.
import type { TextKey } from "../i18n";
import type { ItemId, TakeMode } from "../map/campaign";
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
  /** Kuun vaihe (0–7, kartan kalenterin mukaan) on jokin annetuista. */
  | { kind: "moonPhase"; phases: number[] }
  /** Staattinen maailmanesine on jo otettu. */
  | { kind: "itemTaken"; instanceId: string };

// ---------- Efektit ----------

export type Effect =
  | { kind: "setFlag"; flag: string; value?: boolean }
  | { kind: "addCounter"; counter: string; amount: number }
  | { kind: "giveItem"; itemId: ItemId; quantity: number }
  | { kind: "takeItem"; itemId: ItemId; quantity: number }
  | { kind: "setSceneItemTakeMode"; instanceId: string; takeMode: TakeMode }
  /** Viesti pelaajalle. Ei muuta tilaa; moottori palauttaa sen kutsujalle näytettäväksi. */
  | { kind: "message"; text: TextKey; sub?: TextKey }
  /** Pyytää 3D:tä aloittamaan laulun opettelun (rytmiharjoitus). Ei muuta tilaa itse. */
  | { kind: "startSongLesson"; songId: string }
  /** Paljastaa kartalle paikan: lisää sen tunnetuksi ja paljastaa ruudun ympäristöineen. */
  | { kind: "revealSite"; siteId: string }
  /** Pyytää 3D:tä poistamaan hahmon kohtauksesta heti (pysyvyys tulee lipusta, jonka sääntö asettaa). */
  | { kind: "removeNpc"; npcId: string };

export interface OutMessage { text: TextKey; sub?: TextKey }

/** Efektin pyyntö kutsujalle (UI tekee sen tilanmuutoksen jälkeen). Moottori ei tee sitä itse. */
export type OutAction =
  | { kind: "songLesson"; songId: string }
  | { kind: "removeNpc"; npcId: string };

// ---------- Tapahtumat ----------

export type GameEvent =
  | { type: "item.taken"; instanceId: string; itemId: ItemId; siteId: string; sceneId: string; takeMode: TakeMode; ownerId?: string }
  | { type: "npc.talked"; npcId: string; sceneId: string }
  | { type: "scene.entered"; sceneId: string }
  /** Laulu laulettu: `lesson` = tietäjän opetus, `cast` = laulu taistelussa. */
  | {
    type: "song.performed"; songId: string; context: "lesson" | "cast"; success: boolean; hits: number; sceneId: string;
    /** Lähin puhuteltava hahmo laulajan lähellä (esim. "louhi"), jos sellainen on kuuluvilla. */
    nearNpcId?: string;
  };

type PatternFor<E extends GameEvent> = { type: E["type"] } & Partial<Omit<E, "type">>;
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
  text: TextKey;
  /** Valinta näkyy vain, kun ehto pitää. */
  when?: Condition;
  effects?: Effect[];
  /** Seuraava solmu; puuttuva tai null sulkee dialogin. */
  next?: string | null;
}

export interface DialogueNode {
  text: TextKey;
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
