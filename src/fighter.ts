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
  sing: {
    spineYaw: 0, spinePitch: -0.12, rShX: -0.25, rShZ: -0.35, rEl: -0.4, rHandX: 0.9, rHandY: 0,
    lShX: -1.2, lShZ: 0.9, lEl: -0.6, crouch: 0.02, headPitch: -0.35, stride: 0.05,
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
  private pose: Pose = { ...POSES.guard };
  private walkPhase = 0;
  private disposed = false;
  sink = 0; // suohon vajoaminen metreinä
  fall = 0; // 0..1 kaatuminen

  constructor(readonly look: FighterLook) {
    this.root.add(this.body);
    // Terän pisteet ovat olemassa heti, vaikka malli latautuu vasta hetken päästä.
    this.weapon.position.set(-0.3, 1.0, 0.2);
    this.body.add(this.weapon);
    const spear = look.loadout === "spear";
    this.bladeBase.position.z = spear ? 1.08 : 0.12;
    this.bladeTip.position.z = spear ? 1.36 : 0.8;
    this.weapon.add(this.bladeBase, this.bladeTip);
    characterAssets.then((gltf) => { if (!this.disposed) this.build(gltf.scene); });
  }

  dispose() { this.disposed = true; }

  private build(source: THREE.Object3D) {
    const clone = SkeletonUtils.clone(source);
    const rig = clone.getObjectByName("RIG") ?? clone;
    const keep = new Set<string>([`char_${this.look.character}`]);
    const equip: Record<string, THREE.Object3D> = {};
    for (const child of [...clone.children, ...rig.children]) {
      const n = child.name;
      if (n.startsWith("char_") && !keep.has(n)) child.removeFromParent();
      if (/^(sword|spear|shield_)/.test(n)) { equip[n] = child; child.removeFromParent(); }
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
    this.footRestY = Math.min(this.boneY("foot_L"), this.boneY("foot_R"));

    // Ase oikeaan käteen: pidikkeen asento = virtuaalinen käsikehys (terä +z).
    const hand = this.bones.get("hand_R")!;
    this.weapon.removeFromParent();
    hand.bone.add(this.weapon);
    const cInv = hand.canon.clone().invert();
    this.weapon.quaternion.copy(cInv).multiply(qA.setFromEuler(eul.set(0, HAND_TWIST, 0)));
    this.weapon.position.copy(vTmp.set(GRIP.x, GRIP.y, GRIP.z).applyQuaternion(cInv));
    const weaponModel = equip[this.look.loadout === "spear" ? "spear" : "sword"];
    if (weaponModel) {
      weaponModel.position.set(0, 0, 0);
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
        holder.position.copy(vTmp.set(0.0, -0.36, 0.0).applyQuaternion(aInv));
        shield.position.set(0, 0, 0);
        holder.add(shield);
        arm.bone.add(holder);
      }
    }
    this.apply(0);
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

  private apply(moveAmp: number) {
    if (!this.rig) return;
    const p = this.pose;
    const S = new THREE.Quaternion().setFromEuler(eul.set(p.spinePitch, p.spineYaw, 0));
    const H = new THREE.Quaternion().setFromEuler(eul.set(p.headPitch, -p.spineYaw * 0.5, 0));
    const half = new THREE.Quaternion().slerpQuaternions(IDENT, S, 0.5);
    this.setBone("hips", IDENT);
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

    // Kävely: reidet heiluvat vastakkain, polvet koukistuvat.
    const s = Math.sin(this.walkPhase);
    const leg = (side: "L" | "R", thighRot: number, kneeRot: number) => {
      const th = new THREE.Quaternion().setFromEuler(eul.set(thighRot, 0, 0));
      this.setBone(`thigh_${side}`, th);
      const sh = th.clone().multiply(qA.setFromEuler(eul.set(kneeRot, 0, 0)));
      this.setBone(`shin_${side}`, sh);
      this.setBone(`foot_${side}`, qA.slerpQuaternions(sh, IDENT, 0.7));
    };
    // Haara-asento sulautuu pois kävellessä, jotta askel ei jää toispuoleiseksi.
    const st = p.stride * (1 - moveAmp * 0.6);
    const sf = Math.max(0, st), sb = Math.max(0, -st);
    leg("L", -s * moveAmp - p.crouch * 1.2 - st, Math.max(0, s) * moveAmp * 1.4 + p.crouch * 2 + sf * 0.35 + sb * 0.6);
    leg("R", s * moveAmp - p.crouch * 1.2 + st, Math.max(0, -s) * moveAmp * 1.4 + p.crouch * 2 + sb * 0.35 + sf * 0.6);

    // Lantio seuraa jalkoja: alempi jalka pysyy maassa kyykyssä ja askeleessa.
    const hips = this.bones.get("hips")!.bone;
    hips.position.copy(this.hipsRest);
    this.rig.position.y = 0;
    this.rig.updateMatrixWorld(true);
    const low = Math.min(this.boneY("foot_L"), this.boneY("foot_R"));
    this.rig.position.y = this.footRestY - low - this.sink;
  }

  /** Liu'uttaa asentoa kohti kohdeasentoa. rate = kuinka nopeasti (1/s). */
  animate(target: Pose, rate: number, dt: number, moveSpeed: number) {
    const k = 1 - Math.exp(-rate * dt);
    // Kilpikäsi: kilpi pysyy vartalon edessä ja nousee torjunnassa eteen, ei pään päälle.
    const over = this.look.loadout === "sword_shield"
      ? (target === POSES.block ? SHIELD_BLOCK : SHIELD_ARM.has(target) ? SHIELD_GUARD : null)
      : this.look.loadout === "spear" ? SPEAR.get(target) ?? null : null;
    for (const key of KEYS) {
      const goal = over && key in over ? over[key as keyof typeof over]! : target[key];
      this.pose[key] += (goal - this.pose[key]) * k;
    }
    this.walkPhase += dt * moveSpeed * 3.2;
    // Kaatuminen selälleen.
    this.body.rotation.x = -this.fall * (Math.PI / 2) * 0.95;
    this.body.position.y = this.fall * 0.15;
    this.apply(Math.min(1, moveSpeed / 3) * 0.6);
  }

  setGlow(amount: number) {
    for (const m of this.bladeMats) m.emissive.setRGB(amount * 1.0, amount * 0.6, amount * 0.15);
  }
}

// Kilpikäden asennot (vasen käsi): kyynärvarsi vaakasuoraan eteen, jolloin kilpi on pystyssä.
const SHIELD_GUARD: Partial<Pose> = { lShX: -0.35, lShZ: 0.42, lEl: -1.2 };
const SHIELD_BLOCK: Partial<Pose> = { lShX: -0.95, lShZ: 0.18, lEl: -0.75, rShX: -0.5, rShZ: -0.35, rEl: -1.2, rHandX: 0.9, rHandY: 0 };
const SHIELD_ARM = new Set<Pose>([POSES.guard, POSES.windup, POSES.strike, POSES.heavyWindup, POSES.heavyStrike]);

// Keihäs: kärki eteen vaakatasossa (olkapään, kyynärpään ja ranteen kulmien summa noin nolla),
// takakäsi lantion vieressä ja etukäsi varrella. Isku on pisto, ei lyönti.
const SPEAR = new Map<Pose, Partial<Pose>>([
  [POSES.guard, { spineYaw: -0.45, rShX: 0.35, rShZ: -0.15, rEl: -1.3, rHandX: 0.95, rHandY: 0, lShX: -0.85, lShZ: -0.3, lEl: -0.55 }],
  [POSES.windup, { spineYaw: -0.8, rShX: 0.85, rShZ: -0.2, rEl: -1.7, rHandX: 0.85, rHandY: 0, lShX: -0.6, lShZ: -0.35, lEl: -0.9 }],
  [POSES.strike, { stride: 0.55, crouch: 0.22, spineYaw: 0.35, spinePitch: 0.3, rShX: -1.15, rShZ: 0.1, rEl: -0.2, rHandX: 1.35, rHandY: 0, lShX: -1.2, lShZ: -0.2, lEl: -0.25 }],
  [POSES.block, { spineYaw: -0.2, rShX: -0.3, rShZ: -0.3, rEl: -1.5, rHandX: 0.6, rHandY: 1.2, lShX: -1.3, lShZ: 0.2, lEl: -0.9 }],
]);

// Aseen paikka kädessä virtuaalisessa käsikehyksessä (käsi suorana alas: y alas rannetta pitkin).
const GRIP = { x: 0, y: -0.085, z: 0.0 };
const HAND_TWIST = 0;

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
