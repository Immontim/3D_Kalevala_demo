import * as THREE from "three";

// Metsäaukio: maasto, havu- ja koivumetsä, kivet, kota ja nuotio.
// Kaikki rakennetaan koodista primitiiveistä; oikeat mallit tulevat myöhemmin Blenderistä.

export const ARENA_RADIUS = 11;

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

export interface World {
  campfireLight: THREE.PointLight;
  embers: THREE.Points;
  update(t: number, dt: number): void;
}

export function buildWorld(scene: THREE.Scene): World {
  const r = rand(1849);

  // Taivas ja sumu: syysillan lämmin hämärä.
  scene.background = new THREE.Color(0x8fa3b0);
  scene.fog = new THREE.FogExp2(0x9aa9b0, 0.022);

  const hemi = new THREE.HemisphereLight(0xc9d8e8, 0x3b3a26, 0.9);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffd2a0, 2.4);
  sun.position.set(-18, 22, -10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 70;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);

  // Maasto
  const size = 160, seg = 160;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors: number[] = [];
  const moss = new THREE.Color(0x5b6b2e), grass = new THREE.Color(0x7d7a3c), earth = new THREE.Color(0x5a4630),
    heather = new THREE.Color(0x6b4f5a);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, groundHeight(x, z));
    const rr = Math.hypot(x, z);
    const n = noise2(x * 0.25, z * 0.25);
    c.copy(moss).lerp(grass, n);
    if (rr < ARENA_RADIUS - 1) c.lerp(earth, 0.35 * (1 - rr / ARENA_RADIUS) + 0.15 * noise2(x, z));
    if (noise2(x * 0.06 + 40, z * 0.06) > 0.68) c.lerp(heather, 0.45);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  ground.receiveShadow = true;
  scene.add(ground);

  // Kuuset: runko + kolme kartiota instansseina.
  const dummy = new THREE.Object3D();
  const spots: { x: number; z: number; s: number; birch: boolean }[] = [];
  for (let i = 0; i < 520; i++) {
    const a = r() * Math.PI * 2;
    const d = ARENA_RADIUS + 2 + Math.pow(r(), 0.7) * 55;
    spots.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, s: 0.7 + r() * 0.8, birch: r() < 0.22 });
  }
  const spruces = spots.filter((s) => !s.birch);
  const birches = spots.filter((s) => s.birch);

  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.22, 2.4, 6);
  trunkGeo.translate(0, 1.2, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 1 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spruces.length);
  const needleMat = new THREE.MeshStandardMaterial({ color: 0x24402a, roughness: 0.9, flatShading: true });
  const tiers = [
    { r: 1.9, h: 3.2, y: 2.4 },
    { r: 1.45, h: 2.8, y: 4.0 },
    { r: 0.95, h: 2.4, y: 5.5 },
  ].map((t) => {
    const g = new THREE.ConeGeometry(t.r, t.h, 7);
    g.translate(0, t.y, 0);
    const m = new THREE.InstancedMesh(g, needleMat, spruces.length);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  });
  spruces.forEach((s, i) => {
    dummy.position.set(s.x, groundHeight(s.x, s.z) - 0.1, s.z);
    dummy.rotation.set(0, r() * Math.PI, 0);
    dummy.scale.setScalar(s.s * 1.3);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    tiers.forEach((t) => t.setMatrixAt(i, dummy.matrix));
  });
  trunks.castShadow = true;
  scene.add(trunks, ...tiers);

  // Koivut: valkoinen runko ja kellastuva latvus.
  const bTrunkGeo = new THREE.CylinderGeometry(0.09, 0.14, 5, 6);
  bTrunkGeo.translate(0, 2.5, 0);
  const bTrunks = new THREE.InstancedMesh(
    bTrunkGeo,
    new THREE.MeshStandardMaterial({ color: 0xe8e4d8, roughness: 0.8 }),
    birches.length,
  );
  const crownGeo = new THREE.IcosahedronGeometry(1.5, 0);
  crownGeo.scale(1, 1.4, 1);
  crownGeo.translate(0, 5.2, 0);
  const crowns = new THREE.InstancedMesh(
    crownGeo,
    new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.9, flatShading: true }),
    birches.length,
  );
  const crownColor = new THREE.Color();
  birches.forEach((s, i) => {
    dummy.position.set(s.x, groundHeight(s.x, s.z) - 0.1, s.z);
    dummy.rotation.set((r() - 0.5) * 0.1, r() * Math.PI, (r() - 0.5) * 0.1);
    dummy.scale.setScalar(s.s);
    dummy.updateMatrix();
    bTrunks.setMatrixAt(i, dummy.matrix);
    crowns.setMatrixAt(i, dummy.matrix);
    crownColor.setHSL(0.1 + r() * 0.05, 0.6 + r() * 0.2, 0.4 + r() * 0.15);
    crowns.setColorAt(i, crownColor);
  });
  bTrunks.castShadow = crowns.castShadow = true;
  scene.add(bTrunks, crowns);

  // Kivet ja aukion reunan siirtolohkareet.
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rockCount = 70;
  const rocks = new THREE.InstancedMesh(
    rockGeo,
    new THREE.MeshStandardMaterial({ color: 0x77736b, roughness: 0.95, flatShading: true }),
    rockCount,
  );
  for (let i = 0; i < rockCount; i++) {
    const a = r() * Math.PI * 2;
    const d = i < 10 ? ARENA_RADIUS + 0.5 + r() * 1.5 : ARENA_RADIUS + 3 + r() * 40;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const s = i < 10 ? 0.6 + r() * 0.9 : 0.3 + r() * 1.2;
    dummy.position.set(x, groundHeight(x, z) + s * 0.2, z);
    dummy.rotation.set(r() * 3, r() * 3, r() * 3);
    dummy.scale.set(s * (1 + r() * 0.5), s * 0.7, s);
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
  }
  rocks.castShadow = rocks.receiveShadow = true;
  scene.add(rocks);

  // Uhrikivi aukion laidalla.
  const offering = new THREE.Mesh(
    new THREE.DodecahedronGeometry(1.1, 1),
    new THREE.MeshStandardMaterial({ color: 0x6e6a62, roughness: 0.9, flatShading: true }),
  );
  offering.scale.set(1.4, 0.6, 1.1);
  offering.position.set(-7.5, groundHeight(-7.5, 5) + 0.3, 5);
  offering.castShadow = offering.receiveShadow = true;
  scene.add(offering);

  // Kota (tuohi- ja kalikkakota): kartio, jonka huipulla seipäät.
  const kota = new THREE.Group();
  const kotaBody = new THREE.Mesh(
    new THREE.ConeGeometry(2.2, 3.4, 9, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x6b5236, roughness: 1, flatShading: true, side: THREE.DoubleSide }),
  );
  kotaBody.position.y = 1.7;
  kotaBody.castShadow = kotaBody.receiveShadow = true;
  kota.add(kotaBody);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x4a3626 });
  for (let i = 0; i < 9; i++) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 4.4, 4), poleMat);
    const a = (i / 9) * Math.PI * 2;
    p.position.set(Math.cos(a) * 1.15, 2.1, Math.sin(a) * 1.15);
    p.lookAt(0, 4.5, 0);
    p.rotateX(Math.PI / 2);
    kota.add(p);
  }
  kota.position.set(6.5, groundHeight(6.5, -7) - 0.05, -7);
  scene.add(kota);

  // Nuotio
  const fire = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x55524c, flatShading: true });
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), stoneMat);
    const a = (i / 9) * Math.PI * 2;
    s.position.set(Math.cos(a) * 0.55, 0.08, Math.sin(a) * 0.55);
    fire.add(s);
  }
  const logMat = new THREE.MeshStandardMaterial({ color: 0x2e2118 });
  for (let i = 0; i < 4; i++) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.8, 5), logMat);
    l.rotation.set(Math.PI / 2.6, (i / 4) * Math.PI * 2, 0);
    l.position.y = 0.2;
    fire.add(l);
  }
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.25, 0.7, 6),
    new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.85 }),
  );
  flame.position.y = 0.45;
  fire.add(flame);
  const fx = 4.5, fz = 3;
  fire.position.set(fx, groundHeight(fx, fz), fz);
  scene.add(fire);

  const campfireLight = new THREE.PointLight(0xff8a3c, 6, 12, 1.6);
  campfireLight.position.set(fx, groundHeight(fx, fz) + 0.8, fz);
  scene.add(campfireLight);

  // Kipinät
  const emberCount = 60;
  const ePos = new Float32Array(emberCount * 3);
  const eLife = new Float32Array(emberCount);
  for (let i = 0; i < emberCount; i++) eLife[i] = r() * 2;
  const eGeo = new THREE.BufferGeometry();
  eGeo.setAttribute("position", new THREE.BufferAttribute(ePos, 3));
  const embers = new THREE.Points(
    eGeo,
    new THREE.PointsMaterial({ color: 0xffb060, size: 0.06, transparent: true, opacity: 0.9, depthWrite: false }),
  );
  embers.position.copy(fire.position);
  scene.add(embers);

  return {
    campfireLight,
    embers,
    update(t, dt) {
      const flick = 0.8 + 0.2 * Math.sin(t * 13) * Math.sin(t * 7.3 + 1);
      campfireLight.intensity = 6 * flick;
      flame.scale.set(1, 0.8 + 0.4 * flick, 1);
      flame.rotation.y = t * 2;
      for (let i = 0; i < emberCount; i++) {
        eLife[i] += dt;
        if (eLife[i] > 2) eLife[i] = 0;
        const l = eLife[i];
        const seed = i * 1.37;
        ePos[i * 3] = Math.sin(seed + l * 2) * 0.25 * l;
        ePos[i * 3 + 1] = 0.4 + l * 1.3;
        ePos[i * 3 + 2] = Math.cos(seed * 1.7 + l * 1.5) * 0.25 * l;
      }
      eGeo.attributes.position.needsUpdate = true;
    },
  };
}
