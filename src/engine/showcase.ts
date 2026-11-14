import { Fighter, FighterLook, POSES } from "../fighter";
import { groundHeight } from "../world";
import { scene } from "./view";

// ---------- Hahmorivi (kehityskäyttöön) ----------
// Kaikki hahmot ja varustukset rivissä eri asennoissa kuvakaappauksia ja arviointia varten.
export const showcase: { fighter: Fighter; pose: keyof typeof POSES }[] = [];
export function setShowcase(on: boolean, allPose?: string) {
  for (const s of showcase) { scene.remove(s.fighter.root); s.fighter.dispose(); }
  showcase.length = 0;
  if (!on) return;
  const row: [FighterLook, keyof typeof POSES][] = [
    [{ character: "hero", loadout: "sword_shield" }, "guard"],
    [{ character: "urho", loadout: "sword" }, "guard"],
    [{ character: "urho", loadout: "sword_shield" }, "block"],
    [{ character: "urho", loadout: "spear" }, "windup"],
    [{ character: "pohja", loadout: "sword" }, "strike"],
    [{ character: "pohja", loadout: "sword_shield" }, "guard"],
    [{ character: "pohja", loadout: "spear" }, "guard"],
  ];
  row.forEach(([look, pose], i) => {
    const fighter = new Fighter(look);
    const x = (i - (row.length - 1) / 2) * 1.5;
    fighter.root.position.set(x, groundHeight(x, 1), 1);
    fighter.root.rotation.y = Math.PI;
    scene.add(fighter.root);
    showcase.push({ fighter, pose: allPose && allPose in POSES ? allPose : pose });
  });
}

export function updateShowcase(realDt: number) {
  for (const s of showcase) s.fighter.animate(POSES[s.pose], 8, realDt, 0);
}
