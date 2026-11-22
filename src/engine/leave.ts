// Kohtauksesta lähtö: sankari poistuu polunsuusta tai valikosta kartalle. Ennen sivun vaihtoa
// moottorille kerrotaan jokainen kohtaukseen jäävä puhuteltava hahmo (`npc.leftBehind`), jotta
// säännöt voivat reagoida (esim. parantamaton jousineito kuolee poissa ollessa).
import { TALKABLES } from "../interact";
import { ARENA } from "../world";
import { worldRuntime } from "./store";

export function postLeftBehind() {
  for (const npc of [...TALKABLES]) worldRuntime().post({ type: "npc.leftBehind", npcId: npc.id, sceneId: ARENA });
}
