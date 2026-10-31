import * as THREE from "three";

// Primitiiveistä koottu hahmo ja proseduraalinen animaatio (ei luurankoanimaatioita).
// Asennot (Pose) ovat nivelkulmia, joita kohti hahmo pehmeästi liukuu.

export interface Pose {
  spineYaw: number;
  spinePitch: number;
  rShX: number;
  rShZ: number;
  rEl: number;
  rHandX: number;
  rHandY: number;
  lShX: number;
  lShZ: number;
  lEl: number;
  crouch: number;
  headPitch: number;
}

const KEYS = Object.keys({
  spineYaw: 0, spinePitch: 0, rShX: 0, rShZ: 0, rEl: 0, rHandX: 0, rHandY: 0,
  lShX: 0, lShZ: 0, lEl: 0, crouch: 0, headPitch: 0,
} satisfies Pose) as (keyof Pose)[];

export const POSES: Record<string, Pose> = {
  guard: {
    spineYaw: -0.15, spinePitch: 0.08, rShX: -0.55, rShZ: -0.15, rEl: -1.15, rHandX: 0.95, rHandY: 0,
    lShX: -0.5, lShZ: 0.25, lEl: -1.3, crouch: 0.06, headPitch: 0,
  },
  windup: {
    spineYaw: -0.75, spinePitch: -0.05, rShX: -2.7, rShZ: -0.55, rEl: -1.0, rHandX: -0.3, rHandY: 0,
    lShX: -0.9, lShZ: 0.4, lEl: -0.6, crouch: 0.12, headPitch: 0,
  },
  strike: {
    spineYaw: 0.7, spinePitch: 0.35, rShX: -0.9, rShZ: 0.55, rEl: -0.15, rHandX: 0.35, rHandY: 0,
    lShX: -0.2, lShZ: 0.6, lEl: -0.4, crouch: 0.18, headPitch: 0.1,
  },
  block: {
    spineYaw: 0.05, spinePitch: 0.02, rShX: -1.5, rShZ: -0.35, rEl: -1.25, rHandX: 0.2, rHandY: 1.55,
    lShX: -1.4, lShZ: 0.5, lEl: -1.4, crouch: 0.1, headPitch: 0.05,
  },
  stagger: {
    spineYaw: -0.4, spinePitch: -0.45, rShX: -0.6, rShZ: -0.9, rEl: -0.3, rHandX: 0.5, rHandY: 0,
    lShX: -0.5, lShZ: 0.9, lEl: -0.3, crouch: 0.15, headPitch: -0.4,
  },
  rooted: {
    spineYaw: 0.2, spinePitch: 0.2, rShX: -2.4, rShZ: -0.8, rEl: -0.5, rHandX: 0.4, rHandY: 0,
    lShX: -2.5, lShZ: 0.8, lEl: -0.5, crouch: 0, headPitch: -0.3,
  },
  sing: {
    spineYaw: 0, spinePitch: -0.12, rShX: -0.25, rShZ: -0.35, rEl: -0.4, rHandX: 0.9, rHandY: 0,
    lShX: -1.2, lShZ: 0.9, lEl: -0.6, crouch: 0.02, headPitch: -0.35,
  },
};

export interface FighterLook {
  tunic: number;
  trim: number;
  skin: number;
  hair: number;
  blade: number;
  cap?: number;
}

export class Fighter {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group(); // kaatuu kuollessa
  private hips = new THREE.Group();
  private spine = new THREE.Group();
  private head = new THREE.Group();
  private rSh = new THREE.Group();
  private rEl = new THREE.Group();
  private rHand = new THREE.Group();
  private lSh = new THREE.Group();
  private lEl = new THREE.Group();
  private lThigh = new THREE.Group();
  private rThigh = new THREE.Group();
  private lKnee = new THREE.Group();
  private rKnee = new THREE.Group();
  readonly bladeMat: THREE.MeshStandardMaterial;
  readonly bladeTip = new THREE.Object3D();
  readonly bladeBase = new THREE.Object3D();
  private pose: Pose = { ...POSES.guard };
  private walkPhase = 0;
  sink = 0; // suohon vajoaminen metreinä
  fall = 0; // 0..1 kaatuminen

  constructor(look: FighterLook) {
    const mat = (color: number, rough = 0.9, metal = 0) =>
      new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
    const tunic = mat(look.tunic), trim = mat(look.trim), skin = mat(look.skin, 0.7), hair = mat(look.hair);
    const leg = mat(0x4a3b2c);
    this.bladeMat = new THREE.MeshStandardMaterial({
      color: look.blade, roughness: 0.35, metalness: 0.85, emissive: 0x000000,
    });
    const shadowy = (m: THREE.Mesh) => {
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    };
    const capsule = (r: number, len: number, m: THREE.Material) =>
      shadowy(new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 8), m));

    this.root.add(this.body);
    this.body.add(this.hips);
    this.hips.position.y = 0.95;

    // Jalat
    for (const [thigh, knee, x] of [
      [this.lThigh, this.lKnee, 0.12],
      [this.rThigh, this.rKnee, -0.12],
    ] as const) {
      thigh.position.set(x, 0, 0);
      const t = capsule(0.085, 0.36, leg);
      t.position.y = -0.24;
      thigh.add(t);
      knee.position.y = -0.47;
      const s = capsule(0.07, 0.34, leg);
      s.position.y = -0.22;
      knee.add(s);
      const foot = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.24), trim));
      foot.position.set(0, -0.44, 0.05);
      knee.add(foot);
      thigh.add(knee);
      this.hips.add(thigh);
    }

    // Vartalo: tunika levenee helmaksi.
    this.hips.add(this.spine);
    const torso = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.58, 10), tunic));
    torso.position.y = 0.3;
    this.spine.add(torso);
    const skirt = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.33, 0.32, 10), tunic));
    skirt.position.y = -0.1;
    this.hips.add(skirt);
    const belt = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.255, 0.255, 0.07, 12), trim));
    belt.position.y = 0.04;
    this.spine.add(belt);
    const chest = shadowy(new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 8), tunic));
    chest.scale.set(1.15, 0.7, 0.85);
    chest.position.y = 0.55;
    this.spine.add(chest);

    // Pää
    this.head.position.y = 0.78;
    this.spine.add(this.head);
    const neck = capsule(0.06, 0.08, skin);
    neck.position.y = -0.05;
    this.head.add(neck);
    const skull = shadowy(new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), skin));
    skull.position.y = 0.12;
    this.head.add(skull);
    const hairMesh = shadowy(new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8, 0, Math.PI * 2, 0, Math.PI / 1.8), hair));
    hairMesh.position.set(0, 0.13, -0.015);
    this.head.add(hairMesh);
    const beard = shadowy(new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 8), hair));
    beard.rotation.x = Math.PI;
    beard.position.set(0, 0.0, 0.07);
    this.head.add(beard);
    if (look.cap !== undefined) {
      const cap = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.12, 12), mat(look.cap)));
      cap.position.y = 0.22;
      this.head.add(cap);
    }

    // Kädet
    const arm = (sh: THREE.Group, el: THREE.Group, x: number) => {
      sh.position.set(x, 0.62, 0);
      const ua = capsule(0.065, 0.24, tunic);
      ua.position.y = -0.15;
      sh.add(ua);
      el.position.y = -0.3;
      const fa = capsule(0.055, 0.22, skin);
      fa.position.y = -0.14;
      el.add(fa);
      sh.add(el);
      this.spine.add(sh);
    };
    arm(this.rSh, this.rEl, -0.3);
    arm(this.lSh, this.lEl, 0.3);

    // Pronssimiekka (lehtimäinen terä) oikeassa kädessä. Terä osoittaa käden +z-suuntaan.
    this.rHand.position.y = -0.29;
    this.rEl.add(this.rHand);
    const grip = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.14, 6), trim));
    grip.rotation.x = Math.PI / 2;
    this.rHand.add(grip);
    const guard = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.04), this.bladeMat));
    guard.position.z = 0.08;
    this.rHand.add(guard);
    const shape = new THREE.Shape();
    shape.moveTo(-0.025, 0);
    shape.quadraticCurveTo(-0.05, 0.42, -0.018, 0.68);
    shape.lineTo(0, 0.76);
    shape.lineTo(0.018, 0.68);
    shape.quadraticCurveTo(0.05, 0.42, 0.025, 0);
    shape.lineTo(-0.025, 0);
    const bladeGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1 });
    bladeGeo.translate(0, 0, -0.006);
    const blade = shadowy(new THREE.Mesh(bladeGeo, this.bladeMat));
    blade.rotation.x = Math.PI / 2;
    blade.position.z = 0.09;
    this.rHand.add(blade);
    this.bladeBase.position.z = 0.15;
    this.bladeTip.position.z = 0.84;
    this.rHand.add(this.bladeBase, this.bladeTip);
  }

  /** Liu'uttaa asentoa kohti kohdeasentoa. rate = kuinka nopeasti (1/s). */
  animate(target: Pose, rate: number, dt: number, moveSpeed: number) {
    const k = 1 - Math.exp(-rate * dt);
    for (const key of KEYS) this.pose[key] += (target[key] - this.pose[key]) * k;
    const p = this.pose;

    this.spine.rotation.set(p.spinePitch, p.spineYaw, 0);
    this.head.rotation.set(p.headPitch, -p.spineYaw * 0.5, 0);
    this.rSh.rotation.set(p.rShX, 0, p.rShZ);
    this.rEl.rotation.set(p.rEl, 0, 0);
    this.rHand.rotation.set(p.rHandX, p.rHandY, 0, "YXZ");
    this.lSh.rotation.set(p.lShX, 0, p.lShZ);
    this.lEl.rotation.set(p.lEl, 0, 0);

    // Kävely: reidet heiluvat vastakkain, polvet koukistuvat.
    this.walkPhase += dt * moveSpeed * 3.2;
    const amp = Math.min(1, moveSpeed / 3) * 0.6;
    const s = Math.sin(this.walkPhase);
    this.lThigh.rotation.x = -s * amp - p.crouch * 1.2;
    this.rThigh.rotation.x = s * amp - p.crouch * 1.2;
    this.lKnee.rotation.x = Math.max(0, s) * amp * 1.4 + p.crouch * 2;
    this.rKnee.rotation.x = Math.max(0, -s) * amp * 1.4 + p.crouch * 2;
    this.hips.position.y = 0.95 - p.crouch * 0.5 + Math.abs(Math.cos(this.walkPhase)) * amp * 0.05 - this.sink;

    // Kaatuminen selälleen.
    this.body.rotation.x = -this.fall * (Math.PI / 2) * 0.95;
    this.body.position.y = this.fall * 0.15;
  }

  setGlow(amount: number) {
    this.bladeMat.emissive.setRGB(amount * 1.0, amount * 0.6, amount * 0.15);
  }
}

/** Miekan jälkivana: nauha terän tyven ja kärjen viimeisistä sijainneista. */
export class SwordTrail {
  readonly mesh: THREE.Mesh;
  private pts: THREE.Vector3[] = [];
  private readonly max = 14;
  private geo = new THREE.BufferGeometry();
  private positions: Float32Array;
  private alphas: Float32Array;

  constructor(color: number) {
    this.positions = new Float32Array(this.max * 2 * 3);
    this.alphas = new Float32Array(this.max * 2);
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    this.geo.setAttribute("alpha", new THREE.BufferAttribute(this.alphas, 1));
    const idx: number[] = [];
    for (let i = 0; i < this.max - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    this.geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: { color: { value: new THREE.Color(color) } },
      vertexShader: `attribute float alpha; varying float vA;
        void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 color; varying float vA;
        void main(){ gl_FragColor = vec4(color * vA, vA); }`,
    });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
  }

  update(base: THREE.Vector3, tip: THREE.Vector3, active: boolean) {
    if (active) {
      this.pts.unshift(base.clone(), tip.clone());
      if (this.pts.length > this.max * 2) this.pts.length = this.max * 2;
    } else if (this.pts.length > 0) {
      this.pts.length = Math.max(0, this.pts.length - 4);
    }
    const n = this.pts.length;
    for (let i = 0; i < this.max * 2; i++) {
      const p = this.pts[Math.min(i, n - 1)];
      if (p) this.positions.set([p.x, p.y, p.z], i * 3);
      const seg = Math.floor(i / 2);
      this.alphas[i] = i < n ? (1 - seg / this.max) * (i % 2 === 1 ? 0.7 : 0.15) : 0;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.alpha.needsUpdate = true;
  }
}
