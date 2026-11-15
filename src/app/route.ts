/** Sovelluksen kevyet kartta- ja 3D-reitit. Tämä moduuli ei riipu 3D-moottorista. */

export const SCENE_IDS = ["clearing", "homestead", "yard"] as const;
export type SceneId = (typeof SCENE_IDS)[number];

export type AppRoute =
  | { mode: "map" }
  | { mode: "scene"; scene: SceneId; returnToMap: boolean };

const FALLBACK_BASE = "https://kalevala.invalid/";

function asUrl(value: URL | string): URL {
  return value instanceof URL ? new URL(value.href) : new URL(value, FALLBACK_BASE);
}

function isSceneId(value: string | null): value is SceneId {
  return value !== null && (SCENE_IDS as readonly string[]).includes(value);
}

/** Tuntematon tai puuttuva scene-parametri vie turvallisesti kartalle. */
export function parseAppRoute(value: URL | string): AppRoute {
  const url = asUrl(value);
  const scene = url.searchParams.get("scene");
  if (!isSceneId(scene)) return { mode: "map" };
  return { mode: "scene", scene, returnToMap: url.searchParams.get("return") === "map" };
}

/** Rakentaa 3D-kohtauksen URL:n muuttamatta annettua URL-oliota. */
export function sceneUrl(value: URL | string, scene: SceneId, returnToMap: boolean): URL {
  const url = asUrl(value);
  url.searchParams.delete("scene");
  url.searchParams.delete("return");
  url.searchParams.set("scene", scene);
  if (returnToMap) url.searchParams.set("return", "map");
  return url;
}

/** Rakentaa kartan URL:n ja säilyttää polun, ankkurin sekä muut query-parametrit. */
export function mapUrl(value: URL | string): URL {
  const url = asUrl(value);
  url.searchParams.delete("scene");
  url.searchParams.delete("return");
  return url;
}
