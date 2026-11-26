import * as THREE from "three";
import { cloneBindings } from "./bindings";
import { COMBAT } from "./combat";
import { setState } from "./engine/actor";
import { tmpB } from "./engine/animate";
import { peace } from "./engine/encounter";
import { addEnemy, focusEnemy, lockTarget, startEncounter } from "./engine/enemies";
import { bindings, strikeHeld } from "./engine/input";
import { killActor } from "./engine/melee";
import { exitState } from "./engine/exit";
import { pause, paused, resume, simulate } from "./engine/loop";
import { setShowcase, showcase } from "./engine/showcase";
import { ENEMIES, currentWave, skipToWave, skirmish } from "./engine/skirmish";
import { choosing, slotEls, songState } from "./engine/song";
import { songArcsDebug } from "./engine/songArcs";
import { aim, fx, g, inputs } from "./engine/state";
import { composer, renderer, scene, world } from "./engine/view";
import { FALLEN, FighterLook, POSES } from "./fighter";
import { t } from "./i18n";
import { Modifier, withModifier } from "./stats";
import { changedValues } from "./tuning";
import { meterOff } from "./ui/pauseMenu";
import { hunt, huntDebug } from "./engine/hunt";
import { addBoar, boarDebug, bloodDrops, hurtBoarDebug } from "./engine/boars";
import { ARENA, groundHeight } from "./world";

export function initDebug() {
  // Kehityskäyttöön ja savutesteihin: tila näkyy konsolista.
  // "enemy" tarkoittaa tässä vastustajaa, jota mittarit koskevat: lukittua tai lähintä.
  const d = { get enemy() { return focusEnemy(); } };
  (window as unknown as { __game: unknown }).__game = {
    get state() {
      return { pos: g.player.pos.toArray().map((v) => +v.toFixed(2)), yaw: +g.player.yaw.toFixed(2), dist: d.enemy ? +d.enemy.pos.distanceTo(g.player.pos).toFixed(2) : null, ai: d.enemy?.ai ? { ...d.enemy.ai } : null, player: g.player.state, playerAttack: `${g.player.attack.kind}/${g.player.attack.weight}`, playerHp: g.player.hp, weapon: g.player.weapon.id, weaponDamage: g.player.weapon.damage, playerStamina: +g.player.stamina.toFixed(2), enemyStamina: d.enemy ? +d.enemy.stamina.toFixed(2) : null, playerShield: g.player.shieldHp, stance: g.player.stance, enemy: d.enemy?.state, enemyYaw: d.enemy ? +d.enemy.yaw.toFixed(2) : null, enemyPos: d.enemy ? [+d.enemy.pos.x.toFixed(2), +d.enemy.pos.z.toFixed(2)] : null, enemyAttack: d.enemy ? `${d.enemy.attack.kind}/${d.enemy.attack.weight}` : null, enemyShield: d.enemy?.shieldHp, enemyHp: d.enemy?.hp, song: g.songPower, wave: currentWave(), enemies: g.enemies.length, timeScale: g.timeScale };
    },
    get events() { return [...g.events]; },
    /**
     * Piirron mittaus ilman requestAnimationFramea (toimii myös piilotetussa paneelissa): n ruutua, joista
     * jokainen odottaa näytönohjaimen valmistumista. Palauttaa ms/ruutu, piirtokutsut ja kolmiot.
     */
    renderBench(n = 60) {
      const gl = renderer.getContext(), px = new Uint8Array(4);
      renderer.info.autoReset = false;
      renderer.info.reset();
      composer.render();
      const calls = renderer.info.render.calls, tris = renderer.info.render.triangles;
      renderer.info.autoReset = true;
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const t0 = performance.now();
      for (let i = 0; i < n; i++) { simulate(1 / 60); composer.render(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
      const ms = (performance.now() - t0) / n;
      return { msPerFrame: +ms.toFixed(2), fps: Math.round(1000 / ms), calls, tris, size: [renderer.domElement.width, renderer.domElement.height] };
    },
    /** Metsästys: jousi, viini, saalis, nuolet ja eläinten tilat. */
    get hunt() { return huntDebug(); },
    /** Villisiat (tila, elämä, paikka, leike), verijäljen tippojen määrä ja sian lisäys savutestiin. */
    get boars() { return { boars: boarDebug(), blood: bloodDrops(), danger: g.danger }; },
    spawnBoar(x: number, z: number, yaw = 0) { return addBoar(x, z, yaw).id; },
    hurtBoar(id: string, amount = 1) { return hurtBoarDebug(id, amount); },
    /** Savutesti: jousi esiin (bow), tähtäys (aim) ja jännitys (draw) ilman hiirtä. Arvo false vapauttaa. */
    huntInput(o: { bow?: boolean; aim?: boolean; draw?: boolean }) {
      if (o.bow !== undefined && o.bow !== hunt.bowOut) inputs.bowQueued = true;
      // Oikean painikkeen painallus on myös "käytä" (poiminta), kuten oikealla hiirellä.
      if (o.aim !== undefined) { inputs.blockHeld = o.aim; if (o.aim) inputs.useQueued = true; }
      if (o.draw !== undefined) strikeHeld.slash = o.draw;
    },
    /** Katse ja lukitus (savutestit): yaw ja pitch radiaaneina. */
    get look() { return { camYaw: +aim.yaw.toFixed(3), camPitch: +aim.pitch.toFixed(3), lockOn: aim.lockOn, locked: !!lockTarget(), playerYaw: +g.player.yaw.toFixed(3), enemyYaw: d.enemy ? +d.enemy.yaw.toFixed(3) : null }; },
    setLook(yaw: number, pitch = aim.pitch) { aim.yaw = yaw; aim.pitch = pitch; },
    setLock(on: boolean) { aim.lockOn = on; },
    /** Käytössä oleva paikka ("clearing", "homestead" tai "yard"). */
    get arena() { return ARENA; },
    /** Polunsuusta poistumisen tila (häivytys). */
    exitState() { return exitState(); },
    /** Törmäysrekisterin määrä ja pelaajaa juuri koskettavat vaara-alueet. */
    get collision() {
      return {
        ...world.collision.stats(),
        hazards: world.collision.hazardsAt(g.player.pos.x, g.player.pos.z, g.player.radius).map((h) => h.id),
        radius: g.player.radius,
      };
    },
    get songArcs() { return songArcsDebug(); },
    get song() { return songState ? { results: [...songState.results], done: songState.endAt >= 0, realTime: g.realTime, playAt: songState.playAt, beats: songState.beats } : null; },
    fillSong() { g.songPower = COMBAT.songMax; },
    get meters() { return JSON.parse(JSON.stringify(meterOff)); },
    pause() { pause(); },
    get choosing() { return choosing; },
    /** Savutesti: valitsee laulupaikan kuin pikanäppäimellä. */
    pick(i: number) { inputs.pickQueued = i; },
    get slots() { return slotEls.map((e) => ({ cls: e.className, text: e.textContent, x: Math.round(parseFloat(e.style.left)), y: Math.round(parseFloat(e.style.top)), size: Math.round(parseFloat(e.style.width)) })); },
    /** Lisää ajonaikaisen vaikutuksen kykyihin (savutestit): who = "player" tai "enemy". */
    addModifier(who: "player" | "enemy", mod: Modifier) { const a = who === "player" ? g.player : d.enemy; if (a) a.mods = withModifier(a.mods, mod); },
    get stats() { return { player: { ...g.player.stats }, enemy: d.enemy ? { ...d.enemy.stats } : null }; },
    /** Säädetyt arvot polku → arvo. */
    get tuning() { return Object.fromEntries(changedValues()); },
    /** Asettaa kestävyydet (savutestit); null jättää ennalleen. */
    /** Savutesti: kaataa kaikki elävät vastustajat kuin kuolettavalla iskulla (aalto etenee, viimeinen aalto voittaa). */
    killEnemies() { for (const e of [...g.enemies]) { e.hp = 0; killActor(e, false); } return g.enemies.length; },
    setHp(p: number) { g.player.hp = Math.min(g.player.stats.maxHp, p); },
    setStamina(p: number | null, e: number | null = null) { if (p !== null) g.player.stamina = p; if (e !== null && d.enemy) d.enemy.stamina = e; },
    /** Laulaa vastustajan suoraan suohon t sekunniksi (savutestit). */
    root(t = 3) { if (d.enemy && d.enemy.state !== "dead") { setState(d.enemy, "rooted"); d.enemy.rootTime = t; } },
    /** Siirtää pelaajan annettuun kohtaan (savutestit). */
    get feet() { return { player: g.player.fighter.feetDebug(), enemy: d.enemy?.fighter.feetDebug() ?? null }; },
    placePlayer(x: number, z: number) { g.player.pos.set(x, groundHeight(x, z), z); },
    /** Lennättää vastustajan kypärän päästä (tehosteen kokeiluun). */
    knockHelmet() {
      if (!d.enemy) return false;
      const prop = d.enemy.fighter.knockHelmet(new THREE.Vector3(Math.sin(d.enemy.yaw + 2), 0, Math.cos(d.enemy.yaw + 2)));
      if (prop) { scene.add(prop.group); g.debris.push(prop); }
      return !!prop;
    },
    get bindings() { return cloneBindings(bindings); },
    /** Irtokappaleiden (kypärät, kilven palat) korkeus maasta metreinä: leijuvan kappaleen tunnistaa tästä. */
    get debrisHeights() { return g.debris.map((d) => +(d.group.position.y - groundHeight(d.group.position.x, d.group.position.z)).toFixed(2)); },
    /** Ajaa peliä n askelta eteenpäin ruudunpäivityksestä riippumatta (savutestit). */
    tick(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) simulate(dt); },
    /** Pysäyttää pelin ajan (hitstop) niin, että vain `step` etenee: kuvakaappaukset tarkasta ajanhetkestä. */
    freeze(on = true) { fx.hitstop = on ? 1e9 : 0; },
    step(n = 1, dt = 1 / 60) {
      const h = fx.hitstop;
      fx.hitstop = 0;
      for (let i = 0; i < n; i++) simulate(dt);
      fx.hitstop = h;
    },
    /** Asennot muokattavina: hahmorivin kanssa asentoja voi säätää lennossa konsolista. */
    poses: POSES,
    /** Vaihtaa vastustajan suoraan annetun aallon vastustajaan (1 = urho ja miekka, 3 = keihäs, 4 = kilpi). */
    skipTo(n: number) {
      skipToWave(n);
    },
    /** Vaihtaa kohtauksen: "skirmish" = aaltotaistelu, "peace" = ei vastustajia. */
    encounter(kind: "skirmish" | "peace") { startEncounter(kind === "peace" ? peace : skirmish); },
    /** Tuo kentälle ylimääräisen vastustajan (i = rivi taulukossa ENEMIES) annettuun kohtaan.
     *  Rauhallisella pihalla tämä muuttaa paikan osin vihamieliseksi. */
    addEnemy(i: number, x: number, z: number, level = 1) {
      const def = ENEMIES[i % ENEMIES.length];
      addEnemy({ name: def.name, look: def.look, level }, new THREE.Vector3(x, groundHeight(x, z), z));
    },
    /** Tuo kentälle vapaasti kootun vastustajan, esim. Pohjan uuden vartalon kirveellä:
     *  `addWarrior({ character: "pohja", build: "hoikka", tunic: "vaalea", loadout: "sword_shield", axe: "parta", helmet: true }, 0, -4)`. */
    addWarrior(look: FighterLook, x: number, z: number, level = 1) {
      const shield = look.loadout === "sword_shield";
      const name = look.loadout === "spear" ? t("enemy.pohjaSpear")
        : look.axe ? t(shield ? "enemy.pohjaAxeShield" : "enemy.pohjaAxe")
          : t(shield ? "enemy.pohjaShield" : "enemy.pohja");
      return addEnemy({ name, look, level }, new THREE.Vector3(x, groundHeight(x, z), z)).name;
    },
    /** Elossa olevat vastustajat: nimi, tila, elämä ja paikka. */
    get enemies() { return g.enemies.map((e) => ({ name: e.name, state: e.state, hp: e.hp, pos: [+e.pos.x.toFixed(2), +e.pos.z.toFixed(2)] })); },
    /** Hahmorivi: kaikki hahmot ja varustukset näkyviin aukion keskelle. set "pohja" = Pohjan uudet vartalot ja kirveet. */
    showcase(on = true, pose?: string, set: "all" | "pohja" = "all") { setShowcase(on, pose, set); },
    /** Kaataa hahmorivin annettuun makuuasentoon (0..n-1) kuvakaappauksia varten; drop = pudota varusteet. */
    fallShowcase(variant = 0, drop = true) {
      for (const s of showcase) {
        s.fighter.fallen = FALLEN[variant % FALLEN.length];
        s.fighter.fall = 1;
        if (drop) for (const d of s.fighter.dropGear()) { scene.add(d.group); g.debris.push(d); }
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
    setCamera(pos: number[] | null, look: number[] = [0, 1, 0]) { aim.override = pos ? { pos, look } : null; },
    /** Rauhan eleet kuin painikkeilla (savutestit): "talk" = iskunappi, "use" = torjuntanappi. */
    gesture(kind: "talk" | "use") { if (kind === "talk") inputs.strikeQueued = "slash"; else inputs.useQueued = true; },
    /** Kohtauksen solmut nimen mukaan maailmankoordinaatteina (kuvakaappausten kameran asetukseen, esim. "hand_R"). */
    findNamed(name: string) {
      const out: number[][] = [];
      scene.traverse((o) => { if (o.name === name) out.push(o.getWorldPosition(new THREE.Vector3()).toArray().map((v) => +v.toFixed(2))); });
      return out;
    },
    /** Kävelykorkeus kohdassa (x, z) (kuvakaappausten kameran asetukseen). */
    ground(x: number, z: number) { return +groundHeight(x, z).toFixed(3); },
    /** Piirtokuorma nimetyittäin instanssinipuittain: kolmiot tällä hetkellä (suurimmat ensin). */
    drawLoad(top = 12) {
      const sums: Record<string, number> = {};
      let meshes = 0;
      scene.traverse((o) => {
        const im = o as THREE.InstancedMesh;
        if (!im.isInstancedMesh || !im.visible) return;
        meshes++;
        const geo = im.geometry, tris = (geo.index?.count ?? geo.attributes.position.count) / 3;
        const name = im.name || `static:${(im.material as THREE.Material).name}`;
        sums[name] = (sums[name] ?? 0) + Math.round(tris * im.count);
      });
      const total = Object.values(sums).reduce((a, b) => a + b, 0);
      return { meshes, total, top: Object.entries(sums).sort((a, b) => b[1] - a[1]).slice(0, top) };
    },
    /** Sekunteja (reaaliaikaa) seuraavaan laulun tahtiin, tai null. */
    get nextBeatIn() {
      if (!songState) return null;
      const i = songState.results.findIndex((r) => r === null);
      return i < 0 ? null : songState.beats[i] - g.realTime;
    },
    /** Automaattinen tauko fokuksen kadotessa päälle tai pois (savutestit). */
    autoPause(on: boolean) { g.autoPause = on; if (!on && paused) resume(); },
    /** Vie välilyönnin painalluksen laululle (savutestit). */
    beat() { inputs.beatQueued = true; },
    /** Suo näkyviin annettuun kohtaan tai pois (kuvakaappaukset). */
    bog(pos: number[] | null) { fx.bogDemo = pos ? new THREE.Vector3(pos[0], groundHeight(pos[0], pos[2]), pos[2]) : null; },
    /** Pelin sekunteja siihen, kun vihollisen isku laukeaa, tai null. */
    get enemyStrikeIn() {
      return d.enemy && d.enemy.state === "windup" ? d.enemy.timing.windup - d.enemy.stateTime : null;
    },
  };
}
