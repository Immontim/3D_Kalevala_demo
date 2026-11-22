// Erämaan taustalinnut 3D:ssä: istumapaikat oikeista puista, kevyet koodimallit ja siiveniskut
// varjostimessa. Logiikka on puhtaassa moduulissa `fauna/birds.ts`; tämä vain piirtää.
// Piirtokutsuja on yksi lajia kohti (kolme instanssinippua), linnut eivät heitä varjoa, ja
// kaukaiset linnut jätetään pois nipusta.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { ForestProto, TreeSpot } from "../forest";
import { BIRD_SPECIES, Flock, PerchSet, makeRng, type BirdEnv, type SpeciesId } from "../fauna/birds";

/** Tätä kauempana kamerasta olevaa lintua ei piirretä (m). Pikkulintu on jo silloin alle pikselin. */
const DRAW_R = 60;
/** Istumapaikat vain puille tämän alueen sisällä (kuljettava alue ±97 m + linnun lentomatka). */
const PERCH_EXTENT = 125;

// ---------- Istumapaikat puumalleista ----------

type Local = { x: number; y: number; z: number; top: boolean };

/**
 * Lajin istumapaikat puun omassa koordinaatistossa: latva (korkein runkoverteksi) ja oksat.
 * Männyn ja koivun oksat ovat kuorimateriaalin verteksejä kauempana rungosta, joten lintu istuu
 * mallin oikean oksan päällä. Kuusen oksat ovat pelkkiä lehvästökortteja: kuusessa lintu istuu
 * rungon vieressä tiheän latvuksen sisällä (oksan tyvellä), ei kortin reunalla ilmassa.
 */
function perchTemplate(parts: ForestProto): Local[] {
  const bark = parts.filter((p) => !/Foliage/.test(p.material.name));
  const pts: THREE.Vector3[] = [];
  for (const p of bark) {
    const pos = p.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) pts.push(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
  }
  if (!pts.length) return [];
  let top = pts[0];
  for (const v of pts) if (v.y > top.y) top = v;
  const h = top.y;
  const out: Local[] = [{ x: top.x, y: top.y + 0.02, z: top.z, top: true }];
  const radial = (v: THREE.Vector3) => Math.hypot(v.x, v.z);
  const branches = pts.filter((v) => v.y > 0.4 * h && v.y < 0.92 * h && radial(v) > 0.45);
  if (branches.length > 20) {
    // Kuusi lohkoa × kaksi korkeuskaistaa; lohkosta oksan keskivaiheen verteksi (ei ohut kärki).
    for (let band = 0; band < 2; band++) {
      for (let s = 0; s < 6; s++) {
        const bin = branches.filter((v) => {
          const a = (Math.atan2(v.z, v.x) + Math.PI) / (Math.PI * 2);
          const yb = (v.y / h - 0.4) / 0.52;
          return Math.floor(a * 6) % 6 === s && (yb < 0.5 ? 0 : 1) === band;
        });
        if (bin.length < 3) continue;
        bin.sort((a, b) => radial(a) - radial(b));
        const v = bin[Math.floor(bin.length * 0.65)];
        out.push({ x: v.x, y: v.y + 0.02, z: v.z, top: false });
      }
    }
  } else {
    // Kuusi: rungon säde korkeudella y kuoriverteksien perusteella, istumapaikka 0,3 m rungon ulkopuolella.
    for (let k = 0; k < 5; k++) {
      const y = h * (0.45 + 0.09 * k);
      const near = pts.filter((v) => Math.abs(v.y - y) < 0.8);
      const trunkR = near.reduce((m, v) => Math.max(m, radial(v)), 0.05);
      const a = k * 2.4 + 0.7;
      const r = trunkR + 0.3;
      out.push({ x: Math.cos(a) * r, y, z: Math.sin(a) * r, top: false });
    }
  }
  return out;
}

function buildPerches(trees: readonly TreeSpot[], proto: (name: string) => ForestProto | undefined): PerchSet {
  const templates = new Map<string, Local[]>();
  const data: number[] = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (const t of trees) {
    if (Math.abs(t.x) > PERCH_EXTENT || Math.abs(t.z) > PERCH_EXTENT) continue;
    let tpl = templates.get(t.type);
    if (!tpl) templates.set(t.type, (tpl = perchTemplate(proto(t.type) ?? [])));
    // Sama muunnos kuin Forest-luokan instanssimatriisissa.
    m.compose(p.set(t.x, t.y, t.z), q.setFromEuler(e.set(t.tiltX, t.yaw, t.tiltZ)), s.setScalar(t.scale));
    for (const l of tpl) {
      v.set(l.x, l.y, l.z).applyMatrix4(m);
      data.push(v.x, v.y, v.z, l.top ? 1 : 0);
    }
  }
  return new PerchSet(new Float32Array(data));
}

// ---------- Mallit ----------
// Yksikkölintu: nokka +z, jalat y = 0, pituus noin 1,04 (skaalataan lajin pituuteen).
// aPart: 0 vartalo, 1 siipi, 2 pää (pää ja nokka taipuvat nokkiessa).

const WING_HINGE = 0.12, WING_Y = 0.28, NECK_Y = 0.3, NECK_Z = 0.2, UNIT_LEN = 1.04;

interface Palette { back: number; belly: number; head: number; wing: number; beak: number; tail: number; legs: number }
interface Shape { wingSpan: number; chord: number; beak: number; tail: number }

const LOOK: Record<SpeciesId, { colors: Palette; shape: Shape }> = {
  // Peippo: ruskea selkä, punertava rinta, siniharmaa pää.
  peippo: {
    colors: { back: 0x7a5a40, belly: 0xc98f72, head: 0x6d7c8c, wing: 0x56432f, beak: 0x9a9a8a, tail: 0x4a4038, legs: 0x6a5a50 },
    shape: { wingSpan: 0.72, chord: 0.28, beak: 0.04, tail: 0.24 },
  },
  // Laulurastas: ruskea selkä, kermanvaalea rinta.
  rastas: {
    colors: { back: 0x6f5a42, belly: 0xdccca4, head: 0x6f5a42, wing: 0x5a4632, beak: 0x4a4030, tail: 0x5a4632, legs: 0xb09a80 },
    shape: { wingSpan: 0.72, chord: 0.28, beak: 0.04, tail: 0.26 },
  },
  // Korppi: musta, iso nokka ja pitkät, leveät siivet.
  korppi: {
    colors: { back: 0x121216, belly: 0x1a1a20, head: 0x121216, wing: 0x0f0f13, beak: 0x0c0c0e, tail: 0x101014, legs: 0x101012 },
    shape: { wingSpan: 0.9, chord: 0.32, beak: 0.065, tail: 0.36 },
  },
};

function paint(geo: THREE.BufferGeometry, part: number, color: (y: number) => THREE.Color) {
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3), parts = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const c = color(pos.getY(i));
    col.set([c.r, c.g, c.b], i * 3);
    parts[i] = part;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("aPart", new THREE.BufferAttribute(parts, 1));
  return geo;
}

function birdGeometry(id: SpeciesId): THREE.BufferGeometry {
  const { colors: c, shape } = LOOK[id];
  const col = (hex: number) => { const k = new THREE.Color(hex); return () => k; };
  const back = new THREE.Color(c.back), belly = new THREE.Color(c.belly);
  // Vartalo: ellipsoidi, selkä tumma ja vatsa vaalea korkeuden mukaan.
  const body = new THREE.SphereGeometry(1, 10, 7);
  body.scale(0.17, 0.16, 0.33);
  body.translate(0, 0.2, 0);
  paint(body, 0, (y) => belly.clone().lerp(back, THREE.MathUtils.smoothstep(y, 0.14, 0.26)));
  const head = new THREE.SphereGeometry(0.13, 8, 6);
  head.translate(0, 0.36, 0.27);
  paint(head, 2, col(c.head));
  const beak = new THREE.ConeGeometry(shape.beak, 0.15, 5);
  beak.rotateX(Math.PI / 2);
  beak.translate(0, 0.35, 0.44);
  paint(beak, 2, col(c.beak));
  const tail = new THREE.BoxGeometry(0.16, 0.02, shape.tail);
  tail.rotateX(-0.15);
  tail.translate(0, 0.23, -0.25 - shape.tail / 2);
  paint(tail, 0, col(c.tail));
  const legs = [-1, 1].map((sx) => {
    const g = new THREE.BoxGeometry(0.025, 0.1, 0.025);
    g.translate(sx * 0.06, 0.05, 0.02);
    return paint(g, 0, col(c.legs));
  });
  // Siivet: ohut laatta kyljestä ulos, kapenee ja kääntyy taaksepäin kärkeä kohti.
  const wings = [-1, 1].map((sx) => {
    const g = new THREE.BoxGeometry(shape.wingSpan, 0.015, shape.chord, 3, 1, 1);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const u = (pos.getX(i) + shape.wingSpan / 2) / shape.wingSpan;      // 0 tyvi, 1 kärki
      pos.setZ(i, pos.getZ(i) * (1 - 0.55 * u) - 0.1 * u - 0.02);
      pos.setX(i, sx * (WING_HINGE + u * shape.wingSpan));
      pos.setY(i, pos.getY(i) + WING_Y);
    }
    g.computeVertexNormals();
    return paint(g, 1, col(c.wing));
  });
  const merged = mergeGeometries([body, head, beak, tail, ...legs, ...wings]);
  if (!merged) throw new Error("Linnun geometrian yhdistäminen epäonnistui");
  merged.deleteAttribute("uv");
  return merged;
}

/** Siivet ja pää taipuvat varjostimessa instanssikohtaisen aAnim-attribuutin mukaan (siipi, supistus, pää). */
function birdMaterial(): THREE.Material {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });   // vasen siipi on peilattu
  const rot = (a: string, b: string, ang: string) => `{ float c = cos(${ang}), s = sin(${ang}); float t = ${a} * c - ${b} * s; ${b} = ${a} * s + ${b} * c; ${a} = t; }`;
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aPart;\nattribute vec3 aAnim;")
      .replace("#include <beginnormal_vertex>", `#include <beginnormal_vertex>
        if (aPart > 0.5 && aPart < 1.5) {
          float side = position.x < 0.0 ? -1.0 : 1.0;
          float nu = objectNormal.x * side, ny = objectNormal.y;
          ${rot("nu", "ny", "aAnim.x")}
          objectNormal = vec3(nu * side, ny, objectNormal.z);
        } else if (aPart > 1.5) {
          float ny = objectNormal.y, nz = objectNormal.z;
          ${rot("ny", "nz", "aAnim.z")}
          objectNormal = vec3(objectNormal.x, ny, nz);
        }`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        if (aPart > 0.5 && aPart < 1.5) {
          float side = position.x < 0.0 ? -1.0 : 1.0;
          float u = abs(position.x) - ${WING_HINGE.toFixed(3)};
          float fold = aAnim.y;
          float wu = u * mix(1.0, 0.14, fold);
          float wy = (position.y - ${WING_Y.toFixed(3)}) - u * 0.08 * fold;
          float wz = position.z * mix(1.0, 0.7, fold) - u * 0.45 * fold;
          ${rot("wu", "wy", "aAnim.x")}
          transformed = vec3(side * (${WING_HINGE.toFixed(3)} + wu), ${WING_Y.toFixed(3)} + wy, wz);
        } else if (aPart > 1.5) {
          float hy = position.y - ${NECK_Y.toFixed(3)}, hz = position.z - ${NECK_Z.toFixed(3)};
          ${rot("hy", "hz", "aAnim.z")}
          transformed = vec3(position.x, ${NECK_Y.toFixed(3)} + hy, ${NECK_Z.toFixed(3)} + hz);
        }`);
  };
  m.customProgramCacheKey = () => "fauna-bird-v1";
  return m;
}

// ---------- Kytkentä ----------

export interface BirdsView {
  update(dt: number, camera: THREE.Camera, focus: THREE.Vector3): void;
  stats(): object;
  /** Savutestiin: linnut näkyviin tai piiloon (piirtoajan vertailu). */
  show(on: boolean): void;
}

export function createBirds(
  scene: THREE.Scene,
  trees: readonly TreeSpot[],
  proto: (name: string) => ForestProto | undefined,
  env: BirdEnv,
  start: { x: number; z: number },
): BirdsView {
  const perches = buildPerches(trees, proto);
  const flock = new Flock(perches, env, makeRng(1849));
  flock.spawn(start.x, start.z);
  const material = birdMaterial();
  const kinds = (Object.keys(BIRD_SPECIES) as SpeciesId[]).map((id) => {
    const geo = birdGeometry(id);
    const n = BIRD_SPECIES[id].count;
    const anim = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    anim.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("aAnim", anim);
    const mesh = new THREE.InstancedMesh(geo, material, n);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.name = `birds:${id}`;
    mesh.count = 0;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
    return { id, mesh, anim, scale: BIRD_SPECIES[id].length / UNIT_LEN };
  });
  const obj = new THREE.Object3D();
  obj.rotation.order = "YXZ";
  let drawn = 0;
  return {
    update(dt, camera, focus) {
      flock.step(dt, focus.x, focus.z);
      const cam = camera.position;
      drawn = 0;
      for (const k of kinds) {
        let n = 0;
        for (const b of flock.birds) {
          if (b.species !== k.id) continue;
          if (Math.hypot(b.x - cam.x, b.y - cam.y, b.z - cam.z) > DRAW_R) continue;
          obj.position.set(b.x, b.y, b.z);
          obj.rotation.set(-b.pitch, b.yaw, 0);
          obj.scale.setScalar(k.scale);
          obj.updateMatrix();
          k.mesh.setMatrixAt(n, obj.matrix);
          k.anim.setXYZ(n, b.wing, b.fold, b.headDip);
          n++;
        }
        k.mesh.count = n;
        drawn += n;
        k.mesh.instanceMatrix.needsUpdate = true;
        k.anim.needsUpdate = true;
      }
    },
    show(on) { for (const k of kinds) k.mesh.visible = on; },
    stats: () => ({
      ...flock.stats(),
      drawn,
      list: flock.birds.map((b) => ({ species: b.species, state: b.state, x: +b.x.toFixed(1), y: +b.y.toFixed(1), z: +b.z.toFixed(1) })),
    }),
  };
}
