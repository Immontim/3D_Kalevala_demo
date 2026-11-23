// Villisiat metsästyskohtauksessa: malli ja animaatiot (assets/animals/villisika.glb), arvonta 0–2 sikaa,
// rynnäkön osuma sankariin, sankarin iskut ja nuolet sikaan, verijälki ja ruhon poiminta. Käyttäytyminen
// on puhtaassa moduulissa src/hunt/boar.ts; tämä tiedosto kytkee sen 3D-maailmaan.
import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import boarUrl from "../../assets/animals/villisika.glb?url";
import { codeLabel } from "../bindings";
import { angleBetween, damageAfterArmour, hitStaggers, inStrikeZone } from "../combat";
import { loadGltf } from "../folk";
import type { ArrowBody, Vec3 } from "../hunt/archery";
import {
  BOAR, type Boar, type BoarEvent, type BoarSound, WOUNDED_ENGAGE_RANGE, arrowDamage, boarCount, boarDangerous,
  boarHitSpheres, boarMeatToTake, boarWounded, damageBoar, meleeBoarDamage, spawnBoar, updateBoar,
} from "../hunt/boar";
import { t } from "../i18n";
import { ITEMS, tryAddItem } from "../map/campaign";
import { clampToWalkable, sceneLayout, walkableDepth } from "../sceneLayout";
import { ARENA, SPAWN, groundHeight } from "../world";
import { type Actor, setState } from "./actor";
import { emitBlood } from "./effects";
import { flash, showMsg } from "./hud";
import { bindings } from "./input";
import { killActor, setCreatureStrike } from "./melee";
import type { Pickable } from "./sceneItems";
import { interruptSong, songState } from "./song";
import { fx, g, sfx } from "./state";
import { campaignStore } from "./store";
import { scene, world } from "./view";

/** Sikoja ei arvota näin lähelle saapumispaikkaa (m), ja kahden sian väli on vähintään tämä. */
const BOAR_AVOID_SPAWN = 45;
const BOAR_MIN_GAP = 25;
const BOAR_EDGE_MARGIN = 10;
const BOAR_AREA = 80;
/** Piirtoetäisyys (m): sumussa iso eläin erottuu kauempaa kuin jänis. */
const BOAR_DRAW_RANGE = 95;
/** Juoksuleikkeen oma nopeus (m/s, boar.py) ja kävelyleikkeen nopeus. */
const RUN_CLIP_SPEED = 6.5;
const WALK_CLIP_SPEED = 1.2;
/** Rynnäkön osuma työntää sankaria (m) ja horjuttaa koko horjahduksen ajan. */
const CHARGE_PUSH = 1.4;
/** Verijäljen tippojen enimmäismäärä (vanhimmat korvautuvat). */
const BLOOD_MAX = 400;
const BLOOD_LIFT = 0.07;

interface BoarView {
  boar: Boar;
  root: THREE.Group;
  model: THREE.Object3D | null;
  mixer: THREE.AnimationMixer | null;
  actions: Map<string, THREE.AnimationAction>;
  clip: string;
  /** Kertaleike (attack, hit) kesken: sekunteja jäljellä. */
  oneShot: number;
  yawVis: number;
}

const views: BoarView[] = [];
const layout = sceneLayout(ARENA);
let threatHintShown = false;
let bowWasOut = false;
let blood: THREE.InstancedMesh | null = null;
let bloodNext = 0;
let bloodCount = 0;
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
const FLAT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
const UP = new THREE.Vector3(0, 1, 0);

/** Arpoo apajan siat (0–2) ja aloittaa mallin latauksen. Kutsutaan initHunt-vaiheessa. */
export function initBoars(rng: () => number = Math.random) {
  setCreatureStrike(heroStrikesBoar);
  ensureBlood();
  const n = boarCount(rng());
  for (let i = 0; i < n; i++) {
    const spot = pickSpot(rng);
    if (spot) addBoar(spot.x, spot.z, rng() * Math.PI * 2);
  }
}

function pickSpot(rng: () => number): { x: number; z: number } | null {
  for (let tries = 0; tries < 200; tries++) {
    const x = (rng() * 2 - 1) * BOAR_AREA, z = (rng() * 2 - 1) * BOAR_AREA;
    if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < BOAR_AVOID_SPAWN) continue;
    if (walkableDepth(layout, x, z) < BOAR_EDGE_MARGIN) continue;
    if (views.some((v) => Math.hypot(v.boar.x - x, v.boar.z - z) < BOAR_MIN_GAP)) continue;
    const free = world.collision.depenetrateDisc(x, z, BOAR.radius + 0.2);
    if (Math.hypot(free.x - x, free.z - z) > 0.05) continue;
    return { x, z };
  }
  return null;
}

/** Lisää sian kohtaukseen (myös savutestit, `__game.spawnBoar`). */
export function addBoar(x: number, z: number, yaw = 0): Boar {
  const boar = spawnBoar(`boar-${views.length + 1}`, x, z, yaw);
  const root = new THREE.Group();
  root.name = "hunt_boar";
  // Kallistus (rotation.x) sian omassa kehyksessä: ensin suunta, sitten nyökkäys.
  root.rotation.order = "YXZ";
  scene.add(root);
  const view: BoarView = { boar, root, model: null, mixer: null, actions: new Map(), clip: "", oneShot: 0, yawVis: yaw };
  views.push(view);
  loadGltf(boarUrl).then((gltf) => {
    const model = SkeletonUtils.clone(gltf.scene);
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // Luurangon liikuttama verkko: rajauslaatikko ei seuraa asentoa.
      mesh.frustumCulled = false;
    });
    root.add(model);
    view.model = model;
    view.mixer = new THREE.AnimationMixer(model);
    for (const clip of gltf.animations) view.actions.set(clip.name, view.mixer.clipAction(clip));
    play(view, boar.state === "dead" ? "death" : "idle", 0, boar.state !== "dead");
  }).catch((err) => console.warn("Villisian malli ei latautunut:", err));
  return boar;
}

function play(v: BoarView, name: string, fade = 0.25, loop = true, timeScale = 1): boolean {
  const a = v.actions.get(name);
  if (!a) return false;
  a.timeScale = timeScale;
  if (v.clip === name) return true;
  const prev = v.actions.get(v.clip);
  a.reset();
  a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
  a.clampWhenFinished = !loop;
  a.setEffectiveWeight(1);
  if (fade > 0) a.fadeIn(fade);
  a.play();
  if (prev && prev !== a) { if (fade > 0) prev.fadeOut(fade); else prev.stop(); }
  v.clip = name;
  return true;
}

function ensureBlood() {
  if (blood) return;
  const geo = new THREE.CircleGeometry(0.1, 7);
  // Kirkas, kostea punainen ja hieman omaa valoa, jotta jälki erottuu varvikossa ja varjossa.
  const mat = new THREE.MeshStandardMaterial({
    color: 0x6e0f09, emissive: 0x240302, roughness: 0.35, polygonOffset: true, polygonOffsetFactor: -4,
  });
  blood = new THREE.InstancedMesh(geo, mat, BLOOD_MAX);
  blood.count = 0;
  blood.frustumCulled = false;
  blood.receiveShadow = true;
  blood.name = "hunt_blood";
  scene.add(blood);
}

/** Veritippa maahan (verijälki). Useampi tippa ryppäänä, jotta jälki erottuu maastosta. */
export function dropBlood(x: number, z: number, amount = 1) {
  if (!blood) return;
  const n = Math.max(1, Math.round(3 * amount));
  for (let i = 0; i < n; i++) {
    const px = x + (Math.random() - 0.5) * 0.5, pz = z + (Math.random() - 0.5) * 0.5;
    const s = (0.6 + Math.random() * 0.9) * (0.7 + 0.3 * amount);
    q.copy(FLAT).premultiply(new THREE.Quaternion().setFromAxisAngle(UP, Math.random() * Math.PI));
    // Maastoverkko on laskettua pintaa harvempi: tippa nostetaan hieman, ettei se jää verkon alle.
    m4.compose(pos.set(px, groundHeight(px, pz) + BLOOD_LIFT, pz), q, sc.set(s, s * (0.6 + Math.random() * 0.5), 1));
    blood.setMatrixAt(bloodNext, m4);
    bloodNext = (bloodNext + 1) % BLOOD_MAX;
    bloodCount = Math.min(BLOOD_MAX, bloodCount + 1);
  }
  blood.count = bloodCount;
  blood.instanceMatrix.needsUpdate = true;
}

/** Rynnäkkö osuu sankariin: vahinko panssarin läpi, työntö ja horjahdus. */
function chargeHitsHero(dirX: number, dirZ: number) {
  const p = g.player;
  if (p.state === "dead") return;
  const dmg = damageAfterArmour(BOAR.damage * p.stats.damageTaken, p.armour.ringMail, p.armour.greaves);
  p.hp -= dmg;
  const contact = p.pos.clone().setY(groundHeight(p.pos.x, p.pos.z) + 0.8);
  emitBlood(contact, 22, 2.6);
  sfx.hit();
  sfx.boarGrunt(1);
  fx.hitstop = Math.max(fx.hitstop, 0.09);
  fx.shake = Math.max(fx.shake, 0.3);
  flash("#b33a2e", 0.4);
  g.events.push(`villisika:rynnäkkö:osui:${dmg.toFixed(1)}`);
  if (g.events.length > 30) g.events.shift();
  if (songState) interruptSong();
  if (p.hp <= 0) { p.hp = 0; killActor(p, false); return; }
  if (hitStaggers("bash", "hit", p.state, g.gameTime, p.staggerFreeUntil)) setState(p, "stagger");
  p.bashPushDir.set(dirX, 0, dirZ).normalize();
  p.bashPushLeft = Math.max(p.bashPushLeft, CHARGE_PUSH);
  showMsg(t("hunt.boarHit"), "", 0.9);
}

/** Sankarin isku osuu sikaan, jos sika on iskun kaaressa (melee.ts kutsuu). */
function heroStrikesBoar(att: Actor): boolean {
  let best: { v: BoarView; d: number; point: THREE.Vector3 } | null = null;
  for (const v of views) {
    const b = v.boar;
    if (b.state === "dead") continue;
    for (const s of boarHitSpheres(b, groundHeight(b.x, b.z))) {
      const dx = s.x - att.stepFrom.x, dz = s.z - att.stepFrom.z;
      const distance = Math.max(0, Math.hypot(dx, dz) - s.r * 0.7);
      const angleToDefender = angleBetween(att.yaw, Math.atan2(s.x - att.pos.x, s.z - att.pos.z));
      if (!inStrikeZone({ distance, angleToDefender }, att.attack)) continue;
      // Puu tai kivi välissä: isku osuu esteeseen, ei sikaan.
      if (world.collision.firstMeleeHit(att.pos.x, att.pos.z, s.x, s.z)) continue;
      if (!best || distance < best.d) best = { v, d: distance, point: new THREE.Vector3(s.x, s.y, s.z) };
    }
  }
  if (!best) return false;
  const heavy = att.attack.weight === "heavy";
  const dmg = meleeBoarDamage(att.weapon.id, heavy, att.attack.kind === "bash");
  const result = damageBoar(best.v.boar, dmg, { x: att.pos.x, z: att.pos.z });
  emitBlood(best.point, heavy ? 28 : 18, 2.6);
  dropBlood(best.v.boar.x, best.v.boar.z, 1.5);
  sfx.hit();
  fx.hitstop = Math.max(fx.hitstop, heavy ? 0.1 : 0.07);
  fx.shake = Math.max(fx.shake, heavy ? 0.2 : 0.14);
  g.events.push(`pelaaja:${att.attack.kind}/${att.attack.weight}:villisika:${result}`);
  if (g.events.length > 30) g.events.shift();
  afterHurt(best.v, result);
  return true;
}

/** Osumapallot nuolille ja tähtäykselle; tunniste "sian-id#pallo". */
export function boarBodies(includeDead = true): ArrowBody[] {
  const out: ArrowBody[] = [];
  for (const v of views) {
    const b = v.boar;
    if (!includeDead && b.state === "dead") continue;
    boarHitSpheres(b, groundHeight(b.x, b.z)).forEach((s, i) => out.push({ id: `${b.id}#${i}`, x: s.x, y: s.y, z: s.z, radius: s.r }));
  }
  return out;
}

export function isBoarBody(id: string | undefined): boolean { return !!id && id.startsWith("boar-") && id.includes("#"); }

/** Sian juurisolmu nuolen kiinnitystä varten. */
export function boarRoot(bodyId: string): { id: string; root: THREE.Object3D } | null {
  const v = views.find((x) => bodyId.startsWith(`${x.boar.id}#`));
  return v ? { id: v.boar.id, root: v.root } : null;
}

/** Nuoli osui sikaan: palauttaa "dead", "hurt" tai "none". */
export function boarArrowHit(bodyId: string, draw: number, at: Vec3, from: { x: number; z: number }): "dead" | "hurt" | "none" {
  const v = views.find((x) => bodyId.startsWith(`${x.boar.id}#`));
  if (!v) return "none";
  const result = damageBoar(v.boar, arrowDamage(draw), from);
  emitBlood(new THREE.Vector3(at.x, at.y, at.z), 14, 2);
  dropBlood(v.boar.x, v.boar.z, 1);
  afterHurt(v, result);
  return result;
}

function afterHurt(v: BoarView, result: "dead" | "hurt" | "none") {
  if (result === "none") return;
  sfx.boarSqueal();
  if (result === "dead") {
    play(v, "death", 0.15, false);
    showMsg(t("hunt.killed", { animal: t(BOAR.nameKey) }), t("hunt.killedSub"), 2.6);
    return;
  }
  if (v.boar.state === "flinch" && play(v, "hit", 0.08, false, 1)) v.oneShot = 0.4;
}

/** Päivitys joka ruudulla. Palauttaa, onko jokin sika vaarallinen (asettaa `g.danger`). */
export function updateBoars(dt: number, sounds: readonly BoarSound[], bowOut: boolean) {
  bowWasOut = bowOut;
  const p = g.player;
  const hero = { x: p.pos.x, z: p.pos.z, alive: p.state !== "dead", hittable: p.state !== "dodge" && p.state !== "dead" };
  const env = {
    rng: Math.random,
    move: (x: number, z: number, dx: number, dz: number, radius: number) => {
      const m = world.collision.moveDisc(x, z, dx, dz, radius, "slide");
      return clampToWalkable(layout, m.x, m.z, radius);
    },
  };
  let danger = false;
  for (const v of views) {
    const b = v.boar;
    const events = updateBoar(b, dt, hero, sounds, env);
    for (const e of events) handleEvent(v, e);
    if (boarDangerous(b)) danger = true;
    // Haavoittunut sika lähellä: sankari pysyy taisteluvalmiina, jotta sen voi lopettaa aseella.
    else if (boarWounded(b) && Math.hypot(b.x - p.pos.x, b.z - p.pos.z) < WOUNDED_ENGAGE_RANGE) danger = true;
    animate(v, dt);
  }
  g.danger = danger && p.state !== "dead";
}

function handleEvent(v: BoarView, e: BoarEvent) {
  const b = v.boar, p = g.player;
  const near = Math.hypot(b.x - p.pos.x, b.z - p.pos.z);
  switch (e.kind) {
    case "noticed": if (near < 35) sfx.boarGrunt(0.3); break;
    case "threat": {
      sfx.boarGrunt(1);
      if (!threatHintShown) {
        threatHintShown = true;
        // Jousi esillä: X vaihtaa aseeseen. Ilman jousta ase on jo kädessä: neuvotaan väistämään ja iskemään.
        const key = bindings.bow.find((c) => c) ?? "";
        showMsg(t("hunt.boarThreat"), bowWasOut ? t("hunt.boarThreatSub", { key: key ? codeLabel(key) : "—" }) : t("hunt.boarThreatArmed"), 3);
      }
      g.events.push(`villisika:varoittaa:${b.id}`);
      break;
    }
    case "charge": sfx.boarGrunt(0.8); g.events.push(`villisika:ryntää:${b.id}`); break;
    case "contact":
      if (play(v, "attack", 0.08, false, 1.6)) v.oneShot = 0.5;
      chargeHitsHero(e.dirX, e.dirZ);
      break;
    case "rammed":
      sfx.arrowImpact(true);
      if (near < 20) fx.shake = Math.max(fx.shake, 0.08);
      g.events.push(`villisika:törmäsi:${b.id}`);
      break;
    case "flee": g.events.push(`villisika:pakenee:${b.id}`); break;
    case "blood": dropBlood(e.x, e.z, 0.8); break;
  }
  if (g.events.length > 30) g.events.shift();
}

function animate(v: BoarView, dt: number) {
  const b = v.boar;
  const hero = g.player.pos;
  v.root.visible = Math.hypot(b.x - hero.x, b.z - hero.z) < BOAR_DRAW_RANGE;
  v.root.position.set(b.x, groundHeight(b.x, b.z), b.z);
  const dy = Math.atan2(Math.sin(b.yaw - v.yawVis), Math.cos(b.yaw - v.yawVis));
  v.yawVis += dy * (1 - Math.exp(-(b.state === "charge" ? 18 : 10) * dt));
  v.root.rotation.y = v.yawVis;
  // Varoittava sika laskee päänsä ja painuu vähän etupainoiseksi.
  const lean = b.state === "threat" ? 0.08 : 0;
  v.root.rotation.x += (lean - v.root.rotation.x) * (1 - Math.exp(-10 * dt));
  if (!v.mixer) return;
  v.mixer.update(dt);
  if (b.state === "dead") { play(v, "death", 0.15, false); return; }
  if (v.oneShot > 0) { v.oneShot -= dt; return; }
  if (b.speed > 2.2) play(v, "run", 0.2, true, Math.max(0.6, b.speed / RUN_CLIP_SPEED));
  else if (b.speed > 0.25) play(v, "walk", 0.25, true, Math.max(0.5, b.speed / WALK_CLIP_SPEED));
  else play(v, "idle", 0.3, true, b.state === "threat" ? 2.2 : b.state === "alert" ? 1.4 : 1);
}

/** Kaadettujen sikojen ruhot poimittaviksi. `returnArrows(id)` palauttaa ruhon nuolet viiniin. */
export function boarPickables(returnArrows: (preyId: string) => number, onTaken: () => void): Pickable[] {
  const out: Pickable[] = [];
  for (const v of views) {
    const b = v.boar;
    if (b.state !== "dead") continue;
    const itemId = BOAR.meat.itemId;
    const fits = (n: number) => tryAddItem(campaignStore().get().player.inventory, itemId, n) !== null;
    out.push({
      id: `hunt:${b.id}`, x: b.x, y: groundHeight(b.x, b.z) + 0.45, z: b.z, radius: 0.9,
      label: t("hunt.carcass", { animal: t(BOAR.nameKey) }),
      room: () => boarMeatToTake(b, fits) > 0,
      fullText: t("interact.inventoryFull"),
      take: () => {
        const count = boarMeatToTake(b, fits);
        if (count === 0) return false;
        const update = campaignStore().update((state) => {
          const inventory = tryAddItem(state.player.inventory, itemId, count);
          return inventory ? { ...state, player: { ...state.player, inventory } } : state;
        });
        if (!update.ok) { showMsg(t("interact.saveFailed"), "", 1.6); return false; }
        b.meat -= count;
        const back = returnArrows(b.id);
        if (b.meat <= 0) {
          v.root.removeFromParent();
          views.splice(views.indexOf(v), 1);
        }
        const item = t(ITEMS[itemId].nameKey);
        const name = count > 1 ? `${item} ×${count}` : item;
        showMsg(back ? t("hunt.gutArrows", { item: name, count: back }) : t("hunt.gutted", { item: name }), "", 1.8);
        g.events.push(`pelaaja:otti:${b.id}:${itemId}`);
        onTaken();
        return true;
      },
    });
  }
  return out;
}

/** Savutestit: vahinkoa sialle suoraan (kuin osuma sankarin suunnasta). */
export function hurtBoarDebug(id: string, amount: number): string {
  const v = views.find((x) => x.boar.id === id);
  if (!v) return "none";
  const result = damageBoar(v.boar, amount, { x: g.player.pos.x, z: g.player.pos.z });
  afterHurt(v, result);
  return result;
}

/** Savutestit. */
export function boarDebug() {
  return views.map((v) => ({
    id: v.boar.id, state: v.boar.state, hp: +v.boar.hp.toFixed(2), x: +v.boar.x.toFixed(1), z: +v.boar.z.toFixed(1),
    yaw: +v.boar.yaw.toFixed(2), speed: +v.boar.speed.toFixed(1), meat: v.boar.meat, clip: v.clip, loaded: !!v.model,
  }));
}

export function bloodDrops() { return bloodCount; }
