import * as THREE from "three";
import { cloneBindings } from "./bindings";
import { COMBAT } from "./combat";
import { removeActor, setState } from "./engine/actor";
import { tmpB } from "./engine/animate";
import { lockTarget } from "./engine/camera";
import { renewPlayerShield } from "./engine/hero";
import { bindings } from "./engine/input";
import { pause, paused, resume, simulate } from "./engine/loop";
import { setShowcase, showcase } from "./engine/showcase";
import { spawnEnemy } from "./engine/skirmish";
import { choosing, slotEls, songState } from "./engine/song";
import { aim, fx, g, inputs } from "./engine/state";
import { scene } from "./engine/view";
import { FALLEN, POSES } from "./fighter";
import { Modifier, withModifier } from "./stats";
import { changedValues } from "./tuning";
import { meterOff } from "./ui/pauseMenu";
import { ARENA, groundHeight } from "./world";

export function initDebug() {
  // Kehityskäyttöön ja savutesteihin: tila näkyy konsolista.
  (window as unknown as { __game: unknown }).__game = {
    get state() {
      return { pos: g.player.pos.toArray().map((v) => +v.toFixed(2)), yaw: +g.player.yaw.toFixed(2), dist: g.enemy ? +g.enemy.pos.distanceTo(g.player.pos).toFixed(2) : null, ai: { ...g.ai }, player: g.player.state, playerAttack: `${g.player.attack.kind}/${g.player.attack.weight}`, playerHp: g.player.hp, playerStamina: +g.player.stamina.toFixed(2), enemyStamina: g.enemy ? +g.enemy.stamina.toFixed(2) : null, playerShield: g.player.shieldHp, stance: g.player.stance, enemy: g.enemy?.state, enemyYaw: g.enemy ? +g.enemy.yaw.toFixed(2) : null, enemyPos: g.enemy ? [+g.enemy.pos.x.toFixed(2), +g.enemy.pos.z.toFixed(2)] : null, enemyAttack: g.enemy ? `${g.enemy.attack.kind}/${g.enemy.attack.weight}` : null, enemyShield: g.enemy?.shieldHp, enemyHp: g.enemy?.hp, song: g.songPower, wave: g.wave, timeScale: g.timeScale };
    },
    get events() { return [...g.events]; },
    /** Katse ja lukitus (savutestit): yaw ja pitch radiaaneina. */
    get look() { return { camYaw: +aim.yaw.toFixed(3), camPitch: +aim.pitch.toFixed(3), lockOn: aim.lockOn, locked: !!lockTarget(), playerYaw: +g.player.yaw.toFixed(3), enemyYaw: g.enemy ? +g.enemy.yaw.toFixed(3) : null }; },
    setLook(yaw: number, pitch = aim.pitch) { aim.yaw = yaw; aim.pitch = pitch; },
    setLock(on: boolean) { aim.lockOn = on; },
    /** Käytössä oleva taistelualue ("clearing" tai "homestead"). */
    get arena() { return ARENA; },
    get song() { return songState ? { results: [...songState.results], done: songState.endAt >= 0, realTime: g.realTime, playAt: songState.playAt, beats: songState.beats } : null; },
    fillSong() { g.songPower = COMBAT.songMax; },
    get meters() { return JSON.parse(JSON.stringify(meterOff)); },
    pause() { pause(); },
    get choosing() { return choosing; },
    /** Savutesti: valitsee laulupaikan kuin pikanäppäimellä. */
    pick(i: number) { inputs.pickQueued = i; },
    get slots() { return slotEls.map((e) => ({ cls: e.className, text: e.textContent, x: Math.round(parseFloat(e.style.left)), y: Math.round(parseFloat(e.style.top)), size: Math.round(parseFloat(e.style.width)) })); },
    /** Lisää ajonaikaisen vaikutuksen kykyihin (savutestit): who = "player" tai "enemy". */
    addModifier(who: "player" | "enemy", mod: Modifier) { const a = who === "player" ? g.player : g.enemy; if (a) a.mods = withModifier(a.mods, mod); },
    get stats() { return { player: { ...g.player.stats }, enemy: g.enemy ? { ...g.enemy.stats } : null }; },
    /** Säädetyt arvot polku → arvo. */
    get tuning() { return Object.fromEntries(changedValues()); },
    /** Asettaa kestävyydet (savutestit); null jättää ennalleen. */
    setHp(p: number) { g.player.hp = Math.min(g.player.stats.maxHp, p); },
    setStamina(p: number | null, e: number | null = null) { if (p !== null) g.player.stamina = p; if (e !== null && g.enemy) g.enemy.stamina = e; },
    /** Laulaa vastustajan suoraan suohon t sekunniksi (savutestit). */
    root(t = 3) { if (g.enemy && g.enemy.state !== "dead") { setState(g.enemy, "rooted"); g.enemy.rootTime = t; } },
    /** Siirtää pelaajan annettuun kohtaan (savutestit). */
    get feet() { return { player: g.player.fighter.feetDebug(), enemy: g.enemy?.fighter.feetDebug() ?? null }; },
    placePlayer(x: number, z: number) { g.player.pos.set(x, groundHeight(x, z), z); },
    /** Lennättää vastustajan kypärän päästä (tehosteen kokeiluun). */
    knockHelmet() {
      if (!g.enemy) return false;
      const prop = g.enemy.fighter.knockHelmet(new THREE.Vector3(Math.sin(g.enemy.yaw + 2), 0, Math.cos(g.enemy.yaw + 2)));
      if (prop) { scene.add(prop.group); g.debris.push(prop); }
      return !!prop;
    },
    get bindings() { return cloneBindings(bindings); },
    /** Irtokappaleiden (kypärät, kilven palat) korkeus maasta metreinä: leijuvan kappaleen tunnistaa tästä. */
    get debrisHeights() { return g.debris.map((d) => +(d.group.position.y - groundHeight(d.group.position.x, d.group.position.z)).toFixed(2)); },
    /** Ajaa peliä n askelta eteenpäin ruudunpäivityksestä riippumatta (savutestit). */
    tick(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) simulate(dt); },
    /** Asennot muokattavina: hahmorivin kanssa asentoja voi säätää lennossa konsolista. */
    poses: POSES,
    /** Vaihtaa vastustajan suoraan annetun aallon vastustajaan (1 = urho ja miekka, 3 = keihäs, 4 = kilpi). */
    skipTo(n: number) {
      if (g.enemy) removeActor(g.enemy);
      g.enemy = null;
      g.wave = Math.max(0, n - 1);
      g.nextWaveAt = -1;
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
      return g.enemy && g.enemy.state === "windup" ? g.enemy.timing.windup - g.enemy.stateTime : null;
    },
  };
}
