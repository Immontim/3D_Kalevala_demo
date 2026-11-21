import * as THREE from "three";

// Metsän piirto pelaajan ympärille. Jokainen puu on joko täysi malli (lähellä, heittää varjon)
// tai Blenderissä kevennetty kaukopuu (forest_lod.glb: kevennetty runko + kolme kuvakorttia).
// Rajalla puu vaihtuu pikselikuviolla häivyttäen (screen-door), joten vaihto ei poksahda.
// Kaikki saman lajin puut ovat yhdessä instanssinipussa: piirtokutsuja on lajien ja osien verran,
// ei puiden verran. Lista kootaan uudelleen vain, kun pelaaja on liikkunut.

export type ForestProto = { geometry: THREE.BufferGeometry; material: THREE.Material }[];

/** Yksi puu maailmassa. */
export interface TreeSpot {
  type: string;
  x: number; y: number; z: number;
  scale: number;
  yaw: number;
  /** Pieni kallistus x- ja z-akselin ympäri (rad). */
  tiltX: number; tiltZ: number;
}

export interface ForestOptions {
  /** Täydet puut tämän säteen sisällä pelaajasta (m). */
  nearR: number;
  /** Vaihtokaistan leveys (m): kaistalla molemmat näkyvät vastakkaisilla pikselikuvioilla. */
  band: number;
  /** Uudelleenkokoamisen kynnys: pelaajan liike (m). */
  step: number;
  /** Tätä kauempana ei piirretä mitään (sumu peittää jo); kaukopuuton laji häivytetään tähän. */
  farR: number;
  /** Kaukorajan häivytyskaista (m). */
  farBand: number;
}

const DEFAULTS: ForestOptions = { nearR: 36, band: 7, step: 0.8, farR: Infinity, farBand: 15 };

/** Bayer 4×4 -kynnys pikselille; sama kuvio täysille ja kaukopuille, vastakkaisin ehdoin. */
const DITHER_GLSL = `
float forestBayer(vec2 p) {
  vec2 q = mod(floor(p), 4.0);
  float i = q.x + q.y * 4.0;
  // 4×4 Bayer-matriisi riveittäin.
  float b = i < 1.0 ? 0.0 : i < 2.0 ? 8.0 : i < 3.0 ? 2.0 : i < 4.0 ? 10.0
    : i < 5.0 ? 12.0 : i < 6.0 ? 4.0 : i < 7.0 ? 14.0 : i < 8.0 ? 6.0
    : i < 9.0 ? 3.0 : i < 10.0 ? 11.0 : i < 11.0 ? 1.0 : i < 12.0 ? 9.0
    : i < 13.0 ? 15.0 : i < 14.0 ? 7.0 : i < 15.0 ? 13.0 : 5.0;
  return (b + 0.5) / 16.0;
}`;

/**
 * Kloonaa materiaalin ja lisää siihen instanssikohtaisen häivytyksen (attribuutti `aFade`, 1 = näkyy).
 * `inverse`: kaukopuu näkyy niissä pikseleissä, joista täysi puu on jo häipynyt. Alkuperäisen
 * materiaalin onBeforeCompile ketjutetaan (lehvästön valaistus ja lähihäivytys säilyvät).
 */
function fadeMaterial(base: THREE.Material, inverse: boolean): THREE.Material {
  const m = base.clone();
  const prev = base.onBeforeCompile;
  const prevKey = base.customProgramCacheKey();
  m.onBeforeCompile = (shader, renderer) => {
    prev.call(base, shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aFade;\nvarying float vForestFade;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvForestFade = aFade;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying float vForestFade;\n${DITHER_GLSL}`)
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
        if (vForestFade < 0.999) {
          float fb = forestBayer(gl_FragCoord.xy);
          ${inverse ? "if (fb < 1.0 - vForestFade) discard;" : "if (fb >= vForestFade) discard;"}
        }`,
      );
  };
  m.customProgramCacheKey = () => `${prevKey}|forest${inverse ? "-lod" : "-full"}`;
  return m;
}

interface Layer {
  meshes: THREE.InstancedMesh[];
  fade: THREE.InstancedBufferAttribute;
  matrix: Float32Array;
}

interface Kind {
  type: string;
  /** Puiden valmiit matriisit (16 lukua per puu) ja paikat. */
  matrices: Float32Array;
  xz: Float32Array;
  full: Layer | null;
  lod: Layer | null;
}

export class Forest {
  private kinds: Kind[] = [];
  private opts: ForestOptions;
  private last = new THREE.Vector2(Infinity, Infinity);
  private shown = { full: 0, lod: 0, tris: 0 };

  /**
   * @param full täyden mallin osat lajin nimellä ("spruce_a")
   * @param lod kaukopuun osat ("spruce_a_lod1"); puuttuva kaukopuu = laji piirretään aina täytenä
   */
  constructor(
    scene: THREE.Scene,
    trees: readonly TreeSpot[],
    full: (name: string) => ForestProto | undefined,
    lod: (name: string) => ForestProto | undefined,
    opts: Partial<ForestOptions> = {},
  ) {
    this.opts = { ...DEFAULTS, ...opts };
    const byType = new Map<string, TreeSpot[]>();
    for (const t of trees) {
      if (!byType.has(t.type)) byType.set(t.type, []);
      byType.get(t.type)!.push(t);
    }
    const dummy = new THREE.Object3D();
    const fadeMats = new Map<string, THREE.Material>();
    const fadeMat = (m: THREE.Material, inverse: boolean) => {
      const key = `${m.uuid}|${inverse}`;
      if (!fadeMats.has(key)) fadeMats.set(key, fadeMaterial(m, inverse));
      return fadeMats.get(key)!;
    };
    for (const [type, list] of byType) {
      const fullParts = full(type);
      if (!fullParts?.length) { console.warn("Puumalli puuttuu:", type); continue; }
      const lodParts = lod(`${type}_lod1`);
      const n = list.length;
      const matrices = new Float32Array(n * 16);
      const xz = new Float32Array(n * 2);
      list.forEach((t, i) => {
        dummy.position.set(t.x, t.y, t.z);
        dummy.rotation.set(t.tiltX, t.yaw, t.tiltZ);
        dummy.scale.setScalar(t.scale);
        dummy.updateMatrix();
        dummy.matrix.toArray(matrices, i * 16);
        xz[i * 2] = t.x;
        xz[i * 2 + 1] = t.z;
      });
      const layer = (parts: ForestProto, inverse: boolean, shadow: boolean): Layer => {
        const fade = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
        fade.setUsage(THREE.DynamicDrawUsage);
        const matrix = new Float32Array(n * 16);
        // Lajin kaikki osat (runko, lehvästö) jakavat saman matriisipuskurin: yksi lähetys näytönohjaimelle.
        const inst = new THREE.InstancedBufferAttribute(matrix, 16);
        inst.setUsage(THREE.DynamicDrawUsage);
        const meshes = parts.map((p) => {
          // Geometrian kopio (attribuutit jaetaan), jotta häivytysattribuutti ei vuoda muihin käyttäjiin.
          const geo = new THREE.BufferGeometry();
          geo.index = p.geometry.index;
          for (const [name, attr] of Object.entries(p.geometry.attributes)) geo.setAttribute(name, attr);
          geo.groups = p.geometry.groups;
          geo.boundingSphere = p.geometry.boundingSphere;
          geo.boundingBox = p.geometry.boundingBox;
          geo.setAttribute("aFade", fade);
          const im = new THREE.InstancedMesh(geo, fadeMat(p.material, inverse), n);
          im.instanceMatrix = inst;
          im.count = 0;
          im.castShadow = shadow;
          im.receiveShadow = true;
          im.frustumCulled = false;
          im.name = `forest:${type}${inverse ? ":lod" : ""}`;
          scene.add(im);
          return im;
        });
        return { meshes, fade, matrix };
      };
      this.kinds.push({
        type, matrices, xz,
        full: layer(fullParts, false, true),
        lod: lodParts?.length ? layer(lodParts, true, false) : null,
      });
    }
  }

  /** Kokoaa näkyvät puut uudelleen, jos pelaaja on liikkunut kynnystä enemmän. */
  update(focus: THREE.Vector3, force = false) {
    if (!force && Math.hypot(focus.x - this.last.x, focus.z - this.last.y) < this.opts.step) return;
    this.last.set(focus.x, focus.z);
    const { nearR, band, farR, farBand } = this.opts;
    const inner = nearR - band;
    let fullN = 0, lodN = 0, tris = 0;
    for (const k of this.kinds) {
      let nf = 0, nl = 0;
      const n = k.xz.length / 2;
      const fullFade = k.full!.fade.array as Float32Array;
      const lodFade = k.lod ? (k.lod.fade.array as Float32Array) : null;
      for (let i = 0; i < n; i++) {
        const d = Math.hypot(k.xz[i * 2] - focus.x, k.xz[i * 2 + 1] - focus.z);
        if (d >= farR) continue;
        const far = 1 - THREE.MathUtils.smoothstep(d, farR - farBand, farR);   // 1 = näkyy, 0 = sumussa
        if (!k.lod) {
          // Kaukomallittomat (kivet, kelot): täysi malli kaukorajaan asti.
          k.full!.matrix.set(k.matrices.subarray(i * 16, i * 16 + 16), nf * 16);
          fullFade[nf] = far;
          nf++;
          continue;
        }
        const t = THREE.MathUtils.smoothstep(d, inner, nearR);   // 0 = täysi, 1 = kaukopuu
        if (t < 1) {
          k.full!.matrix.set(k.matrices.subarray(i * 16, i * 16 + 16), nf * 16);
          fullFade[nf] = 1 - t;
          nf++;
        }
        if (lodFade && t > 0) {
          k.lod.matrix.set(k.matrices.subarray(i * 16, i * 16 + 16), nl * 16);
          lodFade[nl] = t * far;
          nl++;
        }
      }
      for (const [layer, count] of [[k.full, nf], [k.lod, nl]] as const) {
        if (!layer) continue;
        layer.fade.needsUpdate = true;
        layer.fade.clearUpdateRanges();
        layer.fade.addUpdateRange(0, Math.max(1, count));
        const inst = layer.meshes[0].instanceMatrix;
        inst.needsUpdate = true;
        inst.clearUpdateRanges();
        inst.addUpdateRange(0, Math.max(16, count * 16));
        for (const im of layer.meshes) {
          im.count = count;
          const g = im.geometry;
          tris += ((g.index?.count ?? g.attributes.position.count) / 3) * count;
        }
      }
      fullN += nf;
      lodN += nl;
    }
    this.shown = { full: fullN, lod: lodN, tris: Math.round(tris) };
  }

  /** Säätö savutesteihin: lähisäde (m). Esim. 0 = kaikki kaukopuina, 999 = kaikki täysinä. */
  setNear(nearR: number, band = this.opts.band) {
    this.opts.nearR = nearR;
    this.opts.band = Math.min(band, nearR);
    this.last.set(Infinity, Infinity);
  }

  /** Viimeisimmän kokoamisen luvut (konsolin `__world.forest`). */
  stats() { return { ...this.shown, types: this.kinds.length, trees: this.kinds.reduce((s, k) => s + k.xz.length / 2, 0) }; }
}

/**
 * Horisonttimetsä: forest_lod.glb:n `metsaseina`-suikale (80 × 20 m) kehänä tai murtoviivana.
 * Suikale on kortti, joka katsoo keskustaa kohti; asetetaan sumun taakse, missä metsä muuten loppuisi.
 */
export function placeForestWall(
  scene: THREE.Scene,
  wall: ForestProto,
  points: readonly { x: number; z: number; y: number; yaw: number; scale: number }[],
) {
  if (!wall.length) return 0;
  const dummy = new THREE.Object3D();
  for (const part of wall) {
    const im = new THREE.InstancedMesh(part.geometry, part.material, points.length);
    points.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, p.yaw, 0);
      dummy.scale.set(p.scale, p.scale * (0.9 + ((i * 37) % 7) * 0.04), p.scale);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    });
    im.frustumCulled = false;
    im.receiveShadow = false;
    im.castShadow = false;
    im.name = "forest:wall";
    scene.add(im);
  }
  return points.length;
}

/** Yksi aluskasvillisuuden esiintymä: mallin nimi ja valmis matriisi. */
export interface ScatterItem { key: string; matrix: THREE.Matrix4 }

/**
 * Aluskasvillisuus ruutuina pelaajan ympärillä (laaja kohtaus): ruutu luodaan ensimmäisellä
 * tarpeella generaattorilla ja pidetään muistissa. Näkyvät ruudut kootaan samoihin
 * instanssinippuihin, ja kaukaisin kaista häivytetään pikselikuviolla, ettei reuna poksahda.
 */
export class ScatterField {
  private tiles = new Map<string, { key: string; m: Float32Array; x: number; z: number }[]>();
  private meshes = new Map<string, { parts: THREE.InstancedMesh[]; fade: THREE.InstancedBufferAttribute; inst: THREE.InstancedBufferAttribute; cap: number }>();
  private last = new THREE.Vector2(Infinity, Infinity);
  private shown = 0;

  constructor(
    private scene: THREE.Scene,
    private proto: (name: string) => ForestProto | undefined,
    private generate: (tx: number, tz: number, size: number) => ScatterItem[],
    private opts: { tile: number; radius: number; band: number; step: number; shadows?: (key: string) => boolean } = { tile: 12, radius: 34, band: 6, step: 0.8 },
  ) {}

  private tile(tx: number, tz: number) {
    const id = `${tx},${tz}`;
    let t = this.tiles.get(id);
    if (!t) {
      t = this.generate(tx, tz, this.opts.tile).map((it) => {
        const m = new Float32Array(16);
        it.matrix.toArray(m);
        return { key: it.key, m, x: m[12], z: m[14] };
      });
      this.tiles.set(id, t);
    }
    return t;
  }

  private mesh(key: string, need: number) {
    let e = this.meshes.get(key);
    if (e && e.cap >= need) return e;
    const parts = this.proto(key);
    if (!parts?.length) return null;
    const cap = Math.max(256, Math.ceil(need * 1.5));
    if (e) for (const im of e.parts) { im.removeFromParent(); im.geometry.dispose(); }
    const fade = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
    fade.setUsage(THREE.DynamicDrawUsage);
    const inst = new THREE.InstancedBufferAttribute(new Float32Array(cap * 16), 16);
    inst.setUsage(THREE.DynamicDrawUsage);
    const shadow = this.opts.shadows?.(key) ?? false;
    const ims = parts.map((p) => {
      const geo = new THREE.BufferGeometry();
      geo.index = p.geometry.index;
      for (const [name, attr] of Object.entries(p.geometry.attributes)) geo.setAttribute(name, attr);
      geo.groups = p.geometry.groups;
      geo.setAttribute("aFade", fade);
      const im = new THREE.InstancedMesh(geo, scatterMaterial(p.material), cap);
      im.instanceMatrix = inst;
      im.count = 0;
      im.frustumCulled = false;
      im.receiveShadow = true;
      im.castShadow = shadow;
      im.name = `scatter:${key}`;
      this.scene.add(im);
      return im;
    });
    e = { parts: ims, fade, inst, cap };
    this.meshes.set(key, e);
    return e;
  }

  update(focus: THREE.Vector3, force = false) {
    if (!force && Math.hypot(focus.x - this.last.x, focus.z - this.last.y) < this.opts.step) return;
    this.last.set(focus.x, focus.z);
    const { tile, radius, band } = this.opts;
    const reach = Math.ceil((radius + tile) / tile);
    const cx = Math.floor(focus.x / tile), cz = Math.floor(focus.z / tile);
    const lists = new Map<string, { m: Float32Array; f: number }[]>();
    for (let dz = -reach; dz <= reach; dz++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const tx = cx + dx, tz = cz + dz;
        // Ruudun lähin piste pelaajaan: koko ruutu jää pois, jos se on säteen ulkopuolella.
        const nx = THREE.MathUtils.clamp(focus.x, tx * tile, tx * tile + tile), nz = THREE.MathUtils.clamp(focus.z, tz * tile, tz * tile + tile);
        if (Math.hypot(nx - focus.x, nz - focus.z) > radius) continue;
        for (const it of this.tile(tx, tz)) {
          const d = Math.hypot(it.x - focus.x, it.z - focus.z);
          if (d > radius) continue;
          const f = 1 - THREE.MathUtils.smoothstep(d, radius - band, radius);
          let l = lists.get(it.key);
          if (!l) lists.set(it.key, (l = []));
          l.push({ m: it.m, f });
        }
      }
    }
    let shown = 0;
    for (const key of new Set([...lists.keys(), ...this.meshes.keys()])) {
      const l = lists.get(key) ?? [];
      const e = this.mesh(key, l.length);
      if (!e) continue;
      const fa = e.fade.array as Float32Array, ia = e.inst.array as Float32Array;
      l.forEach((it, i) => { ia.set(it.m, i * 16); fa[i] = it.f; });
      e.inst.needsUpdate = true;
      e.inst.clearUpdateRanges();
      e.inst.addUpdateRange(0, Math.max(16, l.length * 16));
      e.fade.needsUpdate = true;
      e.fade.clearUpdateRanges();
      e.fade.addUpdateRange(0, Math.max(1, l.length));
      for (const im of e.parts) im.count = l.length;
      shown += l.length;
    }
    this.shown = shown;
  }

  stats() { return { instances: this.shown, tiles: this.tiles.size }; }
}

const scatterMats = new Map<string, THREE.Material>();
/** Aluskasvillisuuden materiaali: sama häivytys kuin täysillä puilla (fade 1 = näkyy). */
function scatterMaterial(base: THREE.Material) {
  let m = scatterMats.get(base.uuid);
  if (!m) scatterMats.set(base.uuid, (m = fadeMaterial(base, false)));
  return m;
}
