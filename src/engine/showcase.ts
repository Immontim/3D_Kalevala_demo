import { Fighter, FighterLook, POSES } from "../fighter";
import { groundHeight } from "../world";
import { scene } from "./view";

// ---------- Hahmorivi (kehityskäyttöön) ----------
// Kaikki hahmot ja varustukset rivissä eri asennoissa kuvakaappauksia ja arviointia varten.
export const showcase: { fighter: Fighter; pose: keyof typeof POSES }[] = [];
/** Pohjan uudet vartalot (tanakka, hoikka), molemmat nutut, kirveet, kilpi ja keihäs. */
const POHJA_ROW: [FighterLook, keyof typeof POSES][] = [
  [{ character: "pohja", loadout: "sword", helmet: true, ringMail: true, greaves: true }, "guard"],
  [{ character: "pohja", build: "tanakka", tunic: "tumma", loadout: "sword", helmet: true, ringMail: true }, "guard"],
  [{ character: "pohja", build: "tanakka", tunic: "vaalea", loadout: "sword_shield", axe: "parta", helmet: true }, "guard"],
  [{ character: "pohja", build: "tanakka", tunic: "tumma", loadout: "spear", helmet: false }, "guard"],
  [{ character: "pohja", build: "hoikka", tunic: "vaalea", loadout: "sword", axe: "karjala", helmet: true, ringMail: true }, "strike"],
  [{ character: "pohja", build: "hoikka", tunic: "tumma", loadout: "sword_shield", helmet: true }, "block"],
  [{ character: "pohja", build: "hoikka", tunic: "vaalea", loadout: "spear", helmet: true, ringMail: true }, "windup"],
];

export function setShowcase(on: boolean, allPose?: string, set: "all" | "pohja" = "all") {
  for (const s of showcase) { scene.remove(s.fighter.root); s.fighter.dispose(); }
  showcase.length = 0;
  if (!on) return;
  const row: [FighterLook, keyof typeof POSES][] = set === "pohja" ? POHJA_ROW : [
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
