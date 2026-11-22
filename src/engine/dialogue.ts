// Dialogi 3D:ssä: DOM-paneeli maailmamoottorin dialogin päällä. Dialogilogiikka on puhtaassa
// `src/world/dialogue.ts`:ssä; tämä moduuli vain piirtää ja välittää valinnat tilanomistajalle.
// Dialogin aikana maailma on pysäytetty (ei taistelua, ei aikaa), ja hiiren lukitus vapautetaan.
import { t, type TextKey } from "../i18n";
import { ARENA } from "../world";
import type { ActiveDialogue, WorldRuntime } from "../world/runtime";
import type { OutMessage } from "../world/types";
import { setState } from "./actor";
import { $ } from "./dom";
import { showMsg } from "./hud";
import { clearInputs, lockPointer } from "./input";
import { paused } from "./loop";
import { startLesson } from "./song";
import { SONGS, type SongId } from "../songLogic";
import { g } from "./state";
import { worldRuntime } from "./store";

export let dialogueOpen = false;
let active: ActiveDialogue | null = null;
let speaker = "";
/** Näytettävä muunnelma nykyisestä solmusta (arvotaan solmuun tullessa, ei joka piirrolla). */
let shownText: TextKey | null = null;
/** Viimeksi näytetty muunnelma solmua kohti: sama repliikki ei toistu kahdesti peräkkäin. */
const lastVariant = new Map<string, TextKey>();

/** Arpoo solmun repliikin muunnelmista yhden, mutta ei edellistä kertaa samassa solmussa. */
function pickVariant(view: ActiveDialogue["view"]): TextKey {
  const key = `${view.dialogueId}/${view.nodeId}`;
  const previous = lastVariant.get(key);
  const pool = view.variants.length > 1 ? view.variants.filter((v) => v !== previous) : view.variants;
  const chosen = pool[Math.floor(Math.random() * pool.length)] ?? view.text;
  lastVariant.set(key, chosen);
  return chosen;
}

function show(messages: readonly OutMessage[]) {
  const first = messages[0];
  if (first) showMsg(t(first.text), first.sub ? t(first.sub) : "", 3);
}

function render() {
  if (!active) return;
  const { view } = active;
  $("dialogueName").textContent = speaker;
  $("dialogueText").textContent = t(shownText ?? view.text);
  const box = $("dialogueChoices");
  box.replaceChildren();
  view.choices.forEach((choice, i) => {
    const button = document.createElement("button");
    button.type = "button";
    const key = document.createElement("kbd");
    key.textContent = String(i + 1);
    button.append(key, t(choice.text));
    button.addEventListener("click", () => choose(i));
    box.appendChild(button);
  });
  (box.firstElementChild as HTMLButtonElement | null)?.focus({ preventScroll: true });
}

function failureText(reason: string): TextKey {
  if (reason === "inventory-full") return "dialogue.inventoryFull";
  if (reason === "missing-item") return "dialogue.missingItem";
  if (reason === "effects-full") return "dialogue.effectsFull";
  return "dialogue.saveFailed";
}

/**
 * Puhe hahmolle: ilmoittaa moottorille `npc.talked`, ja jos hahmolla on tässä kohtauksessa
 * dialogi, avaa sen. Palauttaa true, jos dialogi avautui (muuten kutsuja näyttää vanhan nimiviestin).
 */
export function talkTo(npcId: string, name: string, runtime: WorldRuntime = worldRuntime()): boolean {
  const posted = runtime.post({ type: "npc.talked", npcId, sceneId: ARENA });
  const start = runtime.startDialogue(ARENA, npcId);
  if (!start) {
    if (posted.saved) show(posted.result.messages);
    return false;
  }
  active = start;
  shownText = pickVariant(start.view);
  speaker = name;
  dialogueOpen = true;
  clearInputs();
  setState(g.player, "idle");
  render();
  $("dialogue").classList.remove("hidden");
  showMsg("", "", 0.01);
  if (document.pointerLockElement) { g.choiceUnlock = true; document.exitPointerLock(); }
  return true;
}

function choose(index: number) {
  if (!active) return;
  const choice = active.view.choices[index];
  if (!choice) return;
  const outcome = worldRuntime().choose(active, choice.id);
  if (!outcome.saved) {
    showMsg(t(failureText(outcome.reason)), "", 1.6);
    return;
  }
  show(outcome.messages);
  const lesson = outcome.actions.find((a) => a.kind === "songLesson");
  const npcId = active.view.npcId;
  if (outcome.next) { active = outcome.next; shownText = pickVariant(active.view); render(); } else closeDialogue();
  // Opetus alkaa vasta, kun dialogi on suljettu ja valinnan tila tallennettu.
  if (lesson && Object.prototype.hasOwnProperty.call(SONGS, lesson.songId)) {
    startLesson(lesson.songId as SongId, { npcId, name: speaker });
  }
}

export function closeDialogue(silent = false) {
  if (!dialogueOpen) return;
  dialogueOpen = false;
  active = null;
  shownText = null;
  $("dialogue").classList.add("hidden");
  $("dialogueChoices").replaceChildren();
  clearInputs();
  if (!silent && !paused) lockPointer();
}

/** Numeronäppäimet valitsevat vaihtoehdon. Esc käsitellään `input.ts`:ssä. */
export function initDialogue() {
  window.addEventListener("keydown", (e) => {
    if (!dialogueOpen || e.repeat) return;
    const match = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
    if (!match) return;
    e.preventDefault();
    choose(Number(match[1]) - 1);
  });
}
