import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import forestUrl from "../assets/forest.glb?url";
import homesteadUrl from "../assets/homestead.glb?url";
import needlesDiffUrl from "../assets/ground/needles_diff.webp";
import needlesNorUrl from "../assets/ground/needles_nor.webp";
import mossDiffUrl from "../assets/ground/moss_diff.webp";
import mossNorUrl from "../assets/ground/moss_nor.webp";
import dirtDiffUrl from "../assets/ground/dirt_diff.webp";
import dirtNorUrl from "../assets/ground/dirt_nor.webp";

// Taistelualueet kangasmetsässä: maasto, männyt, kuuset, koivut, varvut ja kivet
// sekä alueen oma keskus (nuotioaukion kota tai pihapiirin rakennukset). Mallit
// tulevat Blenderistä (assets/forest.glb, assets/homestead.glb); tämä tiedosto
// sijoittelee ne instansseina ja hoitaa valon, maaston ja tulen.

/** Taistelukehän säde; sama molemmilla alueilla. */
export const ARENA_RADIUS = 11;

export type ArenaId = "clearing" | "homestead";
export const ARENAS: Record<ArenaId, { name: string; desc: string }> = {
  clearing: { name: "Nuotioaukio", desc: "Metsäaukio mäntykankaalla: kota, nuotio ja uhrikivi." },
  homestead: { name: "Pihapiiri", desc: "Rautakautinen talo ulkorakennuksineen punosaidan sisällä." },
};
const ARENA_STORE = "laulun-miekka.arena.v1";

function savedArena(): ArenaId {
  try {
    const v = localStorage.getItem(ARENA_STORE);
    if (v === "clearing" || v === "homestead") return v;
  } catch { /* muisti ei käytössä */ }
  return "clearing";
}

/** Tallentaa valinnan; se tulee voimaan, kun sivu ladataan uudelleen (maailma rakennetaan kerran). */
export function saveArena(id: ArenaId): boolean {
  try { localStorage.setItem(ARENA_STORE, id); return true; } catch { return false; }
}

/** Tällä latauksella käytössä oleva alue. */
export const ARENA: ArenaId = savedArena();

/** Rakennuksen pohja maassa: suorakaide, jonka etusivu (ovi) osoittaa suuntaan yaw. */
interface Footprint { x: number; z: number; yaw: number; hx: number; front: number; back: number; }

interface Site {
  fire: { x: number; z: number };
  /** Maaston tasainen alue: kumpuilu alkaa säteeltä flat0 ja on täysi säteellä flat1. */
  flat0: number; flat1: number;
  /** Tasaisen alueen jäljelle jäävä epätasaisuus (0..1). */
  rough: number;
  /** Lähimpien puiden etäisyys keskipisteestä. */
  treeMin: number;
  /** Varvikko alkaa säteeltä shrub0 ja on täysi säteellä shrub1. */
  shrub0: number; shrub1: number;
  /** Tallatun maan säde keskeltä. */
  dirtR: number;
  /** Kamera pidetään tämän säteen sisällä, ettei se mene rakennusten sisään. */
  camMaxR: number;
  footprints: Footprint[];
  /** Pyöreät esteet (nuotio, kota, uhrikivi): x, z, säde. */
  circles: { x: number; z: number; r: number }[];
}

const KOTA = { x: 8.6, z: -9.6 };
const OFFERING = { x: -7.5, z: 5 };

/** Paikka kehällä: kulma asteina (0 = +z, 90 = +x) ja etäisyys d; etusivu osoittaa keskipisteeseen. */
function onRing(aDeg: number, d: number, hx: number, front: number, back: number): Footprint {
  const a = (aDeg * Math.PI) / 180;
  return { x: Math.sin(a) * d, z: Math.cos(a) * d, yaw: a + Math.PI, hx, front, back };
}

// Pihapiirin rakennukset kehällä taistelukehän ulkopuolella.
const HOUSE = onRing(180, 16.2, 6.3, 3.6, 3.6);
const PITHOUSE = onRing(72, 16.9, 2.5, 4.3, 2.8);
const STOREHOUSE = onRing(-104, 15.6, 2.0, 3.0, 2.1);
const SHED = onRing(-52, 14.6, 2.5, 1.9, 1.9);
const RACK = onRing(126, 15.4, 2.0, 0.8, 0.8);
const FENCE_R = 12.9;
const GATE_HALF = 0.11;       // portin puolileveys radiaaneina (etelässä, +z)
/** Kuoppatalon kulkukuilu, joka leikataan maastoon: puolileveys sekä alku ja loppu etusuuntaan
 *  (homestead.py: dw + 0.34, L/2 - 0.25, L/2 + RAMP). */
const PIT_HOLE = { half: 0.76, from: 2.05, to: 4.2 };

const SITES: Record<ArenaId, Site> = {
  clearing: {
    fire: { x: 4.5, z: 3 }, flat0: ARENA_RADIUS - 2, flat1: ARENA_RADIUS + 10, rough: 0.12,
    treeMin: ARENA_RADIUS + 2.2, shrub0: 5.5, shrub1: ARENA_RADIUS, dirtR: ARENA_RADIUS - 3, camMaxR: Infinity,
    footprints: [],
    circles: [{ x: 4.5, z: 3, r: 2.2 }, { x: KOTA.x, z: KOTA.z, r: 3.2 }, { x: OFFERING.x, z: OFFERING.z, r: 2.4 }],
  },
  homestead: {
    fire: { x: 5.6, z: -6.4 }, flat0: 20, flat1: 34, rough: 0.03,
    treeMin: 25, shrub0: 17, shrub1: 24, dirtR: 15, camMaxR: 12.2,
    footprints: [HOUSE, PITHOUSE, STOREHOUSE, SHED, RACK],
    circles: [{ x: 5.6, z: -6.4, r: 2.0 }],
  },
};
const SITE = SITES[ARENA];
const FIRE = SITE.fire;

/** Pisteen paikka rakennuksen omassa koordinaatistossa: [sivulle, eteen]. */
function toLocal(f: Footprint, x: number, z: number): [number, number] {
  const dx = x - f.x, dz = z - f.z, s = Math.sin(f.yaw), c = Math.cos(f.yaw);
  return [dx * c - dz * s, dx * s + dz * c];
}
/** Rakennuksen oman pisteen (sivulle, eteen) paikka maailmassa. */
function fromLocal(f: Footprint, lx: number, lz: number): [number, number] {
  const s = Math.sin(f.yaw), c = Math.cos(f.yaw);
  return [f.x + lx * c + lz * s, f.z - lx * s + lz * c];
}

/** Onko piste rakennuksen, nuotion tai muun kiinteän kohteen alla (pad laajentaa aluetta). */
function blocked(x: number, z: number, pad: number) {
  for (const c of SITE.circles) if (Math.hypot(x - c.x, z - c.z) < c.r + pad) return true;
  for (const f of SITE.footprints) {
    const [lx, lz] = toLocal(f, x, z);
    if (Math.abs(lx) < f.hx + pad && lz < f.front + pad && lz > -f.back - pad) return true;
  }
  return false;
}

function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hash2(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function noise2(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function groundHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const n = noise2(x * 0.08, z * 0.08) * 2.2 + noise2(x * 0.3, z * 0.3) * 0.35;
  // Aukio on lähes tasainen, reunoilla maasto kumpuilee.
  const t = THREE.MathUtils.smoothstep(r, SITE.flat0, SITE.flat1);
  return n * (SITE.rough + (1 - SITE.rough) * t) + t * 1.5;
}

/** Kosteus 0..1: korkea arvo = sammalta, mustikkaa ja kuusia; matala = kuivaa kangasta. */
function moisture(x: number, z: number) {
  return noise2(x * 0.07 + 11.3, z * 0.07 - 4.1) * 0.75 + noise2(x * 0.23, z * 0.23 + 9) * 0.25;
}

export interface World {
  campfireLight: THREE.PointLight;
  /** Taivaasta laskettu ympäristökartta hahmojen metallipinnoille. */
  envMap: THREE.Texture;
  /** Valmistuu, kun Blender-mallit on ladattu ja sijoiteltu. */
  ready: Promise<void>;
  /** Maaston laatoittuvat tekstuurit muiden maanpintojen (suo) käyttöön. */
  groundTex: GroundTex;
  /** Metsän malli nimellä (esim. "grass_d"); tyhjä, kunnes mallit on ladattu. */
  proto(name: string): { geometry: THREE.BufferGeometry; material: THREE.Material }[];
  /** Siirtää kameran paikan pois rakennusten sisältä (pihapiirissä kehän sisäpuolelle). */
  clearCamera(pos: THREE.Vector3): void;
  update(t: number, dt: number, camera: THREE.Camera): void;
}

export interface GroundTex { mossDiff: THREE.Texture; mossNor: THREE.Texture; dirtDiff: THREE.Texture; dirtNor: THREE.Texture; }

// ---------- Maasto: kolmen skannatun pinnan sekoitus ----------
function buildGround(scene: THREE.Scene, maxAniso: number): GroundTex {
  const size = 180, seg = 200;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const splat = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, groundHeight(x, z));
    const r = Math.hypot(x, z);
    const fire = Math.hypot(x - FIRE.x, z - FIRE.z);
    // Tallattu maa aukion keskellä ja nuotion ympärillä.
    let dirt = (1 - THREE.MathUtils.smoothstep(r, 1, SITE.dirtR)) * 0.8 + noise2(x * 0.6, z * 0.6) * 0.25 - 0.1;
    dirt = Math.max(dirt, 1 - THREE.MathUtils.smoothstep(fire, 0.8, 2.6));
    // Rakennusten edustat ja seinänvierustat ovat tallattua maata.
    for (const f of SITE.footprints) {
      const [lx, lz] = toLocal(f, x, z);
      const out = Math.max(Math.abs(lx) - f.hx, lz - f.front, -lz - f.back);
      dirt = Math.max(dirt, 1 - THREE.MathUtils.smoothstep(out + (noise2(x * 0.7, z * 0.7) - 0.5) * 1.2, 0.3, 2.2));
    }
    dirt = THREE.MathUtils.clamp(dirt, 0, 1);
    const m = moisture(x, z) + (noise2(x * 0.9, z * 0.9) - 0.5) * 0.25;
    const moss = THREE.MathUtils.smoothstep(m, 0.42, 0.62) * THREE.MathUtils.smoothstep(r, SITE.shrub0 - 0.5, SITE.shrub1) * (1 - dirt);
    const needles = Math.max(0.05, 1 - moss - dirt);
    splat.set([needles, moss, dirt], i * 3);
  }
  geo.setAttribute("splat", new THREE.BufferAttribute(splat, 3));
  geo.computeVertexNormals();

  const loader = new THREE.TextureLoader();
  const tex = (url: string, srgb: boolean) => {
    const t = loader.load(url);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = maxAniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const uniforms = {
    tN: { value: tex(needlesDiffUrl, true) }, tM: { value: tex(mossDiffUrl, true) }, tD: { value: tex(dirtDiffUrl, true) },
    nN: { value: tex(needlesNorUrl, false) }, nM: { value: tex(mossNorUrl, false) }, nD: { value: tex(dirtNorUrl, false) },
    // Maastoon leikattava suorakaide (kuoppatalon kulkukuilu): keskipiste, etusuunta ja puolimitat (sivulle, eteen).
    uHoleC: { value: new THREE.Vector2() }, uHoleDir: { value: new THREE.Vector2(0, 1) }, uHoleHalf: { value: new THREE.Vector2(0, 0) },
  };
  if (ARENA === "homestead") {
    const [cx, cz] = fromLocal(PITHOUSE, 0, (PIT_HOLE.from + PIT_HOLE.to) / 2);
    uniforms.uHoleC.value.set(cx, cz);
    uniforms.uHoleDir.value.set(Math.sin(PITHOUSE.yaw), Math.cos(PITHOUSE.yaw));
    uniforms.uHoleHalf.value.set(PIT_HOLE.half, (PIT_HOLE.to - PIT_HOLE.from) / 2);
  }
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec3 splat;\nvarying vec3 vSplat;\nvarying vec2 vGuv;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSplat = splat;\nvGuv = position.xz;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform sampler2D tN, tM, tD, nN, nM, nD;
        uniform vec2 uHoleC, uHoleDir, uHoleHalf;
        varying vec3 vSplat;
        varying vec2 vGuv;
        vec3 gW;
        vec2 gUvA, gUvB;`,
      )
      .replace(
        "#include <map_fragment>",
        `vec2 hd = vGuv - uHoleC;
        if (abs(dot(hd, vec2(uHoleDir.y, -uHoleDir.x))) < uHoleHalf.x && abs(dot(hd, uHoleDir)) < uHoleHalf.y) discard;
        gUvA = vGuv * 0.27;
        gUvB = vGuv * 0.061 + vec2(0.37, 0.11);   // toinen mittakaava häivyttää laatoituksen toiston
        vec3 cN = mix(texture2D(tN, gUvA).rgb, texture2D(tN, gUvB).rgb, 0.4);
        vec3 cM = mix(texture2D(tM, gUvA).rgb, texture2D(tM, gUvB).rgb, 0.4);
        vec3 cD = mix(texture2D(tD, gUvA).rgb, texture2D(tD, gUvB).rgb, 0.4);
        // Pinnan oma kuvio terävöittää rajat: sammal kasvaa laikkuina, ei tasaisena liukuna.
        gW = vSplat * vec3(0.75 + cN.r, 0.6 + cM.g * 2.2, 0.7 + cD.r);
        gW = pow(gW, vec3(3.0));
        gW /= (gW.x + gW.y + gW.z + 1e-5);
        diffuseColor.rgb *= cN * gW.x * 1.05 + cM * vec3(0.92, 1.08, 0.8) * gW.y + cD * vec3(0.72, 0.76, 0.78) * gW.z;`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `vec3 gn = (texture2D(nN, gUvA).xyz * gW.x + texture2D(nM, gUvA).xyz * gW.y + texture2D(nD, gUvA).xyz * gW.z) * 2.0 - 1.0;
        normal = normalize(normal + (viewMatrix * vec4(gn.x, 0.0, -gn.y, 0.0)).xyz * 1.3);`,
      );
  };
  const ground = new THREE.Mesh(geo, mat);
  ground.receiveShadow = true;
  scene.add(ground);
  return { mossDiff: uniforms.tM.value, mossNor: uniforms.nM.value, dirtDiff: uniforms.tD.value, dirtNor: uniforms.nD.value };
}

// ---------- Taivas ----------
function buildSky(scene: THREE.Scene, sunDir: THREE.Vector3) {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(260, 24, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { sunDir: { value: sunDir } },
      vertexShader: "varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `varying vec3 vDir; uniform vec3 sunDir;
        void main(){
          float h = clamp(vDir.y, 0.0, 1.0);
          vec3 zen = vec3(0.24, 0.42, 0.70), hor = vec3(0.60, 0.69, 0.74);
          vec3 c = mix(hor, zen, pow(h, 0.55));
          float s = max(dot(normalize(vDir), sunDir), 0.0);
          c += vec3(1.0, 0.75, 0.45) * (pow(s, 5.0) * 0.32 + pow(s, 120.0) * 2.5);
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  sky.renderOrder = -10;
  scene.add(sky);
  return sky;
}

// ---------- Nuotion liekki ----------
const FLAME_FRAG = `
  uniform float uTime; uniform float uSeed; varying vec2 vUv;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
  float fbm(vec2 p){ float a = 0.5, s = 0.0; for(int i=0;i<4;i++){ s += a*noise(p); p = p*2.03 + 7.1; a *= 0.5; } return s; }
  void main(){
    float y = vUv.y;
    float x = (vUv.x - 0.5) * 2.0;
    float n = fbm(vec2(x*1.7 + uSeed*7.0, y*2.3 - uTime*1.7));
    float n2 = fbm(vec2(x*4.5 - uSeed*3.0, y*5.0 - uTime*3.1));
    x += (n - 0.47) * 0.75 * y;                         // liekki huojuu enemmän ylhäällä
    float width = mix(0.78, 0.02, pow(y, 0.75));
    float body = 1.0 - smoothstep(width*0.35, width, abs(x));
    float f = body * (0.5 + 1.0*n) * (1.0 - y*0.7) + (n2 - 0.5) * 0.45 * body;
    f *= smoothstep(0.0, 0.07, y);
    float a = smoothstep(0.26, 0.6, f);
    vec3 col = mix(vec3(1.0, 0.20, 0.02), vec3(1.0, 0.55, 0.10), smoothstep(0.28, 0.55, f));
    col = mix(col, vec3(1.0, 0.90, 0.60), smoothstep(0.6, 0.95, f));
    gl_FragColor = vec4(col * a * 0.8, a);
  }`;

function softDot(inner: string, outer: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, inner);
  grd.addColorStop(1, outer);
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** Savupatsas: pehmeät harmaat pilvet, jotka nousevat, ajelehtivat tuulessa ja haihtuvat. */
function makeSmoke(parent: THREE.Object3D, count: number, life: number, y0: number, size: number, alpha: number) {
  const sPos = new Float32Array(count * 3);
  const sCol = new Float32Array(count * 4);
  const sLife = new Float32Array(count);
  for (let i = 0; i < count; i++) sLife[i] = (i / count) * life;
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
  sGeo.setAttribute("color", new THREE.BufferAttribute(sCol, 4));
  const smoke = new THREE.Points(
    sGeo,
    new THREE.PointsMaterial({ map: softDot("rgba(255,255,255,0.55)", "rgba(255,255,255,0)"), size, transparent: true, depthWrite: false, vertexColors: true }),
  );
  smoke.frustumCulled = false;
  parent.add(smoke);
  return (dt: number) => {
    for (let i = 0; i < count; i++) {
      sLife[i] += dt;
      if (sLife[i] > life) sLife[i] = 0;
      const l = sLife[i], seed = i * 2.11;
      sPos[i * 3] = Math.sin(seed + l * 0.6) * 0.12 * l + l * l * 0.035;      // heikko tuuli vie savua
      sPos[i * 3 + 1] = y0 + l * 1.25;
      sPos[i * 3 + 2] = Math.cos(seed * 1.3 + l * 0.5) * 0.12 * l;
      const a = Math.sin((l / life) * Math.PI) * alpha;
      sCol.set([0.42, 0.40, 0.38, a], i * 4);
    }
    sGeo.attributes.position.needsUpdate = true;
    sGeo.attributes.color.needsUpdate = true;
  };
}

function buildFire(scene: THREE.Scene) {
  const fy = groundHeight(FIRE.x, FIRE.z);
  const group = new THREE.Group();
  group.position.set(FIRE.x, fy, FIRE.z);
  scene.add(group);

  // Kaksi lomittaista liekkitasoa, jotka kääntyvät kameraa kohti.
  const flames: THREE.ShaderMaterial[] = [];
  const billboard = new THREE.Group();
  group.add(billboard);
  [[1.15, 1.7, 0.0, 0], [0.8, 1.25, 0.06, 1.7], [0.55, 0.9, 0.12, 4.1]].forEach(([w, h, zoff, seed]) => {
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uSeed: { value: seed } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: FLAME_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const q = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    q.position.set(0, h / 2 + 0.08, zoff);
    billboard.add(q);
    flames.push(m);
  });

  // Hehku maassa ja tuhkakehä.
  const ash = new THREE.Mesh(
    new THREE.CircleGeometry(1.0, 24),
    new THREE.MeshBasicMaterial({ map: softDot("rgba(8,7,6,0.95)", "rgba(8,7,6,0)"), transparent: true, depthWrite: false }),
  );
  ash.rotation.x = -Math.PI / 2;
  ash.position.y = 0.03;
  group.add(ash);
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 20),
    new THREE.MeshBasicMaterial({ map: softDot("rgba(255,120,30,1)", "rgba(255,60,0,0)"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.06;
  group.add(glow);

  const light = new THREE.PointLight(0xff8a3c, 9, 16, 1.5);
  light.position.set(FIRE.x, fy + 0.9, FIRE.z);
  scene.add(light);

  // Kipinät
  const emberCount = 70;
  const ePos = new Float32Array(emberCount * 3);
  const eLife = new Float32Array(emberCount);
  for (let i = 0; i < emberCount; i++) eLife[i] = (i / emberCount) * 2.4;
  const eGeo = new THREE.BufferGeometry();
  eGeo.setAttribute("position", new THREE.BufferAttribute(ePos, 3));
  const embers = new THREE.Points(
    eGeo,
    new THREE.PointsMaterial({ map: softDot("rgba(255,255,255,1)", "rgba(255,255,255,0)"), color: 0xffa040, size: 0.07, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  embers.frustumCulled = false;
  group.add(embers);

  const smoke = makeSmoke(group, 22, 7, 1.2, 2.2, 0.16);

  let ft = 0;
  return {
    light,
    update(dt: number, camera: THREE.Camera) {
      ft += dt;
      flames.forEach((m) => (m.uniforms.uTime.value = ft));
      billboard.rotation.y = Math.atan2(camera.position.x - FIRE.x, camera.position.z - FIRE.z);
      const flick = 0.78 + 0.14 * Math.sin(ft * 11) * Math.sin(ft * 6.3 + 1) + 0.08 * Math.sin(ft * 23.7);
      light.intensity = 9 * flick;
      light.position.x = FIRE.x + Math.sin(ft * 7.1) * 0.06;
      light.position.z = FIRE.z + Math.cos(ft * 5.3) * 0.06;
      (glow.material as THREE.MeshBasicMaterial).opacity = 0.6 + 0.4 * flick;
      for (let i = 0; i < emberCount; i++) {
        eLife[i] += dt;
        if (eLife[i] > 2.4) eLife[i] = 0;
        const l = eLife[i], seed = i * 1.37;
        ePos[i * 3] = Math.sin(seed + l * 2.3) * 0.22 * (0.3 + l);
        ePos[i * 3 + 1] = 0.35 + l * 1.5 + Math.sin(seed * 3 + l * 5) * 0.05;
        ePos[i * 3 + 2] = Math.cos(seed * 1.7 + l * 1.7) * 0.22 * (0.3 + l);
      }
      eGeo.attributes.position.needsUpdate = true;
      smoke(dt);
    },
  };
}

// ---------- Blender-mallien sijoittelu ----------
type Proto = { geometry: THREE.BufferGeometry; material: THREE.Material }[];

function prepareMaterials(protos: Map<string, Proto>, maxAniso: number) {
  const seen = new Set<THREE.Material>();
  for (const parts of protos.values()) {
    for (const p of parts) {
      const m = p.material as THREE.MeshStandardMaterial;
      if (seen.has(m)) continue;
      seen.add(m);
      for (const t of [m.map, m.normalMap]) if (t) t.anisotropy = maxAniso;
      if (/Rock/.test(m.name)) {
        // Skannin kiilto pois ja sävy harmaan graniitin suuntaan.
        m.roughness = 1;
        m.metalness = 0;
        m.color.setRGB(0.82, 0.86, 0.9);
        m.normalScale.setScalar(0.6);
      }
      if (/Thatch|Daub|Turf|Wattle|Wood|PoleBark|BirchBark|Dark/.test(m.name)) {
        // Pihapiirin rakennukset: mattapintaisia; ohuet seinät ja katot näkyvät molemmilta puolilta.
        m.roughness = 1;
        m.metalness = 0;
        m.side = THREE.DoubleSide;
        m.shadowSide = THREE.DoubleSide;
        // Sävyn viritys pelin valoon: punos ja puu ovat varjossa muuten lähes mustia, savi ja turve liian kylläisiä.
        if (/Wattle/.test(m.name)) m.color.setScalar(1.9);
        else if (/Wood|PoleBark/.test(m.name)) m.color.setScalar(1.45);
        else if (/Daub/.test(m.name)) m.color.setRGB(0.95, 1.0, 1.04);
        else if (/Turf/.test(m.name)) m.color.setRGB(0.8, 0.8, 0.8);
      }
      if (/Foliage|Grass|Fern/.test(m.name)) {
        // Alfaleikatut oksakortit: ei läpinäkyvyyslajittelua, pehmeät reunat MSAA:lla.
        m.transparent = false;
        m.alphaTest = 0.42;
        m.alphaToCoverage = true;
        m.side = THREE.DoubleSide;
        m.shadowSide = THREE.DoubleSide;
        m.metalness = 0;
        // Kortin kumpikin puoli valaistaan samalla (latvuksesta ulospäin osoittavalla) normaalilla.
        m.onBeforeCompile = (shader) => {
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <normal_fragment_begin>", "#undef DOUBLE_SIDED\n#include <normal_fragment_begin>");
        };
      }
    }
  }
}

function populate(scene: THREE.Scene, protos: Map<string, Proto>) {
  const r = rand(1849);
  const dummy = new THREE.Object3D();
  const batches = new Map<string, THREE.Matrix4[]>();
  const put = (key: string, x: number, z: number, scale: number, yaw: number, sink = 0, tilt = 0) => {
    dummy.position.set(x, groundHeight(x, z) - sink, z);
    dummy.rotation.set(tilt * (r() - 0.5), yaw, tilt * (r() - 0.5));
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key)!.push(dummy.matrix.clone());
  };
  /** Rakennus paikalleen pohjansa mukaan, etusivu keskipisteeseen päin. */
  const place = (key: string, f: Footprint, sink = 0.03) => put(key, f.x, f.z, 1, f.yaw, sink);

  // Puut: lähimmät kehänä aukion ympärillä, loput harvenevana metsänä.
  const trees: { x: number; z: number }[] = [];
  const tryTree = (x: number, z: number) => {
    const d = Math.hypot(x, z);
    if (d < SITE.treeMin || blocked(x, z, 1.5)) return;
    if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 2.6)) return;
    trees.push({ x, z });
    const m = moisture(x, z), k = r();
    let type: string;
    if (k < 0.1) type = r() < 0.5 ? "birch_a" : "birch_b";
    else if (k < 0.1 + 0.42 * THREE.MathUtils.smoothstep(m, 0.38, 0.62) + 0.06) type = ["spruce_a", "spruce_b", "spruce_young"][Math.floor(r() * 3)];
    else type = ["pine_a", "pine_b", "pine_c"][Math.floor(r() * 3)];
    // Lähipuut heittävät varjon, kaukaiset eivät (säästää varjorenderöintiä).
    put(type + (d < 34 ? "@near" : "@far"), x, z, 0.85 + r() * 0.35, r() * Math.PI * 2, 0.05, 0.05);
  };
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + r() * 0.2, d = SITE.treeMin + 0.4 + r() * 3.5;
    tryTree(Math.cos(a) * d, Math.sin(a) * d);
  }
  for (let i = 0; i < 520; i++) {
    const a = r() * Math.PI * 2, d = SITE.treeMin + 1.8 + Math.pow(r(), 0.8) * 62;
    tryTree(Math.cos(a) * d, Math.sin(a) * d);
  }

  // Kivet, kelot ja risut.
  for (let i = 0; i < 46; i++) {
    const a = r() * Math.PI * 2;
    const d = SITE.treeMin - 2.2 + (i < 9 ? 0.6 + r() * 2 : 3 + r() * 38);      // treeMin - 2,2 = aukion reuna
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (blocked(x, z, 0.5)) continue;
    const s = i < 9 ? 0.35 + r() * 0.35 : 0.25 + r() * 0.75;
    put(`rock_${1 + Math.floor(r() * 6)}@near`, x, z, s, r() * 6.28, 0.05, 0.3);
  }
  if (ARENA === "clearing") put("rock_3@near", OFFERING.x, OFFERING.z, 1.3, 0.7, 0.62);   // uhrikivi: sammaloitunut siirtolohkare
  put("log@near", FIRE.x + 1.9, FIRE.z + 1.3, 0.75, 2.2, 0.02);       // istuinpuu nuotiolla
  for (let i = 0; i < 7; i++) {
    const a = r() * 6.28, d = SITE.treeMin + 0.8 + r() * 26;
    put("log@near", Math.cos(a) * d, Math.sin(a) * d, 0.7 + r() * 0.5, r() * 6.28, 0.04, 0.1);
  }
  for (let i = 0; i < 110; i++) {
    const a = r() * 6.28, d = 6 + r() * 34;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (blocked(x, z, 0)) continue;
    put(`twig_${"abc"[Math.floor(r() * 3)]}`, x, z, 0.6 + r() * 0.8, r() * 6.28, 0.01, 0.2);
  }

  // Varvikko: mustikka kosteassa, puolukka ja kanerva kuivalla kankaalla.
  for (let i = 0; i < 26000; i++) {
    const a = r() * 6.28, d = SITE.shrub0 + Math.pow(r(), 0.9) * 34;
    const x = Math.cos(a) * d + (r() - 0.5), z = Math.sin(a) * d + (r() - 0.5);
    if (blocked(x, z, -0.6)) continue;
    const edge = THREE.MathUtils.smoothstep(d + (noise2(x * 0.45, z * 0.45) - 0.5) * 5, SITE.shrub0, SITE.shrub1);   // repaleinen raja aukioon
    if (r() > edge * (1 - d / 60)) continue;
    const m = moisture(x, z) + (r() - 0.5) * 0.2, k = r();
    let key: string;
    if (m > 0.5) key = k < 0.8 ? (k < 0.4 ? "bilberry_patch" : "bilberry_patch2") : "lingon_patch";
    else if (m > 0.36) key = k < 0.5 ? "lingon_patch" : k < 0.93 ? "bilberry_patch2" : "heather_patch";
    else key = k < 0.14 ? "heather_patch" : k < 0.75 ? "lingon_patch" : "bilberry_patch";
    put(key, x, z, 0.8 + r() * 0.6, r() * 6.28, 0.01, 0.15);
  }
  // Heinätupsut aukion laidoilla ja valoisissa kohdissa, saniaisia kosteissa painanteissa.
  for (let i = 0; i < 3200; i++) {
    const a = r() * 6.28, d = 3.5 + Math.pow(r(), 0.8) * 26;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (blocked(x, z, ARENA === "clearing" ? -0.4 : 0.4)) continue;
    if (d < ARENA_RADIUS - 1 && r() > 0.25) continue;         // aukion keskusta on tallattu
    put(d < ARENA_RADIUS ? "grass_d" : `grass_${"abcd"[Math.floor(r() * 4)]}`, x, z, 0.8 + r() * 0.7, r() * 6.28, 0.01);
  }
  for (let i = 0; i < 140; i++) {
    const a = r() * 6.28, d = SITE.treeMin - 1.2 + r() * 28;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (moisture(x, z) < 0.5 || blocked(x, z, 0)) continue;
    put(r() < 0.5 ? "fern_a" : "fern_b", x, z, 0.9 + r() * 0.8, r() * 6.28, 0.01);
  }

  put("campfire@near", FIRE.x, FIRE.z, 1, 0.4, 0.02);
  if (ARENA === "clearing") {
    put("kota@near", KOTA.x, KOTA.z, 1, 2.45, 0.05);     // oviaukko aukiolle päin
  } else {
    place("talo@near", HOUSE);
    place("kuoppatalo@near", PITHOUSE, 0);
    place("aitta@near", STOREHOUSE);
    place("katos@near", SHED);
    place("haasia@near", RACK);
    // Punosaita kehänä rakennusten väleissä; portti etelässä.
    const step = 2.0 / FENCE_R;
    for (let a = GATE_HALF + step / 2; a < Math.PI * 2 - GATE_HALF - step / 2 + 1e-6; a += step) {
      const rr = FENCE_R + Math.sin(a * 3.1) * 0.25;
      const x = Math.sin(a) * rr, z = Math.cos(a) * rr;
      if (blocked(x, z, 0.9)) continue;
      put("aita@near", x, z, 1, a + Math.sin(a * 7) * 0.06, 0.02);
    }
    for (const s of [-1, 1]) put("portinpieli@near", Math.sin(s * GATE_HALF) * FENCE_R, Math.cos(s * GATE_HALF) * FENCE_R, 1, s, 0);
    // Pihan tavarat: ruukut keittotulella, hakkuupölkky katoksen edessä, halkopino talon päädyssä.
    put("ruukku@near", FIRE.x + 0.95, FIRE.z - 0.5, 1, 0.3, 0.01);
    put("ruukku@near", FIRE.x - 0.7, FIRE.z - 1.0, 0.8, 2.1, 0.01);
    put("ruukku@near", FIRE.x - 1.05, FIRE.z - 0.55, 1.15, 4.0, 0.01);
    const [bx, bz] = fromLocal(SHED, 2.2, 2.6);
    put("polkky@near", bx, bz, 1, 0.8, 0.02);
    const [px, pz] = fromLocal(HOUSE, 7.2, 1.2);
    put("pino@near", px, pz, 1, HOUSE.yaw + Math.PI / 2, 0.02);
  }

  let tris = 0;
  for (const [key, mats] of batches) {
    const [name, tag] = key.split("@");
    const parts = protos.get(name);
    if (!parts) { console.warn("Malli puuttuu:", name); continue; }
    for (const p of parts) {
      const im = new THREE.InstancedMesh(p.geometry, p.material, mats.length);
      mats.forEach((m, i) => im.setMatrixAt(i, m));
      im.castShadow = tag === "near";
      im.receiveShadow = true;
      im.frustumCulled = false;
      scene.add(im);
      tris += ((p.geometry.index?.count ?? p.geometry.attributes.position.count) / 3) * mats.length;
    }
  }
  return { trees: trees.length, tris: Math.round(tris) };
}

export function buildWorld(scene: THREE.Scene, renderer: THREE.WebGLRenderer): World {
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  // Loppukesän ilta-aurinko: lämmin sivuvalo, viileä taivaanvalo, utu metsän syvyydessä.
  const sunPos = new THREE.Vector3(-22, 24, -15);
  scene.background = new THREE.Color(0xc8cfc9);
  scene.fog = new THREE.FogExp2(0x93a6ad, 0.0105);
  const sky = buildSky(scene, sunPos.clone().normalize());
  const envScene = new THREE.Scene();
  envScene.add(sky.clone());
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(envScene, 0, 1, 400).texture;
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight(0xc6d2e2, 0x6e6a52, 2.0));
  const sun = new THREE.DirectionalLight(0xffcf9a, 3.6);
  sun.position.copy(sunPos);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera;
  sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 110;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.05;
  scene.add(sun);

  const groundTex = buildGround(scene, maxAniso);
  const protos = new Map<string, Proto>();
  const fire = buildFire(scene);

  // Talon savu nousee päädyn savuaukosta (pihapiiri).
  let houseSmoke: ((dt: number) => void) | null = null;
  if (ARENA === "homestead") {
    const [sx, sz] = fromLocal(HOUSE, 5.0, 0);
    const g = new THREE.Group();
    g.position.set(sx, groundHeight(sx, sz), sz);
    scene.add(g);
    houseSmoke = makeSmoke(g, 16, 8, 4.5, 2.6, 0.1);
  }

  const loader = new GLTFLoader();
  const files = ARENA === "homestead" ? [forestUrl, homesteadUrl] : [forestUrl];
  const ready = Promise.all(files.map((u) => loader.loadAsync(u))).then((gltfs) => {
    for (const gltf of gltfs) {
      for (const child of gltf.scene.children) {
        const parts: Proto = [];
        child.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh) parts.push({ geometry: mesh.geometry, material: mesh.material as THREE.Material });
        });
        if (parts.length) protos.set(child.name, parts);
      }
    }
    prepareMaterials(protos, maxAniso);
    const stats = populate(scene, protos);
    (window as unknown as { __world: unknown }).__world = stats;
  });
  ready.catch((e) => console.error("Maailman mallien lataus epäonnistui", e));

  return {
    campfireLight: fire.light,
    envMap,
    ready,
    groundTex,
    proto: (name) => protos.get(name) ?? [],
    clearCamera(pos) {
      const r = Math.hypot(pos.x, pos.z);
      if (r > SITE.camMaxR) { pos.x *= SITE.camMaxR / r; pos.z *= SITE.camMaxR / r; }
    },
    update(_t, dt, camera) {
      fire.update(dt, camera);
      houseSmoke?.(dt);
    },
  };
}
