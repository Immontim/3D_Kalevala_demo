import type { SceneId } from "../app/route";
import type { TextKey } from "../i18n";

/** Kartalta avatun rauhallisen kohtauksen oma aloitusruudun alaotsikko. */
export function friendlySceneSubtitleKey(scene: SceneId): TextKey {
  if (scene === "lakeside") return "lakeside.sub";
  if (scene === "lakeruin") return "lakeruin.sub";
  if (scene === "cairnfield") return "cairnfield.sub";
  if (scene === "smithy") return "smithy.sub";
  if (scene === "wilds") return "wilds.sub";
  return "yard.sub";
}
