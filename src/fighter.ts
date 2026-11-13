import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import charactersUrl from "../assets/characters.glb?url";
import type { Loadout } from "./combat";

// Blenderissä mallinnettu luurankohahmo, jota ohjataan koodilla: asennot (Pose) ovat
// nivelkulmia, joita kohti hahmo pehmeästi liukuu. Valmiita animaatioleikkeitä ei ole.

export interface Pose {
  spineYaw: number;
  spinePitch: number;
  rShX: number;
  rShZ: number;
  rEl: number;
  rHandX: number;
  rHandY: number;
  lShX: number;
  lShZ: number;
  lEl: number;
  crouch: number;
  headPitch: number;
  /** Haara-asento: vasen jalka eteen, oikea taakse (rad). Negatiivinen = oikea jalka edessä. */
  stride: number;
}

const KEYS = Object.keys({
  spineYaw: 0, spinePitch: 0, rShX: 0, rShZ: 0, rEl: 0, rHandX: 0, rHandY: 0,
  lShX: 0, lShZ: 0, lEl: 0, crouch: 0, headPitch: 0, stride: 0,
} satisfies Pose) as (keyof Pose)[];

/** Jalan asento kaatuneena: reiden kierto eteen (x), ulkokierto (y) ja loitonnus (z) sekä polven koukistus. */
export interface FallenLeg { x: number; y: number; z: number; knee: number; }

/**
 * Kaatuneen asento. Hahmo makaa selällään tai vatsallaan, ja raajat lepäävät maan tasossa.
 * Kädet ja selkä ovat tavallisia asentokenttiä; lisäksi tulevat jalat, selän sivutaivutus ja
 * pään kääntö, joita taisteluasennot eivät tarvitse.
 */
export interface FallenPose {
  name: string;
  /** true = vatsallaan (kaatuu eteenpäin), false = selällään. */
  prone: boolean;
  /** Vartalon keskilinjan korkeus maasta makuulla (m). */
  lift: number;
  /** Vartalon kierto pystyakselin ympäri kaatuessa (rad), jotta kaikki eivät kaadu samaan suuntaan. */
  bodyYaw: number;
  pose: Pose;
  /** Selän sivutaivutus (rad). */
  spineRoll: number;
  /** Pään kääntö sivulle (rad). */
  headYaw: number;
  legL: FallenLeg;
  legR: FallenLeg;
}

// Käsien loitonnus: oikea käsi negatiivinen, vasen positiivinen. Noin 1,57 = suoraan sivulle,
// yli sen = pään yläpuolelle. shX > 0 vie kättä selän puolelle eli selällään maata kohti.
export const FALLEN: FallenPose[] = [
  {
    name: "selällään, polvi koholla", prone: false, lift: 0.13, bodyYaw: 0.25,
    pose: {
      spineYaw: 0.1, spinePitch: -0.06, rShX: 0.1, rShZ: -1.0, rEl: -0.2, rHandX: 0, rHandY: 0,
      lShX: 0.08, lShZ: 2.2, lEl: -0.25, crouch: 0, headPitch: -0.1, stride: 0,
    },
    spineRoll: 0.1, headYaw: 0.7,
    legL: { x: 0.02, y: 0.35, z: 0.3, knee: 0.08 },
    legR: { x: -0.5, y: -0.1, z: -0.12, knee: 1.0 },
  },
  {
    name: "selällään, suorana", prone: false, lift: 0.13, bodyYaw: -0.3,
    pose: {
      spineYaw: -0.08, spinePitch: -0.04, rShX: 0.12, rShZ: -0.5, rEl: -0.15, rHandX: 0, rHandY: 0,
      lShX: 0.12, lShZ: 0.75, lEl: -0.2, crouch: 0, headPitch: -0.15, stride: 0,
    },
    spineRoll: -0.2, headYaw: -0.8,
    legL: { x: 0.0, y: 0.2, z: 0.16, knee: 0.05 },
    legR: { x: 0.02, y: -0.5, z: -0.34, knee: 0.1 },
  },
  {
    name: "selällään, käsi pään yllä", prone: false, lift: 0.13, bodyYaw: 0.1,
    pose: {
      spineYaw: 0.12, spinePitch: -0.05, rShX: 0.08, rShZ: -2.4, rEl: -0.3, rHandX: 0, rHandY: 0,
      lShX: 0.1, lShZ: 0.9, lEl: -0.15, crouch: 0, headPitch: -0.12, stride: 0,
    },
    spineRoll: 0.18, headYaw: -0.5,
    legL: { x: -0.4, y: 0.15, z: 0.2, knee: 0.8 },
    legR: { x: 0.02, y: -0.3, z: -0.22, knee: 0.06 },
  },
  {
    name: "vatsallaan", prone: true, lift: 0.14, bodyYaw: -0.2,
    pose: {
      spineYaw: 0.1, spinePitch: 0.04, rShX: -0.1, rShZ: -2.1, rEl: -0.2, rHandX: 0, rHandY: 0,
      lShX: -0.1, lShZ: 0.7, lEl: -0.15, crouch: 0, headPitch: 0.05, stride: 0,
    },
    spineRoll: 0.12, headYaw: 1.1,
    legL: { x: -0.02, y: 0.3, z: 0.14, knee: 0.05 },
    legR: { x: -0.02, y: -0.2, z: -0.3, knee: 0.25 },
  },
];

export const POSES: Record<string, Pose> = {
  guard: {
    spineYaw: -0.15, spinePitch: 0.08, rShX: -0.55, rShZ: -0.15, rEl: -1.15, rHandX: 0.95, rHandY: 0,
    lShX: -0.5, lShZ: 0.25, lEl: -1.3, crouch: 0.06, headPitch: 0, stride: 0.22,
  },
  windup: {
    spineYaw: -0.75, spinePitch: -0.05, rShX: -2.7, rShZ: -0.55, rEl: -1.0, rHandX: -0.3, rHandY: 0,
    lShX: -0.9, lShZ: 0.4, lEl: -0.6, crouch: 0.12, headPitch: 0, stride: 0.1,
  },
  strike: {
    spineYaw: 0.7, spinePitch: 0.35, rShX: -0.9, rShZ: 0.55, rEl: -0.15, rHandX: 0.35, rHandY: 0,
    lShX: -0.2, lShZ: 0.6, lEl: -0.4, crouch: 0.18, headPitch: 0.1, stride: 0.42,
  },
  block: {
    spineYaw: 0.05, spinePitch: 0.02, rShX: -1.5, rShZ: -0.35, rEl: -1.25, rHandX: 0.2, rHandY: 1.55,
    lShX: -1.4, lShZ: 0.5, lEl: -1.4, crouch: 0.1, headPitch: 0.05, stride: 0.2,
  },
  stagger: {
    spineYaw: -0.4, spinePitch: -0.45, rShX: -0.6, rShZ: -0.9, rEl: -0.3, rHandX: 0.5, rHandY: 0,
    lShX: -0.5, lShZ: 0.9, lEl: -0.3, crouch: 0.15, headPitch: -0.4, stride: -0.12,
  },
  rooted: {
    spineYaw: 0.2, spinePitch: 0.2, rShX: -2.4, rShZ: -0.8, rEl: -0.5, rHandX: 0.4, rHandY: 0,
    lShX: -2.5, lShZ: 0.8, lEl: -0.5, crouch: 0, headPitch: -0.3, stride: 0,
  },
  // Raskas isku: miekka pään yli ja alas.
  heavyWindup: {
    spineYaw: -0.25, spinePitch: -0.22, rShX: -2.95, rShZ: -0.2, rEl: -1.35, rHandX: -0.55, rHandY: 0,
    lShX: -0.9, lShZ: 0.35, lEl: -0.8, crouch: 0.08, headPitch: -0.1, stride: 0.12,
  },
  heavyStrike: {
    spineYaw: 0.35, spinePitch: 0.55, rShX: -0.8, rShZ: 0.2, rEl: -0.1, rHandX: 0.55, rHandY: 0,
    lShX: -0.1, lShZ: 0.55, lEl: -0.5, crouch: 0.26, headPitch: 0.15, stride: 0.5,
  },
  // Kilpityöntö: kilpi vedetään rintaa vasten ja työnnetään eteen.
  bashWindup: {
    spineYaw: 0.4, spinePitch: 0.1, rShX: -0.3, rShZ: -0.35, rEl: -1.1, rHandX: 0.9, rHandY: 0,
    lShX: -0.3, lShZ: 0.35, lEl: -1.7, crouch: 0.16, headPitch: 0, stride: 0.15,
  },
  bashStrike: {
    spineYaw: -0.55, spinePitch: 0.3, rShX: 0.1, rShZ: -0.45, rEl: -0.9, rHandX: 0.9, rHandY: 0,
    lShX: -1.35, lShZ: 0.1, lEl: -0.3, crouch: 0.2, headPitch: 0.05, stride: 0.5,
  },
  // Sivallus: miekka viedään oikealle sivulle ja vedetään vaakaan vartalon poikki.
  slashWindup: {
    spineYaw: -0.85, spinePitch: 0.05, rShX: 0, rShZ: -1.3, rEl: -0.3, rHandX: 2.2, rHandY: 0,
    lShX: -0.8, lShZ: 0.3, lEl: -0.9, crouch: 0.12, headPitch: 0, stride: 0.12,
  },
  slashStrike: {
    spineYaw: 0.85, spinePitch: 0.2, rShX: -1.25, rShZ: 0.75, rEl: -0.25, rHandX: 1.3, rHandY: 0.5,
    lShX: -0.3, lShZ: 0.6, lEl: -0.5, crouch: 0.16, headPitch: 0.05, stride: 0.4,
  },
  // Pisto: kahva vedetään kylkeen terä edellä ja työnnetään suoraan eteen.
  thrustWindup: {
    spineYaw: -0.7, spinePitch: 0.1, rShX: 0.55, rShZ: -0.25, rEl: -2.0, rHandX: 1.45, rHandY: 0,
    lShX: -1.0, lShZ: 0.2, lEl: -0.6, crouch: 0.14, headPitch: 0, stride: 0.15,
  },
  thrustStrike: {
    spineYaw: 0.55, spinePitch: 0.3, rShX: -1.35, rShZ: 0.1, rEl: -0.1, rHandX: 1.45, rHandY: 0,
    lShX: 0.2, lShZ: 0.5, lEl: -0.6, crouch: 0.22, headPitch: 0.05, stride: 0.55,
  },
  // Torjunnat aseella: block = ylätorjunta (terä vaakasuoraan pään yllä),
  // blockSide = sivutorjunta (terä pystyssä kyljellä), blockThrust = piston ohjaus sivuun (terä alaviistoon).
  blockSide: {
    spineYaw: -0.25, spinePitch: 0.02, rShX: -0.9, rShZ: -0.55, rEl: -1.2, rHandX: 0.5, rHandY: 0.3,
    lShX: -0.6, lShZ: 0.3, lEl: -1.2, crouch: 0.1, headPitch: 0, stride: 0.2,
  },
  blockThrust: {
    spineYaw: 0.25, spinePitch: 0.05, rShX: -1.1, rShZ: 0.2, rEl: -0.9, rHandX: 2.7, rHandY: 0.5,
    lShX: -0.5, lShZ: 0.4, lEl: -1.0, crouch: 0.12, headPitch: 0.05, stride: 0.2,
  },
  // Laulu: kädet levitettyinä sivuille, miekka käden jatkeena, kilpi sivulla, pää hieman takakenossa.
  sing: {
    spineYaw: 0, spinePitch: -0.12, rShX: 0, rShZ: -1.12, rEl: -0.2, rHandX: 1.57, rHandY: 0,
    lShX: 0, lShZ: 1.12, lEl: -0.2, crouch: 0.02, headPitch: -0.32, stride: 0.05,
  },
};

export type CharacterId = "hero" | "urho" | "pohja";
export type { Loadout };

export interface FighterLook {
  character: CharacterId;
  loadout: Loadout;
}

// ---------- Blender-hahmot (assets/characters.glb) ----------
// Tiedostossa on yksi luuranko (RIG, 17 luuta), kolme hahmoa (char_hero, char_urho,
// char_pohja) ja varusteet (sword, spear, shield_*). Jokainen taistelija saa oman
// kloonin, josta jätetään näkyviin vain oma hahmo ja varusteet.
const BONE_NAMES = [
  "hips", "spine", "chest", "neck", "head",
  "upper_arm_L", "forearm_L", "hand_L", "upper_arm_R", "forearm_R", "hand_R",
  "thigh_L", "shin_L", "foot_L", "thigh_R", "shin_R", "foot_R",
] as const;
type BoneName = (typeof BONE_NAMES)[number];
const ARM_BONES = new Set<BoneName>(["upper_arm_L", "forearm_L", "hand_L", "upper_arm_R", "forearm_R", "hand_R"]);

const characterAssets = new GLTFLoader().loadAsync(charactersUrl);
/** Valmistuu, kun hahmomallit on ladattu. */
export const charactersReady: Promise<void> = characterAssets.then(() => undefined);
charactersReady.catch((e) => console.error("Hahmomallien lataus epäonnistui", e));

let envMap: THREE.Texture | null = null;
const envTargets = new Set<THREE.MeshStandardMaterial>();
/** Ympäristökartta metallipinnoille (kypärä, rengaspanssari, terä); ilman sitä metalli näkyy mustana. */
export function setCharacterEnv(tex: THREE.Texture) {
  envMap = tex;
  for (const m of envTargets) { m.envMap = tex; m.needsUpdate = true; }
}

const DOWN = new THREE.Vector3(0, -1, 0);

/**
 * Kävelyn ja paikallaan seisomisen elävyys. Nämä ovat ulkonäköä, eivät pelisääntöjä:
 * hahmon nopeus tulee pelistä, ja askelpituus ja tahti sovitetaan siihen niin, että
 * maassa oleva jalka pysyy paikallaan (ei liu'u).
 */
export const GAIT = {
  /** Askelsyklin pituus (m) = stepBase + stepPerSpeed · nopeus, enintään stepMax. */
  stepBase: 0.36, stepPerSpeed: 0.2, stepMax: 0.68,
  /** Sivuaskel on lyhyempi kuin askel eteen. */
  sideStep: 0.75,
  /** Osuus syklistä, jonka jalka on maassa: kävellessä yli puolet, juostessa (runSpeed) alle. */
  duty: 0.58, dutyRun: 0.4, walkSpeed: 1.6, runSpeed: 3.4,
  /** Jalan nosto heilahduksessa (m): perusosa ja nopeuden mukaan kasvava osa. */
  liftBase: 0.05, liftPerSpeed: 0.022,
  /** Nopeus, jolla askellus alkaa ja jolla se on täydessä laajuudessa (m/s). */
  startSpeed: 0.2, fullSpeed: 0.9,
  /** Kävellessä: lantion kierto, kallistus ja sivusiirtymä (rad, rad, m) sekä hartioiden vastaliike. */
  hipYaw: 0.11, hipRoll: 0.05, hipShift: 0.022, counter: 0.7, lean: 0.07,
  /** Paikallaan: painon siirto jalalta toiselle, lantion kallistus ja kierto, hengitys. */
  idleShift: 0.03, idleRoll: 0.045, idleYaw: 0.04, breath: 0.016,
};
/** Vianetsintä: elossa olevat keihäshahmot (selaimessa `await import("/src/fighter.ts")`). */
export const debugSpearFighters = new Set<Fighter>();
const qA = new THREE.Quaternion(), qB = new THREE.Quaternion(), qC = new THREE.Quaternion();
const eul = new THREE.Euler();
const vTmp = new THREE.Vector3();
const IDENT = new THREE.Quaternion();

interface BoneInfo {
  bone: THREE.Bone;
  parent: BoneName | null;
  /** Luun asento hahmon koordinaatistossa, kun virtuaalinen ranka on nolla-asennossa (kädet suorina alas). */
  canon: THREE.Quaternion;
  world: THREE.Quaternion;
}

export class Fighter {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group(); // kaatuu kuollessa
  readonly bladeTip = new THREE.Object3D();
  readonly bladeBase = new THREE.Object3D();
  private weapon = new THREE.Group();
  private rig: THREE.Object3D | null = null;
  private bones = new Map<BoneName, BoneInfo>();
  private hipsRest = new THREE.Vector3();
  private footRestY = 0;
  private bladeMats: THREE.MeshStandardMaterial[] = [];
  private helmet: THREE.Object3D | null = null;
  private shieldHolder: THREE.Group | null = null;
  /** Kilven asento kyynärvarteen nähden torjunnassa (pinta kyynärvarren suuntaan). */
  private shieldFront = new THREE.Quaternion();
  /** 0 = kilpi edessä torjumassa, 1 = kilpi roikkuu kahvastaan kyljellä pinta ulospäin. */
  private shieldHang = 1;
  private shieldModel: THREE.Object3D | null = null;
  private shieldUniforms: ShieldUniforms[] = [];
  private shieldMats: THREE.MeshStandardMaterial[] = [];
  private shieldBasis = { center: new THREE.Vector3(), u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 1, 0), radius: 0.4 };
  private shieldNotched = false;
  private armLen: [number, number] = [0.28, 0.26];
  /** Onko kilpi kädessä. Hajonnut kilpi poistuu, ja hahmo taistelee kuin ilman kilpeä. */
  hasShield: boolean;
  private pose: Pose = { ...POSES.guard };
  /** Keihään otekanava kummankin käden virtuaalikehyksessä: keskipiste ranteesta ja suunta. */
  private gripV = { R: { c: new THREE.Vector3(), d: new THREE.Vector3(0, 0, 1) }, L: { c: new THREE.Vector3(), d: new THREE.Vector3(0, 0, 1) } };
  /** Keihään nykyinen ote (liukuu kohti asennon otetta) ja kuinka paljon oikea käsi seuraa sitä. */
  private hold = spearHold(SPEAR_HOLD.get(POSES.guard)!);
  private spearW = 1;
  /** Käden edellinen kierto varren ympäri (holdShaft), jotta ratkaisu pysyy jatkuvana. */
  private roll: { L: number | null; R: number | null } = { L: null, R: null };
  private walkPhase = Math.random();
  /** Reiden ja säären pituus sekä vasemman lonkan puoli (+1 tai -1) hahmon x-akselilla. */
  private legLen: [number, number] = [0.42, 0.42];
  private leftX = 1;
  /** Hahmon oma nopeus sen omassa koordinaatistossa (x sivulle, y eteen), tasoitettuna. */
  private vel = new THREE.Vector2();
  private stepDir = new THREE.Vector2(0, 1);
  private stepLen = GAIT.stepBase;
  private duty = GAIT.duty;
  private lastPos: THREE.Vector3 | null = null;
  /** Oma kello ja vaihe, jotta kaksi hahmoa ei huoju samassa tahdissa. */
  private idleT = Math.random() * 100;
  private disposed = false;
  sink = 0; // suohon vajoaminen metreinä
  fall = 0; // 0..1 kaatuminen
  /** Asento, johon hahmo kaatuu. Valitaan kuolinhetkellä (setFallen). */
  fallen: FallenPose = FALLEN[0];

  constructor(readonly look: FighterLook) {
    this.hasShield = look.loadout === "sword_shield";
    this.root.add(this.body);
    // Kaatuessa vartalo ensin kallistuu ja kääntyy vasta sitten pystyakselin ympäri.
    this.body.rotation.order = "YXZ";
    // Terän pisteet ovat olemassa heti, vaikka malli latautuu vasta hetken päästä.
    this.weapon.position.set(-0.3, 1.0, 0.2);
    this.body.add(this.weapon);
    const spear = look.loadout === "spear";
    this.bladeBase.position.z = spear ? 1.22 + SPEAR_SLIDE : 0.12;
    this.bladeTip.position.z = spear ? 1.52 + SPEAR_SLIDE : 0.8;
    this.weapon.add(this.bladeBase, this.bladeTip);
    characterAssets.then((gltf) => { if (!this.disposed) this.build(gltf.scene); });
    if (spear) debugSpearFighters.add(this);
  }

  /** Vapauttaa taistelijan omat materiaalikopiot ja luurangon tekstuurin. Kutsutaan, kun hahmo poistetaan. */
  dispose() {
    this.disposed = true;
    debugSpearFighters.delete(this);
    for (const m of [...this.bladeMats, ...this.shieldMats]) { envTargets.delete(m); m.dispose(); }
    this.bladeMats = [];
    this.shieldMats = [];
    this.body.traverse((o) => {
      const sk = o as THREE.SkinnedMesh;
      if (sk.isSkinnedMesh) sk.skeleton.dispose();
    });
  }

  private build(source: THREE.Object3D) {
    const clone = SkeletonUtils.clone(source);
    const rig = clone.getObjectByName("RIG") ?? clone;
    const keep = new Set<string>([`char_${this.look.character}`]);
    const equip: Record<string, THREE.Object3D> = {};
    for (const child of [...clone.children, ...rig.children]) {
      const n = child.name;
      if (n.startsWith("char_") && !keep.has(n)) child.removeFromParent();
      if (/^(sword|spear|shield_)/.test(n)) { equip[n] = child; child.removeFromParent(); }
      if (n.startsWith("helmet_") && n !== `helmet_${this.look.character}`) child.removeFromParent();
    }
    clone.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat.metalness > 0.5) { envTargets.add(mat); mat.envMapIntensity = 0.45; if (envMap) mat.envMap = envMap; }
    });
    this.body.add(clone);
    this.rig = rig;
    clone.updateMatrixWorld(true);

    // Lepoasennot hahmon omassa koordinaatistossa (klooni on vielä origossa).
    const inv = qC.copy(this.body.getWorldQuaternion(new THREE.Quaternion())).invert();
    for (const name of BONE_NAMES) {
      const bone = rig.getObjectByName(name) as THREE.Bone;
      const rest = bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(inv);
      const canon = rest.clone();
      if (ARM_BONES.has(name)) {
        // A-asennosta kädet suoriksi alas: sama nolla-asento kuin vanhassa primitiivihahmossa.
        const dir = vTmp.set(0, 1, 0).applyQuaternion(rest).clone();
        canon.premultiply(new THREE.Quaternion().setFromUnitVectors(dir, DOWN));
      }
      const p = bone.parent && (BONE_NAMES as readonly string[]).includes(bone.parent.name) ? (bone.parent.name as BoneName) : null;
      this.bones.set(name, { bone, parent: p, canon, world: new THREE.Quaternion() });
    }
    const hips = this.bones.get("hips")!.bone;
    this.hipsRest.copy(hips.position);
    const pUp = this.bones.get("upper_arm_L")!.bone.getWorldPosition(new THREE.Vector3());
    const pFo = this.bones.get("forearm_L")!.bone.getWorldPosition(new THREE.Vector3());
    const pHa = this.bones.get("hand_L")!.bone.getWorldPosition(new THREE.Vector3());
    this.armLen = [pUp.distanceTo(pFo), pFo.distanceTo(pHa)];
    this.footRestY = Math.min(this.boneY("foot_L"), this.boneY("foot_R"));
    const pTh = this.bones.get("thigh_L")!.bone.getWorldPosition(new THREE.Vector3());
    const pSh = this.bones.get("shin_L")!.bone.getWorldPosition(new THREE.Vector3());
    const pFt = this.bones.get("foot_L")!.bone.getWorldPosition(new THREE.Vector3());
    this.legLen = [pTh.distanceTo(pSh), pSh.distanceTo(pFt)];
    this.leftX = this.body.worldToLocal(pTh.clone()).x >= 0 ? 1 : -1;

    // Ase oikeaan käteen: pidikkeen asento = virtuaalinen käsikehys (terä +z).
    const hand = this.bones.get("hand_R")!;
    this.weapon.removeFromParent();
    hand.bone.add(this.weapon);
    const cInv = hand.canon.clone().invert();
    this.weapon.quaternion.copy(cInv).multiply(qA.setFromEuler(eul.set(0, HAND_TWIST, 0)));
    this.weapon.position.copy(vTmp.set(GRIP.x, GRIP.y, GRIP.z).applyQuaternion(cInv));
    if (this.look.loadout === "spear") this.prepareSpearGrip(clone);
    const weaponModel = equip[this.look.loadout === "spear" ? "spear" : "sword"];
    if (weaponModel) {
      weaponModel.position.set(0, 0, this.look.loadout === "spear" ? SPEAR_SLIDE : 0);
      weaponModel.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat.metalness > 0.5) {
          // Oma kopio, jotta vihollisen terän hehku ei sytytä muiden teriä.
          const own = mat.clone();
          if (envMap) own.envMap = envMap;
          envTargets.add(own);
          m.material = own;
          this.bladeMats.push(own);
        }
      });
      this.weapon.add(weaponModel);
    }
    if (this.look.loadout === "sword_shield") {
      const shield = equip[`shield_${this.look.character}`];
      const arm = this.bones.get("forearm_L")!;
      if (shield) {
        const aInv = arm.canon.clone().invert();
        const holder = new THREE.Group();
        // Keskikahvakilpi: pinta osoittaa kyynärvarren suuntaan (rystyset edellä), joten
        // koukistetulla kädellä kilpi on pystyssä vartalon edessä.
        holder.quaternion.copy(aInv).multiply(qA.setFromEuler(eul.set(Math.PI / 2, 0, 0)));
        this.shieldFront.copy(holder.quaternion);
        holder.position.copy(vTmp.set(0.0, -0.36, 0.0).applyQuaternion(aInv));
        shield.position.set(0, 0, 0);
        holder.add(shield);
        arm.bone.add(holder);
        this.shieldHolder = holder;
        this.shieldModel = shield;
        this.prepareShield(shield);
        holder.visible = this.hasShield;
        this.setShieldNotch(this.shieldNotched);
      }
    }
    // Kypärä on oma kappaleensa: se kiinnitetään pääluuhun lepoasennossa, jolloin se istuu
    // kuten Blenderissä ja voidaan myöhemmin irrottaa lentämään.
    const helmet = clone.getObjectByName(`helmet_${this.look.character}`);
    if (helmet) {
      this.root.updateMatrixWorld(true);
      this.bones.get("head")!.bone.attach(helmet);
      this.helmet = helmet;
    }
    this.apply();
  }

  get hasHelmet() { return this.helmet !== null; }

  /** Kypärä lentää päästä suuntaan dir (maailmankoordinaateissa). Pelkkä tehoste. */
/**
   * Kaatuva pudottaa aseensa ja ehjän kilpensä: ne irtoavat käsistä ja jäävät maahan lappeelleen.
   * Ase lähtee hahmon oikealle ja kilpi vasemmalle, jotta kaatuva vartalo ei jää niiden päälle.
   */
  dropGear(): DroppedProp[] {
    if (!this.rig) return [];
    this.root.updateWorldMatrix(true, true);
    const out: DroppedProp[] = [];
    const yaw = this.root.rotation.y;
    const left = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const toSide = (sign: number) => left.clone().multiplyScalar(sign).addScaledVector(fwd, Math.random() * 0.6 - 0.2);
    if (this.weapon.parent && this.weapon.parent !== this.body) {
      // Aseen pituusakseli on sen oma z: maassa se on vaakasuorassa.
      out.push(new DroppedProp(this.weapon, toSide(-1), { long: new THREE.Vector3(0, 0, 1), rest: 0.03 }));
    }
    if (this.shieldHolder && this.shieldHolder.visible && this.shieldModel && this.shieldBasis) {
      // Kilven pinnan normaali pidikkeen koordinaateissa.
      const normal = new THREE.Vector3().crossVectors(this.shieldBasis.u, this.shieldBasis.v).normalize().applyQuaternion(this.shieldModel.quaternion);
      out.push(new DroppedProp(this.shieldHolder, toSide(1), { normal, rest: 0.06 }));
      this.shieldHolder = null;
    }
    return out;
  }

  knockHelmet(dir: THREE.Vector3): FlyingProp | null {
    const h = this.helmet;
    if (!h) return null;
    this.helmet = null;
    this.root.updateMatrixWorld(true);
    return new FlyingProp(h, dir);
  }

  /** Kilven materiaalit omiksi kopioiksi, joihin voi leikata loven ja joista saa sirpaleet. */
  private prepareShield(shield: THREE.Object3D) {
    const box = new THREE.Box3();
    shield.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.computeBoundingBox();
      box.union(m.geometry.boundingBox!);
    });
    const size = box.getSize(new THREE.Vector3());
    const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
    const dims = [size.x, size.y, size.z];
    const thin = dims.indexOf(Math.min(...dims));
    const [u, v] = axes.filter((_, i) => i !== thin);
    box.getCenter(this.shieldBasis.center);
    this.shieldBasis.u.copy(u);
    this.shieldBasis.v.copy(v);
    this.shieldBasis.radius = Math.max(...dims) / 2;
    this.shieldUniforms = patchShield(shield, this.shieldBasis);
    shield.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) this.shieldMats.push(m.material as THREE.MeshStandardMaterial);
    });
  }

  /** Lovi näkyviin, kun kilven kestosta on jäljellä enää puolet. */
  setShieldNotch(on: boolean) {
    this.shieldNotched = on;
    for (const u of this.shieldUniforms) u.uNotch.value = on ? 1 : 0;
  }

  /** Kilpi hajoaa: se poistuu kädestä ja palaset lentävät maahan. Palauttaa sirpaleet päivitettäviksi. */
  breakShield(): ShieldDebris | null {
    if (!this.hasShield) return null;
    this.hasShield = false;
    if (!this.shieldHolder || !this.shieldModel) return null;
    this.shieldHolder.updateWorldMatrix(true, true);
    const debris = new ShieldDebris(this.shieldModel, this.shieldBasis);
    this.shieldHolder.visible = false;
    return debris;
  }

  /** Uusi ehjä kilpi käteen. */
  restoreShield() {
    if (this.look.loadout !== "sword_shield") return;
    this.hasShield = true;
    this.setShieldNotch(false);
    if (this.shieldHolder) this.shieldHolder.visible = true;
  }

  /**
   * Keihään ote: varsi kulkee nyrkin otekanavan (GRIP_CHANNEL) läpi. Kanava muunnetaan
   * kummankin käden virtuaalikehykseen, ja keihään tyviote asetetaan oikean käden kanavaan.
   */
  private prepareSpearGrip(clone: THREE.Object3D) {
    const bodyInv = new THREE.Quaternion().copy(this.body.getWorldQuaternion(new THREE.Quaternion())).invert();
    for (const side of ["R", "L"] as const) {
      const s = side === "R" ? 1 : -1;
      const b = this.bones.get(`hand_${side}`)!;
      const pW = clone.localToWorld(GRIP_CHANNEL.p.clone().setX(GRIP_CHANNEL.p.x * s));
      const dW = GRIP_CHANNEL.d.clone().setX(GRIP_CHANNEL.d.x * s).transformDirection(clone.matrixWorld);
      const rest = b.bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(bodyInv);
      const wrist = this.body.worldToLocal(b.bone.getWorldPosition(new THREE.Vector3()));
      const pB = this.body.worldToLocal(pW.clone());
      const dB = dW.clone().applyQuaternion(bodyInv);
      // Virtuaalikehykseen: luun asento = v * canon, joten kanava = canon * rest⁻¹ * (lepoasennon kanava).
      const toV = b.canon.clone().multiply(rest.clone().invert());
      this.gripV[side].c.copy(pB.sub(wrist).applyQuaternion(toV));
      this.gripV[side].d.copy(dB.applyQuaternion(toV)).normalize();
      if (side === "R") {
        // Keihään origo (takaote) kanavan keskelle, varsi kanavan suuntaan (kärki peukalon puolelle).
        const pLoc = b.bone.worldToLocal(pW.clone());
        const dLoc = dW.clone().applyQuaternion(b.bone.getWorldQuaternion(new THREE.Quaternion()).invert()).normalize();
        this.weapon.position.copy(pLoc);
        this.weapon.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dLoc);
      }
    }
  }

  /** Kahden luun käänteiskinematiikka: kyynärpää tasossa, jonka napa määrää; palauttaa olkavarren ja kyynärvarren kehykset. */
  private twoBone(S: THREE.Vector3, W: THREE.Vector3, pole: THREE.Vector3, v1: THREE.Quaternion, v2: THREE.Quaternion) {
    const [l1, l2] = this.armLen;
    const to = W.clone().sub(S);
    const d = Math.min(Math.max(to.length(), 0.05), l1 + l2 - 0.005);
    to.normalize();
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const pp = pole.clone().addScaledVector(to, -pole.dot(to)).normalize();
    const elbow = to.clone().multiplyScalar(a).addScaledVector(pp, h);
    const d1 = elbow.clone().normalize();
    const d2 = to.multiplyScalar(d).sub(elbow).normalize();
    // Kyynärnivel on sarana: olkavarren x-akseli = saranan akseli, jolloin kyynärvarsi
    // kääntyy x:n ympäri kuten suoraan ohjatussa asennossa (el < 0 taivuttaa).
    const X = new THREE.Vector3().crossVectors(d2, d1);
    if (X.lengthSq() < 1e-8) X.crossVectors(pp, d1);
    X.normalize();
    const Y = d1.clone().negate();
    const Z = new THREE.Vector3().crossVectors(X, Y);
    v1.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
    const th = Math.acos(THREE.MathUtils.clamp(d1.dot(d2), -1, 1));
    v2.copy(v1).multiply(qA.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -th));
  }

  /**
   * Käsi varrelle: kämmenen otekanavan keskipiste pisteeseen G ja kanava varren suuntaan dir.
   * Kierto varren ympäri valitaan niin, että ranne kääntyy kyynärvarteen nähden mahdollisimman vähän.
   */
  private holdShaft(side: "L" | "R", G: THREE.Vector3, dir: THREE.Vector3, pole: THREE.Vector3) {
    const S = this.body.worldToLocal(this.bones.get(`upper_arm_${side}`)!.bone.getWorldPosition(new THREE.Vector3()));
    const g = this.gripV[side];
    const q0 = new THREE.Quaternion().setFromUnitVectors(g.d, dir);
    const v = new THREE.Quaternion(), v1 = new THREE.Quaternion(), v2 = new THREE.Quaternion();
    const W = new THREE.Vector3(), rel = new THREE.Quaternion(), axis = new THREE.Vector3();
    // Hinta kierrolle phi: ranteen taivutus + puolet kämmenen kierrosta kyynärvarteen nähden.
    const cost = (phi: number) => {
      v.setFromAxisAngle(dir, phi).multiply(q0);
      W.copy(G).sub(axis.copy(g.c).applyQuaternion(v));
      this.twoBone(S, W, pole, v1, v2);
      rel.copy(v2).invert().multiply(v);
      const bend = DOWN.angleTo(axis.copy(DOWN).applyQuaternion(rel));
      const twist = 2 * Math.acos(Math.min(1, Math.abs(rel.w) / (Math.hypot(rel.y, rel.w) || 1)));
      return bend + 0.5 * twist;
    };
    // Kierto haetaan edellisen ruudun kierron läheltä, jotta käsi ei hyppää ratkaisusta toiseen.
    // Koko kierros tarkistetaan myös, ja siihen vaihdetaan vain selvästi parempaan (yli 25°).
    const local = (from: number, span: number) => {
      let best = from, bestC = cost(from);
      for (let step = span; step > 0.005; step /= 2) {
        for (const phi of [best - step, best + step]) {
          const c = cost(phi);
          if (c < bestC) { bestC = c; best = phi; }
        }
      }
      return [best, bestC] as const;
    };
    let gBest = 0, gC = Infinity;
    for (let i = 0; i < 24; i++) {
      const phi = (i / 24) * Math.PI * 2, c = cost(phi);
      if (c < gC) { gC = c; gBest = phi; }
    }
    const prev = this.roll[side];
    let [best, bestC] = local(gBest, Math.PI / 24);
    if (prev !== null) {
      const [lb, lc] = local(prev, Math.PI / 8);
      if (lc < bestC + 0.45) [best, bestC] = [lb, lc];
    }
    this.roll[side] = best;
    cost(best);
    // Kämmenen kierto (pronaatio) tapahtuu kyynärvarressa, ei ranteessa: siirretään suurin osa
    // käden kierrosta kyynärvarren oman akselin ympäri. Hihan alla kierto ei näy ranteen saumana.
    rel.copy(v2).invert().multiply(v);
    const tw = qC.set(0, rel.y, 0, rel.w);
    if (tw.lengthSq() > 1e-9) v2.multiply(tw.normalize().slerp(IDENT, 1 - FOREARM_TWIST));
    return [v1, v2, v] as const;
  }

  /** Keihään kädet: oikea käsi asennon mukaiseen otteeseen (sulautuen suoraan ohjattuun), vasen varrelle. */
  private spearArms() {
    this.body.updateMatrixWorld(true);
    const rigY = this.rig ? this.rig.position.y : 0;
    if (this.spearW > 0.001) {
      const G = this.hold.grip.clone();
      G.y += rigY;
      const ik = this.holdShaft("R", G, this.hold.dir, this.hold.poleR);
      (["upper_arm_R", "forearm_R", "hand_R"] as const).forEach((n, i) => {
        const b = this.bones.get(n)!;
        const fk = b.world.clone().multiply(qA.copy(b.canon).invert());
        this.setBone(n, fk.slerp(ik[i], this.spearW));
      });
      this.body.updateMatrixWorld(true);
    }
    const P0 = this.body.worldToLocal(this.weapon.localToWorld(new THREE.Vector3(0, 0, 0)));
    const dir = this.body.worldToLocal(this.weapon.localToWorld(new THREE.Vector3(0, 0, 1))).sub(P0).normalize();
    const G = P0.addScaledVector(dir, this.hold.front);
    const [l1, l2, l3] = this.holdShaft("L", G, dir, this.hold.poleL);
    this.setBone("upper_arm_L", l1);
    this.setBone("forearm_L", l2);
    this.setBone("hand_L", l3);
  }

  /** Mittari: jalkaterien paikka maailmassa (x, y, z) ja askelsyklin vaihe. Savutestiin. */
  feetDebug() {
    if (!this.rig) return null;
    this.root.updateMatrixWorld(true);
    const at = (n: BoneName) => this.bones.get(n)!.bone.getWorldPosition(new THREE.Vector3()).toArray().map((v) => +v.toFixed(3));
    return {
      L: at("foot_L"), R: at("foot_R"), hips: at("hips"), root: this.root.position.toArray().map((v) => +v.toFixed(3)),
      phase: +this.walkPhase.toFixed(3), duty: +this.duty.toFixed(3), speed: +this.vel.length().toFixed(2),
    };
  }

  /**
   * Mittari: kummankin käden otekanavan keskipisteen etäisyys keihään akselista (m),
   * kanavan ja varren välinen kulma (deg) sekä ranteen kääntö kyynärvarteen nähden (deg).
   */
  spearGripDebug() {
    if (this.look.loadout !== "spear" || !this.rig) return null;
    this.root.updateMatrixWorld(true);
    const P0 = this.weapon.localToWorld(new THREE.Vector3(0, 0, 0));
    const dir = this.weapon.localToWorld(new THREE.Vector3(0, 0, 1)).sub(P0).normalize();
    const out: Record<string, number> = {};
    for (const side of ["R", "L"] as const) {
      const h = this.bones.get(`hand_${side}`)!, f = this.bones.get(`forearm_${side}`)!;
      const vH = h.world.clone().multiply(h.canon.clone().invert());
      const vF = f.world.clone().multiply(f.canon.clone().invert());
      const bq = this.body.getWorldQuaternion(new THREE.Quaternion());
      const c = h.bone.getWorldPosition(new THREE.Vector3()).add(this.gripV[side].c.clone().applyQuaternion(vH).applyQuaternion(bq));
      const rel = c.sub(P0);
      out[`grip${side}`] = rel.addScaledVector(dir, -rel.dot(dir)).length();
      const cd = this.gripV[side].d.clone().applyQuaternion(vH).applyQuaternion(bq);
      out[`angle${side}`] = THREE.MathUtils.radToDeg(Math.acos(Math.min(1, Math.abs(cd.dot(dir)))));
      // Ranteen taivutus (kämmenen akselin kulma kyynärvarteen) ja kierto kyynärvarren ympäri.
      const r = vF.invert().multiply(vH);
      out[`wrist${side}`] = THREE.MathUtils.radToDeg(DOWN.angleTo(DOWN.clone().applyQuaternion(r)));
      const tw = new THREE.Quaternion(0, r.y, 0, r.w).normalize();
      out[`twist${side}`] = THREE.MathUtils.radToDeg(2 * Math.acos(Math.min(1, Math.abs(tw.w))));
    }
    return out;
  }

  private boneY(name: BoneName) {
    return this.bones.get(name)!.bone.getWorldPosition(vTmp).y - this.body.getWorldPosition(new THREE.Vector3()).y;
  }

  /** Asettaa luun hahmokoordinaatiston kierron v (virtuaalinen nivelkehys) mukaan. */
  private setBone(name: BoneName, v: THREE.Quaternion) {
    const b = this.bones.get(name)!;
    b.world.copy(v).multiply(b.canon);
    const pw = b.parent ? this.bones.get(b.parent)!.world : IDENT;
    b.bone.quaternion.copy(qC.copy(pw).invert()).multiply(b.world);
  }

  private apply() {
    if (!this.rig) return;
    const p = this.pose;
    // Kaatumisen osuus 0..1: jalat, selän sivutaivutus ja pään kääntö sulautuvat makuuasentoon.
    const fw = this.fall * this.fall * (3 - 2 * this.fall);
    const fp = this.fallen;
    // Elävyys: paikallaan paino siirtyy hitaasti jalalta toiselle ja hahmo hengittää; kävellessä
    // lantio kiertyy askeleen mukaan ja hartiat tekevät vastaliikkeen. Kaatuneella ei mitään näistä.
    const G = GAIT, TAU = Math.PI * 2;
    const life = 1 - fw;
    const speed = this.vel.length();
    const w = THREE.MathUtils.smoothstep(speed, G.startSpeed, G.fullSpeed) * life;
    const calm = (1 - 0.7 * w) * life;
    const t = this.idleT;
    const idle = Math.sin(t * 1.15) * 0.75 + Math.sin(t * 2.63 + 1.3) * 0.25;
    const breath = Math.sin(t * 1.75) * G.breath * life;
    const dir = this.stepDir, duty = this.duty;
    const onLeft = Math.cos(TAU * (this.walkPhase - duty / 2)); // +1 = paino vasemmalla jalalla
    const leftLead = Math.cos(TAU * this.walkPhase); // +1 = vasen jalka edessä
    const pelvisX = idle * G.idleShift * calm + this.leftX * onLeft * G.hipShift * w;
    const hipRoll = idle * G.idleRoll * calm + this.leftX * onLeft * G.hipRoll * w;
    const hipYaw = Math.sin(t * 0.83 + 2) * G.idleYaw * calm - this.leftX * leftLead * G.hipYaw * w * dir.y;
    const lean = G.lean * w * dir.y * Math.min(1, speed / 3.4);
    const S = new THREE.Quaternion().setFromEuler(eul.set(p.spinePitch + breath + lean, p.spineYaw - hipYaw * G.counter, fp.spineRoll * fw - hipRoll * G.counter));
    const H = new THREE.Quaternion().setFromEuler(eul.set(p.headPitch - breath * 0.6 - lean * 0.7, -p.spineYaw * 0.5 + hipYaw * G.counter * 0.8 + fp.headYaw * fw, hipRoll * G.counter * 0.8));
    const half = new THREE.Quaternion().slerpQuaternions(IDENT, S, 0.5);
    this.setBone("hips", new THREE.Quaternion().setFromEuler(eul.set(0, hipYaw, hipRoll)));
    this.setBone("spine", half);
    this.setBone("chest", S);
    this.setBone("neck", qA.copy(S).multiply(qB.slerpQuaternions(IDENT, H, 0.5)));
    this.setBone("head", qA.copy(S).multiply(H));

    const arm = (side: "L" | "R", shX: number, shZ: number, el: number, hand: THREE.Quaternion | null) => {
      const sh = new THREE.Quaternion().copy(S).multiply(qA.setFromEuler(eul.set(shX, 0, shZ)));
      this.setBone(`upper_arm_${side}`, sh);
      const fo = sh.clone().multiply(qA.setFromEuler(eul.set(el, 0, 0)));
      this.setBone(`forearm_${side}`, fo);
      this.setBone(`hand_${side}`, hand ? fo.multiply(hand) : fo);
    };
    arm("R", p.rShX, p.rShZ, p.rEl, qB.setFromEuler(eul.set(p.rHandX, p.rHandY, 0, "YXZ")).clone());
    arm("L", p.lShX, p.lShZ, p.lEl, null);
    eul.order = "XYZ";
    if (this.shieldHolder) {
      // Levossa ranne antaa periksi ja kilpi roikkuu kahvastaan pystyssä kyljellä, pinta ulospäin
      // ja hieman eteen. Torjunnassa se kääntyy takaisin kyynärvarren eteen.
      const hang = qA.setFromEuler(eul.set(0, this.leftX * SHIELD_HANG_YAW, 0));
      qB.copy(this.bones.get("forearm_L")!.world).invert().multiply(hang);
      const hw = this.shieldHang * this.shieldHang * (3 - 2 * this.shieldHang);
      this.shieldHolder.quaternion.slerpQuaternions(this.shieldFront, qB, hw);
    }
    if (this.look.loadout === "spear") this.spearArms();

    // Jalat: asennon mukainen jalan paikka lasketaan ensin (reisi ja polvi), siihen lisätään
    // askel, ja nivelkulmat ratkaistaan jalan paikasta. Näin maassa oleva jalka liikkuu
    // vartaloon nähden täsmälleen hahmon nopeudella taaksepäin eikä liu'u maata pitkin.
    // Kesken kaatumisen polvet pettävät hetkeksi, jotta hahmo ei kaadu jäykkänä lautana.
    const buckle = Math.sin(this.fall * Math.PI) * 0.35;
    const [l1, l2] = this.legLen;
    const reach = (l1 + l2) * 0.995;
    const stepLen = this.stepLen;
    const lift = (G.liftBase + G.liftPerSpeed * speed) * w;
    const foot = (side: "L" | "R", thighRot: number, kneeRot: number) => {
      const a = -thighRot;
      const out = { x: 0, y: -(l1 * Math.cos(a) + l2 * Math.cos(a - kneeRot)), z: l1 * Math.sin(a) + l2 * Math.sin(a - kneeRot), up: 0 };
      const ph = (this.walkPhase + (side === "L" ? 0 : 0.5)) % 1;
      let along: number;
      if (ph < duty) along = 0.5 - ph / duty; // maassa: tasaisesti edestä taakse
      else {
        // Heilahdus takaa eteen. Alku- ja loppunopeus vastaavat maassa oloa, jotta jalka ei nykäise.
        const u = (ph - duty) / (1 - duty), m = Math.max(-1, -(1 - duty) / duty);
        const u2 = u * u, u3 = u2 * u;
        along = (2 * u3 - 3 * u2 + 1) * -0.5 + (u3 - 2 * u2 + u) * m + (-2 * u3 + 3 * u2) * 0.5 + (u3 - u2) * m;
        out.up = Math.sin(Math.PI * u);
      }
      // Sivuaskeleessa kumpikin jalka askeltaa enimmäkseen oman puolensa ulkopuolella, jotta jalat eivät mene ristiin.
      const sideSign = side === "L" ? this.leftX : -this.leftX;
      out.x += (dir.x * along + sideSign * 0.25 * Math.abs(dir.x)) * stepLen * w - pelvisX;
      out.z += dir.y * along * stepLen * w;
      out.y += out.up * lift;
      return out;
    };
    // Haara-asento sulautuu osin pois kävellessä, jotta askel ei jää toispuoleiseksi.
    const st = p.stride * (1 - w * 0.6);
    const sf = Math.max(0, st), sb = Math.max(0, -st);
    const fL = foot("L", -p.crouch * 1.2 - st, p.crouch * 2 + sf * 0.35 + sb * 0.6);
    const fR = foot("R", -p.crouch * 1.2 + st, p.crouch * 2 + sb * 0.35 + sf * 0.6);
    // Jos jalka ei yllä paikkaansa, lantio laskeutuu: tästä syntyy askelluksen pieni pystyliike.
    let drop = 0;
    // Ilmassa oleva jalka ei vedä lantiota alas.
    for (const f of [fL, fR]) drop = Math.max(drop, 0.55 * (1 - f.up * w) * (-f.y - Math.sqrt(Math.max(0.01, reach * reach - f.x * f.x - f.z * f.z))));
    const leg = (side: "L" | "R", tgt: { x: number; y: number; z: number; up: number }) => {
      const x = tgt.x, y = tgt.y + drop, z = tgt.z;
      const r = Math.min(reach, Math.max(Math.abs(l1 - l2) + 0.01, Math.hypot(x, y, z)));
      const knee = Math.PI - Math.acos(THREE.MathUtils.clamp((l1 * l1 + l2 * l2 - r * r) / (2 * l1 * l2), -1, 1));
      const open = Math.acos(THREE.MathUtils.clamp((l1 * l1 + r * r - l2 * l2) / (2 * l1 * r), -1, 1));
      const thighRot = -(Math.atan2(z, Math.hypot(x, y)) + open);
      const spread = Math.atan2(x, -y);
      const f = side === "L" ? fp.legL : fp.legR;
      const tx = thighRot + (f.x - thighRot) * fw - buckle * 1.1;
      const kn = knee + (f.knee - knee) * fw + buckle * 2;
      const th = new THREE.Quaternion().setFromEuler(eul.set(tx, f.y * fw, spread + (f.z - spread) * fw, "ZXY"));
      eul.order = "XYZ";
      this.setBone(`thigh_${side}`, th);
      const sh = th.clone().multiply(qA.setFromEuler(eul.set(kn, 0, 0)));
      this.setBone(`shin_${side}`, sh);
      // Ilmassa jalkaterä seuraa säärtä enemmän, jolloin varpaat osoittavat alas ponnistuksen jälkeen.
      this.setBone(`foot_${side}`, qA.slerpQuaternions(sh, IDENT, 0.7 - 0.3 * tgt.up * w));
    };
    leg("L", fL);
    leg("R", fR);

    // Lantio seuraa jalkoja: alempi jalka pysyy maassa kyykyssä ja askeleessa.
    const hips = this.bones.get("hips")!.bone;
    hips.position.copy(this.hipsRest);
    this.rig.position.set(pelvisX, 0, 0);
    this.rig.updateMatrixWorld(true);
    const low = Math.min(this.boneY("foot_L"), this.boneY("foot_R"));
    this.rig.position.y = this.footRestY - low - this.sink;
  }

  /** Liu'uttaa asentoa kohti kohdeasentoa. rate = kuinka nopeasti (1/s). */
  animate(target: Pose, rate: number, dt: number, moveSpeed: number) {
    const k = 1 - Math.exp(-rate * dt);
    if (this.fall > 0) target = this.fallen.pose;
    // Kilpikäsi: kilpi pysyy vartalon edessä ja nousee torjunnassa eteen, ei pään päälle.
    const over = this.hasShield
      ? (BLOCK_POSES.has(target) ? SHIELD_BLOCK : SHIELD_ARM.has(target) ? SHIELD_GUARD : null)
      : this.look.loadout === "spear" ? SPEAR.get(target) ?? null : null;
    this.shieldHang += ((SHIELD_FRONT.has(target) ? 0 : 1) - this.shieldHang) * k;
    for (const key of KEYS) {
      const goal = over && key in over ? over[key as keyof typeof over]! : target[key];
      this.pose[key] += (goal - this.pose[key]) * k;
    }
    if (this.look.loadout === "spear") {
      const st = SPEAR_HOLD.get(target);
      this.spearW += ((st ? 1 : 0) - this.spearW) * k;
      if (st) {
        const h = spearHold(st);
        this.hold.grip.lerp(h.grip, k);
        this.hold.dir.lerp(h.dir, k).normalize();
        this.hold.poleR.lerp(h.poleR, k);
        this.hold.poleL.lerp(h.poleL, k);
        this.hold.front += (h.front - this.hold.front) * k;
      }
    }
    // Nopeus mitataan hahmon todellisesta siirtymästä, jolloin askel osoittaa liikkeen suuntaan
    // (eteen, taakse tai sivulle) eikä hahmo kävele paikallaan seinää vasten. moveSpeed kertoo,
    // onko liike kävelyä: syöksyn ja iskun työntö eivät ole askellusta.
    const G = GAIT, pos = this.root.position;
    let vx = 0, vz = 0;
    if (this.lastPos && dt > 1e-6 && moveSpeed > 0) {
      const dx = pos.x - this.lastPos.x, dz = pos.z - this.lastPos.z;
      if (Math.hypot(dx, dz) < 1) {
        const yaw = this.root.rotation.y, c = Math.cos(yaw), sn = Math.sin(yaw);
        vx = (dx * c - dz * sn) / dt;
        vz = (dx * sn + dz * c) / dt;
        const len = Math.hypot(vx, vz);
        if (len > 6) { vx *= 6 / len; vz *= 6 / len; }
      }
    }
    (this.lastPos ??= new THREE.Vector3()).copy(pos);
    const kv = 1 - Math.exp(-10 * dt);
    this.vel.x += (vx - this.vel.x) * kv;
    this.vel.y += (vz - this.vel.y) * kv;
    const speed = this.vel.length();
    if (speed > 0.05) this.stepDir.copy(this.vel).divideScalar(speed);
    this.stepLen = Math.min(G.stepMax, G.stepBase + G.stepPerSpeed * speed) * (1 - (1 - G.sideStep) * Math.abs(this.stepDir.x));
    // Sykli etenee niin, että maassa olon aikana vartalo kulkee täsmälleen askelsyklin pituuden.
    this.duty = THREE.MathUtils.lerp(G.duty, G.dutyRun, THREE.MathUtils.smoothstep(speed, G.walkSpeed, G.runSpeed));
    this.walkPhase = (this.walkPhase + dt * this.duty * speed / this.stepLen) % 1;
    this.idleT += dt;
    // Kaatuminen: kiihtyy kuin painovoimassa ja päättyy makuulle selälleen tai vatsalleen.
    const tip = this.fall * this.fall;
    this.body.rotation.x = (this.fallen.prone ? 1 : -1) * tip * (Math.PI / 2);
    this.body.rotation.y = this.fallen.bodyYaw * this.fall;
    this.body.position.y = tip * this.fallen.lift;
    this.apply();
  }

  setGlow(amount: number) {
    for (const m of this.bladeMats) m.emissive.setRGB(amount * 1.0, amount * 0.6, amount * 0.15);
  }
}

// Kilpikäden asennot (vasen käsi). Levossa kilpi roikkuu vasemmalla kyljellä pinta sivulle;
// torjunnassa se nostetaan keskelle vartalon eteen, jolloin liike näkyy selvästi.
const SHIELD_GUARD: Partial<Pose> = { lShX: 0.1, lShZ: 0.34, lEl: -0.3 };
/** Roikkuvan kilven pinnan suunta: 90° = suoraan sivulle, pienempi = hieman eteen. */
const SHIELD_HANG_YAW = 1.3;
const SHIELD_BLOCK: Partial<Pose> = {
  lShX: -1.1, lShZ: -0.1, lEl: -0.8, spineYaw: -0.3, crouch: 0.14,
  rShX: -0.5, rShZ: -0.35, rEl: -1.2, rHandX: 0.9, rHandY: 0,
};
const BLOCK_POSES = new Set<Pose>([POSES.block, POSES.blockSide, POSES.blockThrust]);
/** Asennot, joissa kilpi on edessä: torjunnat ja kilpi-isku. Muissa se roikkuu kyljellä. */
const SHIELD_FRONT = new Set<Pose>([...BLOCK_POSES, POSES.bashWindup, POSES.bashStrike]);
const SHIELD_ARM = new Set<Pose>([
  POSES.guard, POSES.windup, POSES.strike, POSES.heavyWindup, POSES.heavyStrike,
  POSES.slashWindup, POSES.slashStrike, POSES.thrustWindup, POSES.thrustStrike,
]);

// Keihäs: vartalon asento (kierto, kyyry, haara-asento) tulee näistä; kädet vie otteeseen
// SPEAR_HOLD + käänteiskinematiikka. Käsien kulmia käytetään vain siirtymissä asentoihin,
// joille ei ole keihäsotetta (horjahdus, juuttuminen, laulu). Keihäällä vain pistetään.
const SPEAR_BLOCK: Partial<Pose> = { spineYaw: -0.2, rShX: -0.3, rShZ: -0.3, rEl: -1.5, rHandX: 0.6, rHandY: 1.2, lShX: -1.3, lShZ: 0.2, lEl: -0.9 };
export const SPEAR = new Map<Pose, Partial<Pose>>([
  [POSES.guard, { spineYaw: -0.45, rShX: 0.35, rShZ: -0.15, rEl: -1.3, rHandX: 0.95, rHandY: 0, lShX: -0.85, lShZ: -0.3, lEl: -0.55 }],
  [POSES.thrustWindup, { spineYaw: -0.8, rShX: 0.85, rShZ: -0.2, rEl: -1.7, rHandX: 0.85, rHandY: 0, lShX: -0.6, lShZ: -0.35, lEl: -0.9 }],
  [POSES.thrustStrike, { stride: 0.55, crouch: 0.22, spineYaw: -0.55, spinePitch: 0.42, rShX: -1.15, rShZ: 0.1, rEl: -0.2, rHandX: 1.35, rHandY: 0, lShX: -1.2, lShZ: -0.2, lEl: -0.25 }],
  [POSES.block, SPEAR_BLOCK], [POSES.blockSide, SPEAR_BLOCK], [POSES.blockThrust, SPEAR_BLOCK],
]);

/**
 * Keihään ote asennoittain hahmon koordinaatistossa (+z eteen, +y ylös, oikea käsi −x):
 * grip = takakäden otteen paikka (m), yaw/pitch = varren suunta (rad, yaw > 0 kääntää kärjen
 * vartalon keskilinjaa kohti), front = etukäden etäisyys takakädestä varrella (m),
 * poleR/poleL = suunta, johon kyynärpää osoittaa. Kädet viedään otteeseen käänteiskinematiikalla.
 */
interface SpearHoldDef {
  grip: [number, number, number];
  yaw: number;
  pitch: number;
  front: number;
  poleR: [number, number, number];
  poleL: [number, number, number];
}
// Perusasento: takakäsi oikean lonkan vieressä, kärki vastustajan rinnan korkeudella.
const SPEAR_HOLD_GUARD: SpearHoldDef = { grip: [-0.2, 1.0, 0.04], yaw: 0.1, pitch: 0.24, front: 0.53, poleR: [-0.3, -1, -0.6], poleL: [-0.3, -1, 0] };
// Torjunta: varsi vinosti ylös vartalon eteen.
const SPEAR_HOLD_BLOCK: SpearHoldDef = { grip: [-0.16, 1.02, 0.22], yaw: 0.3, pitch: 0.95, front: 0.55, poleR: [-0.3, -1, -0.6], poleL: [0.6, -1, -0.2] };
export const SPEAR_HOLD = new Map<Pose, SpearHoldDef>([
  [POSES.guard, SPEAR_HOLD_GUARD],
  // Pisto: varsi vedetään taakse lonkalle ja työnnetään molemmin käsin eteen (tyviote liikkuu 0,5 m).
  [POSES.thrustWindup, { grip: [-0.22, 1.02, -0.22], yaw: 0.08, pitch: 0.2, front: 0.5, poleR: [-0.3, -1, -0.6], poleL: [-0.3, -1, 0] }],
  [POSES.thrustStrike, { grip: [-0.12, 1.15, 0.28], yaw: 0.05, pitch: 0.1, front: 0.45, poleR: [-0.8, -0.5, -0.6], poleL: [-0.3, -1, 0] }],
  [POSES.block, SPEAR_HOLD_BLOCK], [POSES.blockSide, SPEAR_HOLD_BLOCK], [POSES.blockThrust, SPEAR_HOLD_BLOCK],
  // Horjahdus (myös kaatuminen) ja suohon juuttuminen: keihäs pysyy molemmissa käsissä.
  [POSES.stagger, { grip: [-0.22, 1.05, -0.08], yaw: 0.15, pitch: 0.55, front: 0.5, poleR: [-0.3, -1, -0.6], poleL: [0.6, -1, -0.2] }],
  [POSES.rooted, { grip: [-0.2, 1.15, 0.05], yaw: 0.2, pitch: 0.45, front: 0.55, poleR: [-0.3, -1, -0.6], poleL: [0.6, -1, -0.2] }],
]);
function spearHold(d: SpearHoldDef) {
  return {
    grip: new THREE.Vector3(...d.grip),
    dir: new THREE.Vector3(Math.sin(d.yaw) * Math.cos(d.pitch), Math.sin(d.pitch), Math.cos(d.yaw) * Math.cos(d.pitch)),
    front: d.front,
    poleR: new THREE.Vector3(...d.poleR),
    poleL: new THREE.Vector3(...d.poleL),
  };
}

/** Kuinka suuri osa kämmenen kierrosta viedään kyynärvarteen (loput näkyy ranteessa). */
const FOREARM_TWIST = 0.85;

// Nyrkin otekanava glTF-koordinaateissa (oikea käsi lepoasennossa; vasen = peilikuva x:n suhteen).
// Sama suora kuin GRIP_P/GRIP_D tiedostossa assets-src/blender/char_build.py, jonka mukaan
// sormet on muotoiltu varren ympärille. d osoittaa peukalon puolelle eli keihään kärkeen päin.
/** Kuinka paljon keihästä on työnnetty otteessa eteenpäin (m): takakäden taakse jää noin 0,3 m vartta. */
const SPEAR_SLIDE = 0.3;
const GRIP_CHANNEL = { p: new THREE.Vector3(-0.383, 0.795, 0.112), d: new THREE.Vector3(0.31, -0.06, 0.95).normalize() };

// Aseen paikka kädessä virtuaalisessa käsikehyksessä (käsi suorana alas: y alas rannetta pitkin).
const GRIP = { x: 0, y: -0.085, z: 0.0 };
const HAND_TWIST = 0;

interface ShieldUniforms {
  uNotch: { value: number };
  uSector: { value: THREE.Vector2 };
}
interface ShieldBasis { center: THREE.Vector3; u: THREE.Vector3; v: THREE.Vector3; radius: number }

/**
 * Antaa kilven materiaaleille omat kopiot, joiden shader osaa leikata pois loven (uNotch)
 * ja rajata näkyviin yhden sektorin (uSector, sirpaleita varten).
 */
function patchShield(shield: THREE.Object3D, basis: ShieldBasis): ShieldUniforms[] {
  const out: ShieldUniforms[] = [];
  shield.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = (m.material as THREE.MeshStandardMaterial).clone();
    const uniforms = {
      uNotch: { value: 0 },
      uSector: { value: new THREE.Vector2(0, 0) },
      uShC: { value: basis.center },
      uShU: { value: basis.u },
      uShV: { value: basis.v },
      uShR: { value: basis.radius },
    };
    mat.side = THREE.DoubleSide;
    if (mat.metalness > 0.5) { mat.envMapIntensity = 0.45; if (envMap) mat.envMap = envMap; envTargets.add(mat); }
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vShP;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvShP = position;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", `#include <common>
          varying vec3 vShP;
          uniform float uNotch; uniform vec2 uSector; uniform vec3 uShC; uniform vec3 uShU; uniform vec3 uShV; uniform float uShR;
          float shAngDiff(float a, float b){ float d = a - b; return abs(atan(sin(d), cos(d))); }`)
        .replace("#include <color_fragment>", `#include <color_fragment>
          {
            vec3 q = vShP - uShC;
            vec2 uv = vec2(dot(q, uShU), dot(q, uShV)) / uShR;
            float r = length(uv);
            float ang = atan(uv.y, uv.x) + 0.07 * sin(r * 21.0);
            ang = atan(sin(ang), cos(ang)); // takaisin välille -PI..PI, ettei sauman kohdalle jää rakoa
            if (uSector.y > uSector.x && (ang < uSector.x || ang > uSector.y)) discard;
            if (uNotch > 0.5) {
              // Iso lovi reunasta kohti keskustaa ja pienempi lohkeama toisella laidalla.
              float d1 = shAngDiff(ang, 2.2), w1 = 0.34 * smoothstep(0.25, 1.0, r);
              float d2 = shAngDiff(ang, -0.6), w2 = 0.2 * smoothstep(0.55, 1.0, r);
              if ((r > 0.25 && d1 < w1) || (r > 0.55 && d2 < w2)) discard;
              // Tummat halkeamat loven reunoilla ja sen jatkeena.
              float crack = min(smoothstep(0.0, 0.035, d1 - w1), smoothstep(0.0, 0.03, d2 - w2));
              crack = min(crack, mix(1.0, smoothstep(0.0, 0.02, d1), step(0.08, r) * step(r, 0.27)));
              diffuseColor.rgb *= mix(0.25, 1.0, crack);
            }
          }`);
    };
    mat.customProgramCacheKey = () => "shield-damage";
    m.material = mat;
    out.push(uniforms);
  });
  return out;
}

/** Maahan putoava irtokappale (kilven sirpaleet, päästä lentänyt kypärä). */
export interface Debris {
  readonly group: THREE.Group;
  /** Palauttaa false, kun kappale on aika poistaa. */
  update(dt: number, groundAt: (x: number, z: number) => number): boolean;
  dispose(): void;
}

/** Yksi jäykkä kappale, joka irtoaa hahmosta, lentää kaaressa, pomppaa kerran ja jää maahan. */
export class FlyingProp implements Debris {
  readonly group = new THREE.Group();
  private vel: THREE.Vector3;
  private spin: THREE.Vector3;
  private bounces = 0;
  private rest = false;
  private age = 0;

  constructor(obj: THREE.Object3D, dir: THREE.Vector3) {
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();
    obj.matrixWorld.decompose(pos, quat, scl);
    obj.removeFromParent();
    // Kappale ensin maailman koordinaatteihin: vasta sitten sen keskipiste on oikea.
    // (Aiemmin keskipiste laskettiin pääluun koordinaateissa, jolloin kypärä saattoi
    // "laskeutua" heti ja jäädä leijumaan.)
    obj.position.copy(pos);
    obj.quaternion.copy(quat);
    obj.scale.copy(scl);
    obj.updateMatrixWorld(true);
    // Kääntöpiste kappaleen keskelle, jotta se pyörii luontevasti eikä kierrä hahmon jalkoja.
    const center = new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3());
    obj.position.sub(center);
    this.group.position.copy(center);
    this.group.add(obj);
    this.vel = dir.clone().setY(0).normalize().multiplyScalar(2.2 + Math.random() * 1.2).add(new THREE.Vector3(0, 2.6 + Math.random(), 0));
    this.spin = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(12);
  }

  update(dt: number, groundAt: (x: number, z: number) => number): boolean {
    this.age += dt;
    if (this.rest) return this.age < 25;
    const g = this.group;
    this.vel.y -= 9.8 * dt;
    g.position.addScaledVector(this.vel, dt);
    qA.setFromEuler(eul.set(this.spin.x * dt, this.spin.y * dt, this.spin.z * dt));
    g.quaternion.premultiply(qA);
    const floor = groundAt(g.position.x, g.position.z) + 0.09;
    if (g.position.y <= floor && this.vel.y < 0) {
      g.position.y = floor;
      if (this.bounces++ < 1) {
        this.vel.set(this.vel.x * 0.45, -this.vel.y * 0.35, this.vel.z * 0.45);
        this.spin.multiplyScalar(0.5);
      } else this.rest = true;
    }
    return true;
  }

  dispose() { this.group.removeFromParent(); }
}

/**
 * Kädestä pudonnut ase tai kilpi: putoaa lähelle ja asettuu maahan lappeelleen.
 * long = kappaleen pituusakseli (ase), normal = pinnan normaali (kilpi), kappaleen omissa koordinaateissa.
 */
export class DroppedProp implements Debris {
  readonly group = new THREE.Group();
  private vel: THREE.Vector3;
  private rest = false;
  private age = 0;
  private yawSpin: number;

  constructor(private obj: THREE.Object3D, dir: THREE.Vector3, private shape: { long?: THREE.Vector3; normal?: THREE.Vector3; rest: number }) {
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();
    obj.matrixWorld.decompose(pos, quat, scl);
    obj.removeFromParent();
    obj.position.copy(pos);
    obj.quaternion.copy(quat);
    obj.scale.copy(scl);
    obj.updateMatrixWorld(true);
    const center = new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3());
    obj.position.sub(center);
    this.group.position.copy(center);
    this.group.add(obj);
    this.vel = dir.clone().setY(0).normalize().multiplyScalar(0.8 + Math.random() * 0.6).setY(0.6);
    this.yawSpin = (Math.random() - 0.5) * 3;
  }

  /** Kierto, joka vie kappaleen nykyisestä asennosta lappeelleen. */
  private toFlat(out: THREE.Quaternion) {
    const q = this.group.quaternion.clone().multiply(this.obj.quaternion);
    const up = new THREE.Vector3(0, 1, 0);
    let n: THREE.Vector3;
    if (this.shape.normal) {
      n = this.shape.normal.clone().applyQuaternion(q);
      if (n.y < 0) n.negate();
    } else {
      // Aseelle: pituusakselia vastaan kohtisuora suunta, joka on lähinnä ylöspäin.
      const d = this.shape.long!.clone().applyQuaternion(q);
      n = up.clone().addScaledVector(d, -d.y);
      if (n.lengthSq() < 1e-6) n.set(1, 0, 0);
      n.normalize();
    }
    return out.setFromUnitVectors(n, up);
  }

  update(dt: number, groundAt: (x: number, z: number) => number): boolean {
    this.age += dt;
    if (this.rest) return this.age < 40;
    const g = this.group;
    this.vel.y -= 9.8 * dt;
    g.position.addScaledVector(this.vel, dt);
    // Kääntyy pudotessaan kohti lappeellaan olevaa asentoa ja pyörähtää hieman.
    g.quaternion.premultiply(this.toFlat(qB).slerp(IDENT, Math.exp(-9 * dt)));
    g.quaternion.premultiply(qA.setFromEuler(eul.set(0, this.yawSpin * dt, 0)));
    const floor = groundAt(g.position.x, g.position.z) + this.shape.rest;
    if (g.position.y <= floor && this.vel.y < 0) {
      g.position.y = floor;
      g.quaternion.premultiply(this.toFlat(qB));
      this.rest = true;
    }
    return true;
  }

  dispose() { this.group.removeFromParent(); }
}

const PIECES = 6;
/** Hajonneen kilven palaset: kuusi sektoria, jotka lentävät erilleen ja jäävät maahan. */
export class ShieldDebris implements Debris {
  readonly group = new THREE.Group();
  private pieces: { obj: THREE.Object3D; vel: THREE.Vector3; spin: THREE.Vector3; landed: boolean; flat: THREE.Quaternion; normal: THREE.Vector3 }[] = [];
  private age = 0;

  constructor(shield: THREE.Object3D, basis: ShieldBasis) {
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();
    shield.matrixWorld.decompose(pos, quat, scl);
    const normal = new THREE.Vector3().crossVectors(basis.u, basis.v);
    for (let i = 0; i < PIECES; i++) {
      const a0 = -Math.PI + (i / PIECES) * Math.PI * 2, a1 = a0 + (Math.PI * 2) / PIECES;
      const obj = shield.clone(true);
      for (const u of patchShield(obj, basis)) u.uSector.value.set(a0, a1);
      obj.position.copy(pos);
      obj.quaternion.copy(quat);
      obj.scale.copy(scl);
      const mid = (a0 + a1) / 2;
      const out = basis.u.clone().multiplyScalar(Math.cos(mid)).addScaledVector(basis.v, Math.sin(mid)).applyQuaternion(quat);
      const vel = out.multiplyScalar(1.2 + Math.random() * 1.3).add(new THREE.Vector3(0, 1.2 + Math.random() * 1.5, 0));
      const spin = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(9);
      this.pieces.push({ obj, vel, spin, landed: false, flat: new THREE.Quaternion(), normal: normal.clone() });
      this.group.add(obj);
    }
  }

  /** Palauttaa false, kun palaset on aika poistaa. */
  update(dt: number, groundAt: (x: number, z: number) => number): boolean {
    this.age += dt;
    for (const p of this.pieces) {
      if (p.landed) {
        p.obj.quaternion.slerp(p.flat, 1 - Math.exp(-10 * dt));
        continue;
      }
      p.vel.y -= 9.8 * dt;
      p.obj.position.addScaledVector(p.vel, dt);
      qA.setFromEuler(eul.set(p.spin.x * dt, p.spin.y * dt, p.spin.z * dt));
      p.obj.quaternion.premultiply(qA);
      const g = groundAt(p.obj.position.x, p.obj.position.z) + 0.03;
      if (p.obj.position.y <= g && p.vel.y < 0) {
        p.obj.position.y = g;
        p.landed = true;
        // Lappeelleen maahan: kilven pinnan normaali ylös tai alas sen mukaan, kumpi on lähempänä.
        const n = p.normal.clone().applyQuaternion(p.obj.quaternion);
        const up = new THREE.Vector3(0, n.y >= 0 ? 1 : -1, 0);
        p.flat.setFromUnitVectors(n, up).multiply(p.obj.quaternion);
      }
    }
    return this.age < 20;
  }

  dispose() {
    this.group.removeFromParent();
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      envTargets.delete(m.material as THREE.MeshStandardMaterial);
      (m.material as THREE.Material).dispose();
    });
  }
}

/** Miekan jälkivana: nauha terän tyven ja kärjen viimeisistä sijainneista. */
export class SwordTrail {
  readonly mesh: THREE.Mesh;
  private pts: THREE.Vector3[] = [];
  private readonly max = 14;
  private geo = new THREE.BufferGeometry();
  private positions: Float32Array;
  private alphas: Float32Array;

  constructor(color: number) {
    this.positions = new Float32Array(this.max * 2 * 3);
    this.alphas = new Float32Array(this.max * 2);
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    this.geo.setAttribute("alpha", new THREE.BufferAttribute(this.alphas, 1));
    const idx: number[] = [];
    for (let i = 0; i < this.max - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    this.geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: { color: { value: new THREE.Color(color) } },
      vertexShader: `attribute float alpha; varying float vA;
        void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 color; varying float vA;
        void main(){ gl_FragColor = vec4(color * vA, vA); }`,
    });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
  }

  update(base: THREE.Vector3, tip: THREE.Vector3, active: boolean) {
    if (active) {
      this.pts.unshift(base.clone(), tip.clone());
      if (this.pts.length > this.max * 2) this.pts.length = this.max * 2;
    } else if (this.pts.length > 0) {
      this.pts.length = Math.max(0, this.pts.length - 4);
    }
    const n = this.pts.length;
    for (let i = 0; i < this.max * 2; i++) {
      const p = this.pts[Math.min(i, n - 1)];
      if (p) this.positions.set([p.x, p.y, p.z], i * 3);
      const seg = Math.floor(i / 2);
      this.alphas[i] = i < n ? (1 - seg / this.max) * (i % 2 === 1 ? 0.7 : 0.15) : 0;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.alpha.needsUpdate = true;
  }
}
