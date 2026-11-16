// Maailmanesineen otto yhtenä tilanmuutoksena: inventaario, varkausloki ja `item.taken`-
// tapahtuman säännöt syntyvät samassa tallennuksessa, joten ne eivät voi jäädä puoliksi.
import { tryTakeSceneItem, type CampaignState, type SceneItemDefinition, type TakeSceneItemResult } from "../map/campaign";
import { postEvent, type PostResult } from "./engine";
import type { WorldData } from "./types";

export interface TakeWithEventsResult {
  /** Uusi tila (sama olio kuin alkuperäinen, jos ottoa ei tapahtunut). */
  state: CampaignState;
  take: TakeSceneItemResult;
  /** Otosta seurannut tapahtuma ja sen säännöt; null, jos ottoa ei tapahtunut. */
  post: PostResult | null;
}

export function takeSceneItemWithEvents(
  state: CampaignState,
  item: SceneItemDefinition,
  sceneId: string,
  data: WorldData,
): TakeWithEventsResult {
  const take = tryTakeSceneItem(state, item);
  if (take.status !== "taken") return { state, take, post: null };
  const post = postEvent(take.state, {
    type: "item.taken",
    instanceId: item.instanceId,
    itemId: item.itemId,
    siteId: item.siteId,
    sceneId,
    takeMode: take.takeMode,
    ...(item.ownerId ? { ownerId: item.ownerId } : {}),
  }, data);
  return { state: post.state, take, post };
}
