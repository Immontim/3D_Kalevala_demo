import * as THREE from "three";
import {
  ActionState, AttackDef, AttackTiming, BASH, COMBAT, ENEMY_AI, Loadout, SHIELDS, STYLES, ShieldDef, WAVES, StrikeStyle, StrikeWeight, WeaponDef, angleBetween, attackPhase, chargeLevel,
  enemyAttackTiming, makeAttack, resolveHit, shieldWear, strikeDamage, styleFor, weaponOf,
  canStrikeHeavy, exhausted, staminaAfterBlock, staminaTick, strikeCost, strikeTier, weakened,
} from "./combat";
import { Debris, FALLEN, Fighter, FighterLook, POSES, SwordTrail, setCharacterEnv } from "./fighter";
import {
  ACTIONS, Action, Bindings, DEFAULT_BINDINGS, RESERVED, SLOTS, SONG_SLOT_ACTIONS, actionFor, assign, clearSlot, cloneBindings, codeLabel,
  mouseCode, parseBindings,
} from "./bindings";
import { ARENA_RADIUS, buildWorld, groundHeight } from "./world";
import { Sfx } from "./audio";
import {
  SONG, SONGS, SONG_SLOTS, SongId, beatGap, healOnHit, inZone, slotPositions, songLead, songOutcome, zoneHalf,
} from "./songLogic";
import { Modifier, Stats, baseStats, effectiveStats, withModifier } from "./stats";
import {
  DEFAULTS, FIELDS, applyChanges, changedValues, exportTuning, parseTuningText,
} from "./tuning";
import { Bog } from "./bog";
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

// ---------- Säädetyt arvot ----------
// Taukoikkunan säätövälilehdellä tehdyt muutokset ovat tallessa selaimen muistissa ja otetaan
// käyttöön ennen kuin yhtään hahmoa luodaan.
const TUNE_STORE = "laulun-miekka.tuning.v1";
try {
  const saved = parseTuningText(localStorage.getItem(TUNE_STORE) ?? "");
  if (!("error" in saved)) applyChanges(saved.values);
} catch { /* muisti ei käytössä: pelataan oletusarvoilla */ }

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
  struck: boolean;
  hp: number;
  /** Kestävyys: kuluu lyönneistä ja torjunnoista, palautuu itsestään. */
  stamina: number;
  /** Hahmon perusarvot (hahmon rivi ja aalto). */
  base: Stats;
  /** Ajonaikaiset vaikutukset kykyihin: ruoka, nälkä, loitsut, esineet. */
  mods: Modifier[];
  /** Lopulliset kyvyt: perusarvot ja voimassa olevat vaikutukset. Päivitetään joka ruutu. */
  stats: Stats;
  blockStart: number;
  rootTime: number;
  dodgeDir: THREE.Vector3;
  dodgeCd: number;
  moveSpeed: number;
  extraRecovery: number;
}

/** wave = 0 pelaajalle; vastustajilla aalto kasvattaa elämää ja voimaa. */
function makeActor(look: FighterLook, pos: THREE.Vector3, wave: number, trailColor: number): Actor {
  const fighter = new Fighter(look);
  const trail = new SwordTrail(trailColor);
  scene.add(fighter.root, trail.mesh);
  const weapon = weaponOf(look.loadout);
  const shield = look.loadout === "sword_shield" ? SHIELDS.round : null;
  const base = baseStats(look.character, wave);
  const stats = effectiveStats(base, [], 0);
  return {
    base, mods: [], stats, stamina: stats.maxStamina,
    weapon, shield, shieldHp: shield ? shield.durability : 0, stance: "slash", charging: false,
    fighter, trail, pos: pos.clone(), yaw: 0, state: "idle", stateTime: 0, timing: { windup: 0.3, release: 0.1, recovery: 0.3 },
    attack: makeAttack(weapon, styleFor(weapon, "slash"), "light"), loadout: look.loadout, struck: false, hp: stats.maxHp,
    blockStart: -99, rootTime: 0, dodgeDir: new THREE.Vector3(), dodgeCd: 0, moveSpeed: 0, extraRecovery: 0,
  };
}

const debris: Debris[] = [];
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

let player = makeActor(PLAYER_LOOK, new THREE.Vector3(0, 0, -3), 0, 0xffd27a);
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
  enemy = makeActor(def.look, pos, wave, 0xff6a3a);
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
function pressStrike(style: StrikeStyle) { strikeQueued = style; strikeHeld[style] = true; }
function releaseStrikes() { for (const st of STYLES) strikeHeld[st] = false; }
let blockHeld = false;
let dodgeQueued = false;
let songQueued = false;
let beatQueued = false;
/** Laulun pikavalinta: valintaringin paikka 0–4, tai null. */
let pickQueued: number | null = null;

// Näppäinsidonnat: vaihdettavissa taukoikkunassa ja tallessa selaimen muistissa.
const BIND_STORE = "laulun-miekka.bindings.v1";
let bindings: Bindings = (() => {
  try { return parseBindings(JSON.parse(localStorage.getItem(BIND_STORE) ?? "null")); }
  catch { return cloneBindings(DEFAULT_BINDINGS); }
})();
function saveBindings() {
  try { localStorage.setItem(BIND_STORE, JSON.stringify(bindings)); } catch { /* muisti ei käytössä: sidonnat ovat voimassa tämän istunnon */ }
}
/** Sidontaa odottava paikka asetusikkunassa, tai null. */
let capture: { action: Action; slot: number } | null = null;

/** Näppäin tai hiiren nappi painettiin. Palauttaa true, jos se oli sidottu johonkin. */
function pressCode(code: string): boolean {
  const a = actionFor(bindings, code);
  if (!a) return false;
  if (a === "block") blockHeld = true;
  else if (a === "dodge") dodgeQueued = true;
  else if (a === "song") songQueued = true;
  else if (a === "slash" || a === "overhead" || a === "thrust") pressStrike(a);
  else pickQueued = SONG_SLOT_ACTIONS.indexOf(a);
  return true;
}
function releaseCode(code: string) {
  const a = actionFor(bindings, code);
  if (a === "block") blockHeld = false;
  else if (a === "slash" || a === "overhead" || a === "thrust") strikeHeld[a] = false;
}

/** Näppäily säätövälilehden kenttään ei ole pelin ohjausta. */
function typing(e: Event) { return e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement; }

window.addEventListener("keydown", (e) => {
  if (capture || e.repeat) return;
  if (typing(e) && e.code !== "Escape") return;
  if (e.code === "Escape") {
    // Esc myös jatkaa peliä: sivuun raahatun taukoikkunan Jatka-nappi voi olla ruudun ulkopuolella.
    // Viive estää sen, että hiiren lukituksen vapauttava Esc sekä pysäyttäisi että jatkaisi.
    if (!paused) pause();
    else if (performance.now() - pausedAt > 400) resume();
    return;
  }
  keys.add(e.code);
  if (pressCode(e.code)) e.preventDefault();
  if (e.code === "Space") { beatQueued = true; e.preventDefault(); }
  if (e.code === "KeyR" && gameOver) restart();
});
window.addEventListener("keyup", (e) => {
  keys.delete(e.code);
  releaseCode(e.code);
});
canvas.addEventListener("mousedown", (e) => {
  if (capture) return;
  if (running && !choosing && !document.pointerLockElement) lockPointer();
  if (e.button === 0) beatQueued = true;
  pressCode(mouseCode(e.button));
});
window.addEventListener("mouseup", (e) => releaseCode(mouseCode(e.button)));
// Hiiren lisänapit (4 ja 5) eivät saa selata sivuhistoriaa kesken pelin.
for (const type of ["mousedown", "mouseup", "auxclick"] as const) {
  window.addEventListener(type, (e) => { if (e.button >= 3) e.preventDefault(); });
}
window.addEventListener("contextmenu", (e) => e.preventDefault());

// ---------- Asetusikkuna: näppäinten vaihto ----------
let captureEndedAt = 0;
function renderBinds(note = "") {
  const rootEl = $("binds");
  rootEl.textContent = "";
  for (const { id, label } of ACTIONS) {
    const row = document.createElement("div");
    row.className = "bindrow";
    const name = document.createElement("span");
    name.textContent = label;
    row.appendChild(name);
    for (let slot = 0; slot < SLOTS; slot++) {
      const b = document.createElement("button");
      const listening = capture?.action === id && capture.slot === slot;
      b.className = "bind" + (listening ? " listening" : "") + (bindings[id][slot] ? "" : " empty");
      b.textContent = listening ? "Paina nappia…" : codeLabel(bindings[id][slot]);
      b.addEventListener("click", () => {
        // Sama klikkaus, jolla hiiren nappi juuri sidottiin, ei avaa kuuntelua uudelleen.
        if (performance.now() - captureEndedAt < 350) return;
        capture = { action: id, slot };
        renderBinds();
      });
      row.appendChild(b);
    }
    rootEl.appendChild(row);
  }
  $("bindNote").textContent = note || (capture ? "Paina näppäintä tai hiiren nappia. Esc peruu, Delete tyhjentää." : "Napsauta paikkaa ja paina uutta näppäintä tai hiiren nappia.");
}
function endCapture(next: Bindings | null, note = "") {
  if (next) { bindings = next; saveBindings(); }
  capture = null;
  captureEndedAt = performance.now();
  renderBinds(note);
}
// Kuuntelu sieppaa seuraavan painalluksen ennen pelin omia käsittelijöitä.
window.addEventListener("keydown", (e) => {
  if (!capture) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  if (e.code === "Escape") endCapture(null);
  else if (e.code === "Delete" || e.code === "Backspace") endCapture(clearSlot(bindings, capture.action, capture.slot));
  else if (RESERVED.includes(e.code)) endCapture(null, `${codeLabel(e.code)} on varattu (liike, laulun tahti, uusi peli).`);
  else endCapture(assign(bindings, capture.action, capture.slot, e.code));
}, true);
window.addEventListener("mousedown", (e) => {
  if (!capture) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  endCapture(assign(bindings, capture.action, capture.slot, mouseCode(e.button)));
}, true);
$("resetBinds").addEventListener("click", () => {
  if (performance.now() - captureEndedAt < 350) return;
  endCapture(cloneBindings(DEFAULT_BINDINGS), "Oletusnäppäimet palautettu.");
});
renderBinds();

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
  $("php").style.width = `${(player.hp / player.stats.maxHp) * 100}%`;
  $("ehp").style.width = enemy ? `${(Math.max(0, enemy.hp) / enemy.stats.maxHp) * 100}%` : "0%";
  const staminaBar = (id: string, a: Actor | null) => {
    $(id).style.width = a ? `${(a.stamina / a.stats.maxStamina) * 100}%` : "0%";
    $(id).parentElement!.classList.toggle("spent", !!a && a.state !== "dead" && exhausted(a.stamina));
  };
  staminaBar("psta", player);
  staminaBar("esta", enemy);
  const s = $("psong");
  s.style.width = `${(song / COMBAT.songMax) * 100}%`;
  s.classList.toggle("full", song >= COMBAT.songMax);
  $("songReady").textContent = song >= COMBAT.songMax ? "· paina Q" : "";

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
  // Jos voimat eivät riitä raskaaseen lyöntiin, mittari ei täyty.
  const tooTired = p.state === "windup" && p.charging && !canStrikeHeavy(p.stamina);
  if (tooTired) charge = Math.min(charge, 0.6);
  $("charge").classList.toggle("on", charge > 0.12);
  $("charge").classList.toggle("full", charge >= 1);
  $("chargeFill").style.width = `${charge * 100}%`;
  $("chargeLabel").textContent = charge >= 1 ? `${STYLE_NAME[p.attack.kind]} · raskas` : charge > 0 ? `${STYLE_NAME[p.attack.kind]}${tooTired ? " · voimat eivät riitä raskaaseen" : ""}` : "";

  // Vastustajan tuleva isku ja oma torjunta-asento tekstinä.
  const e = enemy;
  $("cue").textContent = e && e.state === "windup" ? `${STYLE_ICON[e.attack.kind]} ${STYLE_NAME[e.attack.kind]}${e.attack.weight === "heavy" ? " (raskas)" : ""}` : "";
  $("pstance").textContent = p.state !== "dead" && exhausted(p.stamina) ? "Uupunut: et voi torjua, ja lyöntisi ovat heikkoja"
    : p.state === "block" && !p.shield ? `Torjunta: ${BLOCK_NAME[p.stance]}` : "";
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

// Suo, johon vihollinen lauletaan (malli Blenderistä, liike koodista).
const bog = new Bog(scene, world);
let bogDemo: THREE.Vector3 | null = null;

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
// Kulku: 1) maailma hidastuu, 2) pelaaja ottaa lauluasennon normaalinopeudella,
// 3) rytmipeli: välilyönti, kun merkki on riimun osuma-alueella, 4) loitsu laukeaa tai ei.
// Jos hidastettu vastustaja ehtii osua, laulu katkeaa heti.
interface SongState {
  id: SongId;
  /** Parannuslaulun tähän mennessä palauttama elämä. */
  healed: number;
  start: number; // reaaliaika
  /** Rytmipeli alkaa, kun lauluasento on otettu. */
  playAt: number;
  shown: boolean;
  beats: number[];
  results: (boolean | null)[];
  runes: HTMLDivElement[];
  zones: HTMLDivElement[];
  /** Kun kaikki riimut on arvioitu: hetki, jolloin loitsu laukeaa. */
  endAt: number;
}
let songState: SongState | null = null;
let timeScale = 1;
let realTime = 0;
const RUNES = ["ᚠ", "ᚹ", "ᛃ", "ᛟ", "ᚱ", "ᛉ", "ᛏ", "ᛗ"];

// ---------- Laulun valinta ----------
// Laulunappi pysäyttää pelin kokonaan ja näyttää laulupaikat hahmon ympärillä. Laulu alkaa heti,
// kun paikka valitaan pikanäppäimellä tai napsauttamalla; laulunappi uudestaan peruu valinnan.
let choosing = false;
/** Valinta vapauttaa hiiren itse, eikä se saa laukaista automaattista taukoa. */
let choiceUnlock = false;
const slotEls: HTMLDivElement[] = SONG_SLOTS.map((id, i) => {
  const d = document.createElement("div");
  d.className = "slot " + (id ?? "empty");
  const rune = document.createElement("span");
  rune.textContent = id ? SONGS[id].rune : "";
  const label = document.createElement("small");
  d.append(rune, label);
  d.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); pickQueued = i; });
  $("choice").appendChild(d);
  return d;
});
function songAvailable(id: SongId | null): id is SongId {
  return id !== null && (!SONGS[id].needsEnemy || (enemy !== null && enemy.state !== "dead"));
}
function openChoice() {
  choosing = true;
  clearInputs();
  setState(player, "idle");
  SONG_SLOTS.forEach((id, i) => {
    const key = codeLabel(bindings[SONG_SLOT_ACTIONS[i]].find((c) => c) ?? "");
    slotEls[i].classList.toggle("off", id !== null && !songAvailable(id));
    (slotEls[i].lastChild as HTMLElement).innerHTML = "";
    (slotEls[i].lastChild as HTMLElement).append(key === "–" ? "" : key, document.createElement("br"), id ? SONGS[id].name : "tyhjä");
  });
  $("choiceHint").textContent = isTouch ? "Valitse laulu napauttamalla" : `Valitse laulu: napsauta tai paina pikanäppäintä. ${codeLabel(bindings.song.find((c) => c) ?? "")} peruu.`;
  $("choice").classList.remove("hidden");
  canvas.classList.add("singing");
  $("vignette").classList.add("on");
  if (document.pointerLockElement) { choiceUnlock = true; document.exitPointerLock(); }
}
function closeChoice() {
  choosing = false;
  pickQueued = null;
  $("choice").classList.add("hidden");
  canvas.classList.remove("singing");
  $("vignette").classList.remove("on");
  clearInputs();
  if (!paused) lockPointer();
}
/** Asettelee laulupaikat hahmon ympärille ruudulla ja käsittelee valinnan. */
const choiceP = new THREE.Vector3();
function updateChoice() {
  const w = window.innerWidth, h = window.innerHeight;
  const toScreen = (y: number) => {
    choiceP.copy(player.pos).setY(player.pos.y + y).project(camera);
    return [(choiceP.x * 0.5 + 0.5) * w, (-choiceP.y * 0.5 + 0.5) * h];
  };
  const [cx, cy] = toScreen(1.0);
  const pxPerM = Math.abs(toScreen(0.5)[1] - toScreen(1.5)[1]);
  // Paikka on noin pään kokoinen, mutta aina niin iso, että siihen osuu hiirellä ja sormella.
  const size = Math.max(56, Math.min(110, pxPerM * 0.34));
  const r = Math.max(size * 2.1, Math.min(pxPerM * 1.35, Math.min(w, h) * 0.42));
  slotPositions(cx, cy, r).forEach(([x, y], i) => {
    const el = slotEls[i];
    el.style.left = `${Math.max(size / 2 + 4, Math.min(w - size / 2 - 4, x))}px`;
    el.style.top = `${Math.max(size / 2 + 4, Math.min(h - size - 20, y))}px`;
    el.style.width = el.style.height = `${size}px`;
    el.style.fontSize = `${size * 0.58}px`;
  });
  if (songQueued) { closeChoice(); return; }
  if (pickQueued !== null) {
    const id = SONG_SLOTS[pickQueued] ?? null;
    pickQueued = null;
    if (songAvailable(id)) { closeChoice(); startSong(id); }
  }
}

function startSong(id: SongId) {
  const verses = SONGS[id].verses;
  song = 0; // voima kuluu kokonaan, kävi laululle miten tahansa
  sfx.startDrone();
  const track = $("track");
  track.querySelectorAll(".rune, .zone").forEach((r) => r.remove());
  const playAt = realTime + SONG.intro;
  const beats = verses.map((_, i) => playAt + songLead() + i * beatGap());
  const zones = beats.map(() => {
    const d = document.createElement("div");
    d.className = "zone";
    track.appendChild(d);
    return d;
  });
  const runes = beats.map((_, i) => {
    const d = document.createElement("div");
    d.className = "rune";
    d.textContent = RUNES[i % RUNES.length];
    track.appendChild(d);
    return d;
  });
  songState = { id, healed: 0, start: realTime, playAt, shown: false, beats, results: beats.map(() => null), runes, zones, endAt: -1 };
  $("verse").textContent = "";
  canvas.classList.add("singing");
  $("vignette").classList.add("on");
  $("song").classList.toggle("heal", id === "heal");
  setState(player, "idle");
  showMsg(SONGS[id].name, "", 1);
}

let lastTick = -1;
function updateSong() {
  const s = songState;
  if (!s) return;
  if (realTime < s.playAt) return; // lauluasento kesken: painallukset eivät vielä laske
  if (!s.shown) { s.shown = true; $("song").classList.remove("hidden"); }
  const trackW = $("track").clientWidth;
  const markerX = trackW * 0.25;
  const pxPerSec = trackW * 0.45 * SONG.speed;
  s.beats.forEach((bt, i) => {
    const x = markerX + (bt - realTime) * pxPerSec;
    const w = 2 * zoneHalf(i) * pxPerSec;
    s.runes[i].style.left = `${x}px`;
    s.zones[i].style.left = `${x - w / 2}px`;
    s.zones[i].style.width = `${w}px`;
    if (s.results[i] === null && realTime > bt + zoneHalf(i)) judge(i, false);
  });
  // Tikitys ennen jokaista riimua.
  const next = s.beats.findIndex((b, i) => s.results[i] === null && b > realTime);
  if (next >= 0) {
    const tick = Math.floor((s.beats[next] - realTime) / (beatGap() / 2));
    if (tick !== lastTick && tick <= 1) { sfx.tick(); lastTick = tick; }
  }
  // Painallus arvioidaan aina seuraavaa riimua vastaan: alueen ulkopuolelle osunut painallus on huti.
  if (beatQueued) {
    const i = s.results.findIndex((r) => r === null);
    if (i >= 0) judge(i, inZone(realTime - s.beats[i], i));
  }
  if (s.endAt < 0 && s.results.every((r) => r !== null)) s.endAt = realTime + SONG.outro;
  if (s.endAt >= 0 && realTime >= s.endAt) {
    const out = songOutcome(s.results as boolean[]);
    endSong(s.id, out.success, out.rootTime, out.hits, s.healed);
  }
}

function judge(i: number, hit: boolean) {
  const s = songState!;
  s.results[i] = hit;
  s.runes[i].classList.add(hit ? "hit" : "miss");
  s.zones[i].classList.add(hit ? "hit" : "miss");
  sfx.pluck(i + 1, hit);
  $("verse").textContent = hit ? SONGS[s.id].verses[i] : "…";
  if (hit && s.id === "heal") {
    // Parannus tulee heti jokaisesta osumasta, joten katkennutkin laulu ehtii auttaa.
    const before = player.hp;
    player.hp = healOnHit(player.hp, player.stats.maxHp);
    s.healed += player.hp - before;
    flash("#e8736a", 0.16);
  } else if (hit) flash("#f0c766", 0.14);
}

/** Sulkee laulun näkymän ja palauttaa ajan kulun. */
function closeSong(instant = false) {
  songState = null;
  sfx.stopDrone();
  $("song").classList.add("hidden");
  canvas.classList.remove("singing");
  $("vignette").classList.remove("on");
  if (instant) timeScale = 1;
}

function endSong(id: SongId, success: boolean, rootTime: number, hits: number, healed: number) {
  closeSong();
  const total = SONGS[id].verses.length;
  if (id === "heal") {
    if (hits > 0) showMsg("Veri seisoi kuin seinä", `${hits}/${total} osumaa: ${Math.round(healed)} elämää takaisin`, 2.4);
    else showMsg("Laulu katkesi", "Tahti ei pitänyt", 1.6);
  } else if (success && enemy && enemy.state !== "dead") {
    enemy.state = "rooted";
    enemy.stateTime = 0;
    enemy.rootTime = rootTime;
    sfx.swamp();
    shake = 0.25;
    showMsg("Suohon suonivyötäisistä!", `${hits}/${total} osumaa: vastustaja on kiinni ${rootTime.toFixed(1)} s ja ottaa tuplavahingon`, 2.4);
  } else {
    showMsg("Laulu katkesi", "Tahti ei pitänyt", 1.6);
  }
}

/** Vastustajan isku osui kesken laulun: loitsu raukeaa ja aika palaa heti normaaliksi. */
function interruptSong() {
  closeSong(true);
  showMsg("Laulu katkesi", "Isku osui kesken laulun", 1.6);
}

// ---------- Tekoäly ----------
interface Ai { decide: number; strafeDir: number; reactedTo: number; counter: boolean; /** Suosta päässyt kääntyy vielä pelaajaa kohti. */ reorient: boolean; /** Uupunut: vetäytyy keräämään voimia. */ resting: boolean; }
let ai: Ai = newAi();
function newAi(): Ai { return { decide: 1.2, strafeDir: Math.random() < 0.5 ? 1 : -1, reactedTo: -1, counter: false, reorient: false, resting: false }; }
// Tekoälyn luvut ovat taulukossa ENEMY_AI (combat.ts).
let playerAttackId = 0;

/** Kilpi torjuu useammin, keihäsmies harvemmin. */
function blockChance(e: Actor) {
  const bonus = e.shield ? ENEMY_AI.blockShieldBonus : e.loadout === "spear" ? ENEMY_AI.blockSpearBonus : 0;
  return Math.min(ENEMY_AI.blockMax, ENEMY_AI.blockBase + ENEMY_AI.blockPerWave * wave) + bonus;
}
/** Kuinka usein aseella torjuva vihollinen lukee iskun suunnan oikein. */
function readChance() { return Math.min(ENEMY_AI.readMax, ENEMY_AI.readBase + ENEMY_AI.readPerWave * wave); }

/** Pelaaja on seissyt torjunnassa niin pitkään, että suoja kannattaa murtaa. */
function playerTurtles() { return player.state === "block" && gameTime - player.blockStart > ENEMY_AI.turtleTime; }

/** Minkä iskun vihollinen tältä etäisyydeltä aloittaisi, tai null jos mikään ei ylety. */
function pickEnemyAttack(e: Actor, dist: number, quick = false): { kind: StrikeStyle | "bash"; weight: StrikeWeight } | null {
  // Kilpityöntö murtaa aseella torjuvan pelaajan suojan; kilpeä vastaan se ei auta.
  if (e.shield && !player.shield && playerTurtles() && dist < BASH.range - 0.1) return { kind: "bash", weight: "light" };
  const kind = styleFor(e.weapon, STYLES[Math.floor(Math.random() * STYLES.length)]);
  // Pelkällä miekalla taisteleva lyö usein raskaasti, kilpimies harvoin.
  // Kilven takana seisovaa pelaajaa vastaan kaikki lyövät raskaasti: kilpi kuluu nopeammin.
  let heavy = e.loadout === "sword" ? ENEMY_AI.heavySword : e.loadout === "spear" ? ENEMY_AI.heavySpear : ENEMY_AI.heavyShield;
  if (playerTurtles() && player.shield) heavy = ENEMY_AI.heavyVsTurtle;
  const weight: StrikeWeight = !quick && canStrikeHeavy(e.stamina) && Math.random() < heavy ? "heavy" : "light";
  const a = makeAttack(e.weapon, kind, weight);
  return dist < a.range + 0.2 && dist > a.minRange + 0.1 ? { kind, weight } : null;
}

function updateAi(e: Actor, dt: number) {
  const toPlayer = player.pos.clone().sub(e.pos);
  const dist = toPlayer.length();
  const facing = Math.atan2(toPlayer.x, toPlayer.z);
  if (e.state === "rooted") {
    // Suossa ei käännytä: pelaaja voi kiertää selän taakse.
    ai.reorient = true;
  } else if (ai.reorient) {
    // Suosta päässyt kääntyy pelaajaa kohti tasaista vauhtia eikä tee sinä aikana muuta.
    const diff = angleBetween(e.yaw, facing);
    const step = ENEMY_AI.reorientTurn * dt;
    e.yaw += Math.max(-step, Math.min(step, diff));
    if (Math.abs(diff) <= Math.max(step, ENEMY_AI.reorientDone)) ai.reorient = false;
  } else {
    e.yaw = lerpAngle(e.yaw, facing, 1 - Math.exp(-8 * dt));
  }

  if (e.state === "idle" && ai.reorient) {
    e.moveSpeed = 0;
  } else if (e.state === "idle") {
    // Reagoi pelaajan nostoon: torju joskus.
    if (player.state === "windup" && ai.reactedTo !== playerAttackId && dist < 3.2) {
      ai.reactedTo = playerAttackId;
      if (!exhausted(e.stamina) && Math.random() < blockChance(e)) {
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
    if (exhausted(e.stamina)) ai.resting = true;
    else if (e.stamina >= Math.min(ENEMY_AI.restUntil, e.stats.maxStamina)) ai.resting = false;
    const spear = e.loadout === "spear";
    const want = ai.resting ? ENEMY_AI.restDistance : spear ? ENEMY_AI.distSpear : e.shield && !player.shield && playerTurtles() ? ENEMY_AI.distBash : ENEMY_AI.distSword;
    const dir = toPlayer.clone().normalize();
    const side = new THREE.Vector3(dir.z, 0, -dir.x).multiplyScalar(ai.strafeDir);
    const move = new THREE.Vector3();
    if (dist > want + 0.3) move.add(dir);
    else if (dist < want - 0.4) move.sub(dir);
    move.addScaledVector(side, 0.45);
    // Kaukaa lähestytään juosten, ja keihäsmies perääntyy tavallista kävelyä nopeammin.
    const pace = dist > 4 ? ENEMY_AI.chaseScale : spear && dist < want - 0.4 ? ENEMY_AI.spearRetreatScale : 1;
    moveActor(e, move, e.stats.moveSpeed * pace, dt);

    ai.decide -= dt;
    // Lepäävä vastustaja ei hyökkää, ellei pelaaja tule iholle.
    const mayAttack = !ai.resting || dist < ENEMY_AI.restCornered;
    const counter = ai.counter && mayAttack ? pickEnemyAttack(e, dist, true) : null;
    if (counter) {
      ai.counter = false;
      startAttack(e, counter.kind, counter.weight);
    } else if (ai.decide <= 0) {
      ai.decide = ENEMY_AI.decideMin + Math.random() * ENEMY_AI.decideRandom;
      if (Math.random() < 0.25) ai.strafeDir *= -1;
      const pick = mayAttack ? pickEnemyAttack(e, dist) : null;
      if (pick && player.state !== "dead" && Math.random() < (pick.kind === "bash" ? ENEMY_AI.bashChance : ENEMY_AI.attackChance)) startAttack(e, pick.kind, pick.weight);
    }
  } else {
    e.moveSpeed = 0;
  }

  if (e.state === "block") {
    const playerBusy = player.state === "windup" || player.state === "release";
    if ((!playerBusy && e.stateTime > 0.25) || exhausted(e.stamina)) {
      setState(e, "idle");
      ai.counter = Math.random() < ENEMY_AI.counterChance;
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
  def.hp -= strikeDamage(att.stats.power, atk, res, defState) * def.stats.damageTaken;
  // Kilpi kuluu torjutuista iskuista: puolivälissä siihen tulee lovi, lopussa se hajoaa.
  const wear = shieldWear(atk, res, defender);
  if (wear > 0 && def.shield) {
    def.shieldHp -= wear;
    if (def.shieldHp <= 0) breakShield(def);
    else if (def.shieldHp <= def.shield.durability * def.shield.notchAt) def.fighter.setShieldNotch(true);
  }
  if (res === "blocked" || res === "parried") def.stamina = staminaAfterBlock(def.stamina);
  const died = def.hp <= 0;
  if (def === player && songState && (res === "hit" || res === "guardbreak")) interruptSong();
  if (died) {
    setState(def, "dead");
    fallDown(def, Math.abs(angleToAttacker) > Math.PI / 2);
    if (def === player) onPlayerDeath();
    else onEnemyDeath();
  }

  if (res === "hit") {
    sfx.hit();
    hitstop = heavy ? 0.11 : 0.07;
    shake = (isPlayer ? 0.12 : 0.22) * (heavy ? 1.5 : atk.kind === "bash" ? 0.7 : 1);
    emitSparks(contact, heavy ? 18 : 10, 2);
    if (isPlayer) song = Math.min(COMBAT.songMax, song + COMBAT.songGainHit);
    else flash("#b33a2e", heavy ? 0.45 : atk.kind === "bash" ? 0.15 : 0.35);
    // Tehoste: sivallus tai ylälyönti voi lennättää vastustajan kypärän päästä. Ei vaikuta peliin.
    if (isPlayer && def.fighter.hasHelmet && (atk.kind === "slash" || atk.kind === "overhead")
      && Math.random() < (died ? 1 : heavy ? 0.6 : 0.25)) {
      const away = toDef.clone().setY(0).normalize();
      const side = new THREE.Vector3(away.z, 0, -away.x);
      // Sivallus vie kypärän sivulle, ylälyönti taakse.
      const dir = atk.kind === "slash" ? side.multiplyScalar(-1).addScaledVector(away, 0.4) : away.addScaledVector(side, Math.random() - 0.5);
      const prop = def.fighter.knockHelmet(dir);
      if (prop) { scene.add(prop.group); debris.push(prop); sfx.clang(false); }
    }
    if (!isPlayer && defState === "block" && !died) showMsg("Väärä torjunta", `${STYLE_NAME[atk.kind]} meni läpi`, 0.9);
    // Lyhyt horjahdus keskeyttää noston. Kilpityöntö ei riitä pysäyttämään jo alkanutta iskua.
    const interrupts = defState === "idle" || defState === "block" || (defState === "windup" && atk.kind !== "bash");
    if (!died && interrupts) {
      setState(def, "stagger");
      def.stateTime = COMBAT.staggerTime - COMBAT.hitStagger;
    }
  } else if (res === "guardbreak") {
    sfx.clang(false);
    sfx.hit();
    emitSparks(contact, 26, 5);
    hitstop = 0.08;
    shake = 0.18;
    if (!died) {
      setState(def, "stagger");
      def.stateTime = COMBAT.staggerTime - COMBAT.guardbreakStagger;
    }
    // Murtaja toipuu nopeasti ja ehtii iskeä ennen kuin puolustaja saa suojan takaisin.
    att.extraRecovery = -COMBAT.guardbreakAdvantage;
    if (!isPlayer) ai.counter = true;
    if (isPlayer) showMsg("Suoja murtui!", "Iske nyt", 0.9);
    else { showMsg("Suojasi murtui", "", 0.8); flash("#b33a2e", 0.2); }
  } else if (res === "blocked") {
    sfx.clang(false);
    emitSparks(contact, 18, 4);
    att.extraRecovery = COMBAT.blockRecoil;
    shake = 0.08;
    if (isPlayer) showMsg("Torjuttu", "", 0.6);
  } else if (res === "parried") {
    sfx.clang(true);
    emitSparks(contact, 40, 6);
    hitstop = 0.14;
    shake = 0.18;
    setState(att, "stagger");
    if (!isPlayer) {
      song = Math.min(COMBAT.songMax, song + COMBAT.songGainParry);
      showMsg("Täydellinen torjunta!", "Vastustaja horjuu, iske nyt", 1);
      flash("#f0c766", 0.25);
    }
  } else if (res === "dodged" && !isPlayer) {
    showMsg("Väistit", "", 0.5);
  }
}

/** Lyönti laukeaa: kestävyys ratkaisee, onko se raskas, kevyt vai uupuneen heikko, ja hinta maksetaan. */
function spendOnStrike(a: Actor) {
  const tier = strikeTier(a.stamina, a.attack.weight);
  if (tier !== "heavy" && a.attack.weight === "heavy" && a.attack.kind !== "bash") a.attack = makeAttack(a.weapon, a.attack.kind, "light");
  if (tier === "weak") a.attack = weakened(a.attack);
  a.stamina = Math.max(0, a.stamina - strikeCost(tier));
}

/**
 * Kaatuminen: valitaan makuuasento ja pudotetaan ase ja kilpi maahan.
 * Selkään lyöty kaatuu vatsalleen, edestä lyöty selälleen (kolme eri asentoa).
 */
function fallDown(a: Actor, fromBehind: boolean) {
  const fits = FALLEN.filter((f) => f.prone === fromBehind);
  a.fighter.fallen = fits[Math.floor(Math.random() * fits.length)] ?? FALLEN[0];
  for (const d of a.fighter.dropGear()) { scene.add(d.group); debris.push(d); }
}

function updateCombatant(a: Actor, other: Actor | null, dt: number) {
  a.stateTime += dt;
  // Kyvyt lasketaan joka ruutu, jotta ajastetut vaikutukset (ruoka, loitsut) alkavat ja loppuvat itsestään.
  a.stats = effectiveStats(a.base, a.mods, gameTime);
  if (a.state !== "dead") {
    a.hp = Math.min(a.hp, a.stats.maxHp);
    a.stamina = staminaTick(a.stamina, a.stats.maxStamina, a.stats.staminaRegen, a.state === "block", dt);
  }
  a.dodgeCd -= dt;
  const t = a.timing;

  if (a.state === "windup" || a.state === "release" || a.state === "recovery") {
    const phase = a.charging ? "windup" : attackPhase(a.stateTime, { ...t, recovery: t.recovery + a.extraRecovery });
    if (phase === "release" && a.state !== "release") {
      a.state = "release";
      spendOnStrike(a);
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
    if (a.stateTime >= COMBAT.staggerTime) setState(a, "idle");
  } else if (a.state === "dodge") {
    a.pos.addScaledVector(a.dodgeDir, COMBAT.dodgeSpeed * dt);
    if (a.stateTime >= COMBAT.dodgeTime) setState(a, "idle");
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
    if (full && p.attack.weight === "light" && canStrikeHeavy(p.stamina)) { p.attack = heavy; sfx.tick(); }
    // Nappi lasketaan pohjassa olevaksi myös, jos ase muunsi painetun suunnan toiseksi (keihäs).
    const held = STYLES.some((st) => strikeHeld[st] && styleFor(p.weapon, st) === style);
    if (!held || p.stateTime >= heavy.timing.windup + COMBAT.chargeHoldMax) {
      p.charging = false;
      // Kevyt isku laukeaa aikaisintaan oman nostonsa jälkeen, viritetty raskas heti.
      const lightWindup = makeAttack(p.weapon, style, "light").timing.windup;
      p.timing = { ...p.attack.timing, windup: full ? p.stateTime : Math.max(p.stateTime, lightWindup) };
    }
  }

  if (p.state === "idle" || p.state === "block") {
    if (songQueued && song >= COMBAT.songMax) {
      openChoice();
      return;
    }
    if (dodgeQueued && p.dodgeCd <= 0) {
      setState(p, "dodge");
      p.dodgeCd = COMBAT.dodgeCooldown;
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
    // Uupunut ei pysty torjumaan: suoja laskee itsestään.
    const tired = exhausted(p.stamina);
    if (blockHeld && !tired && p.state === "idle") { setState(p, "block"); p.blockStart = gameTime; }
    if ((!blockHeld || tired) && p.state === "block") setState(p, "idle");
  }
  const walk = p.stats.moveSpeed;
  const speed = p.state === "idle" ? walk : p.state === "block" || p.state === "windup" || p.state === "recovery" ? walk * COMBAT.guardMoveScale : 0;
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
      // Suohon juuttunutta ei voi työntää: vain toinen osapuoli väistyy.
      const stuck = b.state === "rooted";
      const push = d.multiplyScalar((1.0 - len) / len / (stuck ? 1 : 2));
      a.pos.sub(push);
      if (!stuck) b.pos.add(push);
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
    default: return a === player && (songState || choosing) ? { pose: POSES.sing, rate: 4.5 } : { pose: POSES.guard, rate: 8 };
  }
}

const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
function syncVisual(a: Actor, dt: number) {
  const f = a.fighter;
  a.pos.y = groundHeight(a.pos.x, a.pos.z);
  f.root.position.copy(a.pos);
  f.root.rotation.y = a.yaw;
  const { pose, rate } = targetPose(a);
  if (a.state === "dodge") f.root.rotation.z = Math.sin((a.stateTime / COMBAT.dodgeTime) * Math.PI) * 0.25;
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
  const singing = songState !== null || choosing;
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
  nextWaveAt = gameTime + WAVES.nextWaveDelay;
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
  player = makeActor(PLAYER_LOOK, new THREE.Vector3(0, 0, -3), 0, 0xffd27a);
  enemy = null;
  wave = 0;
  song = 0;
  if (songState) closeSong(true);
  if (choosing) closeChoice();
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
  if (!paused) realTime += realDt; // tauko pysäyttää myös laulun riimut
  fpsAcc += realDt; fpsFrames++;
  if (fpsAcc > 0.5) { $("fps").textContent = String(Math.round(fpsFrames / fpsAcc)); fpsAcc = 0; fpsFrames = 0; }

  if (gameOver && isTouch && beatQueued) restart();

  // Laulu hidastaa maailman nopeasti; paluu normaaliin on pehmeämpi.
  const targetScale = songState ? SONG.slowmo : 1;
  timeScale += (targetScale - timeScale) * (1 - Math.exp(-(songState ? 16 : 6) * realDt));
  let dt = realDt * timeScale;
  if (hitstop > 0) { hitstop -= realDt; dt = 0; }

  // Laulun valinta pysäyttää maailman kokonaan; vain laulaja ottaa asentonsa.
  if (paused || choosing) dt = 0;
  if (running && !paused && choosing) updateChoice();
  else if (running && !paused) {
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
      if (enemy) corpses.push({ actor: enemy, removeAt: gameTime + WAVES.corpseTime });
      player.hp = Math.min(player.stats.maxHp, player.hp + WAVES.restHp);
      player.stamina = Math.min(player.stats.maxStamina, player.stamina + WAVES.restStamina);
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

  // Laulaja liikkuu omassa ajassaan, vaikka maailma on hidastettu.
  syncVisual(player, (songState || choosing) && !paused ? realDt : dt);
  if (enemy) syncVisual(enemy, dt);
  for (const c of corpses) syncVisual(c.actor, dt);
  for (const s of showcase) s.fighter.animate(POSES[s.pose], 8, realDt, 0);
  for (let i = debris.length - 1; i >= 0; i--) {
    if (!debris[i].update(dt, groundHeight)) { debris[i].dispose(); debris.splice(i, 1); }
  }

  // Suo
  bog.update(bogDemo ? realDt : dt, bogDemo ?? (enemy && enemy.state === "rooted" ? enemy.pos : null));

  // Laulurengas (pyörii reaaliajassa, vaikka maailma on hidastettu).
  const ringMat = ring.material as THREE.PointsMaterial;
  ringMat.opacity += ((songState || choosing ? 0.9 : 0) - ringMat.opacity) * (1 - Math.exp(-5 * realDt));
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
  pickQueued = null;
}

// ---------- Hiiren lukitus ja tauko ----------
// Hiiri lukitaan pelin ajaksi, jotta kursori ei karkaa pelialueelta ja vie
// klikkauksia muualle. Jos lukitus ei ole saatavilla (esim. upotettu näkymä),
// peli pysähtyy, kun hiiri tai fokus lähtee ikkunasta.
let paused = false;
let pausedAt = 0;
let pointerLockWorked = false;

function clearInputs() {
  keys.clear();
  blockHeld = false;
  // Kesken jäänyt viritys perutaan, jottei isku laukea itsestään tauon jälkeen.
  if (player.state === "windup" && player.charging) setState(player, "idle");
  releaseStrikes();
  strikeQueued = null;
  dodgeQueued = songQueued = beatQueued = false;
  pickQueued = null;
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
  pausedAt = performance.now();
  clearInputs();
  renderBinds();
  openTune();
  $("pause").classList.remove("hidden");
}

function resume() {
  if (performance.now() - captureEndedAt < 350) return; // klikkaus, jolla juuri sidottiin hiiren nappi
  capture = null;
  paused = false;
  $("pause").classList.add("hidden");
  last = performance.now();
  if (!choosing) lockPointer();
}

// ---------- Säätövälilehti ----------
// Luonnos on polku → arvo ja sisältää vain oletuksista poikkeavat arvot. Kentät ja tekstialue
// näyttävät saman luonnoksen. Mikään ei muutu pelissä ennen kuin luonnos otetaan käyttöön;
// silloin se tallennetaan selaimen muistiin ja peli alkaa alusta.
let tuneDraft = new Map<string, number>();
const tuneInputs = new Map<string, HTMLInputElement>();
const tuneText = $("tuneJson") as HTMLTextAreaElement;
const fmtValue = (v: number) => String(+v.toFixed(4));

function buildTuneFields() {
  const rootEl = $("tuneFields");
  let group = "";
  for (const f of FIELDS) {
    if (f.group !== group) {
      group = f.group;
      const h = document.createElement("h3");
      h.textContent = group;
      rootEl.appendChild(h);
    }
    const def = DEFAULTS.get(f.path)!;
    const row = document.createElement("label");
    row.className = "tunerow";
    const name = document.createElement("span");
    name.textContent = f.label;
    const input = document.createElement("input");
    input.type = "number";
    input.min = String(f.min);
    input.max = String(f.max);
    input.step = String(f.step);
    row.title = `Oletus ${fmtValue(def)} · sallittu ${f.min}–${f.max} · ${f.path}`;
    const read = (final: boolean) => {
      const raw = input.valueAsNumber;
      if (!Number.isFinite(raw)) { if (final) refreshTune(); return; } // kenttä on kesken tai tyhjä
      const v = final ? Math.max(f.min, Math.min(f.max, raw)) : raw;
      if (Math.abs(v - def) < 1e-9) tuneDraft.delete(f.path);
      else tuneDraft.set(f.path, v);
      refreshTune(final ? undefined : input);
    };
    input.addEventListener("input", () => read(false));
    input.addEventListener("change", () => read(true)); // kentästä poistuttaessa arvo rajataan sallittuun väliin
    row.append(name, input);
    rootEl.appendChild(row);
    tuneInputs.set(f.path, input);
  }
}

function sameDraft(a: ReadonlyMap<string, number>, b: ReadonlyMap<string, number>) {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) if (Math.abs((b.get(k) ?? NaN) - v) > 1e-9) return false;
  return true;
}

/** Päivittää kentät, tekstin ja tilarivin luonnoksesta. skip = kenttä, johon käyttäjä juuri kirjoittaa. */
function refreshTune(skip?: HTMLInputElement | HTMLTextAreaElement, note = "") {
  for (const [path, input] of tuneInputs) {
    if (input !== skip) input.value = fmtValue(tuneDraft.get(path) ?? DEFAULTS.get(path)!);
    input.classList.toggle("changed", tuneDraft.has(path));
  }
  if (skip !== tuneText) tuneText.value = exportTuning(VERSION, tuneDraft);
  const pending = !sameDraft(tuneDraft, changedValues());
  $("tuneApply").classList.toggle("pending", pending);
  const count = tuneDraft.size === 0 ? "Kaikki arvot ovat oletuksissa." : `${tuneDraft.size} arvoa poikkeaa oletuksista.`;
  $("tuneNote").textContent = note || `${count} ${pending ? "Muutokset eivät ole vielä käytössä." : "Nämä arvot ovat käytössä."}`;
}

/** Kulmaan merkki, kun pelataan muilla kuin oletusarvoilla. */
function showTunedBadge() {
  const n = changedValues().size;
  $("tuned").textContent = n > 0 ? `säädetyt arvot (${n}) · ` : "";
}

function openTune() {
  tuneDraft = new Map(changedValues());
  refreshTune();
}

function showTab(tune: boolean) {
  $("paneTune").classList.toggle("hidden", !tune);
  $("paneBinds").classList.toggle("hidden", tune);
  $("tabTune").classList.toggle("on", tune);
  $("tabBinds").classList.toggle("on", !tune);
}
$("tabBinds").addEventListener("click", () => showTab(false));
$("tabTune").addEventListener("click", () => showTab(true));

tuneText.addEventListener("input", () => {
  const parsed = parseTuningText(tuneText.value);
  if ("error" in parsed) { $("tuneNote").textContent = `Tekstiä ei voi lukea: ${parsed.error}`; return; }
  tuneDraft = parsed.values;
  const notes: string[] = [];
  if (parsed.rejected.length) notes.push(`Tuntematon tai virheellinen: ${parsed.rejected.join(", ")}.`);
  if (parsed.clamped.length) notes.push(`Rajattu sallittuun väliin: ${parsed.clamped.join(", ")}.`);
  refreshTune(tuneText, notes.join(" "));
});

$("tuneApply").addEventListener("click", () => {
  applyChanges(tuneDraft);
  try {
    if (changedValues().size > 0) localStorage.setItem(TUNE_STORE, exportTuning(VERSION));
    else localStorage.removeItem(TUNE_STORE);
  } catch { /* muisti ei käytössä: arvot ovat voimassa tämän istunnon */ }
  showTunedBadge();
  openTune();
  restart();
  resume();
});

$("tuneCopy").addEventListener("click", async () => {
  let ok = false;
  try { await navigator.clipboard.writeText(tuneText.value); ok = true; } catch { /* leikepöytä ei sallittu: kokeillaan valintaa */ }
  if (!ok) { tuneText.select(); ok = document.execCommand("copy"); }
  refreshTune(tuneText, ok ? "Arvot kopioitu leikepöydälle." : "Kopiointi ei onnistunut: valitse teksti ja kopioi se käsin (Ctrl+C).");
});

$("tuneReset").addEventListener("click", () => {
  tuneDraft = new Map();
  refreshTune();
});

buildTuneFields();
showTunedBadge();

// Taukoikkunan voi raahata sivuun, esimerkiksi kuvakaappausta varten. Siirretty ikkuna
// poistaa myös ruudun tummennuksen. Paikka säilyy seuraavaan taukoon.
{
  const overlay = $("pause");
  const panel = overlay.querySelector(".panel") as HTMLElement;
  const off = { x: 0, y: 0 };
  let drag: { x: number; y: number; ox: number; oy: number } | null = null;
  panel.addEventListener("pointerdown", (e) => {
    if (capture || (e.target as HTMLElement).closest("button, input, textarea, label")) return;
    drag = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y };
    panel.setPointerCapture(e.pointerId);
  });
  panel.addEventListener("pointermove", (e) => {
    if (!drag) return;
    // Ikkunasta jää aina kaistale näkyviin, jotta sen saa takaisin.
    const maxX = (window.innerWidth + panel.offsetWidth) / 2 - 80;
    const maxY = (window.innerHeight + panel.offsetHeight) / 2 - 60;
    off.x = Math.max(-maxX, Math.min(maxX, drag.ox + e.clientX - drag.x));
    off.y = Math.max(-maxY, Math.min(maxY, drag.oy + e.clientY - drag.y));
    panel.style.transform = `translate(${off.x}px, ${off.y}px)`;
    overlay.classList.toggle("moved", off.x !== 0 || off.y !== 0);
  });
  const drop = () => { drag = null; };
  panel.addEventListener("pointerup", drop);
  panel.addEventListener("pointercancel", drop);
}

document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement === canvas) pointerLockWorked = true;
  else if (choiceUnlock) choiceUnlock = false;
  else if (pointerLockWorked) autoPauseNow();
});
// Savutesteissä selainpaneeli menettää fokuksen jatkuvasti: __game.autoPause(false) estää automaattisen tauon.
let autoPause = true;
function autoPauseNow() { if (autoPause) pause(); }
window.addEventListener("blur", () => { clearInputs(); autoPauseNow(); });
document.addEventListener("visibilitychange", () => { if (document.hidden) autoPauseNow(); });
document.addEventListener("mouseleave", () => { if (!pointerLockWorked && !isTouch) autoPauseNow(); });
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
    return { pos: player.pos.toArray().map((v) => +v.toFixed(2)), yaw: +player.yaw.toFixed(2), dist: enemy ? +enemy.pos.distanceTo(player.pos).toFixed(2) : null, ai: { ...ai }, player: player.state, playerAttack: `${player.attack.kind}/${player.attack.weight}`, playerHp: player.hp, playerStamina: +player.stamina.toFixed(2), enemyStamina: enemy ? +enemy.stamina.toFixed(2) : null, playerShield: player.shieldHp, stance: player.stance, enemy: enemy?.state, enemyYaw: enemy ? +enemy.yaw.toFixed(2) : null, enemyPos: enemy ? [+enemy.pos.x.toFixed(2), +enemy.pos.z.toFixed(2)] : null, enemyAttack: enemy ? `${enemy.attack.kind}/${enemy.attack.weight}` : null, enemyShield: enemy?.shieldHp, enemyHp: enemy?.hp, song, wave, timeScale };
  },
  get events() { return [...events]; },
  get song() { return songState ? { results: [...songState.results], done: songState.endAt >= 0, realTime, playAt: songState.playAt, beats: songState.beats } : null; },
  fillSong() { song = COMBAT.songMax; },
  get choosing() { return choosing; },
  /** Savutesti: valitsee laulupaikan kuin pikanäppäimellä. */
  pick(i: number) { pickQueued = i; },
  get slots() { return slotEls.map((e) => ({ cls: e.className, text: e.textContent, x: Math.round(parseFloat(e.style.left)), y: Math.round(parseFloat(e.style.top)), size: Math.round(parseFloat(e.style.width)) })); },
  /** Lisää ajonaikaisen vaikutuksen kykyihin (savutestit): who = "player" tai "enemy". */
  addModifier(who: "player" | "enemy", mod: Modifier) { const a = who === "player" ? player : enemy; if (a) a.mods = withModifier(a.mods, mod); },
  get stats() { return { player: { ...player.stats }, enemy: enemy ? { ...enemy.stats } : null }; },
  /** Säädetyt arvot polku → arvo. */
  get tuning() { return Object.fromEntries(changedValues()); },
  /** Asettaa kestävyydet (savutestit); null jättää ennalleen. */
  setHp(p: number) { player.hp = Math.min(player.stats.maxHp, p); },
  setStamina(p: number | null, e: number | null = null) { if (p !== null) player.stamina = p; if (e !== null && enemy) enemy.stamina = e; },
  /** Laulaa vastustajan suoraan suohon t sekunniksi (savutestit). */
  root(t = 3) { if (enemy && enemy.state !== "dead") { setState(enemy, "rooted"); enemy.rootTime = t; } },
  /** Siirtää pelaajan annettuun kohtaan (savutestit). */
  get feet() { return { player: player.fighter.feetDebug(), enemy: enemy?.fighter.feetDebug() ?? null }; },
  placePlayer(x: number, z: number) { player.pos.set(x, groundHeight(x, z), z); },
  /** Lennättää vastustajan kypärän päästä (tehosteen kokeiluun). */
  knockHelmet() {
    if (!enemy) return false;
    const prop = enemy.fighter.knockHelmet(new THREE.Vector3(Math.sin(enemy.yaw + 2), 0, Math.cos(enemy.yaw + 2)));
    if (prop) { scene.add(prop.group); debris.push(prop); }
    return !!prop;
  },
  get bindings() { return cloneBindings(bindings); },
  /** Irtokappaleiden (kypärät, kilven palat) korkeus maasta metreinä: leijuvan kappaleen tunnistaa tästä. */
  get debrisHeights() { return debris.map((d) => +(d.group.position.y - groundHeight(d.group.position.x, d.group.position.z)).toFixed(2)); },
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
  /** Kaataa hahmorivin annettuun makuuasentoon (0..n-1) kuvakaappauksia varten; drop = pudota varusteet. */
  fallShowcase(variant = 0, drop = true) {
    for (const s of showcase) {
      s.fighter.fallen = FALLEN[variant % FALLEN.length];
      s.fighter.fall = 1;
      if (drop) for (const d of s.fighter.dropGear()) { scene.add(d.group); debris.push(d); }
    }
    return FALLEN[variant % FALLEN.length].name;
  },
  /** Makuuasennot muokattavina konsolista. */
  fallen: FALLEN,
  /** Hahmorivin aseiden kärjen vaakaetäisyys hahmon keskipisteestä (m): kantaman vertailuun malliin. */
  get showcaseReach() {
    return showcase.map((s) => {
      s.fighter.bladeTip.getWorldPosition(tmpB);
      return { look: `${s.fighter.look.character}/${s.fighter.look.loadout}`, pose: s.pose, reach: +Math.hypot(tmpB.x - s.fighter.root.position.x, tmpB.z - s.fighter.root.position.z).toFixed(2) };
    });
  },
  /** Vapaa kamera kuvakaappauksia varten; null palauttaa pelikameran. */
  setCamera(pos: number[] | null, look: number[] = [0, 1, 0]) { camOverride = pos ? { pos, look } : null; },
  /** Sekunteja (reaaliaikaa) seuraavaan laulun tahtiin, tai null. */
  get nextBeatIn() {
    if (!songState) return null;
    const i = songState.results.findIndex((r) => r === null);
    return i < 0 ? null : songState.beats[i] - realTime;
  },
  /** Automaattinen tauko fokuksen kadotessa päälle tai pois (savutestit). */
  autoPause(on: boolean) { autoPause = on; if (!on && paused) resume(); },
  /** Vie välilyönnin painalluksen laululle (savutestit). */
  beat() { beatQueued = true; },
  /** Suo näkyviin annettuun kohtaan tai pois (kuvakaappaukset). */
  bog(pos: number[] | null) { bogDemo = pos ? new THREE.Vector3(pos[0], groundHeight(pos[0], pos[2]), pos[2]) : null; },
  /** Pelin sekunteja siihen, kun vihollisen isku laukeaa, tai null. */
  get enemyStrikeIn() {
    return enemy && enemy.state === "windup" ? enemy.timing.windup - enemy.stateTime : null;
  },
};

requestAnimationFrame(frame);
