// Näppäinsidonnat: mikä näppäin tai hiiren nappi tekee minkä toiminnon.
// Puhdasta logiikkaa ilman selainriippuvuuksia, jotta tämän voi testata suoraan.
//
// Koodit ovat joko näppäimistön KeyboardEvent.code-arvoja ("KeyJ", "ShiftLeft")
// tai hiiren nappeja muodossa "Mouse0", "Mouse1", ... (MouseEvent.button).
// Moninappihiiren lisänapit tulevat selaimelle joko nappeina 3 ja 4 tai ajurin
// lähettäminä näppäinpainalluksina; molemmat kelpaavat sellaisinaan.
import { t } from "./i18n";

export type SongSlotAction = "song1" | "song2" | "song3" | "song4" | "song5";
export type Action = "slash" | "overhead" | "thrust" | "block" | "dodge" | "song" | "lock" | "bow" | SongSlotAction;
/** Laulun pikavalinnat valintaringin paikoille vasemmalta oikealle. */
export const SONG_SLOT_ACTIONS: readonly SongSlotAction[] = ["song1", "song2", "song3", "song4", "song5"];

export const ACTIONS: { id: Action; label: string }[] = [
  { id: "slash", label: t("bindings.action.slash") },
  { id: "overhead", label: t("bindings.action.overhead") },
  { id: "thrust", label: t("bindings.action.thrust") },
  { id: "block", label: t("bindings.action.block") },
  { id: "dodge", label: t("bindings.action.dodge") },
  { id: "song", label: t("bindings.action.song") },
  { id: "lock", label: t("bindings.action.lock") },
  { id: "bow", label: t("bindings.action.bow") },
  { id: "song1", label: t("bindings.action.song1") },
  { id: "song2", label: t("bindings.action.song2") },
  { id: "song3", label: t("bindings.action.song3") },
  { id: "song4", label: t("bindings.action.song4") },
  { id: "song5", label: t("bindings.action.song5") },
];

/** Jokaisella toiminnolla on kaksi paikkaa; tyhjä merkkijono on tyhjä paikka. */
export const SLOTS = 2;
export type Bindings = Record<Action, string[]>;

export const DEFAULT_BINDINGS: Bindings = {
  slash: ["Mouse0", "KeyJ"],
  overhead: ["KeyF", "KeyI"],
  thrust: ["KeyE", "KeyL"],
  block: ["Mouse2", "KeyK"],
  dodge: ["ShiftLeft", "ShiftRight"],
  song: ["KeyQ", ""],
  lock: ["Tab", "Mouse1"],
  bow: ["KeyX", ""],
  song1: ["F1", ""],
  song2: ["F2", ""],
  song3: ["F3", ""],
  song4: ["F4", ""],
  song5: ["F5", ""],
};

/** Näppäimet, joilla on kiinteä tehtävä: liike, laulun tahti, uusi peli ja tauko. */
export const RESERVED: readonly string[] = ["KeyW", "KeyA", "KeyS", "KeyD", "KeyB", "Space", "KeyR", "Escape"];

export function mouseCode(button: number): string {
  return `Mouse${button}`;
}

export function cloneBindings(b: Bindings): Bindings {
  const out = {} as Bindings;
  for (const { id } of ACTIONS) out[id] = [...b[id]];
  return out;
}

/** Mikä toiminto koodista seuraa, tai null. */
export function actionFor(b: Bindings, code: string): Action | null {
  if (!code) return null;
  for (const { id } of ACTIONS) if (b[id].includes(code)) return id;
  return null;
}

/**
 * Sitoo koodin toiminnon paikkaan. Sama koodi poistetaan kaikista muista paikoista,
 * jotta yksi nappi ei tee kahta asiaa. Varattu koodi ei muuta mitään.
 */
export function assign(b: Bindings, action: Action, slot: number, code: string): Bindings {
  if (RESERVED.includes(code) || slot < 0 || slot >= SLOTS) return b;
  const out = cloneBindings(b);
  for (const { id } of ACTIONS) out[id] = out[id].map((c) => (c === code ? "" : c));
  out[action][slot] = code;
  return out;
}

export function clearSlot(b: Bindings, action: Action, slot: number): Bindings {
  const out = cloneBindings(b);
  if (slot >= 0 && slot < SLOTS) out[action][slot] = "";
  return out;
}

/** Lukee tallennetut sidonnat. Puuttuva tai rikkinäinen kohta korvataan oletuksella. */
export function parseBindings(data: unknown): Bindings {
  const out = cloneBindings(DEFAULT_BINDINGS);
  if (!data || typeof data !== "object") return out;
  const seen = new Set<string>();
  for (const { id } of ACTIONS) {
    const v = (data as Record<string, unknown>)[id];
    if (!Array.isArray(v)) continue;
    const slots: string[] = [];
    for (let i = 0; i < SLOTS; i++) {
      const c = v[i];
      const ok = typeof c === "string" && c.length > 0 && c.length < 40 && !RESERVED.includes(c) && !seen.has(c);
      if (ok) seen.add(c as string);
      slots.push(ok ? (c as string) : "");
    }
    out[id] = slots;
  }
  // Oletukset, jotka jäivät voimaan lukemattomille toiminnoille, eivät saa törmätä luettuihin.
  for (const { id } of ACTIONS) {
    const v = (data as Record<string, unknown>)[id];
    if (Array.isArray(v)) continue;
    out[id] = out[id].map((c) => (seen.has(c) ? "" : c));
  }
  return out;
}

const MOUSE_NAMES = [t("key.mouseLeft"), t("key.mouseMiddle"), t("key.mouseRight"), t("key.mouseButton", { number: 4 }), t("key.mouseButton", { number: 5 })];
const KEY_NAMES: Record<string, string> = {
  ShiftLeft: t("key.shiftLeft"), ShiftRight: t("key.shiftRight"), ControlLeft: t("key.controlLeft"), ControlRight: t("key.controlRight"),
  AltLeft: t("key.altLeft"), AltRight: t("key.altRight"), Tab: "Tab", CapsLock: "Caps Lock", Enter: "Enter", Backquote: "§",
  ArrowUp: t("key.arrowUp"), ArrowDown: t("key.arrowDown"), ArrowLeft: t("key.arrowLeft"), ArrowRight: t("key.arrowRight"),
};

/** Koodin nimi ihmiselle. */
export function codeLabel(code: string): string {
  if (!code) return "–";
  const mouse = /^Mouse(\d+)$/.exec(code);
  if (mouse) return MOUSE_NAMES[+mouse[1]] ?? t("key.mouseButton", { number: +mouse[1] + 1 });
  if (KEY_NAMES[code]) return KEY_NAMES[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad/.test(code)) return t("key.num", { key: code.slice(6) });
  return code;
}
