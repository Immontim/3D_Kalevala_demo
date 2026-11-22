// Metsästys 3D-kohtauksessa: jousi esiin ja pois, tähtäys ja jännitys, nuolten lento ja osumat,
// riistaeläimet (jänikset) sekä poimittavat nuolet ja saaliit. Puhdas laskenta on kansiossa src/hunt/.
import * as THREE from "three";
import { codeLabel } from "../bindings";
import { CONTROLS } from "../controls";
import { bowPose, type Pose } from "../fighter";
import {
  ARCHERY, type ArrowTraceWorld, type Vec3, drawAmount, launchSpeed, launchVelocity, newQuiver,
  returnArrow, stepArrow, takeArrow, traceSegment,
} from "../hunt/archery";
import { ARROW_LEN, buildArrow, buildBow, buildHare, type BowModel, type HareModel } from "../hunt/models";
import { SPECIES, type Prey, type Stimulus, killPrey, meatToTake, spawnPrey, updatePrey } from "../hunt/prey";
import { pickHareSpots } from "../hunt/spawns";
import { ITEMS, tryAddItem } from "../map/campaign";
import { t } from "../i18n";
import { clampToWalkable, sceneLayout, walkableDepth } from "../sceneLayout";
import { ARENA, SPAWN, WILDS_ZONES, groundHeight } from "../world";
import { $ } from "./dom";
import { heroAtPeace } from "./hero";
import { showMsg } from "./hud";
import { bindings, strikeHeld } from "./input";
import type { Pickable } from "./sceneItems";
import { DEG, aim, g, inputs, sfx } from "./state";
import { campaignStore } from "./store";
import { camera, scene, world } from "./view";

/** Kohtaukset, joissa jousi on käytössä. Alkuun vain erämaa (testikohtaus). */
export const HUNTING = ARENA === "wilds";

/** Jänikset eivät synny näin lähelle saapumispaikkaa (m): muuten ensimmäinen pakenisi heti. */
const HARE_AVOID_SPAWN = 22;
/** Vapaasti arvottavien jänisten alue ja vähimmäisetäisyys kohtauksen rajasta (m). */
const HARE_ANYWHERE = { x: 0, z: 0, rx: 85, rz: 85 };
const HARE_EDGE_MARGIN = 8;

/** Jäniksen piirtoetäisyys (m): kauempaa 0,5 m:n eläintä ei erota sumun läpi. */
const HARE_DRAW_RANGE = 75;

interface FlyingArrow { mesh: THREE.Mesh; p: Vec3; v: Vec3; t: number }
interface StuckArrow { id: string; mesh: THREE.Mesh; pickable: boolean; preyId?: string }
interface Game { prey: Prey; model: HareModel; hopPhase: number }

export const hunt = {
  bowOut: false,
  /** Tähtäys päällä (oikea painike tai jännitys). Kamera siirtyy olan yli. */
  aiming: false,
  drawing: false,
  drawHeld: 0,
  draw: 0,
  /** 0..1 pehmennetty tähtäys asentoa ja kameraa varten. */
  aimBlend: 0,
  reload: 0,
  quiver: newQuiver(),
  /** Tässä kohtauksessa kaadetut eläimet. */
  bag: 0,
};

let bow: BowModel | null = null;
const flying: FlyingArrow[] = [];
const stuck: StuckArrow[] = [];
const game: Game[] = [];
let nocked: THREE.Mesh | null = null;
let sounds: Stimulus[] = [];
let arrowSeq = 0;
let prevDrawHeld = false;
let lastShot: { from: Vec3; target: Vec3; speed: number } | null = null;
const layout = sceneLayout(ARENA);
const rng = (() => { let s = 1849; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
const Z = new THREE.Vector3(0, 0, 1);

export function initHunt() {
  if (!HUNTING) return;
  bow = buildBow();
  g.player.fighter.setBow(bow.group);
  nocked = buildArrow();
  nocked.visible = false;
  scene.add(nocked);
  // Jokainen käynti arpoo eläimet uusiin paikkoihin (tasapainon luvut: hunt/spawns.ts).
  const spots = pickHareSpots({
    rng: Math.random,
    bog: WILDS_ZONES.bog,
    burn: WILDS_ZONES.burn,
    anywhere: HARE_ANYWHERE,
    valid: (x, z) => {
      if (walkableDepth(layout, x, z) < HARE_EDGE_MARGIN) return false;
      const free = world.collision.depenetrateDisc(x, z, 0.4);
      return Math.hypot(free.x - x, free.z - z) < 0.05;
    },
    avoid: { x: SPAWN.x, z: SPAWN.z, radius: HARE_AVOID_SPAWN },
  });
  for (const [i, { x: x0, z: z0 }] of spots.entries()) {
    const free = world.collision.depenetrateDisc(x0, z0, 0.4);
    const p = spawnPrey(`hare-${i + 1}`, "hare", free.x, free.z, rng() * Math.PI * 2);
    const model = buildHare();
    scene.add(model.root);
    game.push({ prey: p, model, hopPhase: rng() });
  }
  hunt.bowOut = false;
}

/** Sankari on luotu uudelleen (uusi yritys tai varustevaihto): jousi uudelle hahmolle. */
export function rebindHeroBow() {
  if (!bow) return;
  g.player.fighter.setBow(bow.group);
  g.player.fighter.setBowMode(hunt.bowOut);
}

/** Jousi kädessä ja käytettävissä: rauhassa, hengissä, ei eleen tai laulun aikana. */
export function bowActive() {
  return HUNTING && hunt.bowOut && heroAtPeace() && g.player.state !== "dead";
}

/** Sankarin asento jousen kanssa (animate.ts), tai null. */
export function heroBowPose(): Pose | null {
  if (!bowActive()) return null;
  return bowPose(hunt.aimBlend, hunt.draw, -aim.pitch);
}

/** Tähtäyssuunta (kameran katse) maailmassa. */
export function aimDirection(out: THREE.Vector3) {
  const elev = -aim.pitch;
  return out.set(Math.sin(aim.yaw) * Math.cos(elev), Math.sin(elev), Math.cos(aim.yaw) * Math.cos(elev));
}

function setBowOut(on: boolean, announce: boolean) {
  if (hunt.bowOut === on) return;
  hunt.bowOut = on;
  g.player.fighter.setBowMode(on);
  hunt.drawing = false;
  hunt.draw = 0;
  if (!on) endAim();
  if (announce) {
    const key = bindings.bow.find((c) => c) ?? "";
    showMsg(on ? t("hunt.bowOut") : t("hunt.bowAway"), on ? t("hunt.bowOutSub", { key: key ? codeLabel(key) : "—" }) : "", on ? 3 : 1.2);
  }
}

function endAim() {
  hunt.aiming = false;
  // Tähtäyksen laajempi pystykulma palautetaan tavallisen katseen rajoihin.
  aim.pitch = Math.max(CONTROLS.pitchMin * DEG, Math.min(CONTROLS.pitchMax * DEG, aim.pitch));
}

function traceWorld(includeDead = true): ArrowTraceWorld {
  return {
    groundAt: groundHeight,
    staticHit: (a, b) => {
      const h = world.collision.firstProjectileHit(a.x, a.y, a.z, b.x, b.y, b.z);
      return h ? { t: h.t, id: h.collider.id } : null;
    },
    bodies: game.filter((e) => includeDead || e.prey.state !== "dead").map((e) => {
      const def = SPECIES[e.prey.species];
      const dead = e.prey.state === "dead";
      return { id: e.prey.id, x: e.prey.x, y: groundHeight(e.prey.x, e.prey.z) + (dead ? 0.1 : def.hitHeight), z: e.prey.z, radius: dead ? 0.18 : def.hitRadius };
    }),
  };
}

/** Kohta, johon tähtäin osoittaa: kameran säde lähimpään osumaan (enintään 200 m). */
function aimPoint(): Vec3 {
  const dir = camera.getWorldDirection(v1);
  // Säde alkaa sankarin kohdalta kameran katseella, jottei kameran vieressä oleva runko kaappaa sitä.
  const hero = v2.copy(g.player.pos).setY(g.player.pos.y + 1.5);
  const along = Math.max(0, v3.copy(hero).sub(camera.position).dot(dir));
  const from = { x: camera.position.x + dir.x * along, y: camera.position.y + dir.y * along, z: camera.position.z + dir.z * along };
  const to = { x: from.x + dir.x * 200, y: from.y + dir.y * 200, z: from.z + dir.z * 200 };
  const hit = traceSegment(from, to, traceWorld());
  return hit ? { x: hit.x, y: hit.y, z: hit.z } : to;
}

function orient(mesh: THREE.Object3D, v: Vec3) {
  mesh.quaternion.setFromUnitVectors(Z, v1.set(v.x, v.y, v.z).normalize());
}

/** Lentävä nuoli: simuloitu piste on kärki; mallin origo (perä) jää nuolen pituuden verran taakse. */
function placeArrow(mesh: THREE.Object3D, tip: Vec3, v: Vec3) {
  orient(mesh, v);
  mesh.position.set(tip.x, tip.y, tip.z).addScaledVector(v1, -ARROW_LEN);
}

function shoot() {
  if (!takeArrow(hunt.quiver)) return;
  const from = nockedTip();
  const speed = launchSpeed(hunt.draw);
  const target = aimPoint();
  const v = launchVelocity(from, target, speed);
  lastShot = { from, target, speed };
  const mesh = buildArrow();
  placeArrow(mesh, from, v);
  scene.add(mesh);
  flying.push({ mesh, p: from, v, t: 0 });
  sfx.bowRelease(hunt.draw);
  hunt.reload = ARCHERY.reloadTime;
  g.events.push(`pelaaja:jousi:laukaus:${hunt.draw.toFixed(2)}`);
  if (g.events.length > 30) g.events.shift();
}

/** Jänteellä olevan nuolen kärki (laukauksen lähtöpiste). */
function nockedTip(): Vec3 {
  if (bow && g.player.fighter.bowReady) {
    const nock = bow.nockWorld(v1);
    const grip = bow.group.getWorldPosition(v2);
    const dir = v3.copy(grip).sub(nock).normalize();
    return { x: grip.x + dir.x * 0.1, y: grip.y + dir.y * 0.1, z: grip.z + dir.z * 0.1 };
  }
  const d = aimDirection(v1);
  return { x: g.player.pos.x + d.x * 0.6, y: g.player.pos.y + 1.45, z: g.player.pos.z + d.z * 0.6 };
}

/** Jousen jänne ja jänteellä oleva nuoli seuraavat oikeaa kättä. */
function updateBowVisual() {
  if (!bow || !nocked) return;
  const f = g.player.fighter;
  const show = bowActive() && f.bowReady && hunt.aimBlend > 0.6 && hunt.reload <= 0 && hunt.quiver.arrows > 0 && g.player.state === "idle";
  if (!show) { bow.setNock(null); nocked.visible = false; return; }
  // Jänne seuraa oikean käden nyrkkiä (asento vetää kättä jännityksen mukana); nuolen perä jänteellä,
  // kärki kahvan editse.
  f.root.updateMatrixWorld(true);
  const fist = f.fistWorld("R", v1);
  bow.setNock(fist ? bow.group.worldToLocal(fist) : v1.set(0, -0.09 - 0.55 * hunt.draw, 0));
  const nock = bow.nockWorld(v2);
  const grip = bow.group.getWorldPosition(v3);
  const dir = grip.sub(nock).normalize();
  nocked.position.copy(nock);
  nocked.quaternion.setFromUnitVectors(Z, dir);
  nocked.visible = true;
}

function updateInput(dt: number) {
  if (!HUNTING) return;
  const p = g.player;
  if (inputs.bowQueued && heroAtPeace() && p.state !== "dead") setBowOut(!hunt.bowOut, true);
  // Taistelu alkaa: jousi selkään (miekka esiin hoituu heroAtPeace-säännöllä).
  if (hunt.bowOut && !heroAtPeace()) setBowOut(false, false);
  const active = bowActive() && p.state === "idle";
  const drawHeld = active && strikeHeld.slash;
  hunt.reload = Math.max(0, hunt.reload - dt);
  if (active && drawHeld && !prevDrawHeld && !hunt.drawing) {
    if (hunt.quiver.arrows <= 0) showMsg(t("hunt.quiverEmpty"), t("hunt.quiverEmptySub"), 1.6);
    else if (hunt.reload <= 0) { hunt.drawing = true; hunt.drawHeld = 0; }
  }
  // Painallus latauksen aikana: jännitys alkaa heti, kun uusi nuoli on jänteellä.
  if (active && drawHeld && !hunt.drawing && hunt.reload <= 0 && hunt.quiver.arrows > 0 && prevDrawHeld) { hunt.drawing = true; hunt.drawHeld = 0; }
  prevDrawHeld = drawHeld;
  if (hunt.drawing) {
    if (!active) { hunt.drawing = false; hunt.draw = 0; }
    else if (drawHeld) { hunt.drawHeld += dt; hunt.draw = drawAmount(hunt.drawHeld); }
    else {
      hunt.drawing = false;
      if (hunt.draw >= ARCHERY.minDraw) shoot();
      hunt.draw = 0;
    }
  } else hunt.draw = Math.max(0, hunt.draw - dt * 4);
  // Tähdätään aina: jännitys vie myös tähtäykseen (omistajan päätös 2026-11-21).
  const aiming = active && (inputs.blockHeld || hunt.drawing);
  if (hunt.aiming && !aiming) endAim();
  hunt.aiming = aiming;
  hunt.aimBlend += ((aiming ? 1 : 0) - hunt.aimBlend) * (1 - Math.exp(-12 * dt));
}

function stickArrow(f: FlyingArrow, hit: { x: number; y: number; z: number }, preyGame: Game | null) {
  // Kärki uppoaa osumakohtaan: varren keskipiste jää taakse.
  const dir = v3.set(f.v.x, f.v.y, f.v.z).normalize();
  placeArrow(f.mesh, { x: hit.x + dir.x * ARCHERY.stickDepth, y: hit.y + dir.y * ARCHERY.stickDepth, z: hit.z + dir.z * ARCHERY.stickDepth }, f.v);
  const id = `arrow-${++arrowSeq}`;
  if (preyGame) {
    // Nuoli jää eläimeen: se kulkee ruhon mukana ja palaa viiniin, kun saalis poimitaan. Kiinnitys juureen
    // (ei kaatuvaan vartaloon), jottei kyljelleen kaatuminen käännä nuolta pystyyn.
    preyGame.model.root.updateMatrixWorld(true);
    preyGame.model.root.attach(f.mesh);
    stuck.push({ id, mesh: f.mesh, pickable: false, preyId: preyGame.prey.id });
    return;
  }
  const reach = hit.y - groundHeight(hit.x, hit.z) <= ARCHERY.pickupReach;
  stuck.push({ id, mesh: f.mesh, pickable: reach });
}

function updateArrows(dt: number) {
  for (let i = flying.length - 1; i >= 0; i--) {
    const f = flying[i];
    let remaining = dt, done = false;
    while (remaining > 1e-6 && !done) {
      const h = Math.min(remaining, 1 / 120);
      remaining -= h;
      const next = stepArrow(f.p, f.v, h);
      const hit = traceSegment(f.p, next.p, traceWorld());
      f.t += h;
      if (hit) {
        done = true;
        const e = hit.kind === "body" ? game.find((x) => x.prey.id === hit.id) ?? null : null;
        stickArrow(f, hit, e);
        sfx.arrowImpact(hit.kind === "static");
        if (e && e.prey.state !== "dead") {
          killPrey(e.prey);
          hunt.bag++;
          const name = t(SPECIES[e.prey.species].nameKey);
          showMsg(t("hunt.killed", { animal: name }), t("hunt.killedSub"), 2.6);
          g.events.push(`pelaaja:saalis:${e.prey.id}`);
        } else {
          // Ohi mennyt nuoli kuuluu: lähellä oleva riista säikähtää.
          sounds.push({ kind: "sound", x: hit.x, z: hit.z, loudness: ARCHERY.impactLoudness });
          g.events.push(`pelaaja:nuoli:${hit.kind}${hit.id ? `:${hit.id}` : ""}`);
        }
        if (g.events.length > 30) g.events.shift();
        flying.splice(i, 1);
        break;
      }
      f.p = next.p;
      f.v = next.v;
    }
    if (done) continue;
    placeArrow(f.mesh, f.p, f.v);
    // Lentänyt pois kohtauksesta: nuoli on menetetty.
    if (f.t > ARCHERY.maxFlight || Math.abs(f.p.x) > 190 || Math.abs(f.p.z) > 190) {
      f.mesh.removeFromParent();
      flying.splice(i, 1);
    }
  }
}

function updateGame(dt: number) {
  const hero = g.player.pos;
  const stimuli: Stimulus[] = [{ kind: "sight", x: hero.x, z: hero.z }, ...sounds];
  sounds = [];
  const env = {
    rng,
    move: (x: number, z: number, dx: number, dz: number, radius: number) => {
      const m = world.collision.moveDisc(x, z, dx, dz, radius, "slide");
      return clampToWalkable(layout, m.x, m.z, radius);
    },
  };
  for (const e of game) {
    const was = e.prey.state;
    updatePrey(e.prey, dt, stimuli, env);
    const p = e.prey, m = e.model;
    // Kaukana (sumussa) oleva eläin ei piirry: säästää piirtokutsuja ja varjoja.
    m.root.visible = Math.hypot(p.x - hero.x, p.z - hero.z) < HARE_DRAW_RANGE;
    const y = groundHeight(p.x, p.z);
    m.root.position.set(p.x, y, p.z);
    if (p.state === "dead") {
      // Kaatunut: kyljelleen (pehmeästi), korvat lappeelleen.
      if (was !== "dead") e.hopPhase = 0;
      e.hopPhase = Math.min(1, e.hopPhase + dt * 5);
      m.body.rotation.z = (Math.PI / 2) * e.hopPhase;
      m.body.position.y = 0.08 * e.hopPhase - 0.02;
      for (const ear of m.ears) ear.rotation.x = -1.2;
      continue;
    }
    // Kääntyminen pehmeästi kohti liikesuuntaa.
    const dy = Math.atan2(Math.sin(p.yaw - m.root.rotation.y), Math.cos(p.yaw - m.root.rotation.y));
    m.root.rotation.y += dy * (1 - Math.exp(-14 * dt));
    // Loikat: kaari, jonka tiheys seuraa vauhtia. Pakeneva jänis venyy pitkäksi.
    const fleeing = p.state === "flee";
    const stride = fleeing ? 1.4 : 0.45;
    if (p.speed > 0.1) e.hopPhase = (e.hopPhase + (p.speed / stride) * dt) % 1;
    else e.hopPhase = 0;
    const arc = Math.sin(e.hopPhase * Math.PI);
    m.body.position.y = arc * (fleeing ? 0.22 : 0.09);
    m.body.rotation.x = p.speed > 0.1 ? (0.5 - e.hopPhase) * (fleeing ? 0.5 : 0.3) : 0;
    m.body.scale.z = 1 + (fleeing ? 0.15 * arc : 0);
    // Korvat: säikähtänyt nostaa korvat pystyyn, laiduntava pitää ne rennosti, pakeneva painaa taakse.
    const earX = p.state === "alert" ? -0.05 : fleeing ? -1.05 : -0.5;
    for (const ear of m.ears) ear.rotation.x += (earX - ear.rotation.x) * (1 - Math.exp(-12 * dt));
    // Laiduntaessa pää painuu välillä alas (koko vartalon pieni nyökkäys).
    if (p.state === "graze") m.body.rotation.x = Math.max(0, Math.sin(p.stateTime * 1.7 + e.hopPhase * 6)) * 0.18;
  }
}

/** Kutsutaan joka ruudulla sankarin päivityksen jälkeen. */
export function updateHunt(dt: number) {
  if (!HUNTING) return;
  updateInput(dt);
  // Tähtäyksen kädet (Fighter.bowArms): jousikäsi linjalla, vetokäsi jänteellä.
  g.player.fighter.setBowAim(bowActive() ? hunt.aimBlend : 0, -aim.pitch, hunt.draw);
  updateArrows(dt);
  updateGame(dt);
}

/** Piirtoa edeltävä päivitys (myös tauolla): jänne, jänteen nuoli ja HUD. */
export function updateHuntVisuals() {
  if (!HUNTING) return;
  updateBowVisual();
  const hud = $("huntHud");
  hud.classList.toggle("hidden", !hunt.bowOut && hunt.bag === 0 && hunt.quiver.arrows === hunt.quiver.max);
  $("huntArrows").textContent = t("hunt.arrows", { count: hunt.quiver.arrows, max: hunt.quiver.max });
  $("huntBag").textContent = hunt.bag ? t("hunt.bag", { count: hunt.bag }) : "";
  const cross = $("crosshair");
  cross.classList.toggle("hidden", !(bowActive() && hunt.aimBlend > 0.5));
  // Tähtäin kapenee jännityksen mukana: täysi jännitys = tarkin (vain visuaalinen vihje).
  cross.style.setProperty("--spread", `${Math.round(16 - 11 * hunt.draw)}px`);
  cross.classList.toggle("full", hunt.draw >= 1);
}

/** Olan yli -kameran paino 0..1 (camera.ts). */
export function aimCameraBlend() { return bowActive() ? hunt.aimBlend : 0; }

/** Poimittavat nuolet ja saaliit katsekohdistukseen (sceneItems.ts). */
export function huntPickables(): Pickable[] {
  if (!HUNTING) return [];
  const out: Pickable[] = [];
  for (const s of stuck) {
    if (!s.pickable) continue;
    const pos = s.mesh.getWorldPosition(v1).addScaledVector(v2.set(0, 0, 1).applyQuaternion(s.mesh.quaternion), ARROW_LEN * 0.4);
    const gy = groundHeight(pos.x, pos.z);
    out.push({
      id: `hunt:${s.id}`, x: pos.x, y: Math.max(pos.y, gy + 0.3), z: pos.z, radius: 0.55,
      label: t("hunt.arrow"),
      room: () => hunt.quiver.arrows < hunt.quiver.max,
      fullText: t("hunt.quiverFull"),
      take: () => {
        if (!returnArrow(hunt.quiver)) return false;
        s.mesh.removeFromParent();
        stuck.splice(stuck.indexOf(s), 1);
        showMsg(t("hunt.arrows", { count: hunt.quiver.arrows, max: hunt.quiver.max }), "", 1);
        return true;
      },
    });
  }
  for (const e of game) {
    if (e.prey.state !== "dead") continue;
    const def = SPECIES[e.prey.species];
    const item = ITEMS[def.meat.itemId];
    const fits = (n: number) => tryAddItem(campaignStore().get().player.inventory, def.meat.itemId, n) !== null;
    out.push({
      id: `hunt:${e.prey.id}`, x: e.prey.x, y: groundHeight(e.prey.x, e.prey.z) + 0.3, z: e.prey.z, radius: 0.6,
      label: t("hunt.carcass", { animal: t(def.nameKey) }),
      room: () => meatToTake(e.prey, fits) > 0,
      fullText: t("interact.inventoryFull"),
      take: () => {
        // Mahtuva määrä otetaan; loput jäävät ruhoon, jos inventaario täyttyy kesken.
        const count = meatToTake(e.prey, fits);
        if (count === 0) return false;
        const update = campaignStore().update((state) => {
          const inventory = tryAddItem(state.player.inventory, def.meat.itemId, count);
          return inventory ? { ...state, player: { ...state.player, inventory } } : state;
        });
        if (!update.ok) { showMsg(t("interact.saveFailed"), "", 1.6); return false; }
        e.prey.meat -= count;
        // Ruhoon jääneet nuolet palaavat viiniin (täyteen viiniin ei mahdu enempää).
        let back = 0;
        for (let i = stuck.length - 1; i >= 0; i--) {
          if (stuck[i].preyId !== e.prey.id) continue;
          if (returnArrow(hunt.quiver)) back++;
          stuck[i].mesh.removeFromParent();
          stuck.splice(i, 1);
        }
        if (e.prey.meat <= 0) {
          e.model.root.removeFromParent();
          game.splice(game.indexOf(e), 1);
        }
        const name = count > 1 ? `${t(item.nameKey)} ×${count}` : t(item.nameKey);
        showMsg(back ? t("hunt.gutArrows", { item: name, count: back }) : t("hunt.gutted", { item: name }), "", 1.8);
        g.events.push(`pelaaja:otti:${e.prey.id}:${def.meat.itemId}`);
        return true;
      },
    });
  }
  return out;
}

/** Savutestit: tila ja eläinten paikat konsolista (`__game.hunt()`). */
export function huntDebug() {
  return {
    lastShot, bowOut: hunt.bowOut, aiming: hunt.aiming, draw: +hunt.draw.toFixed(2), arrows: hunt.quiver.arrows, bag: hunt.bag,
    flying: flying.length, stuck: stuck.map((s) => ({ id: s.id, pickable: s.pickable, prey: s.preyId ?? null, at: s.mesh.getWorldPosition(new THREE.Vector3()).toArray().map((v) => +v.toFixed(2)) })),
    prey: game.map((e) => ({ id: e.prey.id, state: e.prey.state, x: +e.prey.x.toFixed(1), z: +e.prey.z.toFixed(1) })),
  };
}
