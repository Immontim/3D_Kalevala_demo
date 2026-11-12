import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import bogUrl from "../assets/bog.glb?url";
import { World, groundHeight } from "./world";

// Suo, johon vihollinen lauletaan. Muodot tulevat Blenderistä (assets/bog.glb: mutapinta,
// turvereunus ja kuplan malli), pinnat maaston tekstuureista ja liike tästä tiedostosta:
// muta velloo, kuplat kasvavat ja puhkeavat ja jättävät renkaan pintaan.

/** Säädettävät luvut yhdessä paikassa. */
export const BOG = {
  /** Kuinka nopeasti suo aukeaa ja sulkeutuu (1/s). */
  growRate: 3,
  /** Mudan vellonnan korkeus metreinä. */
  churn: 0.024,
  bubbles: 7,
  bubbleRadius: [0.05, 0.14] as [number, number],
  /** Kuplan kasvuaika sekunteina. */
  bubbleLife: [0.7, 1.7] as [number, number],
  /** Puhkeamisen jälkeisen renkaan kesto. */
  rippleTime: 0.9,
  /** Heinätupsuja reunuksella. */
  tufts: 10,
};

/** Metsän heinämallit, joita reunuksella kasvaa. */
const TUFT_MODELS = ["grass_a", "grass_c"];

interface Bubble { x: number; z: number; r: number; age: number; life: number; wait: number; }

export class Bog {
  readonly group = new THREE.Group();
  private size = 0;
  private open = false;
  private time = 0;
  private mud: THREE.Mesh | null = null;
  private mudBase: Float32Array | null = null;
  private mudAmp: Float32Array | null = null;
  private rim: THREE.Mesh | null = null;
  private rimBase: Float32Array | null = null;
  private domes: THREE.InstancedMesh | null = null;
  private tufts: { mesh: THREE.InstancedMesh; spots: number[] }[] = [];
  private tuftSpots: { x: number; z: number; yaw: number; scale: number }[] = [];
  private bubbles: Bubble[] = [];
  private dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene, world: World) {
    this.group.visible = false;
    scene.add(this.group);
    for (let i = 0; i < BOG.bubbles; i++) this.bubbles.push(this.newBubble(Math.random() * 1.5));
    for (let i = 0; i < BOG.tufts; i++) {
      const a = (i / BOG.tufts) * Math.PI * 2 + Math.random() * 0.5;
      const d = 1.45 + Math.random() * 0.3;
      this.tuftSpots.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, yaw: Math.random() * 6.28, scale: 0.55 + Math.random() * 0.5 });
    }

    const loaded = new GLTFLoader().loadAsync(bogUrl).then((gltf) => {
      const geo = (name: string) => (gltf.scene.getObjectByName(name) as THREE.Mesh).geometry;
      const { groundTex: tex, envMap } = world;

      // Märkä muta: tumma, kiiltävä, taivas heijastuu vellovasta pinnasta.
      const mudMat = new THREE.MeshStandardMaterial({
        vertexColors: true, color: 0x6a6258, roughness: 0.3, metalness: 0, normalMap: tex.dirtNor,
        normalScale: new THREE.Vector2(0.35, 0.35), envMap, envMapIntensity: 0.22,
      });
      this.mud = new THREE.Mesh(geo("bog_mud"), mudMat);
      this.mud.receiveShadow = true;
      const pos = this.mud.geometry.attributes.position as THREE.BufferAttribute;
      pos.setUsage(THREE.DynamicDrawUsage);
      this.mudBase = new Float32Array(pos.array);
      // Vellonta vaimenee rantaa kohti, jotta rantaviiva pysyy paikallaan.
      this.mudAmp = new Float32Array(pos.count);
      for (let i = 0; i < pos.count; i++) {
        this.mudAmp[i] = 1 - THREE.MathUtils.smoothstep(Math.hypot(pos.getX(i), pos.getZ(i)), 0.55, 1.02);
      }

      const rimMat = new THREE.MeshStandardMaterial({
        vertexColors: true, map: tex.mossDiff, normalMap: tex.mossNor, roughness: 0.95, metalness: 0,
      });
      this.rim = new THREE.Mesh(geo("bog_rim"), rimMat);
      this.rim.receiveShadow = true;
      this.rimBase = new Float32Array((this.rim.geometry.attributes.position as THREE.BufferAttribute).array);

      this.domes = new THREE.InstancedMesh(geo("bog_bubble"), mudMat, BOG.bubbles);
      this.domes.frustumCulled = false;
      this.group.add(this.rim, this.mud, this.domes);
    });
    loaded.catch((e) => console.error("Suon mallin lataus epäonnistui", e));

    // Heinätupsut ovat samoja kuin metsässä, joten ne tulevat metsän malleista.
    Promise.all([loaded, world.ready]).then(() => {
      TUFT_MODELS.forEach((name, k) => {
        const spots = this.tuftSpots.map((_, i) => i).filter((i) => i % TUFT_MODELS.length === k);
        for (const part of world.proto(name)) {
          const mesh = new THREE.InstancedMesh(part.geometry, part.material, spots.length);
          mesh.frustumCulled = false;
          mesh.receiveShadow = true;
          this.group.add(mesh);
          this.tufts.push({ mesh, spots });
        }
      });
      this.conform();
    }).catch(() => { /* virhe on jo kirjattu yllä */ });
  }

  private newBubble(wait: number): Bubble {
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * 0.82;
    const [r0, r1] = BOG.bubbleRadius, [l0, l1] = BOG.bubbleLife;
    return { x: Math.cos(a) * d, z: Math.sin(a) * d, r: r0 + Math.random() * (r1 - r0), age: 0, life: l0 + Math.random() * (l1 - l0), wait };
  }

  /** Reunus ja tupsut seuraavat maaston muotoa; mutapinta pysyy vaakasuorana. */
  private conform() {
    const c = this.group.position;
    const rel = (x: number, z: number) => groundHeight(c.x + x, c.z + z) - c.y;
    if (this.rim && this.rimBase) {
      const pos = this.rim.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const x = this.rimBase[i * 3], z = this.rimBase[i * 3 + 2];
        // Rannassa reunus pysyy mudan tasossa, ulompana se myötäilee maata.
        const k = THREE.MathUtils.smoothstep(Math.hypot(x, z), 1.1, 1.6);
        pos.setY(i, this.rimBase[i * 3 + 1] + rel(x, z) * k);
      }
      pos.needsUpdate = true;
      this.rim.geometry.computeVertexNormals();
    }
    for (const t of this.tufts) {
      t.spots.forEach((spot, i) => {
        const s = this.tuftSpots[spot];
        this.dummy.position.set(s.x, rel(s.x, s.z) + 0.07, s.z);
        this.dummy.rotation.set(0, s.yaw, 0);
        this.dummy.scale.setScalar(s.scale);
        this.dummy.updateMatrix();
        t.mesh.setMatrixAt(i, this.dummy.matrix);
      });
      t.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** at = kohta, jossa suo on auki, tai null kun sen pitää sulkeutua. */
  update(dt: number, at: THREE.Vector3 | null) {
    if (at && !this.open) {
      // Suo aukeaa uhrin alle ja pysyy siinä, vaikka uhri rimpuilisi.
      this.group.position.set(at.x, groundHeight(at.x, at.z) + 0.02, at.z);
      this.conform();
    }
    this.open = at !== null;
    this.size += ((this.open ? 1 : 0) - this.size) * (1 - Math.exp(-BOG.growRate * dt));
    this.group.visible = this.size > 0.01;
    if (!this.group.visible) return;
    this.group.scale.setScalar(this.size);
    this.time += dt;
    this.animate(dt);
  }

  private animate(dt: number) {
    const { mud, mudBase, mudAmp, domes } = this;
    if (!mud || !mudBase || !mudAmp || !domes) return;
    const t = this.time;

    this.bubbles.forEach((b, i) => {
      if (b.wait > 0) b.wait -= dt;
      else b.age += dt;
      if (b.age > b.life + BOG.rippleTime) this.bubbles[i] = b = this.newBubble(0.2 + Math.random() * 1.6);
      // Kupla pullistuu hitaasti ja katoaa puhjetessaan.
      const k = b.wait > 0 || b.age > b.life ? 0 : b.age / b.life;
      const grow = k * k * (3 - 2 * k);
      const amp = 1 - THREE.MathUtils.smoothstep(Math.hypot(b.x, b.z), 0.55, 1.02);
      this.dummy.position.set(b.x, this.surface(b.x, b.z, t) * amp - 0.004, b.z);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(b.r * grow, b.r * grow * (0.45 + 0.4 * k), b.r * grow);
      this.dummy.updateMatrix();
      domes.setMatrixAt(i, this.dummy.matrix);
    });
    domes.instanceMatrix.needsUpdate = true;

    const pos = mud.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = mudBase[i * 3], z = mudBase[i * 3 + 2], amp = mudAmp[i];
      let y = this.surface(x, z, t) * amp;
      for (const b of this.bubbles) {
        const pop = b.age - b.life;
        if (b.wait > 0 || pop < 0) continue;
        const d = Math.hypot(x - b.x, z - b.z);
        if (d > 0.6) continue;
        // Puhjennut kupla: kuoppa ja ulospäin leviävä rengas.
        const fade = 1 - pop / BOG.rippleTime;
        y += amp * fade * b.r * 0.32 * Math.cos((d - pop * 0.55) * 22) * Math.exp(-d * 5.5);
      }
      pos.setY(i, mudBase[i * 3 + 1] + y);
    }
    pos.needsUpdate = true;
    mud.geometry.computeVertexNormals();
  }

  /** Vellovan mudan korkeus kohdassa (x, z): hitaita, eri suuntiin kulkevia aaltoja. */
  private surface(x: number, z: number, t: number) {
    return BOG.churn * (
      Math.sin(x * 3.1 + t * 1.3) + Math.sin(z * 2.7 - t * 1.7 + x * 1.3) + 0.6 * Math.sin((x + z) * 5.2 + t * 2.9)
      + 0.5 * Math.sin((x - z) * 7.5 - t * 2.2)
    ) / 3.1;
  }
}
