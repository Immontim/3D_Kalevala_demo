// Metsästyksen väliaikaiset koodimallit: jousi, nuoli ja jänis. Kevyet (yhteensä muutama sata
// kolmiota kappaletta kohti) ja korvattavissa myöhemmin Blender-malleilla samoilla mitoilla ja suunnilla.
import * as THREE from "three";

// ---------- Jousi ----------
// Koordinaatit käden virtuaalikehyksessä (Fighter): lavat +z/-z, kahva origossa, jänne -y:n puolella
// (käden +y osoittaa olkapäästä poispäin, joten ojennetulla kädellä jänne on ampujaan päin ja lavat pystyssä).
const BOW_HALF = 0.72;

export interface BowModel {
  group: THREE.Group;
  /** Jänteen vetokohta bowin omassa koordinaatistossa, tai null = jänne lepoasennossa. */
  setNock(local: THREE.Vector3 | null): void;
  /** Jänteen vetokohta maailmassa (nuolen pää). */
  nockWorld(out: THREE.Vector3): THREE.Vector3;
}

export function buildBow(): BowModel {
  const group = new THREE.Group();
  group.name = "hunt_bow";
  // Lapojen kaari: kärjet taipuvat jännettä kohti (y negatiivinen). Kärjissä pieni takakaari (rekurvi).
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 16; i++) {
    const s = -BOW_HALF + (2 * BOW_HALF * i) / 16;
    const u = Math.abs(s) / BOW_HALF;
    const y = -(0.11 * u * u - 0.025 * Math.pow(u, 8));
    pts.push(new THREE.Vector3(0, y, s));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const limbGeo = new THREE.TubeGeometry(curve, 24, 0.013, 6, false);
  // Kapenee kärkiä kohti: skaalataan poikkileikkausta pituuden mukaan.
  const p = limbGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i);
    const k = 1 - 0.55 * Math.pow(Math.abs(z) / BOW_HALF, 1.5);
    const c = curve.getPoint(Math.min(1, Math.max(0, (z + BOW_HALF) / (2 * BOW_HALF))));
    p.setX(i, c.x + (p.getX(i) - c.x) * k);
    p.setY(i, c.y + (p.getY(i) - c.y) * k * 1.25);
  }
  limbGeo.computeVertexNormals();
  // Koivu ja mänty liimattuina: vaalea vatsa, tummempi selkä (yksi väri riittää paikkamalliin).
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.7 });
  const limbs = new THREE.Mesh(limbGeo, wood);
  limbs.castShadow = true;
  // Kahva: tuohikäärö.
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.13, 8), new THREE.MeshStandardMaterial({ color: 0xc9b48a, roughness: 0.9 }));
  grip.rotation.x = Math.PI / 2;
  group.add(limbs, grip);

  // Jänne: kaksi ohutta janaa kärjistä vetokohtaan.
  const tipTop = new THREE.Vector3(0, -(0.11 - 0.025) - 0.005, BOW_HALF - 0.01);
  const tipBot = tipTop.clone().setZ(-tipTop.z);
  const restNock = new THREE.Vector3(0, tipTop.y, 0);
  const sGeo = new THREE.BufferGeometry();
  const sPos = new Float32Array(9);
  sGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
  const string = new THREE.Line(sGeo, new THREE.LineBasicMaterial({ color: 0xd8cdb4 }));
  string.frustumCulled = false;
  group.add(string);
  const nock = new THREE.Vector3();
  const setNock = (local: THREE.Vector3 | null) => {
    nock.copy(local ?? restNock);
    // Jänne ei voi mennä kahvan läpi eikä venyä mahdottomasti; sivulle se taipuu vähän (käsi on poskella).
    nock.x = THREE.MathUtils.clamp(nock.x, -0.22, 0.22);
    nock.z = THREE.MathUtils.clamp(nock.z, -0.05, 0.05);
    nock.y = THREE.MathUtils.clamp(nock.y, -0.78, restNock.y);
    sPos.set([tipTop.x, tipTop.y, tipTop.z, nock.x, nock.y, nock.z, tipBot.x, tipBot.y, tipBot.z]);
    sGeo.attributes.position.needsUpdate = true;
  };
  setNock(null);
  return { group, setNock, nockWorld: (out) => group.localToWorld(out.copy(nock)) };
}

// ---------- Nuoli ----------
// Varsi +z-suuntaan: kärki +z:ssa (pituus ARROW_LEN), pää origossa. Yksi yhteinen geometria.
export const ARROW_LEN = 0.78;
let arrowGeo: THREE.BufferGeometry | null = null;
let arrowMat: THREE.MeshStandardMaterial | null = null;

function colored(geo: THREE.BufferGeometry, color: number) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.deleteAttribute("uv");
  return g;
}

function mergeGeos(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let total = 0;
  for (const p of parts) total += p.attributes.position.count;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3);
  let o = 0;
  for (const p of parts) {
    pos.set(p.attributes.position.array as Float32Array, o * 3);
    nor.set(p.attributes.normal.array as Float32Array, o * 3);
    col.set(p.attributes.color.array as Float32Array, o * 3);
    o += p.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  out.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return out;
}

export function buildArrow(): THREE.Mesh {
  if (!arrowGeo) {
    const shaft = new THREE.CylinderGeometry(0.0045, 0.0045, ARROW_LEN - 0.06, 5, 1, true);
    shaft.rotateX(Math.PI / 2);
    shaft.translate(0, 0, (ARROW_LEN - 0.06) / 2);
    // Lehtimäinen rautakärki.
    const head = new THREE.ConeGeometry(0.011, 0.07, 4);
    head.rotateX(Math.PI / 2);
    head.translate(0, 0, ARROW_LEN - 0.035);
    const parts = [colored(shaft, 0xb89868), colored(head, 0x3a3a3c)];
    // Sulat: kolme ohutta levyä perässä.
    for (let i = 0; i < 3; i++) {
      const f = new THREE.PlaneGeometry(0.022, 0.12);
      f.translate(0.014, 0, 0);
      f.rotateX(Math.PI / 2);
      f.rotateZ((i * Math.PI * 2) / 3);
      f.translate(0, 0, 0.08);
      parts.push(colored(f, i === 0 ? 0xc8c0b0 : 0x5b4a3a));
    }
    arrowGeo = mergeGeos(parts);
    arrowMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide });
  }
  const m = new THREE.Mesh(arrowGeo, arrowMat!);
  m.castShadow = true;
  m.name = "hunt_arrow";
  return m;
}

// ---------- Jänis ----------
// Origo maassa jalkojen välissä, kuono +z, mitat metreinä (metsäjänis kesäturkissa, noin 55 cm).
export interface HareModel {
  root: THREE.Group;
  /** Vartalo, joka loikkii ja kaatuu (root pysyy maassa). */
  body: THREE.Group;
  ears: THREE.Object3D[];
}

let hareGeo: { body: THREE.BufferGeometry; ear: THREE.BufferGeometry } | null = null;
let hareMat: THREE.MeshStandardMaterial | null = null;

/** Yksi muoto vartaloon: pallo skaalattuna, kierrettynä ja siirrettynä, väri verteksiväreinä. */
function hareBlob(color: number, r: number, sx: number, sy: number, sz: number, x: number, y: number, z: number, rx = 0) {
  const geo = new THREE.SphereGeometry(r, 9, 7);
  geo.applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, 0)), new THREE.Vector3(sx, sy, sz)));
  return colored(geo, color);
}

function buildHareGeometry() {
  const FUR = 0x8f7d63, BELLY = 0xd9d2c3, DARK = 0x2a2420;
  const body = mergeGeos([
    hareBlob(FUR, 0.12, 0.85, 0.85, 1.45, 0, 0.2, -0.02, -0.25),        // runko, takapää korkeampi
    hareBlob(BELLY, 0.1, 0.75, 0.6, 1.2, 0, 0.15, 0.0, -0.2),           // vaalea vatsa
    hareBlob(FUR, 0.075, 0.85, 0.9, 1.25, 0, 0.3, 0.16, 0.35),          // pää
    hareBlob(DARK, 0.012, 1, 1, 1, 0.045, 0.32, 0.215),                  // silmät
    hareBlob(DARK, 0.012, 1, 1, 1, -0.045, 0.32, 0.215),
    hareBlob(FUR, 0.07, 0.7, 1.1, 1.5, 0.075, 0.12, -0.1, 0.1),         // takareidet
    hareBlob(FUR, 0.07, 0.7, 1.1, 1.5, -0.075, 0.12, -0.1, 0.1),
    hareBlob(FUR, 0.035, 0.8, 0.8, 2.6, 0.06, 0.025, 0.0),              // takakäpälät maassa
    hareBlob(FUR, 0.035, 0.8, 0.8, 2.6, -0.06, 0.025, 0.0),
    hareBlob(FUR, 0.028, 0.9, 2.4, 0.9, 0.045, 0.075, 0.13),            // etujalat rinnan alla maahan asti
    hareBlob(FUR, 0.028, 0.9, 2.4, 0.9, -0.045, 0.075, 0.13),
    hareBlob(BELLY, 0.04, 1, 1, 1, 0, 0.22, -0.19),                      // valkoinen hännäntupsu
  ]);
  // Korva nivelensä ympärillä (origo korvan tyvessä); kärki musta (metsäjäniksen tuntomerkki).
  const ear = mergeGeos([
    hareBlob(FUR, 0.06, 0.42, 1.9, 0.22, 0, 0.1, 0),
    hareBlob(DARK, 0.018, 1.1, 1.5, 0.6, 0, 0.205, 0),
  ]);
  return { body, ear };
}

export function buildHare(): HareModel {
  hareGeo ??= buildHareGeometry();
  hareMat ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const root = new THREE.Group();
  root.name = "hunt_hare";
  const body = new THREE.Group();
  root.add(body);
  const mesh = new THREE.Mesh(hareGeo.body, hareMat);
  mesh.castShadow = true;
  body.add(mesh);
  const ears: THREE.Object3D[] = [];
  for (const s of [1, -1]) {
    const pivot = new THREE.Mesh(hareGeo.ear, hareMat);
    pivot.castShadow = true;
    pivot.position.set(0.028 * s, 0.36, 0.13);
    pivot.rotation.set(-0.5, 0, 0.18 * s);
    body.add(pivot);
    ears.push(pivot);
  }
  return { root, body, ears };
}
