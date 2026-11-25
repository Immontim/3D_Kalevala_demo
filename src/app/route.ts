/** Sovelluksen kevyet kartta- ja 3D-reitit. Tämä moduuli ei riipu 3D-moottorista. */

export const SCENE_IDS = ["clearing", "homestead", "yard", "smithy", "lakeside", "lakeruin", "cairnfield", "wilds"] as const;
export type SceneId = (typeof SCENE_IDS)[number];
export type SceneKind = "battle" | "friendly";

/** Reititystason kohtausluokitus on kevyt eikä vedä 3D-maailmaa karttareitille. */
export const SCENE_KINDS: Record<SceneId, SceneKind> = {
  clearing: "battle",
  homestead: "battle",
  yard: "friendly",
  smithy: "friendly",
  lakeside: "friendly",
  lakeruin: "friendly",
  cairnfield: "friendly",
  wilds: "friendly",
};

export function sceneKind(scene: SceneId): SceneKind {
  return SCENE_KINDS[scene];
}

export type AppRoute =
  | { mode: "map" }
  /** `site` on kartan paikkainstanssin tunniste (esim. "yard-b"); puuttuu, kun kohtaus avataan suoraan. */
  | { mode: "scene"; scene: SceneId; returnToMap: boolean; site: string | null };

const FALLBACK_BASE = "https://kalevala.invalid/";

function asUrl(value: URL | string): URL {
  return value instanceof URL ? new URL(value.href) : new URL(value, FALLBACK_BASE);
}

function isSceneId(value: string | null): value is SceneId {
  return value !== null && (SCENE_IDS as readonly string[]).includes(value);
}

const SITE_PATTERN = /^[a-z][a-z0-9-]{0,39}$/;

/** Tuntematon tai puuttuva scene-parametri vie turvallisesti kartalle. */
export function parseAppRoute(value: URL | string): AppRoute {
  const url = asUrl(value);
  const scene = url.searchParams.get("scene");
  if (!isSceneId(scene)) return { mode: "map" };
  const site = url.searchParams.get("site");
  return {
    mode: "scene",
    scene,
    returnToMap: url.searchParams.get("return") === "map",
    site: site !== null && SITE_PATTERN.test(site) ? site : null,
  };
}

/** Rakentaa 3D-kohtauksen URL:n muuttamatta annettua URL-oliota. */
export function sceneUrl(value: URL | string, scene: SceneId, returnToMap: boolean, site?: string | null): URL {
  const url = asUrl(value);
  url.searchParams.delete("scene");
  url.searchParams.delete("return");
  url.searchParams.delete("site");
  url.searchParams.set("scene", scene);
  if (returnToMap) url.searchParams.set("return", "map");
  if (site && SITE_PATTERN.test(site)) url.searchParams.set("site", site);
  return url;
}

/** Rakentaa kartan URL:n ja säilyttää polun, ankkurin sekä muut query-parametrit. */
export function mapUrl(value: URL | string): URL {
  const url = asUrl(value);
  url.searchParams.delete("scene");
  url.searchParams.delete("return");
  url.searchParams.delete("site");
  return url;
}
