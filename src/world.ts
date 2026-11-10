import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import forestUrl from "../assets/forest.glb?url";
import needlesDiffUrl from "../assets/ground/needles_diff.webp";
import needlesNorUrl from "../assets/ground/needles_nor.webp";
import mossDiffUrl from "../assets/ground/moss_diff.webp";
import mossNorUrl from "../assets/ground/moss_nor.webp";
import dirtDiffUrl from "../assets/ground/dirt_diff.webp";
import dirtNorUrl from "../assets/ground/dirt_nor.webp";

// Metsäaukio kangasmetsässä: maasto, männyt, kuuset, koivut, varvut, kivet,
// kota ja nuotio. Mallit tulevat Blenderistä (assets/forest.glb); tämä tiedosto
// sijoittelee ne instansseina ja hoitaa valon, maaston ja tulen.

export const ARENA_RADIUS = 11;

const FIRE = { x: 4.5, z: 3 };
const KOTA = { x: 8.6, z: -9.6 };
const OFFERING = { x: -7.5, z: 5 };

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
  const t = THREE.MathUtils.smoothstep(r, ARENA_RADIUS - 2, ARENA_RADIUS + 10);
  return n * (0.12 + 0.88 * t) + t * 1.5;
}

/** Kosteus 0..1: korkea arvo = sammalta, mustikkaa ja kuusia; matala = kuivaa kangasta. */
function moisture(x: number, z: number) {
  return noise2(x * 0.07 + 11.3, z * 0.07 - 4.1) * 0.75 + noise2(x * 0.23, z * 0.23 + 9) * 0.25;
}

export interface World {
  campfireLight: THREE.PointLight;
  /** Valmistuu, kun Blender-mallit on ladattu ja sijoiteltu. */
  ready: Promise<void>;
  update(t: number, dt: number, camera: THREE.Camera): void;
}

// ---------- Maasto: kolmen skannatun pinnan sekoitus ----------
function buildGround(scene: THREE.Scene, maxAniso: number) {
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
    let dirt = (1 - THREE.MathUtils.smoothstep(r, 1, ARENA_RADIUS - 3)) * 0.8 + noise2(x * 0.6, z * 0.6) * 0.25 - 0.1;
    dirt = Math.max(dirt, 1 - THREE.MathUtils.smoothstep(fire, 0.8, 2.6));
    dirt = THREE.MathUtils.clamp(dirt, 0, 1);
    const m = moisture(x, z) + (noise2(x * 0.9, z * 0.9) - 0.5) * 0.25;
    const moss = THREE.MathUtils.smoothstep(m, 0.42, 0.62) * THREE.MathUtils.smoothstep(r, 5, ARENA_RADIUS) * (1 - dirt);
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
  };
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
        varying vec3 vSplat;
        varying vec2 vGuv;
        vec3 gW;
        vec2 gUvA, gUvB;`,
      )
      .replace(
        "#include <map_fragment>",
        `gUvA = vGuv * 0.27;
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

  // Savu: pehmeät harmaat pilvet, jotka nousevat ja haihtuvat.
  const smokeCount = 22;
  const sPos = new Float32Array(smokeCount * 3);
  const sCol = new Float32Array(smokeCount * 4);
  const sLife = new Float32Array(smokeCount);
  for (let i = 0; i < smokeCount; i++) sLife[i] = (i / smokeCount) * 7;
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
  sGeo.setAttribute("color", new THREE.BufferAttribute(sCol, 4));
  const smoke = new THREE.Points(
    sGeo,
    new THREE.PointsMaterial({ map: softDot("rgba(255,255,255,0.55)", "rgba(255,255,255,0)"), size: 2.2, transparent: true, depthWrite: false, vertexColors: true }),
  );
  smoke.frustumCulled = false;
  group.add(smoke);

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
      for (let i = 0; i < smokeCount; i++) {
        sLife[i] += dt;
        if (sLife[i] > 7) sLife[i] = 0;
        const l = sLife[i], seed = i * 2.11;
        sPos[i * 3] = Math.sin(seed + l * 0.6) * 0.12 * l + l * l * 0.035;      // heikko tuuli vie savua
        sPos[i * 3 + 1] = 1.2 + l * 1.25;
        sPos[i * 3 + 2] = Math.cos(seed * 1.3 + l * 0.5) * 0.12 * l;
        const a = Math.sin((l / 7) * Math.PI) * 0.16;
        sCol.set([0.42, 0.40, 0.38, a], i * 4);
      }
      sGeo.attributes.position.needsUpdate = true;
      sGeo.attributes.color.needsUpdate = true;
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
  const blocked = (x: number, z: number, pad: number) =>
    Math.hypot(x - FIRE.x, z - FIRE.z) < 2.2 + pad || Math.hypot(x - KOTA.x, z - KOTA.z) < 3.2 + pad ||
    Math.hypot(x - OFFERING.x, z - OFFERING.z) < 2.4 + pad;

  // Puut: lähimmät kehänä aukion ympärillä, loput harvenevana metsänä.
  const trees: { x: number; z: number }[] = [];
  const tryTree = (x: number, z: number) => {
    const d = Math.hypot(x, z);
    if (d < ARENA_RADIUS + 2.2 || blocked(x, z, 1.5)) return;
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
    const a = (i / 26) * Math.PI * 2 + r() * 0.2, d = ARENA_RADIUS + 2.6 + r() * 3.5;
    tryTree(Math.cos(a) * d, Math.sin(a) * d);
  }
  for (let i = 0; i < 520; i++) {
    const a = r() * Math.PI * 2, d = ARENA_RADIUS + 4 + Math.pow(r(), 0.8) * 62;
    tryTree(Math.cos(a) * d, Math.sin(a) * d);
  }

  // Kivet, kelot ja risut.
  for (let i = 0; i < 46; i++) {
    const a = r() * Math.PI * 2;
    const d = i < 9 ? ARENA_RADIUS + 0.6 + r() * 2 : ARENA_RADIUS + 3 + r() * 38;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (blocked(x, z, 0.5)) continue;
    const s = i < 9 ? 0.35 + r() * 0.35 : 0.25 + r() * 0.75;
    put(`rock_${1 + Math.floor(r() * 6)}@near`, x, z, s, r() * 6.28, 0.05, 0.3);
  }
  put("rock_3@near", OFFERING.x, OFFERING.z, 1.3, 0.7, 0.62);   // uhrikivi: sammaloitunut siirtolohkare
  put("log@near", FIRE.x + 1.9, FIRE.z + 1.3, 0.75, 2.2, 0.02);       // istuinpuu nuotiolla
  for (let i = 0; i < 7; i++) {
    const a = r() * 6.28, d = ARENA_RADIUS + 3 + r() * 26;
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
    const a = r() * 6.28, d = 5.5 + Math.pow(r(), 0.9) * 34;
    const x = Math.cos(a) * d + (r() - 0.5), z = Math.sin(a) * d + (r() - 0.5);
    if (blocked(x, z, -0.6)) continue;
    const edge = THREE.MathUtils.smoothstep(d + (noise2(x * 0.45, z * 0.45) - 0.5) * 5, 5.5, ARENA_RADIUS);   // repaleinen raja aukioon
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
    if (blocked(x, z, -0.4)) continue;
    if (d < ARENA_RADIUS - 1 && r() > 0.25) continue;         // aukion keskusta on tallattu
    put(d < ARENA_RADIUS ? "grass_d" : `grass_${"abcd"[Math.floor(r() * 4)]}`, x, z, 0.8 + r() * 0.7, r() * 6.28, 0.01);
  }
  for (let i = 0; i < 140; i++) {
    const a = r() * 6.28, d = ARENA_RADIUS + 1 + r() * 28;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (moisture(x, z) < 0.5 || blocked(x, z, 0)) continue;
    put(r() < 0.5 ? "fern_a" : "fern_b", x, z, 0.9 + r() * 0.8, r() * 6.28, 0.01);
  }

  put("campfire@near", FIRE.x, FIRE.z, 1, 0.4, 0.02);
  put("kota@near", KOTA.x, KOTA.z, 1, 2.45, 0.05);     // oviaukko aukiolle päin

  let tris = 0;
  for (const [key, mats] of batches) {
    const [name, tag] = key.split("@");
    const parts = protos.get(name);
    if (!parts) { console.warn("Malli puuttuu forest.glb:stä:", name); continue; }
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
  buildSky(scene, sunPos.clone().normalize());

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

  buildGround(scene, maxAniso);
  const fire = buildFire(scene);

  const ready = new GLTFLoader().loadAsync(forestUrl).then((gltf) => {
    const protos = new Map<string, Proto>();
    for (const child of gltf.scene.children) {
      const parts: Proto = [];
      child.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) parts.push({ geometry: mesh.geometry, material: mesh.material as THREE.Material });
      });
      if (parts.length) protos.set(child.name, parts);
    }
    prepareMaterials(protos, maxAniso);
    const stats = populate(scene, protos);
    (window as unknown as { __world: unknown }).__world = stats;
  });
  ready.catch((e) => console.error("Metsän mallien lataus epäonnistui", e));

  return {
    campfireLight: fire.light,
    ready,
    update(_t, dt, camera) {
      fire.update(dt, camera);
    },
  };
}
