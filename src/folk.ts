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
  /** Tunniste, jolla hahmo voidaan poistaa kesken kohtauksen (`vanishVillager`). */
  id?: string;
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
const villagers = new Map<string, Villager>();
/** Kesto, jonka kuluessa poistuva hahmo pienenee ja vaipuu maahan (s). */
const VANISH_SECONDS = 2.2;

/**
 * Kevyen kyläläishahmon ajonaikainen toiminta. Tämä ei tee hahmosta taistelijaa eikä anna
 * sille elämää tai tekoälyä: kohtaaminen päättää, milloin toiminta vaihtuu. Uusia Louhen
 * kykyjä voidaan myöhemmin lisätä tähän rajapintaan ilman Fighter/Actor-kytkentää.
 */
export type VillagerAction = "idle" | "sing" | "hit";

/** Vaihtaa tunnisteellisen kyläläisen toiminnan. `hit` on lyhyt säpsähdys, joka palaa edelliseen toimintaan. */
export function setVillagerAction(id: string, action: VillagerAction): boolean {
  const villager = villagers.get(id);
  if (!villager || villager.vanishing) return false;
  villager.setAction(action);
  return true;
}

/** Nykyinen toiminta kohtaamisen tarkistuksia ja debuggausta varten. */
export function villagerAction(id: string): VillagerAction | null {
  return villagers.get(id)?.currentAction ?? null;
}

/** Hahmon juuren sijainti maailmassa. Palautettu vektori on kopio eikä sillä voi siirtää hahmoa. */
export function villagerPosition(id: string, out = new THREE.Vector3()): THREE.Vector3 | null {
  const villager = villagers.get(id);
  return villager ? villager.root.getWorldPosition(out) : null;
}

/** Hahmo vaipuu näkyvistä hitaasti ja poistuu sitten kokonaan. Palauttaa false, jos tunnistetta ei ole. */
export function vanishVillager(id: string, instant = false): boolean {
  const v = villagers.get(id);
  if (!v || v.vanishing) return false;
  if (instant) { v.onGone?.(); return true; }      // heti pois (esim. maassa makaava hahmo vaihtuu seisovaan)
  v.startVanish();
  return true;
}

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
  private action: VillagerAction = "idle";
  private actionBeforeHit: Exclude<VillagerAction, "hit"> = "idle";
  private actionTime = 0;
  private actionBones = new Map<string, THREE.Object3D>();
  private idleArms = new Map<string, THREE.Quaternion>();
  private singArms = new Map<string, THREE.Quaternion>();
  private hitArms = new Map<string, THREE.Quaternion>();
  vanishing = false;
  private vanishT = 0;
  private baseScale = 1;
  private baseY = 0;
  onGone: (() => void) | null = null;

  get currentAction(): VillagerAction { return this.action; }

  setAction(action: VillagerAction) {
    if (this.def.lying) return;
    if (action === "hit") {
      if (this.action !== "hit") this.actionBeforeHit = this.action;
    } else this.actionBeforeHit = action;
    this.action = action;
    this.actionTime = 0;
  }

  startVanish() {
    this.vanishing = true;
    this.vanishT = 0;
    this.baseScale = this.root.scale.x;
    this.baseY = this.root.position.y;
  }

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
    if (!def.lying) this.buildActionPoses(rig);

    this.root.position.set(def.x, def.y, def.z);
    this.root.rotation.y = def.yaw;
    this.root.scale.setScalar(def.scale ?? 1);
  }

  /**
   * Tekee käsien tavoiteasennot nykyisestä lepoasennosta samalla luuohjauksella kuin hahmon
   * alkuasento. Tavoitteet ovat paikallisia kvaternioita, joten niitä kohti voidaan liukua
   * pehmeästi joka ruudulla. Malliin ei tarvita leivottuja animaatioleikkeitä.
   */
  private buildActionPoses(rig: THREE.Object3D) {
    const names = ["upper_arm_L", "forearm_L", "upper_arm_R", "forearm_R"] as const;
    for (const name of names) {
      const bone = rig.getObjectByName(name);
      if (!bone) continue;
      this.actionBones.set(name, bone);
      this.idleArms.set(name, bone.quaternion.clone());
    }
    const capture = (target: Map<string, THREE.Quaternion>, upper: Dir, fore: Dir) => {
      for (const side of ["L", "R"] as const) {
        const up = this.actionBones.get(`upper_arm_${side}`);
        const fo = this.actionBones.get(`forearm_${side}`);
        if (!up || !fo) continue;
        const out = Math.sign(up.getWorldPosition(v1).x) || 1;
        aimBone(up, new THREE.Vector3(upper[0] * out, upper[1], upper[2]));
        aimBone(fo, new THREE.Vector3(fore[0] * out, fore[1], fore[2]));
      }
      for (const [name, bone] of this.actionBones) target.set(name, bone.quaternion.clone());
      for (const [name, rest] of this.idleArms) this.actionBones.get(name)?.quaternion.copy(rest);
      rig.updateMatrixWorld(true);
    };
    // Pelaajan lauluasennon tapaan kädet leviävät sivuille ja hieman ylöspäin.
    capture(this.singArms, [0.96, 0.16, 0.08], [0.98, 0.08, 0.12]);
    // Osuma ei vahingoita kyläläistä: ylävartalo ja kädet vain väistävät lyhyesti taakse.
    capture(this.hitArms, [0.35, -0.72, -0.5], [0.38, -0.42, -0.62]);
  }

  private updateAction(dt: number, focus: THREE.Vector3 | null) {
    this.actionTime += dt;
    if (this.action === "hit" && this.actionTime >= 0.42) {
      this.action = this.actionBeforeHit;
      this.actionTime = 0;
    }
    const targetArms = this.action === "sing" ? this.singArms : this.action === "hit" ? this.hitArms : this.idleArms;
    const rate = this.action === "hit" ? 18 : this.action === "sing" ? 5.5 : 7;
    const blend = 1 - Math.exp(-rate * dt);
    for (const [name, target] of targetArms) this.actionBones.get(name)?.quaternion.slerp(target, blend);

    if (this.action === "idle") {
      // Katse seuraa kulkijaa vain levossa. Laulaessa Louhi pitää pään ylhäällä eikä seuraa pelaajaa.
      let want = 0;
      if (focus) {
        const dx = focus.x - this.root.position.x, dz = focus.z - this.root.position.z;
        const d = Math.hypot(dx, dz);
        let a = Math.atan2(dx, dz) - this.root.rotation.y;
        a = Math.atan2(Math.sin(a), Math.cos(a));
        if (d < 7 && d > 0.6 && Math.abs(a) < 1.9) want = THREE.MathUtils.clamp(a, -1.0, 1.0);
      }
      this.look += (want - this.look) * Math.min(1, dt * 2.2);
      if (this.head) {
        const sway = Math.sin(this.t * 0.37) * 0.05;
        q1.setFromAxisAngle(UP, this.look * 0.85 + sway);
        const target = q2.copy(this.headParent).invert().multiply(q1).multiply(this.headParent).multiply(this.headRest);
        this.head.quaternion.slerp(target, blend);
      }
      if (this.spine) {
        q1.setFromAxisAngle(v1.set(1, 0, 0), Math.sin(this.t * 1.25) * 0.012);
        this.spine.quaternion.slerp(q2.copy(this.spineRest).multiply(q1), blend);
      }
      return;
    }

    this.look += (0 - this.look) * Math.min(1, dt * 4);
    if (this.spine) {
      const pitch = this.action === "sing" ? -0.12 : 0.22;
      q1.setFromAxisAngle(v1.set(1, 0, 0), pitch);
      this.spine.quaternion.slerp(q2.copy(this.spineRest).multiply(q1), blend);
    }
    if (this.head) {
      const pitch = this.action === "sing" ? -0.28 : 0.18;
      q1.setFromAxisAngle(v1.set(1, 0, 0), pitch);
      const target = q2.copy(this.headRest).multiply(q1);
      if (this.action === "hit") target.multiply(q1.setFromAxisAngle(v1.set(0, 0, 1), 0.18));
      this.head.quaternion.slerp(target, blend);
    }
  }

  update(dt: number, focus: THREE.Vector3 | null) {
    if (this.vanishing) {
      // Louhi vaipuu uneen: hahmo pienenee ja painuu maahan, kunnes se poistuu.
      this.vanishT += dt;
      const k = Math.min(1, this.vanishT / VANISH_SECONDS);
      const ease = k * k;
      this.root.scale.setScalar(Math.max(0.001, this.baseScale * (1 - ease)));
      this.root.position.y = this.baseY - ease * 0.5;
      if (k >= 1) this.onGone?.();
      return;
    }
    if (this.def.lying) return;        // kuollut ei hengitä eikä katso
    this.t += dt;
    this.updateAction(dt, focus);
  }
}

/** Tuo kyläläisen näkymään, kun malli on ladattu. */
export function spawnVillager(scene: THREE.Scene, def: VillagerDef): Promise<void> {
  return load(def.url).then((gltf) => {
    const v = new Villager(def, gltf.scene);
    scene.add(v.root);
    living.push(v);
    if (def.id) {
      villagers.set(def.id, v);
      v.onGone = () => {
        v.root.removeFromParent();
        const i = living.indexOf(v);
        if (i >= 0) living.splice(i, 1);
        villagers.delete(def.id!);
      };
    }
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
    const source = def.node ? gltf.scene.getObjectByName(def.node) : gltf.scene;
    if (!source) { console.warn("Eläin puuttuu:", def.node); return; }
    // Ladattu GLB on jaettu (välimuisti): jokainen eläin saa oman kopionsa, jotta samasta
    // tiedostosta voi olla pihalla useita (esim. 2–4 animoitua kanaa).
    const model = SkeletonUtils.clone(source);
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
