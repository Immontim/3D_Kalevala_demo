// Sovelluskuori: kartta on oletus, raskas 3D-moottori ladataan vain scene-reitillä.
import { parseAppRoute } from "./app/route";
import { translateDocument } from "./i18n";

translateDocument();

const route = parseAppRoute(location.href);
if (route.mode === "scene") {
  document.body.classList.add("mode-scene");
  await import("./scene3d").then((module) => module.initScene3d(route));
} else {
  document.body.classList.add("mode-map");
  await import("./map/app").then((module) => module.initMap());
}
