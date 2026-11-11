import * as THREE from "three";
import {
  ActionState, AttackDef, AttackTiming, BASH, BLOCK_RECOIL, CHARGE_HOLD_MAX, DODGE_COOLDOWN, DODGE_TIME,
  GUARDBREAK_ADVANTAGE, GUARDBREAK_STAGGER, Loadout, SHIELDS, SONG_GAIN_HIT, SONG_GAIN_PARRY, SONG_MAX,
  STAGGER_TIME, STYLES, ShieldDef, StrikeStyle, StrikeWeight, WeaponDef, angleBetween, attackPhase, chargeLevel,
  enemyAttackTiming, makeAttack, resolveHit, shieldWear, strikeDamage, styleFor, weaponOf,
} from "./combat";
import { Fighter, FighterLook, POSES, ShieldDebris, SwordTrail, setCharacterEnv } from "./fighter";
import { ARENA_RADIUS, buildWorld, groundHeight } from "./world";
import { Sfx } from "./audio";
import { BeatJudgement, GOOD_WINDOW, SONG_VERSES, judgeBeat, songOutcome } from "./songLogic";
import { VERSION } from "./version";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

// ---------- Perusasetukset ----------
const canvas = document.getElementById("c") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 300);
const world = buildWorld(scene, renderer);
const sfx = new Sfx();
setCharacterEnv(world.envMap);

// Jälkikäsittely: hehku (nuotio, vastavalo), sävytys ja vinjetti. MSAA säilyy renderöintikohteessa.
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.14, 0.5, 1.0));
composer.addPass(new OutputPass());
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, 0.92);                                   // hieman hillitympi värikylläisyys
      c *= mix(vec3(0.93, 0.98, 1.06), vec3(1.05, 1.0, 0.93), smoothstep(0.1, 0.8, l));   // viileät varjot, lämpimät valot
      c = (c - 0.5) * 1.06 + 0.5;
      vec2 d = vUv - 0.5;
      c *= 1.0 - dot(d, d) * 0.55;                                 // vinjetti
      gl_FragColor = vec4(c, 1.0);
    }`,
}));

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

const $ = (id: string) => document.getElementById(id)!;
$("ver").textContent = VERSION;

// ---------- Hahmot ----------
interface Actor {
  fighter: Fighter;
  trail: SwordTrail;
  pos: THREE.Vector3;
  yaw: number;
  state: ActionState;
  stateTime: number;
  timing: AttackTiming;
  /** Käynnissä oleva tai viimeisin isku. */
  attack: AttackDef;
  loadout: Loadout;
  weapon: WeaponDef;
  /** Ehjä kilpi, tai null jos kilpeä ei ole tai se on hajonnut. */
  shield: ShieldDef | null;
  shieldHp: number;
  /** Aseella torjuttaessa: mitä iskusuuntaa vastaan torjunta on. */
  stance: StrikeStyle;
  /** Pelaaja pitää iskunappia pohjassa: isku virittyy eikä vielä laukea. */
  charging: boolean;
  /** Lyöjän voima: vahingon perusarvo ennen aseen ja iskun kertoimia. */
  power: number;
  struck: boolean;
  hp: number;
  maxHp: number;
  blockStart: number;
  rootTime: number;
  dodgeDir: THREE.Vector3;
  dodgeCd: number;
  moveSpeed: number;
  extraRecovery: number;
}

function makeActor(look: FighterLook, pos: THREE.Vector3, hp: number, trailColor: number, power: number): Actor {
  const fighter = new Fighter(look);
  const trail = new SwordTrail(trailColor);
  scene.add(fighter.root, trail.mesh);
  const weapon = weaponOf(look.loadout);
  const shield = look.loadout === "sword_shield" ? SHIELDS.round : null;
  return {
    weapon, shield, shieldHp: shield ? shield.durability : 0, stance: "slash", charging: false, power,
    fighter, trail, pos: pos.clone(), yaw: 0, state: "idle", stateTime: 0, timing: { windup: 0.3, release: 0.1, recovery: 0.3 },
    attack: makeAttack(weapon, styleFor(weapon, "slash"), "light"), loadout: look.loadout, struck: false, hp, maxHp: hp,
    blockStart: -99, rootTime: 0, dodgeDir: new THREE.Vector3(), dodgeCd: 0, moveSpeed: 0, extraRecovery: 0,
  };
}

const PLAYER_POWER = 20;
const debris: ShieldDebris[] = [];
const PLAYER_LOOK: FighterLook = { character: "hero", loadout: "sword_shield" };
// Vastustajat kiertävät: kaksi hahmoa, kummallakin miekka, miekka ja kilpi sekä keihäs.
const ENEMIES: { name: string; look: FighterLook }[] = [
  { name: "Nuori urho", look: { character: "urho", loadout: "sword" } },
  { name: "Pohjan soturi", look: { character: "pohja", loadout: "sword" } },
  { name: "Nuori urho, keihäs", look: { character: "urho", loadout: "spear" } },
  { name: "Pohjan soturi, kilpi", look: { character: "pohja", loadout: "sword_shield" } },
  { name: "Nuori urho, kilpi", look: { character: "urho", loadout: "sword_shield" } },
  { name: "Pohjan soturi, keihäs", look: { character: "pohja", loadout: "spear" } },
];

let player = makeActor(PLAYER_LOOK, new THREE.Vector3(0, 0, -3), 100, 0xffd27a, PLAYER_POWER);
let enemy: Actor | null = null;
let wave = 0;
let song = 0;
let gameTime = 0;
let running = false;
let gameOver = false;
let nextWaveAt = -1;
const corpses: { actor: Actor; removeAt: number }[] = [];
const events: string[] = [];

/** Poistaa taistelijan näkymästä ja vapauttaa sen omat materiaalit. */
function removeActor(a: Actor) {
  scene.remove(a.fighter.root, a.trail.mesh);
  a.fighter.dispose();
  a.trail.mesh.geometry.dispose();
  (a.trail.mesh.material as THREE.Material).dispose();
}

/** Uusi ehjä kilpi pelaajalle jokaiseen aaltoon. */
function renewPlayerShield() {
  if (PLAYER_LOOK.loadout !== "sword_shield") return;
  player.shield = SHIELDS.round;
  player.shieldHp = player.shield.durability;
  player.loadout = "sword_shield";
  player.fighter.restoreShield();
}

function spawnEnemy() {
  wave++;
  const def = ENEMIES[(wave - 1) % ENEMIES.length];
  // Ilmestyy aukion reunalta noin kuuden metrin päähän pelaajasta.
  const a = Math.atan2(-player.pos.x, -player.pos.z) + (Math.random() - 0.5);
  const pos = player.pos.clone().add(new THREE.Vector3(Math.sin(a) * 6, 0, Math.cos(a) * 6));
  const r = Math.hypot(pos.x, pos.z);
  if (r > ARENA_RADIUS - 1) pos.multiplyScalar((ARENA_RADIUS - 1) / r);
  const hp = 80 + wave * 20;
  enemy = makeActor(def.look, pos, hp, 0xff6a3a, 14 + wave);
  ai = newAi();
  $("ename").textContent = def.name;
  $("wave").textContent = `Aalto ${wave}`;
  showMsg(`Aalto ${wave}`, def.name);
}

// ---------- Syöte ----------
const keys = new Set<string>();
// Kolme iskunappia, yksi kullekin iskusuunnalle. Pohjassa pidetty nappi virittää raskaan iskun.
let strikeQueued: StrikeStyle | null = null;
const strikeHeld: Record<StrikeStyle, boolean> = { overhead: false, slash: false, thrust: false };
const STRIKE_KEYS: Record<string, StrikeStyle> = {
  KeyJ: "slash", KeyI: "overhead", KeyF: "overhead", KeyL: "thrust", KeyE: "thrust",
};
function pressStrike(style: StrikeStyle) { strikeQueued = style; strikeHeld[style] = true; }
function releaseStrikes() { for (const st of STYLES) strikeHeld[st] = false; }
let blockHeld = false;
let dodgeQueued = false;
let songQueued = false;
let beatQueued = false;

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  if (STRIKE_KEYS[e.code]) pressStrike(STRIKE_KEYS[e.code]);
  if (e.code === "KeyK") blockHeld = true;
  if (e.code === "ShiftLeft" || e.code === "ShiftRight") dodgeQueued = true;
  if (e.code === "KeyQ") songQueued = true;
  if (e.code === "Space") { beatQueued = true; e.preventDefault(); }
  if (e.code === "KeyR" && gameOver) restart();
});
window.addEventListener("keyup", (e) => {
  keys.delete(e.code);
  if (e.code === "KeyK") blockHeld = false;
  if (STRIKE_KEYS[e.code]) strikeHeld[STRIKE_KEYS[e.code]] = false;
});
canvas.addEventListener("mousedown", (e) => {
  if (running && !document.pointerLockElement) lockPointer();
  if (e.button === 0) { pressStrike("slash"); beatQueued = true; }
  if (e.button === 2) blockHeld = true;
});
window.addEventListener("mouseup", (e) => {
  if (e.button === 0) strikeHeld.slash = false;
  if (e.button === 2) blockHeld = false;
});
window.addEventListener("contextmenu", (e) => e.preventDefault());

// Kosketusnapit
const isTouch = matchMedia("(pointer: coarse)").matches;
if (isTouch) $("touch").classList.remove("hidden");
document.querySelectorAll<HTMLButtonElement>("#touch button").forEach((b) => {
  const act = b.dataset.act;
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (act === "attack") { pressStrike("slash"); beatQueued = true; }
    if (act === "block") blockHeld = true;
    if (act === "dodge") dodgeQueued = true;
    if (act === "song") { songQueued = true; beatQueued = true; }
  });
  const release = () => {
    if (act === "block") blockHeld = false;
    if (act === "attack") strikeHeld.slash = false;
  };
  b.addEventListener("pointerup", release);
  b.addEventListener("pointerleave", release);
});
$("song").addEventListener("pointerdown", () => (beatQueued = true));
canvas.addEventListener("touchstart", () => (beatQueued = true), { passive: true });

// ---------- HUD ----------
let msgTimer = 0;
function showMsg(text: string, sub = "", dur = 1.6) {
  $("msg").textContent = text;
  $("sub").textContent = sub;
  $("msg").style.opacity = "1";
  $("sub").style.opacity = "1";
  msgTimer = dur;
}
function flash(color: string, strength: number) {
  const f = $("flash");
  f.style.background = color;
  f.style.transition = "none";
  f.style.opacity = String(strength);
  requestAnimationFrame(() => {
    f.style.transition = "opacity 0.35s";
    f.style.opacity = "0";
  });
}
function updateHud() {
  $("php").style.width = `${(player.hp / player.maxHp) * 100}%`;
  $("ehp").style.width = enemy ? `${(Math.max(0, enemy.hp) / enemy.maxHp) * 100}%` : "0%";
  const s = $("psong");
  s.style.width = `${(song / SONG_MAX) * 100}%`;
  s.classList.toggle("full", song >= SONG_MAX);
  $("songReady").textContent = song >= SONG_MAX ? "· paina Q" : "";

  // Kilpien kesto.
  const shieldBar = (id: string, a: Actor | null) => {
    const wrap = $(id).parentElement!;
    wrap.style.visibility = a && a.fighter.look.loadout === "sword_shield" ? "visible" : "hidden";
    $(id).style.width = a && a.shield ? `${(a.shieldHp / a.shield.durability) * 100}%` : "0%";
    $(id).classList.toggle("worn", !!a && !!a.shield && a.shieldHp <= a.shield.durability * a.shield.notchAt);
  };
  shieldBar("pshield", player);
  shieldBar("eshield", enemy);

  // Viritysmittari: täyttyy, kun iskunappi on pohjassa. Täysi = raskas isku viritetty.
  const p = player;
  let charge = 0;
  if (p.state === "windup" && p.attack.kind !== "bash") {
    charge = p.charging ? chargeLevel(p.stateTime, heavyOf(p)) : p.attack.weight === "heavy" ? 1 : 0;
  } else if (p.state === "release" && p.attack.weight === "heavy") charge = 1;
  $("charge").classList.toggle("on", charge > 0.12);
  $("charge").classList.toggle("full", charge >= 1);
  $("chargeFill").style.width = `${charge * 100}%`;
  $("chargeLabel").textContent = charge >= 1 ? `${STYLE_NAME[p.attack.kind]} · raskas` : charge > 0 ? STYLE_NAME[p.attack.kind] : "";

  // Vastustajan tuleva isku ja oma torjunta-asento tekstinä.
  const e = enemy;
  $("cue").textContent = e && e.state === "windup" ? `${STYLE_ICON[e.attack.kind]} ${STYLE_NAME[e.attack.kind]}${e.attack.weight === "heavy" ? " (raskas)" : ""}` : "";
  $("pstance").textContent = p.state === "block" && !p.shield ? `Torjunta: ${BLOCK_NAME[p.stance]}` : "";
}
const STYLE_NAME: Record<AttackDef["kind"], string> = { overhead: "Ylälyönti", slash: "Sivallus", thrust: "Pisto", bash: "Kilpityöntö" };
const STYLE_ICON: Record<AttackDef["kind"], string> = { overhead: "↓", slash: "→", thrust: "•", bash: "◐" };
const BLOCK_NAME: Record<StrikeStyle, string> = { overhead: "ylä", slash: "sivu", thrust: "pisto" };
function heavyOf(a: Actor) { return makeAttack(a.weapon, a.attack.kind === "bash" ? "slash" : a.attack.kind, "heavy"); }

// ---------- Efektit ----------
const dotTex = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.4, "rgba(255,255,255,0.6)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
})();
let hitstop = 0;
let shake = 0;
const sparkCount = 120;
const sparkPos = new Float32Array(sparkCount * 3);
const sparkVel = new Float32Array(sparkCount * 3);
const sparkLife = new Float32Array(sparkCount);
const sparkGeo = new THREE.BufferGeometry();
sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
const sparks = new THREE.Points(
  sparkGeo,
  new THREE.PointsMaterial({ map: dotTex, color: 0xffd080, size: 0.12, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
);
sparks.frustumCulled = false;
scene.add(sparks);
let sparkIdx = 0;
function emitSparks(at: THREE.Vector3, n: number, speed: number) {
  for (let i = 0; i < n; i++) {
    const k = sparkIdx++ % sparkCount;
    sparkPos.set([at.x, at.y, at.z], k * 3);
    sparkVel.set([(Math.random() - 0.5) * speed, Math.random() * speed * 0.8, (Math.random() - 0.5) * speed], k * 3);
    sparkLife[k] = 0.4 + Math.random() * 0.4;
  }
}
function updateSparks(dt: number) {
  for (let i = 0; i < sparkCount; i++) {
    if (sparkLife[i] <= 0) { sparkPos[i * 3 + 1] = -100; continue; }
    sparkLife[i] -= dt;
    sparkVel[i * 3 + 1] -= 9 * dt;
    for (let j = 0; j < 3; j++) sparkPos[i * 3 + j] += sparkVel[i * 3 + j] * dt;
  }
  sparkGeo.attributes.position.needsUpdate = true;
}

// Suo, johon vihollinen lauletaan.
const swamp = new THREE.Mesh(
  new THREE.CircleGeometry(1, 40),
  new THREE.MeshStandardMaterial({ color: 0x1e2414, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.92 }),
);
swamp.rotation.x = -Math.PI / 2;
swamp.scale.setScalar(0.001);
swamp.receiveShadow = true;
scene.add(swamp);
let swampSize = 0;

// Laulun kultainen rengas pelaajan ympärillä.
const ringCount = 80;
const ringPos = new Float32Array(ringCount * 3);
const ringGeo = new THREE.BufferGeometry();
ringGeo.setAttribute("position", new THREE.BufferAttribute(ringPos, 3));
const ring = new THREE.Points(
  ringGeo,
  new THREE.PointsMaterial({ map: dotTex, color: 0xffe08a, size: 0.16, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
);
ring.frustumCulled = false;
scene.add(ring);

// ---------- Laulu ----------
interface SongState {
  start: number; // reaaliaika
  beats: number[];
  results: (BeatJudgement | null)[];
  runes: HTMLDivElement[];
  done: boolean;
}
let songState: SongState | null = null;
let timeScale = 1;
let realTime = 0;
const RUNES = ["ᚠ", "ᚹ", "ᛃ", "ᛟ"];
const BEAT_GAP = 0.8;
const LEAD = 1.4;

function startSong() {
  song = 0;
  sfx.startDrone();
  const track = $("track");
  track.querySelectorAll(".rune").forEach((r) => r.remove());
  const beats = SONG_VERSES.map((_, i) => realTime + LEAD + i * BEAT_GAP);
  const runes = beats.map((_, i) => {
    const d = document.createElement("div");
    d.className = "rune";
    d.textContent = RUNES[i];
    track.appendChild(d);
    return d;
  });
  songState = { start: realTime, beats, results: beats.map(() => null), runes, done: false };
  $("song").classList.remove("hidden");
  $("verse").textContent = "";
  canvas.classList.add("singing");
  $("vignette").classList.add("on");
  player.state = "idle";
  showMsg("Laulu alkaa", "", 1);
}

let lastTick = -1;
function updateSong() {
  const s = songState;
  if (!s) return;
  const trackW = $("track").clientWidth;
  const markerX = trackW * 0.25;
  const pxPerSec = trackW * 0.45;
  s.beats.forEach((bt, i) => {
    const x = markerX + (bt - realTime) * pxPerSec;
    s.runes[i].style.left = `${x}px`;
    if (s.results[i] === null && realTime > bt + GOOD_WINDOW) judge(i, "miss");
  });
  // Tikitys ennen jokaista tahtia.
  const next = s.beats.findIndex((b, i) => s.results[i] === null && b > realTime);
  if (next >= 0) {
    const tick = Math.floor((s.beats[next] - realTime) / (BEAT_GAP / 2));
    if (tick !== lastTick && tick <= 1) { sfx.tick(); lastTick = tick; }
  }
  if (beatQueued) {
    const i = s.results.findIndex((r) => r === null);
    if (i >= 0) judge(i, judgeBeat(realTime - s.beats[i]));
  }
  if (!s.done && s.results.every((r) => r !== null)) {
    s.done = true;
    const out = songOutcome(s.results as BeatJudgement[]);
    setTimeout(() => endSong(out.success, out.rootTime), 450);
  }
}

function judge(i: number, j: BeatJudgement) {
  const s = songState!;
  s.results[i] = j;
  s.runes[i].classList.add(j);
  sfx.pluck(i * 2 + (j === "perfect" ? 1 : 0), j !== "miss");
  $("verse").textContent = j === "miss" ? "…" : SONG_VERSES[i];
  if (j === "perfect") flash("#f0c766", 0.18);
}

function endSong(success: boolean, rootTime: number) {
  songState = null;
  sfx.stopDrone();
  $("song").classList.add("hidden");
  canvas.classList.remove("singing");
  $("vignette").classList.remove("on");
  if (success && enemy && enemy.state !== "dead") {
    enemy.state = "rooted";
    enemy.stateTime = 0;
    enemy.rootTime = rootTime;
    sfx.swamp();
    shake = 0.25;
    showMsg("Suohon suonivyötäisistä!", `Vastustaja on kiinni ${rootTime.toFixed(1)} s ja ottaa tuplavahingon`, 2.2);
  } else {
    showMsg("Laulu katkesi", "Tahti ei pitänyt", 1.6);
  }
}

// ---------- Tekoäly ----------
interface Ai { decide: number; strafeDir: number; reactedTo: number; counter: boolean; }
let ai: Ai = newAi();
function newAi(): Ai { return { decide: 1.2, strafeDir: Math.random() < 0.5 ? 1 : -1, reactedTo: -1, counter: false }; }
let playerAttackId = 0;

/** Kilpi torjuu useammin, keihäsmies harvemmin. */
function blockChance(e: Actor) {
  const bonus = e.shield ? 0.2 : e.loadout === "spear" ? -0.1 : 0;
  return Math.min(0.7, 0.3 + 0.1 * wave) + bonus;
}
/** Kuinka usein aseella torjuva vihollinen lukee iskun suunnan oikein. */
function readChance() { return Math.min(0.9, 0.5 + 0.06 * wave); }

/** Pelaaja on seissyt torjunnassa niin pitkään, että suoja kannattaa murtaa. */
function playerTurtles() { return player.state === "block" && gameTime - player.blockStart > 0.7; }

/** Minkä iskun vihollinen tältä etäisyydeltä aloittaisi, tai null jos mikään ei ylety. */
function pickEnemyAttack(e: Actor, dist: number, quick = false): { kind: StrikeStyle | "bash"; weight: StrikeWeight } | null {
  // Kilpityöntö murtaa aseella torjuvan pelaajan suojan; kilpeä vastaan se ei auta.
  if (e.shield && !player.shield && playerTurtles() && dist < BASH.range - 0.1) return { kind: "bash", weight: "light" };
  const kind = styleFor(e.weapon, STYLES[Math.floor(Math.random() * STYLES.length)]);
  // Pelkällä miekalla taisteleva lyö usein raskaasti, kilpimies harvoin.
  // Kilven takana seisovaa pelaajaa vastaan kaikki lyövät raskaasti: kilpi kuluu nopeammin.
  let heavy = e.loadout === "sword" ? 0.35 : e.loadout === "spear" ? 0.25 : 0.15;
  if (playerTurtles() && player.shield) heavy = 0.7;
  const weight: StrikeWeight = !quick && Math.random() < heavy ? "heavy" : "light";
  const a = makeAttack(e.weapon, kind, weight);
  return dist < a.range + 0.2 && dist > a.minRange + 0.1 ? { kind, weight } : null;
}

function updateAi(e: Actor, dt: number) {
  const toPlayer = player.pos.clone().sub(e.pos);
  const dist = toPlayer.length();
  e.yaw = lerpAngle(e.yaw, Math.atan2(toPlayer.x, toPlayer.z), 1 - Math.exp(-8 * dt));

  if (e.state === "idle") {
    // Reagoi pelaajan nostoon: torju joskus.
    if (player.state === "windup" && ai.reactedTo !== playerAttackId && dist < 3.2) {
      ai.reactedTo = playerAttackId;
      if (Math.random() < blockChance(e)) {
        setState(e, "block");
        // Aseella torjuva arvaa iskun suunnan: myöhemmillä aalloilla useammin oikein.
        const real = player.attack.kind === "bash" ? "slash" : player.attack.kind;
        const wrong = STYLES.filter((st) => st !== real);
        e.stance = Math.random() < readChance() ? real : wrong[Math.floor(Math.random() * wrong.length)];
        e.blockStart = -99; // vihollinen ei tee täydellisiä torjuntoja
        return;
      }
    }
    // Liiku sopivalle etäisyydelle ja kierrä.
    // Keihäsmies pitää välimatkaa, kilpimies tulee iholle murtamaan pitkän torjunnan.
    const spear = e.loadout === "spear";
    const want = spear ? 2.7 : e.shield && !player.shield && playerTurtles() ? 1.35 : 1.9;
    const dir = toPlayer.clone().normalize();
    const side = new THREE.Vector3(dir.z, 0, -dir.x).multiplyScalar(ai.strafeDir);
    const move = new THREE.Vector3();
    if (dist > want + 0.3) move.add(dir);
    else if (dist < want - 0.4) move.sub(dir);
    move.addScaledVector(side, 0.45);
    moveActor(e, move, dist > 4 ? 3.4 : spear && dist < want - 0.4 ? 3.0 : 2.4, dt);

    ai.decide -= dt;
    const counter = ai.counter ? pickEnemyAttack(e, dist, true) : null;
    if (counter) {
      ai.counter = false;
      startAttack(e, counter.kind, counter.weight);
    } else if (ai.decide <= 0) {
      ai.decide = 0.5 + Math.random() * 1.0;
      if (Math.random() < 0.25) ai.strafeDir *= -1;
      const pick = pickEnemyAttack(e, dist);
      if (pick && player.state !== "dead" && Math.random() < (pick.kind === "bash" ? 0.9 : 0.65)) startAttack(e, pick.kind, pick.weight);
    }
  } else {
    e.moveSpeed = 0;
  }

  if (e.state === "block") {
    const playerBusy = player.state === "windup" || player.state === "release";
    if (!playerBusy && e.stateTime > 0.25) {
      setState(e, "idle");
      ai.counter = Math.random() < 0.55;
    }
  }
}

// ---------- Tilakoneet ----------
function setState(a: Actor, s: ActionState) {
  a.state = s;
  a.stateTime = 0;
  a.struck = false;
  a.charging = false;
}
function startAttack(a: Actor, kind: StrikeStyle | "bash", weight: StrikeWeight = "light", charging = false) {
  setState(a, "windup");
  a.attack = kind === "bash" ? BASH : makeAttack(a.weapon, styleFor(a.weapon, kind), weight);
  a.timing = { ...(a === player ? a.attack.timing : enemyAttackTiming(a.attack, wave)) };
  a.charging = charging;
  a.extraRecovery = 0;
  if (a === player) playerAttackId++;
}

/** Kilpi hajoaa: palaset putoavat maahan, ja kantaja taistelee tästä eteenpäin ilman kilpeä. */
function breakShield(a: Actor) {
  a.shield = null;
  a.shieldHp = 0;
  if (a.loadout === "sword_shield") a.loadout = "sword";
  const d = a.fighter.breakShield();
  if (d) { scene.add(d.group); debris.push(d); }
  sfx.clang(false);
  sfx.hit();
  shake = Math.max(shake, 0.25);
  hitstop = Math.max(hitstop, 0.1);
  if (a === player) { showMsg("Kilpesi hajosi!", "Torju nyt miekalla oikeaan suuntaan", 1.6); flash("#b33a2e", 0.25); }
  else showMsg("Kilpi hajosi!", "", 1.1);
}

function lerpAngle(a: number, b: number, t: number) { return a + angleBetween(a, b) * t; }

function moveActor(a: Actor, dir: THREE.Vector3, speed: number, dt: number) {
  if (dir.lengthSq() > 1) dir.normalize();
  a.pos.addScaledVector(dir, speed * dt);
  a.moveSpeed = dir.length() * speed;
}

function resolveStrike(att: Actor, def: Actor) {
  const toDef = def.pos.clone().sub(att.pos);
  const dist = toDef.length();
  const angleToDefender = angleBetween(att.yaw, Math.atan2(toDef.x, toDef.z));
  const angleToAttacker = angleBetween(def.yaw, Math.atan2(-toDef.x, -toDef.z));
  const atk = att.attack;
  const defState = def.state;
  const defender = {
    state: defState, blockStart: def.blockStart, angleToAttacker,
    shield: def.shield, stance: def.stance, blockArc: def.weapon.blockArc,
  };
  const res = resolveHit({ distance: dist, angleToDefender }, defender, gameTime, atk);
  const contact = att.pos.clone().lerp(def.pos, 0.55).setY(groundHeight(def.pos.x, def.pos.z) + 1.3);
  const isPlayer = att === player;
  events.push(`${isPlayer ? "pelaaja" : "vihollinen"}:${atk.kind}/${atk.weight}:${res}`);
  if (events.length > 30) events.shift();

  const heavy = atk.weight === "heavy";
  def.hp -= strikeDamage(att.power, atk, res, defState);
  // Kilpi kuluu torjutuista iskuista: puolivälissä siihen tulee lovi, lopussa se hajoaa.
  const wear = shieldWear(atk, res, defender);
  if (wear > 0 && def.shield) {
    def.shieldHp -= wear;
    if (def.shieldHp <= 0) breakShield(def);
    else if (def.shieldHp <= def.shield.durability * def.shield.notchAt) def.fighter.setShieldNotch(true);
  }
  const died = def.hp <= 0;
  if (died) {
    setState(def, "dead");
    if (def === player) onPlayerDeath();
    else onEnemyDeath();
  }

  if (res === "hit") {
    sfx.hit();
    hitstop = heavy ? 0.11 : 0.07;
    shake = (isPlayer ? 0.12 : 0.22) * (heavy ? 1.5 : atk.kind === "bash" ? 0.7 : 1);
    emitSparks(contact, heavy ? 18 : 10, 2);
    if (isPlayer) song = Math.min(SONG_MAX, song + SONG_GAIN_HIT);
    else flash("#b33a2e", heavy ? 0.45 : atk.kind === "bash" ? 0.15 : 0.35);
    if (!isPlayer && defState === "block" && !died) showMsg("Väärä torjunta", `${STYLE_NAME[atk.kind]} meni läpi`, 0.9);
    // Lyhyt horjahdus keskeyttää noston. Kilpityöntö ei riitä pysäyttämään jo alkanutta iskua.
    const interrupts = defState === "idle" || defState === "block" || (defState === "windup" && atk.kind !== "bash");
    if (!died && interrupts) {
      setState(def, "stagger");
      def.stateTime = STAGGER_TIME * 0.55;
    }
  } else if (res === "guardbreak") {
    sfx.clang(false);
    sfx.hit();
    emitSparks(contact, 26, 5);
    hitstop = 0.08;
    shake = 0.18;
    if (!died) {
      setState(def, "stagger");
      def.stateTime = STAGGER_TIME - GUARDBREAK_STAGGER;
    }
    // Murtaja toipuu nopeasti ja ehtii iskeä ennen kuin puolustaja saa suojan takaisin.
    att.extraRecovery = -GUARDBREAK_ADVANTAGE;
    if (!isPlayer) ai.counter = true;
    if (isPlayer) showMsg("Suoja murtui!", "Iske nyt", 0.9);
    else { showMsg("Suojasi murtui", "", 0.8); flash("#b33a2e", 0.2); }
  } else if (res === "blocked") {
    sfx.clang(false);
    emitSparks(contact, 18, 4);
    att.extraRecovery = BLOCK_RECOIL;
    shake = 0.08;
    if (isPlayer) showMsg("Torjuttu", "", 0.6);
  } else if (res === "parried") {
    sfx.clang(true);
    emitSparks(contact, 40, 6);
    hitstop = 0.14;
    shake = 0.18;
    setState(att, "stagger");
    if (!isPlayer) {
      song = Math.min(SONG_MAX, song + SONG_GAIN_PARRY);
      showMsg("Täydellinen torjunta!", "Vastustaja horjuu, iske nyt", 1);
      flash("#f0c766", 0.25);
    }
  } else if (res === "dodged" && !isPlayer) {
    showMsg("Väistit", "", 0.5);
  }
}

function updateCombatant(a: Actor, other: Actor | null, dt: number) {
  a.stateTime += dt;
  a.dodgeCd -= dt;
  const t = a.timing;

  if (a.state === "windup" || a.state === "release" || a.state === "recovery") {
    const phase = a.charging ? "windup" : attackPhase(a.stateTime, { ...t, recovery: t.recovery + a.extraRecovery });
    if (phase === "release" && a.state !== "release") {
      a.state = "release";
      sfx.swing();
    }
    if (phase === "release") {
      // Askel iskun mukana: paino siirtyy eteen.
      const step = (a.attack.lunge / t.release) * dt;
      a.pos.x += Math.sin(a.yaw) * step;
      a.pos.z += Math.cos(a.yaw) * step;
    }
    if (phase === "release" && !a.struck && other) {
      a.struck = true;
      resolveStrike(a, other);
      if ((a.state as ActionState) === "stagger") return; // täydellinen torjunta keskeytti
    }
    if (phase === "recovery") a.state = "recovery";
    if (phase === "done") setState(a, "idle");
  } else if (a.state === "stagger") {
    if (a.stateTime >= STAGGER_TIME) setState(a, "idle");
  } else if (a.state === "dodge") {
    a.pos.addScaledVector(a.dodgeDir, 7 * dt);
    if (a.stateTime >= DODGE_TIME) setState(a, "idle");
  } else if (a.state === "rooted") {
    a.rootTime -= dt;
    if (a.rootTime <= 0) setState(a, "idle");
  }
}

function updatePlayer(dt: number) {
  const p = player;
  if (p.state === "dead") return;
  if (enemy) {
    const to = enemy.pos.clone().sub(p.pos);
    p.yaw = lerpAngle(p.yaw, Math.atan2(to.x, to.z), 1 - Math.exp(-12 * dt));
  }
  // Liike kameran suhteen: eteen = kohti vastustajaa.
  const fwd = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const move = new THREE.Vector3();
  if (keys.has("KeyW")) move.add(fwd);
  if (keys.has("KeyS")) move.sub(fwd);
  if (keys.has("KeyD")) move.add(right);
  if (keys.has("KeyA")) move.sub(right);

  if (songState) { p.moveSpeed = 0; return; }

  // Viritys: niin kauan kuin iskunappi on pohjassa, isku ei laukea. Kun viritysaika täyttyy,
  // isku muuttuu raskaaksi. Napin vapautus laukaisee iskun.
  if (p.state === "windup" && p.charging && p.attack.kind !== "bash") {
    const style = p.attack.kind;
    const heavy = makeAttack(p.weapon, style, "heavy");
    const full = p.stateTime >= heavy.timing.windup;
    if (full && p.attack.weight === "light") { p.attack = heavy; sfx.tick(); }
    // Nappi lasketaan pohjassa olevaksi myös, jos ase muunsi painetun suunnan toiseksi (keihäs).
    const held = STYLES.some((st) => strikeHeld[st] && styleFor(p.weapon, st) === style);
    if (!held || p.stateTime >= heavy.timing.windup + CHARGE_HOLD_MAX) {
      p.charging = false;
      // Kevyt isku laukeaa aikaisintaan oman nostonsa jälkeen, viritetty raskas heti.
      const lightWindup = makeAttack(p.weapon, style, "light").timing.windup;
      p.timing = { ...p.attack.timing, windup: full ? p.stateTime : Math.max(p.stateTime, lightWindup) };
    }
  }

  if (p.state === "idle" || p.state === "block") {
    if (songQueued && song >= SONG_MAX && enemy && enemy.state !== "dead") {
      startSong();
      return;
    }
    if (dodgeQueued && p.dodgeCd <= 0) {
      setState(p, "dodge");
      p.dodgeCd = DODGE_COOLDOWN;
      p.dodgeDir.copy(move.lengthSq() > 0 ? move.normalize() : right.clone().negate());
      return;
    }
    if (strikeQueued) {
      if (p.state === "idle") { startAttack(p, strikeQueued, "light", true); return; }
      // Torjunnan aikana: kilven kanssa kilpityöntö, pelkällä aseella torjunta-asennon vaihto.
      if (p.shield) { startAttack(p, "bash"); return; }
      // Asennon vaihto aloittaa torjunnan alusta, joten oikeaan aikaan vaihdettu asento on täydellinen torjunta.
      if (strikeQueued !== p.stance) { p.stance = strikeQueued; p.blockStart = gameTime; }
    }
    if (blockHeld && p.state === "idle") { setState(p, "block"); p.blockStart = gameTime; }
    if (!blockHeld && p.state === "block") setState(p, "idle");
  }
  const speed = p.state === "idle" ? 3.4 : p.state === "block" || p.state === "windup" || p.state === "recovery" ? 1.4 : 0;
  if (speed > 0) moveActor(p, move, speed, dt);
  else p.moveSpeed = 0;
}

function keepApartAndInside(a: Actor, b: Actor | null) {
  for (const x of [a, b]) {
    if (!x) continue;
    const r = Math.hypot(x.pos.x, x.pos.z);
    if (r > ARENA_RADIUS - 0.6) x.pos.multiplyScalar((ARENA_RADIUS - 0.6) / r);
  }
  if (b && b.state !== "dead" && a.state !== "dead") {
    const d = b.pos.clone().sub(a.pos);
    const len = d.length();
    if (len < 1.0 && len > 0.0001) {
      const push = d.multiplyScalar((1.0 - len) / len / 2);
      a.pos.sub(push);
      b.pos.add(push);
    }
  }
}

function targetPose(a: Actor) {
  const k = a.attack.kind, hv = a.attack.weight === "heavy";
  switch (a.state) {
    case "windup": {
      const pose = k === "bash" ? POSES.bashWindup : k === "slash" ? POSES.slashWindup : k === "thrust" ? POSES.thrustWindup : hv ? POSES.heavyWindup : POSES.windup;
      return { pose, rate: 7 / a.timing.windup };
    }
    case "release": {
      const pose = k === "bash" ? POSES.bashStrike : k === "slash" ? POSES.slashStrike : k === "thrust" ? POSES.thrustStrike : hv ? POSES.heavyStrike : POSES.strike;
      return { pose, rate: 40 };
    }
    case "recovery": return { pose: POSES.guard, rate: 5 };
    case "block": return { pose: a.stance === "slash" ? POSES.blockSide : a.stance === "thrust" ? POSES.blockThrust : POSES.block, rate: 22 };
    case "stagger": return { pose: POSES.stagger, rate: 14 };
    case "rooted": return { pose: POSES.rooted, rate: 6 };
    case "dead": return { pose: POSES.stagger, rate: 6 };
    case "dodge": return { pose: POSES.guard, rate: 10 };
    default: return { pose: a === player && songState ? POSES.sing : POSES.guard, rate: 8 };
  }
}

const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
function syncVisual(a: Actor, dt: number) {
  const f = a.fighter;
  a.pos.y = groundHeight(a.pos.x, a.pos.z);
  f.root.position.copy(a.pos);
  f.root.rotation.y = a.yaw;
  const { pose, rate } = targetPose(a);
  if (a.state === "dodge") f.root.rotation.z = Math.sin((a.stateTime / DODGE_TIME) * Math.PI) * 0.25;
  else f.root.rotation.z = 0;
  const sinkTarget = a.state === "rooted" ? 0.55 : 0;
  f.sink += (sinkTarget - f.sink) * (1 - Math.exp(-4 * dt));
  if (a.state === "dead") f.fall = Math.min(1, f.fall + dt * 1.6);
  f.animate(pose, rate, dt, a.moveSpeed);
  // Vihollisen terä hehkuu noston aikana: ajoitusvihje.
  const glow = a !== player && a.state === "windup" ? Math.min(1, a.stateTime / a.timing.windup) : 0;
  f.setGlow(glow * (a.attack.weight === "heavy" ? 1.5 : 0.9));
  f.root.updateMatrixWorld(true);
  f.bladeBase.getWorldPosition(tmpA);
  f.bladeTip.getWorldPosition(tmpB);
  a.trail.update(tmpA, tmpB, a.attack.kind !== "bash" && (a.state === "release" || (a.state === "recovery" && a.stateTime < a.timing.windup + a.timing.release + 0.05)));
}

// ---------- Kamera ----------
const camPos = new THREE.Vector3(0, 4, -9);
const camLook = new THREE.Vector3();
// Savutestien ja kuvakaappausten vapaa kamera: { pos: [x,y,z], look: [x,y,z] } tai null.
let camOverride: { pos: number[]; look: number[] } | null = null;
function updateCamera(dt: number) {
  if (camOverride) {
    camera.position.fromArray(camOverride.pos);
    camera.lookAt(camOverride.look[0], camOverride.look[1], camOverride.look[2]);
    return;
  }
  const target = enemy && enemy.state !== "dead" ? enemy.pos : player.pos.clone().add(new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw)).multiplyScalar(3));
  const dir = target.clone().sub(player.pos).setY(0);
  if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
  dir.normalize();
  const right = new THREE.Vector3(-dir.z, 0, dir.x);
  const singing = songState !== null;
  const back = singing ? 3.2 : 4.4;
  const height = singing ? 1.7 : 2.3;
  const desired = player.pos.clone().addScaledVector(dir, -back).addScaledVector(right, singing ? -1.6 : -1.3).setY(player.pos.y + height);
  camPos.lerp(desired, 1 - Math.exp(-5 * dt));
  const look = player.pos.clone().lerp(target, 0.6).setY(player.pos.y + 1.2);
  camLook.lerp(look, 1 - Math.exp(-8 * dt));
  camera.position.copy(camPos);
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
  }
  camera.lookAt(camLook);
  camera.fov += ((singing ? 46 : 55) - camera.fov) * (1 - Math.exp(-3 * dt));
  camera.updateProjectionMatrix();
}

// ---------- Hahmorivi (kehityskäyttöön) ----------
// Kaikki hahmot ja varustukset rivissä eri asennoissa kuvakaappauksia ja arviointia varten.
const showcase: { fighter: Fighter; pose: keyof typeof POSES }[] = [];
function setShowcase(on: boolean, allPose?: string) {
  for (const s of showcase) { scene.remove(s.fighter.root); s.fighter.dispose(); }
  showcase.length = 0;
  if (!on) return;
  const row: [FighterLook, keyof typeof POSES][] = [
    [{ character: "hero", loadout: "sword_shield" }, "guard"],
    [{ character: "urho", loadout: "sword" }, "guard"],
    [{ character: "urho", loadout: "sword_shield" }, "block"],
    [{ character: "urho", loadout: "spear" }, "windup"],
    [{ character: "pohja", loadout: "sword" }, "strike"],
    [{ character: "pohja", loadout: "sword_shield" }, "guard"],
    [{ character: "pohja", loadout: "spear" }, "guard"],
  ];
  row.forEach(([look, pose], i) => {
    const fighter = new Fighter(look);
    const x = (i - (row.length - 1) / 2) * 1.5;
    fighter.root.position.set(x, groundHeight(x, 1), 1);
    fighter.root.rotation.y = Math.PI;
    scene.add(fighter.root);
    showcase.push({ fighter, pose: allPose && allPose in POSES ? allPose : pose });
  });
}

// ---------- Kierrokset ----------
function onEnemyDeath() {
  showMsg("Vastustaja kaatui", "Seuraava saapuu metsästä…", 2.4);
  nextWaveAt = gameTime + 3;
}
function onPlayerDeath() {
  gameOver = true;
  showMsg("Kaaduit", isTouch ? "Napauta aloittaaksesi alusta" : "Paina R aloittaaksesi alusta", 9999);
}
function restart() {
  for (const a of [player, enemy, ...corpses.map((c) => c.actor)]) {
    if (a) removeActor(a);
  }
  corpses.length = 0;
  for (const d of debris) d.dispose();
  debris.length = 0;
  player = makeActor(PLAYER_LOOK, new THREE.Vector3(0, 0, -3), 100, 0xffd27a, PLAYER_POWER);
  enemy = null;
  wave = 0;
  song = 0;
  gameOver = false;
  spawnEnemy();
  lockPointer();
}

// ---------- Pääsilmukka ----------
let last = performance.now();
let fpsAcc = 0, fpsFrames = 0;
function frame(now: number) {
  const realDt = Math.min(0.05, (now - last) / 1000);
  last = now;
  simulate(realDt);
  composer.render();
  requestAnimationFrame(frame);
}

/** Yksi pelin askel ilman piirtoa. Erillään, jotta savutesti voi ajaa peliä tasaisin askelin. */
function simulate(realDt: number) {
  realTime += realDt;
  fpsAcc += realDt; fpsFrames++;
  if (fpsAcc > 0.5) { $("fps").textContent = String(Math.round(fpsFrames / fpsAcc)); fpsAcc = 0; fpsFrames = 0; }

  if (gameOver && isTouch && beatQueued) restart();

  const targetScale = songState ? 0.12 : 1;
  timeScale += (targetScale - timeScale) * (1 - Math.exp(-6 * realDt));
  let dt = realDt * timeScale;
  if (hitstop > 0) { hitstop -= realDt; dt = 0; }

  if (paused) dt = 0;
  if (running && !paused) {
    gameTime += dt;
    updateSong();
    updatePlayer(dt);
    updateCombatant(player, enemy, dt);
    if (enemy) {
      if (enemy.state !== "dead") updateAi(enemy, dt);
      updateCombatant(enemy, player, dt);
    }
    keepApartAndInside(player, enemy);
    if (nextWaveAt > 0 && gameTime >= nextWaveAt) {
      nextWaveAt = -1;
      if (enemy) corpses.push({ actor: enemy, removeAt: gameTime + 6 });
      player.hp = Math.min(player.maxHp, player.hp + 35);
      renewPlayerShield();
      spawnEnemy();
    }
    for (let i = corpses.length - 1; i >= 0; i--) {
      if (gameTime > corpses[i].removeAt) {
        removeActor(corpses[i].actor);
        corpses.splice(i, 1);
      }
    }
  }

  syncVisual(player, dt);
  if (enemy) syncVisual(enemy, dt);
  for (const c of corpses) syncVisual(c.actor, dt);
  for (const s of showcase) s.fighter.animate(POSES[s.pose], 8, realDt, 0);
  for (let i = debris.length - 1; i >= 0; i--) {
    if (!debris[i].update(dt, groundHeight)) { debris[i].dispose(); debris.splice(i, 1); }
  }

  // Suo
  const swampTarget = enemy && enemy.state === "rooted" ? 1.4 : 0;
  swampSize += (swampTarget - swampSize) * (1 - Math.exp(-3 * dt));
  if (enemy) swamp.position.set(enemy.pos.x, enemy.pos.y + 0.03, enemy.pos.z);
  swamp.scale.setScalar(Math.max(0.001, swampSize));

  // Laulurengas (pyörii reaaliajassa, vaikka maailma on hidastettu).
  const ringMat = ring.material as THREE.PointsMaterial;
  ringMat.opacity += ((songState ? 0.9 : 0) - ringMat.opacity) * (1 - Math.exp(-5 * realDt));
  for (let i = 0; i < ringCount; i++) {
    const a = (i / ringCount) * Math.PI * 2 + realTime * 0.8;
    const h = 0.2 + ((i * 0.37 + realTime * 0.6) % 1) * 2.0;
    const rr = 1.0 + 0.15 * Math.sin(realTime * 3 + i);
    ringPos.set([player.pos.x + Math.cos(a) * rr, player.pos.y + h, player.pos.z + Math.sin(a) * rr], i * 3);
  }
  ringGeo.attributes.position.needsUpdate = true;

  world.update(realTime, dt, camera);
  updateSparks(dt);
  shake = Math.max(0, shake - realDt * 1.2);
  updateCamera(realDt);
  updateHud();

  if (msgTimer > 0) {
    msgTimer -= realDt;
    if (msgTimer <= 0) { $("msg").style.opacity = "0"; $("sub").style.opacity = "0"; }
  }
  strikeQueued = null;
  dodgeQueued = songQueued = beatQueued = false;
}

// ---------- Hiiren lukitus ja tauko ----------
// Hiiri lukitaan pelin ajaksi, jotta kursori ei karkaa pelialueelta ja vie
// klikkauksia muualle. Jos lukitus ei ole saatavilla (esim. upotettu näkymä),
// peli pysähtyy, kun hiiri tai fokus lähtee ikkunasta.
let paused = false;
let pointerLockWorked = false;

function clearInputs() {
  keys.clear();
  blockHeld = false;
  // Kesken jäänyt viritys perutaan, jottei isku laukea itsestään tauon jälkeen.
  if (player.state === "windup" && player.charging) setState(player, "idle");
  releaseStrikes();
  strikeQueued = null;
  dodgeQueued = songQueued = beatQueued = false;
}

function lockPointer() {
  if (isTouch) return;
  try {
    const r = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
    if (r && typeof r.catch === "function") r.catch(() => {});
  } catch {
    /* lukitus ei ole sallittu: tauko hoitaa tilanteen */
  }
}

function pause() {
  if (!running || paused || gameOver) return;
  paused = true;
  clearInputs();
  $("pause").classList.remove("hidden");
}

function resume() {
  paused = false;
  $("pause").classList.add("hidden");
  last = performance.now();
  lockPointer();
}

document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement === canvas) pointerLockWorked = true;
  else if (pointerLockWorked) pause();
});
window.addEventListener("blur", () => { clearInputs(); pause(); });
document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });
document.addEventListener("mouseleave", () => { if (!pointerLockWorked && !isTouch) pause(); });
$("resumeBtn").addEventListener("click", resume);

$("startBtn").addEventListener("click", () => {
  $("start").classList.add("hidden");
  sfx.start();
  running = true;
  spawnEnemy();
  lockPointer();
});

// Kehityskäyttöön ja savutesteihin: tila näkyy konsolista.
(window as unknown as { __game: unknown }).__game = {
  get state() {
    return { pos: player.pos.toArray().map((v) => +v.toFixed(2)), yaw: +player.yaw.toFixed(2), dist: enemy ? +enemy.pos.distanceTo(player.pos).toFixed(2) : null, ai: { ...ai }, player: player.state, playerAttack: `${player.attack.kind}/${player.attack.weight}`, playerHp: player.hp, playerShield: player.shieldHp, stance: player.stance, enemy: enemy?.state, enemyAttack: enemy ? `${enemy.attack.kind}/${enemy.attack.weight}` : null, enemyShield: enemy?.shieldHp, enemyHp: enemy?.hp, song, wave, timeScale };
  },
  get events() { return [...events]; },
  get song() { return songState ? { results: [...songState.results], done: songState.done, realTime, beats: songState.beats } : null; },
  fillSong() { song = SONG_MAX; },
  /** Ajaa peliä n askelta eteenpäin ruudunpäivityksestä riippumatta (savutestit). */
  tick(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) simulate(dt); },
  /** Asennot muokattavina: hahmorivin kanssa asentoja voi säätää lennossa konsolista. */
  poses: POSES,
  /** Vaihtaa vastustajan suoraan annetun aallon vastustajaan (1 = urho ja miekka, 3 = keihäs, 4 = kilpi). */
  skipTo(n: number) {
    if (enemy) removeActor(enemy);
    enemy = null;
    wave = Math.max(0, n - 1);
    nextWaveAt = -1;
    renewPlayerShield();
    spawnEnemy();
  },
  /** Hahmorivi: kaikki hahmot ja varustukset näkyviin aukion keskelle. */
  showcase(on = true, pose?: string) { setShowcase(on, pose); },
  /** Vapaa kamera kuvakaappauksia varten; null palauttaa pelikameran. */
  setCamera(pos: number[] | null, look: number[] = [0, 1, 0]) { camOverride = pos ? { pos, look } : null; },
  /** Sekunteja (reaaliaikaa) seuraavaan laulun tahtiin, tai null. */
  get nextBeatIn() {
    if (!songState) return null;
    const i = songState.results.findIndex((r) => r === null);
    return i < 0 ? null : songState.beats[i] - realTime;
  },
  /** Pelin sekunteja siihen, kun vihollisen isku laukeaa, tai null. */
  get enemyStrikeIn() {
    return enemy && enemy.state === "windup" ? enemy.timing.windup - enemy.stateTime : null;
  },
};

requestAnimationFrame(frame);
