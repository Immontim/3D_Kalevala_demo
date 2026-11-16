// Pihan väki: paikallaan seisovat kyläläiset ja eläimet. Nämä eivät ole taistelijoita
// (Fighter/Actor), vaan kevyitä hahmoja, joilla ei ole elämää, tekoälyä eikä osumia.
// Kyläläiset asetetaan koodilla lepoasentoon ja he kääntävät päätään kulkijan perään;
// eläimet toistavat lähdemalliensa valmiita animaatioleikkeitä (AnimationMixer).
// Sijoittelu (kuka seisoo missä) on world.ts:ssä.
import * as THREE from "three";
import { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

const loader = new GLTFLoader();
const cache = new Map<string, Promise<GLTF>>();
/** Ladattu GLB jaettuna: sama tiedosto ladataan vain kerran (kyläläiset ja naissankari). */
export function loadGltf(url: string): Promise<GLTF> { return load(url); }
function load(url: string): Promise<GLTF> {
  if (!cache.has(url)) cache.set(url, loader.loadAsync(url));
  return cache.get(url)!;
}

function prepareMeshes(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;   // luurangon liikuttama verkko: rajauslaatikko ei seuraa asentoa
    const mat = m.material as THREE.MeshStandardMaterial;
    if (/^M_AN_/.test(mat.name)) { mat.metalness = 0; mat.roughness = Math.max(mat.roughness, 0.85); }
  });
}

/** Käsivarren suunta hahmon omassa koordinaatistossa: [ulos sivulle, ylös, eteen]. */
type Dir = [number, number, number];
export interface ArmPose { upper: Dir; fore: Dir; }
const ARM_DOWN: ArmPose = { upper: [0.14, -1, 0.02], fore: [0.08, -1, 0.16] };

export interface VillagerDef {
  url: string;
  /** Hahmon nimi tiedostossa ilman etuliitettä `char_`. */
  character: string;
  x: number; y: number; z: number; yaw: number;
  scale?: number;
  armL?: ArmPose; armR?: ArmPose;
  /** Makaa selällään maassa (kuollut): käsivarret asetetaan ensin pystyasennossa, sitten koko hahmo kaadetaan. Jalkaterien kohta on juuri, vartalo ulottuu juuren -z-suuntaan. */
  lying?: boolean;
  /** Kädessä pidettävä esine. Varsi kulkee pystyssä nyrkin otekanavan läpi: sauva nojaa maahan,
   *  jousi on kädessä kahvastaan. grip = kanavan piste ja suunta lepoasennossa (mallin
   *  koordinaatit, ks. docs/BLENDER_HANDOFF.md "Otekanavat"). */
  prop?: { name: string; hand: "L" | "R"; kind: "staff" | "bow"; grip: { p: Dir; d: Dir } };
}

const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), q3 = new THREE.Quaternion();
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);
/** Sormiluiden täysi avaus (rad) nyrkistä suoriksi: rystys-, keski- ja kärkinivel (Blender: FINGER_ANG). Lepoasento on nyrkki. */
export const FINGER_OPEN = [1.25, 1.5, 0.9] as const;

/** Kääntää luun niin, että sen oma akseli (oletus: luun pituussuunta) osoittaa annettuun
 *  suuntaan maailman koordinaatistossa; lapsiluut seuraavat. */
function aimBone(bone: THREE.Object3D, dir: THREE.Vector3, axis?: THREE.Vector3) {
  const pw = bone.parent!.getWorldQuaternion(q1);
  const w = bone.getWorldQuaternion(q2);
  const cur = (axis ? v1.copy(axis) : v1.set(0, 1, 0)).applyQuaternion(w).normalize();
  w.premultiply(q3.setFromUnitVectors(cur, v2.copy(dir).normalize()));
  bone.quaternion.copy(pw.invert().multiply(w));
  bone.updateMatrixWorld(true);
}

interface Living { update(dt: number, focus: THREE.Vector3 | null): void; }
const living: Living[] = [];

/** Päivittää kaikki kyläläiset ja eläimet. focus = kulkija, jota kyläläiset katsovat. */
export function updateFolk(dt: number, focus: THREE.Vector3 | null) {
  for (const l of living) l.update(dt, focus);
}

class Villager implements Living {
  readonly root = new THREE.Group();
  private head: THREE.Object3D | null = null;
  private headRest = new THREE.Quaternion();
  private headParent = new THREE.Quaternion();
  private spine: THREE.Object3D | null = null;
  private spineRest = new THREE.Quaternion();
  private look = 0;
  private t = Math.random() * 50;

  constructor(private def: VillagerDef, source: THREE.Object3D) {
    const clone = SkeletonUtils.clone(source);
    const rig = clone.getObjectByName("RIG") ?? clone;
    let prop: THREE.Object3D | null = null;
    for (const child of [...clone.children, ...rig.children]) {
      if (child.name.startsWith("char_") && child.name !== `char_${def.character}`) child.removeFromParent();
      else if (child !== rig && !(child as THREE.Bone).isBone && !child.name.startsWith("char_")) {
        if (def.prop && child.name === def.prop.name) prop = child;
        child.removeFromParent();
      }
    }
    prepareMeshes(clone);
    this.root.add(clone);
    this.root.updateMatrixWorld(true);

    // Otekanava käden luun omassa koordinaatistossa, mitattuna ennen kuin käsiä käännetään.
    const hand = def.prop ? rig.getObjectByName(`hand_${def.prop.hand}`) ?? null : null;
    const gripP = new THREE.Vector3(), gripD = new THREE.Vector3();
    if (hand && def.prop) {
      hand.worldToLocal(gripP.set(...def.prop.grip.p));
      gripD.set(...def.prop.grip.d).normalize().applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion()).invert());
    }

    // Kädet levällään olevasta lepoasennosta alas tai esineen pitoon. Juuri on vielä origossa
    // kääntämättä, joten maailman suunnat ovat hahmon omia suuntia.
    for (const side of ["L", "R"] as const) {
      const upper = rig.getObjectByName(`upper_arm_${side}`);
      const fore = rig.getObjectByName(`forearm_${side}`);
      if (!upper || !fore) continue;
      const out = Math.sign(upper.getWorldPosition(v1).x) || 1;
      const pose = (side === "L" ? def.armL : def.armR) ?? ARM_DOWN;
      aimBone(upper, new THREE.Vector3(pose.upper[0] * out, pose.upper[1], pose.upper[2]));
      aimBone(fore, new THREE.Vector3(pose.fore[0] * out, pose.fore[1], pose.fore[2]));
    }

    // Sormet: nyrkki on lepoasento. Vapaa käsi on rennosti auki, esinettä pitävä käsi pysyy nyrkissä.
    for (const side of ["L", "R"] as const) {
      if (def.prop?.hand === side) continue;
      [1, 2, 3].forEach((i) => {
        const f = rig.getObjectByName(`finger${i}_${side}`);
        if (f) f.quaternion.multiply(q1.setFromAxisAngle(AXIS_Z, FINGER_OPEN[i - 1] * 0.7));
      });
    }

    if (prop && def.lying) {
      // Pudonnut sauva makaa maassa vartalon vieressä, varsi hahmon pituussuunnassa (-z).
      prop.position.set(0, 0, 0);
      prop.scale.setScalar(1);
      prop.quaternion.identity();
      prepareMeshes(prop);
      this.root.add(prop);
      this.root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(prop);
      prop.position.set(0.8, 0.02 - box.min.y, -0.55);
      prop.rotation.y = 0.14;
    } else if (prop && def.prop && hand) {
      // Ranne käännetään niin, että nyrkin kanava on pystyssä (lähempään pystysuuntaan, ettei
      // ranne kierry ympäri); varsi asetetaan kanavan kohdalle.
      const up = gripD.clone().applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion())).y >= 0 ? 1 : -1;
      aimBone(hand, new THREE.Vector3(0, up, 0), gripD);
      const h = hand.localToWorld(gripP.clone());
      const out = Math.sign(h.x) || 1;
      prop.position.set(0, 0, 0);
      prop.scale.setScalar(1);
      if (def.prop.kind === "staff") {
        // Sauvan varsi on mallissa +z-suuntaan ja linnun nokka +y: pystyyn, nokka eteen.
        prop.quaternion.setFromAxisAngle(UP, Math.PI).multiply(q1.setFromAxisAngle(v1.set(1, 0, 0), -Math.PI / 2));
      } else {
        // Jousen lavat ovat pystyssä ja jänne -z: jänne käännetään vartaloon päin.
        prop.quaternion.setFromAxisAngle(UP, out > 0 ? Math.PI / 2 : -Math.PI / 2);
      }
      prop.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(prop);
      // Sauva seisoo maassa ja käsi on varrella siinä, mihin se osuu; jousi on kädessä kahvastaan.
      prop.position.set(h.x, def.prop.kind === "staff" ? -box.min.y + 0.01 : h.y, h.z);
      prepareMeshes(prop);
      this.root.add(prop);
      this.root.updateMatrixWorld(true);
      hand.attach(prop);      // seuraa kättä (hengitys)
    }

    if (def.lying) {
      // Selälleen: -90° x-akselin ympäri (pää -z-suuntaan, etupuoli ylös). Selän paksuus (viitta, kantele) nostaa vartaloa.
      clone.rotation.x = -Math.PI / 2;
      clone.position.y = 0.24;
      const head = rig.getObjectByName("head");
      if (head) head.rotation.z += 0.45;      // pää kääntyy sivulle
    }

    this.head = rig.getObjectByName("head") ?? null;
    if (this.head) {
      this.headRest.copy(this.head.quaternion);
      this.head.parent!.getWorldQuaternion(this.headParent);
    }
    this.spine = rig.getObjectByName("chest") ?? null;
    if (this.spine) this.spineRest.copy(this.spine.quaternion);

    this.root.position.set(def.x, def.y, def.z);
    this.root.rotation.y = def.yaw;
    this.root.scale.setScalar(def.scale ?? 1);
  }

  update(dt: number, focus: THREE.Vector3 | null) {
    if (this.def.lying) return;        // kuollut ei hengitä eikä katso
    this.t += dt;
    // Katse seuraa kulkijaa, kun tämä on lähellä ja edessä; muuten pää palaa hitaasti eteen.
    let want = 0;
    if (focus) {
      const dx = focus.x - this.def.x, dz = focus.z - this.def.z;
      const d = Math.hypot(dx, dz);
      let a = Math.atan2(dx, dz) - this.def.yaw;
      a = Math.atan2(Math.sin(a), Math.cos(a));
      if (d < 7 && d > 0.6 && Math.abs(a) < 1.9) want = THREE.MathUtils.clamp(a, -1.0, 1.0);
    }
    this.look += (want - this.look) * Math.min(1, dt * 2.2);
    if (this.head) {
      const sway = Math.sin(this.t * 0.37) * 0.05;
      q1.setFromAxisAngle(UP, this.look * 0.85 + sway);
      // Kierto hahmon pystyakselin ympäri, muunnettuna pään emoluun koordinaatistoon.
      this.head.quaternion.copy(q2.copy(this.headParent).invert()).multiply(q1).multiply(this.headParent).multiply(this.headRest);
    }
    if (this.spine) {
      // Hengitys: rintakehä kallistuu hieman.
      q1.setFromAxisAngle(v1.set(1, 0, 0), Math.sin(this.t * 1.25) * 0.012);
      this.spine.quaternion.copy(this.spineRest).multiply(q1);
    }
  }
}

/** Tuo kyläläisen näkymään, kun malli on ladattu. */
export function spawnVillager(scene: THREE.Scene, def: VillagerDef): Promise<void> {
  return load(def.url).then((gltf) => {
    const v = new Villager(def, gltf.scene);
    scene.add(v.root);
    living.push(v);
  });
}

export interface AnimalDef {
  url: string;
  /** Solmun nimi, jos tiedostossa on useita eläimiä (kukko ja kana); muuten koko tiedosto. */
  node?: string;
  x: number; y: number; z: number; yaw: number;
  scale?: number;
  /** idle = toistaa leikettä `clip` paikallaan; dog = seisoo ja istuu vuorotellen;
   *  circle = kävelee ympyrää (keskipiste x, z; säde radius). */
  behavior?: "idle" | "dog" | "circle";
  clip?: string;
  radius?: number;
  speed?: number;
  /** Maan korkeus liikkuvalle eläimelle. */
  ground?: (x: number, z: number) => number;
}

/** Koiran leikkeet kierrossa; ensimmäinen vaihto on istuminen, koska koira alkaa seisten. */
const DOG_CYCLE = ["istuu", "seisoo", "tassu", "seisoo"];

class Animal implements Living {
  readonly root = new THREE.Group();
  private mixer: THREE.AnimationMixer | null = null;
  private actions = new Map<string, THREE.AnimationAction>();
  private current = "";
  private nextSwitch = 6 + Math.random() * 8;
  private angle = Math.random() * Math.PI * 2;
  private dogStep = 0;

  constructor(private def: AnimalDef, gltf: GLTF) {
    const model = def.node ? gltf.scene.getObjectByName(def.node) : gltf.scene;
    if (!model) { console.warn("Eläin puuttuu:", def.node); return; }
    model.removeFromParent();
    prepareMeshes(model);
    this.root.add(model);
    this.root.position.set(def.x, def.y, def.z);
    this.root.rotation.y = def.yaw;
    this.root.scale.setScalar(def.scale ?? 1);
    if (gltf.animations.length && !def.node) {
      this.mixer = new THREE.AnimationMixer(model);
      for (const clip of gltf.animations) this.actions.set(clip.name, this.mixer.clipAction(clip));
      const first = def.behavior === "dog" ? "seisoo" : def.clip ?? gltf.animations[0].name;
      const a = this.actions.get(first);
      if (a) { a.play(); a.time = Math.random() * a.getClip().duration; this.current = first; }
    }
    if (def.behavior === "circle") this.walk(0);
  }

  private walk(dt: number) {
    const d = this.def, r = d.radius ?? 0.7;
    this.angle += ((d.speed ?? 0.3) / r) * dt;
    const x = d.x + Math.sin(this.angle) * r, z = d.z + Math.cos(this.angle) * r;
    this.root.position.set(x, d.ground ? d.ground(x, z) : d.y, z);
    this.root.rotation.y = this.angle + Math.PI / 2;   // kulkusuunta on ympyrän tangentti
  }

  update(dt: number) {
    this.mixer?.update(dt);
    if (this.def.behavior === "circle") this.walk(dt);
    if (this.def.behavior === "dog") {
      this.nextSwitch -= dt;
      if (this.nextSwitch <= 0) {
        // Koira vaihtaa vuorotellen asentoa: seisoo, istuu, seisoo, nostaa tassua.
        const next = DOG_CYCLE[this.dogStep++ % DOG_CYCLE.length];
        const from = this.actions.get(this.current), to = this.actions.get(next);
        if (from && to && from !== to) {
          to.reset().play();
          from.crossFadeTo(to, 0.6, false);
          this.current = next;
        }
        this.nextSwitch = next === "tassu" ? Math.max(3, (to?.getClip().duration ?? 2) * 2) : 9 + Math.random() * 9;
      }
    }
  }
}

/** Tuo eläimen näkymään, kun malli on ladattu. */
export function spawnAnimal(scene: THREE.Scene, def: AnimalDef): Promise<void> {
  return load(def.url).then((gltf) => {
    const a = new Animal(def, gltf);
    scene.add(a.root);
    living.push(a);
  });
}
