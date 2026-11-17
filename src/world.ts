import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import forestUrl from "../assets/forest.glb?url";
import homesteadUrl from "../assets/homestead.glb?url";
import householdUrl from "../assets/household.glb?url";
import yardUrl from "../assets/yard.glb?url";
import lakesideUrl from "../assets/lakeside.glb?url";
import lakeruinUrl from "../assets/lakeruin.glb?url";
import cairnfieldUrl from "../assets/cairnfield.glb?url";
import louhiUrl from "../assets/louhi.glb?url";
import villagersUrl from "../assets/villagers.glb?url";
import villagersFUrl from "../assets/villagers_f.glb?url";
import charactersUrl from "../assets/characters.glb?url";
import dogUrl from "../assets/animals/koira.glb?url";
import henUrl from "../assets/animals/kana.glb?url";
import pigUrl from "../assets/animals/possu.glb?url";
import fowlUrl from "../assets/animals/kukko_kana.glb?url";
import needlesDiffUrl from "../assets/ground/needles_diff.webp";
import needlesNorUrl from "../assets/ground/needles_nor.webp";
import mossDiffUrl from "../assets/ground/moss_diff.webp";
import mossNorUrl from "../assets/ground/moss_nor.webp";
import dirtDiffUrl from "../assets/ground/dirt_diff.webp";
import dirtNorUrl from "../assets/ground/dirt_nor.webp";
import { COLLISION, CollisionWorld } from "./collision";
import { spawnAnimal, spawnVillager, updateFolk, vanishVillager } from "./folk";
import { t, type TextKey } from "./i18n";
import { addTalkable, removeTalkable } from "./interact";
import { birdLevelAtDistance } from "./ambience";
import { SCENE_IDS, type SceneId } from "./app/route";

// Taistelualueet kangasmetsässä: maasto, männyt, kuuset, koivut, varvut ja kivet
// sekä alueen oma keskus (nuotioaukion kota tai pihapiirin rakennukset). Mallit
// tulevat Blenderistä (assets/forest.glb, assets/homestead.glb); tämä tiedosto
// sijoittelee ne instansseina ja hoitaa valon, maaston ja tulen.

/** Taistelukehän säde; sama molemmilla alueilla. */
export const ARENA_RADIUS = 11;

export type ArenaId = SceneId;
export const ARENAS: Record<ArenaId, { name: string; desc: string }> = {
  clearing: { name: t("arena.clearing.name"), desc: t("arena.clearing.desc") },
  homestead: { name: t("arena.homestead.name"), desc: t("arena.homestead.desc") },
  yard: { name: t("arena.yard.name"), desc: t("arena.yard.desc") },
  lakeside: { name: t("arena.lakeside.name"), desc: t("arena.lakeside.desc") },
  lakeruin: { name: t("arena.lakeruin.name"), desc: t("arena.lakeruin.desc") },
  cairnfield: { name: t("arena.cairnfield.name"), desc: t("arena.cairnfield.desc") },
};
const ARENA_STORE = "laulun-miekka.arena.v1";

function isArena(v: string | null): v is ArenaId {
  return v !== null && (SCENE_IDS as readonly string[]).includes(v);
}

function savedArena(): ArenaId {
  try {
    const v = localStorage.getItem(ARENA_STORE);
    if (isArena(v)) return v;
  } catch { /* muisti ei käytössä */ }
  return "clearing";
}

function requestedArena(): ArenaId | null {
  try {
    const value = new URL(location.href).searchParams.get("scene");
    return isArena(value) ? value : null;
  } catch { return null; }
}

/** Tallentaa valinnan; se tulee voimaan, kun sivu ladataan uudelleen (maailma rakennetaan kerran). */
export function saveArena(id: ArenaId): boolean {
  try { localStorage.setItem(ARENA_STORE, id); return true; } catch { return false; }
}

/** Tällä latauksella käytössä oleva alue. */
export const ARENA: ArenaId = requestedArena() ?? savedArena();
/**
 * Pihakohtauksen instanssi (V3): sama `yard`-kohtaus ajetaan usealle kartan pihalle, ja instanssi
 * määrää esineiden tunnisteiden etuliitteen ("yard", "yard-b") sekä sen, onko jousineito paikalla.
 * `scene3d.ts` asettaa arvon kampanjan paikkainstanssista ennen maailman rakentamista.
 */
export const siteInstance = { id: "yard", archer: true };
export function setSiteInstance(next: { id: string; archer: boolean }) {
  siteInstance.id = next.id;
  siteInstance.archer = next.archer;
}

/** Pihan pysyvä tila: jousineito on parannettu (`archer.healed`), joten hän seisoo eikä makaa. `scene3d.ts` asettaa. */
export const yardState = { archerHealed: false };

/** Jousineidon paikka pihassa (maassa makaava ja seisova ovat samassa kohdassa). */
const ARCHER_AT = { x: 2.3, z: 8.9 };
/** Loukkaantuneen jousineidon vartalon lisäesteet (ympyrät juuresta pitkin vartaloa), poistetaan paranemisessa. */
const ARCHER_BODY_IDS = ["folk:jousineito-ruumis1", "folk:jousineito-ruumis2"] as const;

/**
 * Jousineito pihassa: loukkaantuneena selällään maassa (V6, ilman jousta) tai parannettuna seisomassa
 * jousi kädessä. Sama tunniste "jousineito" molemmille, jotta `vanishVillager` löytää hänet.
 */
function spawnArcher(scene: THREE.Scene, standing: boolean): Promise<void> {
  const { x: jx, z: jz } = ARCHER_AT;
  const yaw = Math.atan2(-1 - jx, 0 - jz);
  if (!standing) {
    return spawnVillager(scene, { id: "jousineito", url: villagersFUrl, character: "jousineito", x: jx, y: groundHeight(jx, jz), z: jz, yaw, scale: 0.95, lying: true });
  }
  return spawnVillager(scene, {
    id: "jousineito", url: villagersFUrl, character: "jousineito", x: jx, y: groundHeight(jx, jz), z: jz, yaw, scale: 0.95,
    armL: { upper: [0.16, -1, 0.06], fore: [0.12, -0.25, 1] },
    prop: { name: "jousi", hand: "L", kind: "bow", grip: GRIP_FEMALE_L },
  });
}

/**
 * Hahmon tilan vaihto kesken kohtauksen (moottorin `setNpcState`-toimi). Nyt vain jousineito: parannettu
 * hahmo nousee seisomaan (maassa makaava malli vaihdetaan heti seisovaan) ja vartaloesteet poistuvat.
 */
export function setNpcStateInScene(scene: THREE.Scene, collision: CollisionWorld, npcId: string, state: string): boolean {
  if (npcId !== "jousineito" || state !== "healed" || !vanishVillager("jousineito", true)) return false;
  void spawnArcher(scene, true);
  for (const id of ARCHER_BODY_IDS) collision.disable(id);
  return true;
}

/** Kalmiston pysyvä tila: Louhi on karkotettu (`louhi.banished`), eikä häntä luoda. `scene3d.ts` asettaa ennen rakennusta. */
export const cairnState = { louhiBanished: false };

/**
 * Poistaa hahmon kesken kohtauksen (moottorin `removeNpc`-toimi): kyläläinen vaipuu näkyvistä,
 * este poistuu käytöstä ja hahmolle ei voi enää puhua. Palauttaa true, jos jokin poistettiin.
 */
export function removeNpcFromScene(npcId: string, collision: CollisionWorld): boolean {
  const gone = vanishVillager(npcId);
  const blocked = collision.disable(`folk:${npcId}`);
  const talk = removeTalkable(npcId);
  return gone || blocked || talk;
}

/** Rauhallinen paikka: kohtaus alkaa ilman vastustajia. Paikka voi silti muuttua vihamieliseksi,
 *  koska vastustajat tuo kohtaus (Encounter), ei paikka. */
export const ARENA_PEACEFUL = ARENA === "yard" || ARENA === "lakeside" || ARENA === "lakeruin" || ARENA === "cairnfield";
/** Pihan rakennukset, aita ja portti ovat yhteiset taistelupihalle ja rauhalliselle pihalle. */
const HAS_YARD = ARENA === "homestead" || ARENA === "yard";
/** Järven ranta: mökki, laituri ja vesi (lakeside.glb). */
const LAKESIDE = ARENA === "lakeside" || ARENA === "lakeruin";
/** Kalmisto: kalliokumpu järven rannalla (cairnfield.glb), ei mökkiä, laituria eikä tulta. */
const CAIRN = ARENA === "cairnfield";
/** Järvi ja kaukoranta: sama vesi ja maastonmuoto rantakohtauksilla ja kalmistolla. */
const LAKE = LAKESIDE || CAIRN;
/** Sama ranta tuhon jälkeen (lakeruin.glb): mökki poltettu, tietäjä kuollut, vene ja koira poissa, tulet sammuneet. */
const RUIN = ARENA === "lakeruin";

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
  /** Nuotion liekin koko (oletus 1): keittotulella liekki jää padan alle. */
  fireScale?: number;
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
// Rauhallisen pihan omat rakennelmat: sikolätti kuoppatalon paikalla (aitaus kehän reunalla
// niin, että possu näkyy kulkijalle), kanakoppi pihan länsilaidalla ja ruokapöytä talon edessä.
const STY = onRing(74, 13.7, 1.85, 2.15, 2.2);
const COOP = onRing(-80, 9.7, 0.8, 0.65, 0.65);
const TABLE = { x: -4.4, z: -6.6, yaw: 0.22 };
const FENCE_R = 12.9;
const GATE_HALF = 0.11;       // portin puolileveys radiaaneina (etelässä, +z)
/** Kuoppatalon kulkukuilu, joka leikataan maastoon: puolileveys sekä alku ja loppu etusuuntaan
 *  (homestead.py: dw + 0.34, L/2 - 0.25, L/2 + RAMP). */
const PIT_HOLE = { half: 0.76, from: 2.05, to: 4.2 };

// ---------- Järven ranta ----------
/** Vesipinnan korkeus; maasto painuu sen alle rannasta järveen päin (+z). */
export const WATER_LEVEL = -0.42;
/** Rantaviivan (maan ja kaltevan rannan raja) z-paikka kohdassa x. */
function shoreZ(x: number) {
  const base = 3.6 + Math.sin(x * 0.22 + 0.6) * 0.9 + Math.sin(x * 0.07 + 2.0) * 1.5;
  // Kalmisto on niemi: ranta on kauempana ja vetäytyy sivuille päin, joten järvi näkyy kumpareen takana ja sivuilla.
  return CAIRN ? base + 17.5 - 9 * THREE.MathUtils.smoothstep(Math.abs(x), 7, 28) : base;
}
/** Lahden puolileveys (m) etäisyydellä d rannasta, kummallekin puolelle erikseen: kapea lahdelma mökin kohdalla,
 *  joka aukeaa kaukana laajaksi järvenseläksi. Reunat ovat hieman epäsäännölliset. */
function bayHalf(d: number, side: number) {
  const dd = Math.max(0, d);
  const k = side < 0 ? 0.78 : 1.1;
  return 21 + dd * k + (noise2(dd * 0.045 + side * 7.3, 3.1) - 0.5) * 9 * Math.min(1, dd / 12);
}
/** Järven vaikutus 0..1: alkaa rantakaistalta, ja lahti aukeaa sivuille päin. Kaukana (r > 125) maa vajoaa
 *  veteen, jotta maaston reuna ei jää näkyviin; vastaranta on erillinen kaukainen harju (buildFarShore). */
function lakeMix(x: number, z: number) {
  const d = z - shoreZ(x);
  const w = bayHalf(d, Math.sign(x) || 1);
  const side = 1 - THREE.MathUtils.smoothstep(Math.abs(x), w - 11, w);
  const sea = THREE.MathUtils.smoothstep(Math.hypot(x, z), 125, 150) * THREE.MathUtils.smoothstep(z, 10, 40);
  return Math.max(THREE.MathUtils.smoothstep(d, -0.8, 3.8) * side, sea);
}
const lakeBed = (d: number) => -0.5 - 1.7 * THREE.MathUtils.smoothstep(d, 2, 10);
/** Veden reunan z-paikka kohdassa x (ensimmäinen kohta, jossa pohja on vesipinnan alla). */
function waterlineZ(x: number) {
  for (let z = shoreZ(x) - 1; z < shoreZ(x) + 70; z += 0.1) if (terrainHeight(x, z) < WATER_LEVEL) return z;
  return shoreZ(x) + 2.5;
}

const CABIN: Footprint = { x: -1.6, z: -2.2, yaw: 0.1, hx: 2.5, front: 1.95, back: 1.95 };
const LAKE_FIRE = { x: 2.7, z: 1.5 };
/** Laituri: origo maalla, kansi 0,30 m origon yläpuolella, ulottuu +z-suuntaan (lakeside.py). */
const JETTY = { x: -0.8, len: 3.9, half: 0.55, deck: 0.3 };
const RACK_LAKE = { x: -6.4, z: 1.6, yaw: Math.PI / 2 + 0.12 };
/** Tuhon jälkeen (lakeruin): tietäjä makaa selällään tulen vieressä, päänsä mökkiä kohti. Pisteet ovat jalkojen kohta;
 *  vartalo ulottuu hahmon omaan -z-suuntaan (`RUIN_BODY`), ja verilammikko on rinnan kohdalla. */
const RUIN_SAGE = { dx: 3.1, dz: 0.8, yaw: 1.26 };
const RUIN_BODY = { x: -Math.sin(RUIN_SAGE.yaw), z: -Math.cos(RUIN_SAGE.yaw) };
const ruinSagePos = () => ({ x: LAKE_FIRE.x + RUIN_SAGE.dx, z: LAKE_FIRE.z + RUIN_SAGE.dz });

// ---------- Kalmisto ----------
/** Kuppikivi kalmiston keskellä (cairnfield.glb: noin 2,2 x 1,75 m, lakipinta 0,8 m). */
export const CUPSTONE = { x: 1.2, z: 3.0, yaw: 0.5 };
/** Matalat röykkiöt kumpareella: malli, paikka, kierto ja mittakaava. Törmäysympyrän säde on PROP_COLLIDERS:ssa. */
const CAIRNS_AT = [
  { key: "roykkio_a", x: -6.2, z: 0.2, yaw: 0.4, s: 1 },
  { key: "roykkio_b", x: 7.6, z: 5.6, yaw: 1.1, s: 1 },
  { key: "roykkio_c", x: -3.2, z: 9.6, yaw: 2.0, s: 1 },
  { key: "roykkio_d", x: 5.0, z: -4.4, yaw: 0.9, s: 1 },
  { key: "roykkio_a", x: -9.6, z: -5.4, yaw: 3.2, s: 0.8 },
  { key: "roykkio_b", x: 11.2, z: -2.6, yaw: 0.2, s: 0.75 },
];
/** Karsikkomänty alueen länsilaidalla; Louhi seisoo sen vierellä katse kuppikiveen päin. */
const KARSIKKO = { x: -11.6, z: 9.2 };
export const LOUHI_AT = { x: -9.9, z: 7.5 };
/** Musta maa röykkiöiden ja kuppikiven välissä: keskipiste ja säde. */
const DARK_SOIL = [
  { x: -1.9, z: 5.6, r: 1.7, seed: 3 }, { x: 4.6, z: 1.3, r: 1.5, seed: 8 }, { x: -1.6, z: -1.2, r: 1.8, seed: 5 },
  { x: 3.0, z: 8.4, r: 1.3, seed: 11 }, { x: 4.4, z: -3.0, r: 1.2, seed: 14 }, { x: -7.6, z: 4.4, r: 1.5, seed: 17 },
];

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
  yard: {
    fire: { x: 3.6, z: -4.6 }, flat0: 20, flat1: 34, rough: 0.03,
    treeMin: 25, shrub0: 17, shrub1: 24, dirtR: 15, camMaxR: 12.2,
    footprints: [HOUSE, STY, STOREHOUSE, SHED, RACK],
    circles: [{ x: 3.6, z: -4.6, r: 2.0 }, { x: COOP.x, z: COOP.z, r: 1.6 }, { x: TABLE.x, z: TABLE.z, r: 2.0 }],
  },
  lakeside: {
    fire: LAKE_FIRE, fireScale: 0.62, flat0: 20, flat1: 34, rough: 0.03,
    treeMin: 11, shrub0: 10, shrub1: 18, dirtR: 7, camMaxR: Infinity,
    footprints: [CABIN],
    circles: [{ x: LAKE_FIRE.x, z: LAKE_FIRE.z, r: 1.8 }, { x: RACK_LAKE.x, z: RACK_LAKE.z, r: 2.2 }],
  },
  lakeruin: {
    fire: LAKE_FIRE, fireScale: 0.62, flat0: 20, flat1: 34, rough: 0.03,
    treeMin: 11, shrub0: 10, shrub1: 18, dirtR: 7, camMaxR: Infinity,
    footprints: [CABIN],
    circles: [{ x: LAKE_FIRE.x, z: LAKE_FIRE.z, r: 1.8 }, { x: RACK_LAKE.x, z: RACK_LAKE.z, r: 2.2 }],
  },
  cairnfield: {
    // Ei nuotiota: "tuli" on kaukana pelialueen ulkopuolella (maaston tallattu maa ja valo eivät osu).
    fire: { x: -380, z: -380 }, flat0: 16, flat1: 34, rough: 0.12,
    treeMin: 13, shrub0: 0.5, shrub1: 6, dirtR: 2, camMaxR: Infinity,
    footprints: [],
    circles: [
      { x: CUPSTONE.x, z: CUPSTONE.z, r: 2.0 },
      ...CAIRNS_AT.map((c) => ({ x: c.x, z: c.z, r: (c.key === "roykkio_b" ? 2.4 : c.key === "roykkio_d" ? 1.5 : 2.0) * c.s })),
      { x: KARSIKKO.x, z: KARSIKKO.z, r: 1.2 },
      { x: LOUHI_AT.x, z: LOUHI_AT.z, r: 1.0 },
    ],
  },
};
const SITE = SITES[ARENA];
/** Sumun väri; sama väri sekoitetaan kaukorannan siluetteihin. Hävitetyllä rannalla utuisempi, kalmistolla vaalea ja kostea. */
const FOG_COLOR = RUIN ? 0x8d9698 : CAIRN ? 0xa4b0b2 : 0x93a6ad;
const FIRE = SITE.fire;

/**
 * Mallityypin törmäys määritellään kerran tässä. Kaikki put()-kutsulla koodista
 * sijoitetut instanssit saavat saman muodon automaattisesti sijainnin, kierron ja
 * mittakaavan mukaan. Uusi kohtaus ei siis tarvitse käsin merkittyjä törmäyksiä.
 */
export type PropColliderTemplate =
  | { kind: "circle"; radius: number; blocksMelee?: boolean }
  | { kind: "box"; halfX: number; halfZ: number; blocksMelee?: boolean };

export const PROP_COLLIDERS: Record<string, PropColliderTemplate> = {
  rock_1: { kind: "circle", radius: 0.7, blocksMelee: true },
  rock_2: { kind: "circle", radius: 0.7, blocksMelee: true },
  rock_3: { kind: "circle", radius: 0.8, blocksMelee: true },
  rock_4: { kind: "circle", radius: 0.65, blocksMelee: true },
  rock_5: { kind: "circle", radius: 0.75, blocksMelee: true },
  rock_6: { kind: "circle", radius: 0.7, blocksMelee: true },
  pine_a: { kind: "circle", radius: 0.3, blocksMelee: true },
  pine_b: { kind: "circle", radius: 0.34, blocksMelee: true },
  pine_c: { kind: "circle", radius: 0.3, blocksMelee: true },
  spruce_a: { kind: "circle", radius: 0.3, blocksMelee: true },
  spruce_b: { kind: "circle", radius: 0.28, blocksMelee: true },
  spruce_young: { kind: "circle", radius: 0.22, blocksMelee: true },
  birch_a: { kind: "circle", radius: 0.22, blocksMelee: true },
  birch_b: { kind: "circle", radius: 0.24, blocksMelee: true },
  kota: { kind: "circle", radius: 2.25, blocksMelee: true },
  aita: { kind: "box", halfX: 1.02, halfZ: 0.12, blocksMelee: true },
  portinpieli: { kind: "circle", radius: 0.13, blocksMelee: true },
  pino: { kind: "box", halfX: 1.15, halfZ: 0.45, blocksMelee: true },
  polkky: { kind: "circle", radius: 0.55, blocksMelee: true },
  haasia: { kind: "box", halfX: 1.95, halfZ: 0.65, blocksMelee: true },
  ruukku: { kind: "circle", radius: 0.2, blocksMelee: false },
  // Clauden talousesineet eivät ole vielä kohtauksessa, mutta tuleva koodisijoittelu
  // saa törmäykset ilman kohtauskohtaista käsityötä.
  pukkipoyta: { kind: "box", halfX: 1.18, halfZ: 0.42, blocksMelee: true },
  penkki: { kind: "box", halfX: 0.98, halfZ: 0.3, blocksMelee: true },
  kanakoppi: { kind: "box", halfX: 0.8, halfZ: 0.65, blocksMelee: true },
  pata: { kind: "circle", radius: 0.5, blocksMelee: false },
  tuohikontti: { kind: "circle", radius: 0.2, blocksMelee: false },
  // Järven rannan esineet (lakeside.glb); mökki, laituri ja nuotio saavat törmäyksensä erikseen.
  istuinhirsi: { kind: "box", halfX: 0.66, halfZ: 0.2, blocksMelee: false },
  vene: { kind: "box", halfX: 0.36, halfZ: 1.7, blocksMelee: true },
  haasia_kaatunut: { kind: "box", halfX: 1.9, halfZ: 0.7, blocksMelee: false },
  lyhde: { kind: "circle", radius: 0.25, blocksMelee: false },
  // Kalmisto (cairnfield.glb): röykkiöt ovat matalia, joten niiden yli lyödään, mutta päälle ei astuta.
  kuppikivi: { kind: "box", halfX: 1.02, halfZ: 0.76, blocksMelee: true },
  roykkio_a: { kind: "circle", radius: 1.45, blocksMelee: false },
  roykkio_b: { kind: "box", halfX: 1.9, halfZ: 1.0, blocksMelee: false },
  roykkio_c: { kind: "circle", radius: 1.65, blocksMelee: false },
  roykkio_d: { kind: "circle", radius: 0.95, blocksMelee: false },
  karsikko: { kind: "circle", radius: 0.34, blocksMelee: true },
};

function addPropCollider(
  collision: CollisionWorld,
  id: string,
  name: string,
  x: number,
  z: number,
  scale: number,
  yaw: number,
) {
  const def = PROP_COLLIDERS[name];
  if (!def) return;
  if (def.kind === "circle") {
    collision.add({ id, kind: "circle", x, z, radius: def.radius * scale, blocksMovement: true, blocksMelee: !!def.blocksMelee });
  } else {
    collision.add({ id, kind: "box", x, z, yaw, halfX: def.halfX * scale, halfZ: def.halfZ * scale, blocksMovement: true, blocksMelee: !!def.blocksMelee });
  }
}

function addFootprintCollider(collision: CollisionWorld, id: string, f: Footprint) {
  const center = (f.front - f.back) / 2;
  const [x, z] = fromLocal(f, 0, center);
  collision.add({
    id, kind: "box", x, z, yaw: f.yaw, halfX: f.hx, halfZ: (f.front + f.back) / 2,
    blocksMovement: true, blocksMelee: true,
  });
}

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
  if (LAKESIDE) {
    if (Math.abs(x - JETTY_AT.x) < 1.3 + pad && z > JETTY_AT.z - 1.2 - pad && z < JETTY_AT.z + JETTY.len + 0.8 + pad) return true;
    if (Math.hypot(x - BOAT_AT.x, z - BOAT_AT.z) < 2.3 + pad) return true;
  }
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

/** Maaston pinta ilman rakennelmia (maastoverkko, rantakaistan laskenta). */
function terrainHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const n = noise2(x * 0.08, z * 0.08) * 2.2 + noise2(x * 0.3, z * 0.3) * 0.35;
  // Aukio on lähes tasainen, reunoilla maasto kumpuilee.
  const t = THREE.MathUtils.smoothstep(r, SITE.flat0, SITE.flat1);
  let h = n * (SITE.rough + (1 - SITE.rough) * t) + t * 1.5;
  if (CAIRN) {
    // Kallionokka: loiva kumpare, jonka laelta maa laskee rantaan, ja pinnassa matalia kalliokumpuja.
    const hx = x - 1, hz = z - 4;
    h += 1.15 * Math.exp(-(hx * hx / (2 * 13 * 13) + hz * hz / (2 * 12 * 12)));
    h += Math.abs(noise2(x * 0.32 + 5, z * 0.32) - 0.5) * 0.55 * (1 - THREE.MathUtils.smoothstep(r, 6, 20));
  }
  if (!LAKE) return h;
  const m = lakeMix(x, z);
  return h * (1 - m) + lakeBed(z - shoreZ(x)) * m;
}

/** Laiturin paikka: origo (maan päässä), kantopinnan korkeus ja sen alla olevan maan korkeus. */
const JETTY_AT = LAKESIDE
  ? (() => {
    const z = shoreZ(JETTY.x) + 1.3;
    const y = terrainHeight(JETTY.x, z);
    return { x: JETTY.x, z, y, top: y + JETTY.deck };
  })()
  : { x: 0, z: 0, y: 0, top: 0 };

/** Vene vedetty rantaan laiturin viereen, keula järvelle. */
const BOAT_AT = LAKESIDE
  ? (() => {
    const x = JETTY.x + 3.7, z = waterlineZ(x) - 0.3;
    return { x, z, y: terrainHeight(x, z) + 0.08, yaw: -0.12 };
  })()
  : { x: 0, z: 0, y: 0, yaw: 0 };

/** Sankarin aloituspaikka ja katseen suunta (yaw 0 = +z, π = -z). Rannalla hän astuu laiturin
 *  juurelta katsomaan keittotulta: mökki jää vasemmalle ja järvi oikealle. */
export const SPAWN = LAKESIDE ? { x: JETTY_AT.x, z: JETTY_AT.z - 1.5, yaw: Math.PI - 0.7 }
  : CAIRN ? { x: -0.6, z: -9.5, yaw: 0.1 } : { x: 0, z: -3, yaw: 0 };

/** Korkeus, jolla hahmot kävelevät: maasto, ja laiturin päällä sen kansi. */
export function groundHeight(x: number, z: number): number {
  const h = terrainHeight(x, z);
  if (!LAKESIDE) return h;
  const lx = Math.abs(x - JETTY_AT.x), lz = z - JETTY_AT.z;
  if (lx > JETTY.half + 0.05 || lz < -0.4 || lz > JETTY.len + 0.1) return h;
  const w = THREE.MathUtils.smoothstep(lz, -0.4, 0.5);        // luiska maasta kannelle
  return h * (1 - w) + JETTY_AT.top * w;
}

/** Onko piste vedessä (maasto alle vesipinnan, laiturin ulkopuolella). */
function wet(x: number, z: number) {
  return LAKE && terrainHeight(x, z) < WATER_LEVEL + 0.12;
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
  /** Yhteinen hahmojen, eläinten, maailmanesteiden ja vaara-alueiden 2,5D-rekisteri. */
  collision: CollisionWorld;
  /** Kohtauksen pienet, erikseen poistettavat esineet. Lista täyttyy ready-lupauksen aikana. */
  sceneItems(): readonly RuntimeSceneItem[];
  sceneItem(id: string): RuntimeSceneItem | undefined;
  /** Piilottaa tallennuksessa jo otetut esineet. Turvallinen kutsua ennen ready-lupausta. */
  setTakenSceneItemIds(ids: readonly string[]): void;
  /** Poistaa yhden esineen näkymästä ja estää sen myöhäisen luonnin. */
  removeSceneItem(id: string): boolean;
  /** Poistaa hahmon (esim. "louhi") kesken kohtauksen; false, jos häntä ei ole. */
  removeNpc(npcId: string): boolean;
  /** Vaihtaa hahmon tilan kesken kohtauksen (jousineito: "healed" = nousee seisomaan). */
  setNpcState(npcId: string, state: string): boolean;
  /** Siirtää kameran paikan pois rakennusten sisältä (pihapiirissä kehän sisäpuolelle). */
  clearCamera(pos: THREE.Vector3): void;
  /** focus = kulkija (sankari), jota pihan väki katsoo. */
  update(t: number, dt: number, camera: THREE.Camera, focus?: THREE.Vector3): void;
}

export type SceneItemTakeMode = "allowed" | "theft";

/** Renderöity, vuorovaikutettava maailmanesine. Inventaarion pysyvä tila on kampanjadomainissa. */
export interface RuntimeSceneItem {
  /** Vakaa paikkainstanssin sisäinen tunniste; sama ranta säilyttää tunnisteen myös raunioituneena. */
  id: string;
  siteId: string;
  itemId: string;
  quantity: number;
  takeMode: SceneItemTakeMode;
  ownerId?: string;
  /** Poistettava juuri; geometria ja materiaalit jaetaan prototyypin kanssa. */
  root: THREE.Group;
  /** Kohdistuksen maailmanpiste ja salliva säde, jotta ohuisiin ruokiin ei tarvitse osua pikselintarkasti. */
  focusWorldPosition: THREE.Vector3;
  focusRadius: number;
}

export interface GroundTex { mossDiff: THREE.Texture; mossNor: THREE.Texture; dirtDiff: THREE.Texture; dirtNor: THREE.Texture; }

// ---------- Maasto: kolmen skannatun pinnan sekoitus ----------
function buildGround(scene: THREE.Scene, maxAniso: number): GroundTex {
  // Järven rannalla maasto ulottuu kauemmas (lahti aukeaa järvenselälle).
  const size = LAKE ? 360 : 180, seg = LAKE ? 300 : 200;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const splat = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, terrainHeight(x, z));
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
    if (LAKE) dirt = Math.max(dirt, (1 - THREE.MathUtils.smoothstep(pos.getY(i), WATER_LEVEL - 0.15, WATER_LEVEL + 0.3)) * 0.95);   // rantahiekka ja pohja
    dirt = THREE.MathUtils.clamp(dirt, 0, 1);
    const m = moisture(x, z) + (noise2(x * 0.9, z * 0.9) - 0.5) * 0.25;
    // Kalmisto on sammaleista ja jäkäläistä kalliokangasta: sammal alkaa heti ja havunneulaset jäävät vähäisiksi.
    const mossLo = CAIRN ? 0.28 : 0.42, mossHi = CAIRN ? 0.5 : 0.62;
    const moss = THREE.MathUtils.smoothstep(m, mossLo, mossHi) * THREE.MathUtils.smoothstep(r, SITE.shrub0 - 0.5, SITE.shrub1) * (1 - dirt);
    const needles = Math.max(0.05, 1 - moss - dirt) * (CAIRN ? 0.55 : 1);
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

// ---------- Järven vesi ----------
/** Tumma, hiljainen vesipinta: taivas heijastuu, pinta väreilee hitaasti. Pohja näkyy läpi rannassa. */
function buildWater(scene: THREE.Scene, envMap: THREE.Texture) {
  const geo = new THREE.PlaneGeometry(1800, 1800);
  geo.rotateX(-Math.PI / 2);
  const uTime = { value: 0 };
  const mat = new THREE.MeshStandardMaterial({
    color: 0x2a5560, roughness: 0.07, metalness: 0.1, envMap, envMapIntensity: 1.25, transparent: true, opacity: 0.84,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vWp;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWp = (modelMatrix * vec4(position, 1.0)).xz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;\nvarying vec2 vWp;")
      .replace(
        "#include <normal_fragment_maps>",
        `vec2 wp = vWp;
        float wa = sin(wp.x * 1.3 + uTime * 0.9 + sin(wp.y * 0.7 + uTime * 0.5)) + sin(wp.y * 1.7 - uTime * 0.7 + wp.x * 0.4) + sin((wp.x + wp.y) * 3.1 + uTime * 1.6) * 0.5;
        float wb = cos(wp.x * 1.1 - uTime * 0.6 + wp.y * 0.9) + cos(wp.y * 2.3 + uTime * 1.1) + cos((wp.x - wp.y) * 2.7 - uTime * 1.4) * 0.5;
        normal = normalize(normal + (viewMatrix * vec4(wa * 0.02, 0.0, wb * 0.02, 0.0)).xyz);`,
      );
  };
  const water = new THREE.Mesh(geo, mat);
  water.position.y = WATER_LEVEL;
  water.renderOrder = 1;
  scene.add(water);
  return { update(dt: number) { uTime.value += dt; } };
}

// ---------- Kaukainen vastaranta ----------
/** Järven vastaranta: kaksi matalaa metsäharjua kaukana horisontissa (z 330–460 m). Ne ovat oma verkkonsa ilman
 *  sumua (sumu peittäisi ne kokonaan) ja väri on valmiiksi sekoitettu sumun väriin, jolloin ne näkyvät vaaleina siluetteina. */
function buildFarShore(scene: THREE.Scene) {
  const fog = new THREE.Color(FOG_COLOR);
  // Kalmistolla vastaranta on lähes sumun peitossa: vaaleita, himmeitä siluetteja.
  const layers = [
    { z0: 330, depth: 60, h: 11, fogMix: CAIRN ? 0.78 : 0.55, tint: 0x35504a, seed: 3.0 },
    { z0: 410, depth: 70, h: 22, fogMix: CAIRN ? 0.9 : 0.74, tint: 0x40605a, seed: 9.0 },
  ];
  for (const L of layers) {
    const w = 1700, nx = 220, nz = 8;
    const geo = new THREE.PlaneGeometry(w, L.depth, nx, nz);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const col = new Float32Array(pos.count * 3);
    const base = new THREE.Color(L.tint).lerp(fog, L.fogMix);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), u = (pos.getZ(i) + L.depth / 2) / L.depth;       // u 0 = vedenpuoleinen reuna
      const ridge = 0.45 + noise2(x * 0.004 + L.seed, L.seed) * 0.75 + noise2(x * 0.017, L.seed + 4) * 0.35;
      const jag = (noise2(x * 0.45 + L.seed, u * 3) - 0.5) * 0.12 + (noise2(x * 0.12, L.seed) - 0.5) * 0.18;   // havupuurivin pykälät
      const h = L.h * ridge * THREE.MathUtils.smoothstep(u, 0.0, 0.5) * (1 + jag);
      pos.setXYZ(i, x, -1.2 + h, pos.getZ(i) + L.z0 + L.depth / 2);
      c.copy(base).multiplyScalar(0.88 + 0.22 * THREE.MathUtils.smoothstep(h, 0, L.h * 0.9));
      col.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
    mesh.frustumCulled = false;
    scene.add(mesh);
  }
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
function makeSmoke(parent: THREE.Object3D, count: number, life: number, y0: number, size: number, alpha: number, tone: [number, number, number] = [0.42, 0.40, 0.38]) {
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
      sCol.set([tone[0], tone[1], tone[2], a], i * 4);
    }
    sGeo.attributes.position.needsUpdate = true;
    sGeo.attributes.color.needsUpdate = true;
  };
}

function buildFire(scene: THREE.Scene) {
  const fy = groundHeight(FIRE.x, FIRE.z);
  const group = new THREE.Group();
  const fs = SITE.fireScale ?? 1;
  group.position.set(FIRE.x, fy, FIRE.z);
  group.scale.setScalar(fs);
  scene.add(group);
  if (RUIN || CAIRN) {
    // Tuhon jälkeen tuli on sammunut (tuhka on mallissa); kalmistolla ei ole tulta lainkaan: ei liekkiä, hehkua, kipinöitä, savua eikä valoa.
    const dead = new THREE.PointLight(0xff8a3c, 0, 16, 1.5);
    dead.visible = false;
    scene.add(dead);
    return { light: dead, update() { /* sammunut */ } };
  }

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
  light.position.set(FIRE.x, fy + 0.9 * fs, FIRE.z);
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
  // Keittotulella padasta nousee ohut höyry (pata on 0,92 m korkeudella).
  const steam = LAKESIDE ? makeSmoke(group, 9, 3.4, 0.92 / fs, 0.5, 0.11) : null;

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
      steam?.(dt);
    },
  };
}

// ---------- Blender-mallien sijoittelu ----------
type Proto = { geometry: THREE.BufferGeometry; material: THREE.Material }[];

interface SceneItemPlacement {
  id: string;
  siteId: string;
  itemId: string;
  model: string;
  quantity: number;
  takeMode: SceneItemTakeMode;
  ownerId?: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale?: number;
  focusY: number;
  focusRadius: number;
}

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
      if (/Blood/.test(m.name)) {
        // Verilammikko on litteä läikkä maan päällä: nostetaan syvyydessä, ettei maaston epätasaisuus syö sitä.
        m.metalness = 0;
        m.roughness = 0.2;
        m.polygonOffset = true;
        m.polygonOffsetFactor = -2;
        m.polygonOffsetUnits = -2;
      }
      if (/^M_HH_/.test(m.name)) {
        // Talousesineet: mattapintaisia; punokset, oljet ja tuohi ovat ohuita pintoja.
        m.metalness = 0;
        m.roughness = Math.max(m.roughness, 0.85);
        if (/Weave|Straw|Kori|Bark|Birch/.test(m.name)) { m.side = THREE.DoubleSide; m.shadowSide = THREE.DoubleSide; }
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

function populate(
  scene: THREE.Scene,
  protos: Map<string, Proto>,
  collision: CollisionWorld,
  sceneItems: Map<string, RuntimeSceneItem>,
  takenSceneItems: ReadonlySet<string>,
) {
  const r = rand(1849);
  const dummy = new THREE.Object3D();
  const batches = new Map<string, THREE.Matrix4[]>();
  let dynamicTris = 0;
  let colliderId = 0;
  const put = (key: string, x: number, z: number, scale: number, yaw: number, sink = 0, tilt = 0, opts: { wetOk?: boolean; y?: number } = {}) => {
    if (!opts.wetOk && wet(x, z)) return;                     // ei puita, kiviä tai heinää veteen
    dummy.position.set(x, opts.y ?? groundHeight(x, z) - sink, z);
    dummy.rotation.set(tilt * (r() - 0.5), yaw, tilt * (r() - 0.5));
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key)!.push(dummy.matrix.clone());
    const name = key.split("@")[0];
    addPropCollider(collision, `prop:${name}:${colliderId++}`, name, x, z, scale, yaw);
  };
  const putSceneItem = (def: SceneItemPlacement) => {
    if (takenSceneItems.has(def.id)) return;
    const parts = protos.get(def.model);
    if (!parts?.length) { console.warn("Esinemalli puuttuu:", def.model); return; }
    const root = new THREE.Group();
    root.name = `scene-item:${def.id}`;
    root.position.set(def.x, def.y, def.z);
    root.rotation.y = def.yaw;
    root.scale.setScalar(def.scale ?? 1);
    root.userData.sceneItemId = def.id;
    for (const part of parts) {
      const mesh = new THREE.Mesh(part.geometry, part.material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
      dynamicTris += (part.geometry.index?.count ?? part.geometry.attributes.position.count) / 3;
    }
    scene.add(root);
    sceneItems.set(def.id, {
      id: def.id,
      siteId: def.siteId,
      itemId: def.itemId,
      quantity: def.quantity,
      takeMode: def.takeMode,
      ownerId: def.ownerId,
      root,
      focusWorldPosition: new THREE.Vector3(def.x, def.y + def.focusY * (def.scale ?? 1), def.z),
      focusRadius: def.focusRadius * (def.scale ?? 1),
    });
  };
  /** Rakennus paikalleen pohjansa mukaan, etusivu keskipisteeseen päin. */
  const place = (key: string, f: Footprint, sink = 0.03) => put(key, f.x, f.z, 1, f.yaw, sink);

  // Puut: lähimmät kehänä aukion ympärillä, loput harvenevana metsänä.
  const trees: { x: number; z: number }[] = [];
  const tryTree = (x: number, z: number) => {
    const d = Math.hypot(x, z);
    if (d < SITE.treeMin || blocked(x, z, 1.5)) return;
    if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 2.6)) return;
    // Kalmisto: näkymä järvelle jää auki, mäntymetsä on harvaa ja kumpareen ympärillä on tilaa.
    if (CAIRN && ((z > 7 && Math.abs(x) < 14) || Math.hypot(x - 1, z - 3) < 13 || r() < 0.4)) return;
    trees.push({ x, z });
    const m = moisture(x, z), k = r();
    let type: string;
    if (CAIRN) type = k < 0.4 ? (r() < 0.5 ? "birch_a" : "birch_b") : k < 0.46 ? ["spruce_a", "spruce_b"][Math.floor(r() * 2)] : ["pine_a", "pine_b", "pine_c"][Math.floor(r() * 3)];
    else if (LAKESIDE) type = k < 0.06 ? (r() < 0.5 ? "birch_a" : "birch_b") : k < 0.84 ? ["spruce_a", "spruce_b", "spruce_a", "spruce_young"][Math.floor(r() * 4)] : ["pine_a", "pine_b", "pine_c"][Math.floor(r() * 3)];
    else if (k < 0.1) type = r() < 0.5 ? "birch_a" : "birch_b";
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
  if (LAKESIDE) put("istuinhirsi@near", FIRE.x - 1.75, FIRE.z + 0.35, 1, Math.PI / 2 + 0.2, 0.02);     // istuinhirsi keittotulella
  else if (!CAIRN) put("log@near", FIRE.x + 1.9, FIRE.z + 1.3, 0.75, 2.2, 0.02);       // istuinpuu nuotiolla
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
    if (CAIRN && r() < 0.6) continue;                        // kalliokangas: harvaa heinää, enemmän sammalta ja kiveä
    put(d < ARENA_RADIUS ? "grass_d" : `grass_${"abcd"[Math.floor(r() * 4)]}`, x, z, 0.8 + r() * 0.7, r() * 6.28, 0.01);
  }
  for (let i = 0; i < 140; i++) {
    const a = r() * 6.28, d = SITE.treeMin - 1.2 + r() * 28;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (moisture(x, z) < 0.5 || blocked(x, z, 0)) continue;
    put(r() < 0.5 ? "fern_a" : "fern_b", x, z, 0.9 + r() * 0.8, r() * 6.28, 0.01);
  }

  if (!CAIRN) put(LAKESIDE ? (RUIN ? "keittopaikka_sammunut@near" : "keittopaikka@near") : "campfire@near", FIRE.x, FIRE.z, 1, LAKESIDE ? 0 : 0.4, 0.02);
  if (ARENA === "clearing") {
    put("kota@near", KOTA.x, KOTA.z, 1, 2.45, 0.05);     // oviaukko aukiolle päin
  } else if (CAIRN) {
    // Kalmisto: kuppikivi keskellä, matalat röykkiöt kumpareella ja karsikkomänty länsilaidalla.
    put("kuppikivi@near", CUPSTONE.x, CUPSTONE.z, 1, CUPSTONE.yaw, 0.12);
    for (const c of CAIRNS_AT) put(`${c.key}@near`, c.x, c.z, c.s, c.yaw, 0.03);
    put("karsikko@near", KARSIKKO.x, KARSIKKO.z, 1, 0.6, 0.15);
  } else if (LAKESIDE) {
    // Mökki oven kanssa rantaan päin, laituri, vene ja ruovikko; pihalla halkopino, pölkky, penkki ja kuivausteline.
    place(RUIN ? "mokki_palanut@near" : "mokki@near", CABIN, 0.04);
    put("laituri@near", JETTY_AT.x, JETTY_AT.z, 1, 0, 0, 0, { y: JETTY_AT.y, wetOk: true });
    if (!RUIN) {   // tuhon jälkeen vene on poissa
      put("vene@near", BOAT_AT.x, BOAT_AT.z, 1, BOAT_AT.yaw, 0, 0, { y: BOAT_AT.y, wetOk: true });
      put("mela@near", BOAT_AT.x, BOAT_AT.z, 1, BOAT_AT.yaw, 0, 0, { y: BOAT_AT.y + 0.38, wetOk: true });
    }
    for (let i = 0; i < 74; i++) {
      const x = -40 + r() * 80;
      if (Math.abs(x - JETTY_AT.x) < 1.9 || Math.abs(x - BOAT_AT.x) < 2.6) continue;
      const k = r();
      const zw = waterlineZ(x);
      if (zw > shoreZ(x) + 69) continue;           // ei vettä tällä kohdalla (lahden reunan maa)
      put(k < 0.45 ? "ruoko_a@near" : k < 0.75 ? "ruoko_b@near" : "kaisla@near", x, zw + 0.1 + r() * 1.6, 0.8 + r() * 0.5, r() * 6.28, 0.02, 0.1, { wetOk: true });
    }
    const at = (lx: number, lz: number) => fromLocal(CABIN, lx, lz);
    const [wx, wz] = at(-3.3, 0.1);
    put("pino@near", wx, wz, 1, CABIN.yaw + Math.PI / 2, 0.02);
    put(RUIN ? "haasia_kaatunut@near" : "haasia@near", RACK_LAKE.x, RACK_LAKE.z, 1, RACK_LAKE.yaw, 0.02);
    const [cx, cz] = at(2.3, 2.9);
    put("polkky@near", cx, cz, 1, 0.8, 0.02);
    const [bx, bz] = at(1.35, 2.3);
    put("penkki@near", bx, bz, 1, CABIN.yaw, 0.01);
    put("kori@near", bx + 0.35, bz, 1, 0.9, 0, 0, { y: groundHeight(bx, bz) + 0.47 });
    const [tx, tz] = at(-1.9, 2.3);
    putSceneItem({
      id: "lakeside.sage-pack", siteId: "lakeside", itemId: "birch_bark_pack", model: "tuohikontti", quantity: 1,
      takeMode: "theft", ownerId: "tietaja",
      x: tx, y: groundHeight(tx, tz) - 0.01, z: tz, yaw: CABIN.yaw + 2.6,
      focusY: 0.22, focusRadius: 0.34,
    });
    if (RUIN) {
      // Verta: iso lammikko tietäjän rinnan kohdalla ja jälki mökin ovelta hänen luokseen.
      const f = ruinSagePos();
      const chest = { x: f.x + RUIN_BODY.x * 1.15, z: f.z + RUIN_BODY.z * 1.15 };
      put("verilammikko@near", chest.x, chest.z, 1, 0.3, -0.03);
      const [ox, oz] = fromLocal(CABIN, -0.5, 2.2);
      [0.1, 0.24, 0.38, 0.86].forEach((k, i) => {
        const px = ox + (chest.x - ox) * k + Math.sin(i * 2.1) * 0.25, pz = oz + (chest.z - oz) * k + Math.cos(i * 1.7) * 0.25;
        put("verilammikko_pieni@near", px, pz, 0.8 + 0.2 * (i % 2), i * 1.9, -0.03);
      });
    }
  } else {
    place("talo@near", HOUSE);
    if (ARENA === "homestead") place("kuoppatalo@near", PITHOUSE, 0);
    else place("sikolatti@near", STY, 0.02);
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
    if (ARENA === "homestead") put("ruukku@near", FIRE.x - 1.05, FIRE.z - 0.55, 1.15, 4.0, 0.01);
    if (ARENA === "yard") {
      // Katettu pöytä penkkeineen talon edessä, keittopata sen päädyssä, eväät ja lyhteet seinustoilla.
      const tb = { ...TABLE, hx: 0, front: 0, back: 0 };
      put("pukkipoyta@near", TABLE.x, TABLE.z, 1, TABLE.yaw, 0.01);
      // Blenderin poyta_kattaus yhdistää ruuat ja astiat yhdeksi verkoksi. Kootaan sama kattaus
      // erillisistä prototyypeistä, jotta rieskat ja kalat voidaan poistaa muun kattauksen jäädessä.
      const tableTopY = groundHeight(TABLE.x, TABLE.z) + 0.75;
      const tablePoint = (lx: number, blenderY: number) => fromLocal(tb, lx, -blenderY);
      const tableProp = (key: string, lx: number, blenderY: number, height = 0, yaw = 0) => {
        const [x, z] = tablePoint(lx, blenderY);
        put(`${key}@near`, x, z, 1, TABLE.yaw + yaw, 0, 0, { y: tableTopY + height });
      };
      tableProp("kulho", -0.62, 0.05, 0, 0.4);
      tableProp("nauriit", -0.62, 0.05, 0.035, 1.0);
      tableProp("lautanen", 0.42, 0.08);
      tableProp("kuppi", -0.95, -0.2, 0, 0.3);
      tableProp("kuppi", 0.1, 0.24, 0, 2.0);
      tableProp("kuppi", 0.9, -0.16, 0, 4.0);
      tableProp("kauha", -0.3, 0.22, 0, 1.2);
      const [breadX, breadZ] = tablePoint(-0.12, -0.08);
      putSceneItem({
        id: `${siteInstance.id}.table-flatbread`, siteId: siteInstance.id, itemId: "barley_flatbread", model: "rieska", quantity: 3,
        takeMode: "theft", ownerId: "household",
        x: breadX, y: tableTopY, z: breadZ, yaw: TABLE.yaw,
        focusY: 0.05, focusRadius: 0.28,
      });
      const [fishX, fishZ] = tablePoint(0.42, 0.08);
      putSceneItem({
        id: `${siteInstance.id}.table-dried-fish`, siteId: siteInstance.id, itemId: "dried_fish", model: "kuivakalat", quantity: 3,
        takeMode: "theft", ownerId: "household",
        x: fishX, y: tableTopY + 0.012, z: fishZ, yaw: TABLE.yaw + 0.5,
        focusY: 0.04, focusRadius: 0.29,
      });
      for (const s of [-1, 1]) {
        const [x, z] = fromLocal(tb, 0, s * 0.8);
        put("penkki@near", x, z, 1, TABLE.yaw, 0.01);
      }
      const at = (key: string, lx: number, lz: number, scale = 1, yaw = 0) => {
        const [x, z] = fromLocal(tb, lx, lz);
        put(key + "@near", x, z, scale, TABLE.yaw + yaw, 0.005);
      };
      at("pata", 2.5, -0.5, 1, 0.6);
      at("tuohikontti", -1.6, 0.5, 1, 2.6);
      at("kori", -1.75, -0.25, 1, 0.9);
      at("nauriit", -1.45, -0.15, 1, 0.3);
      at("ruukku", 2.0, 0.55, 0.9, 1.0);
      const [sx, sz] = fromLocal(STOREHOUSE, 1.2, 3.35);
      put("lyhde@near", sx, sz, 1, 0.4, 0.01, 0.12);
      put("lyhde@near", sx + 0.1, sz + 0.55, 0.92, 2.2, 0.01, 0.12);
      const [lx, lz] = fromLocal(STOREHOUSE, 1.75, 3.2);
      put("lyhde@near", lx, lz, 1.05, 4.1, 0.01, 0.12);
      put("kanakoppi@near", COOP.x, COOP.z, 1, COOP.yaw, 0.02);
    }
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
  return { trees: trees.length, tris: Math.round(tris + dynamicTris), sceneItems: sceneItems.size };
}

// Nyrkin otekanavat lepoasennossa (piste ja suunta mallin koordinaateissa). Miehen oikea käsi
// on sama kuin taistelijoiden GRIP_CHANNEL (fighter.ts); naisen vasen on arvio (BLENDER_HANDOFF).
const GRIP_MALE_R = { p: [-0.383, 0.795, 0.112] as [number, number, number], d: [0.31, -0.06, 0.95] as [number, number, number] };
const GRIP_FEMALE_L = { p: [0.385, 0.769, 0.058] as [number, number, number], d: [-0.283, -0.537, 0.795] as [number, number, number] };

/** Rauhallisen pihan väki: emäntä pöydän luona, tietäjä tulella, jousineito portilla, koira ja siipikarja pihalla, possu lätissä. */
function populateYardLife(scene: THREE.Scene, collision: CollisionWorld) {
  const tb = { ...TABLE, hx: 0, front: 0, back: 0 };
  const facing = (x: number, z: number, tx: number, tz: number) => Math.atan2(tx - x, tz - z);
  const solid = (id: string, x: number, z: number, radius: number) => {
    collision.add({ id: `folk:${id}`, kind: "circle", x, z, radius, blocksMovement: true, blocksMelee: false });
    // Pihan ja rannan väelle voi puhua (src/interact.ts); kana_b on toinen kana.
    addTalkable({ id, x, z, name: t(`folk.${id === "kana_b" ? "kana" : id}` as TextKey) });
  };
  const jobs: Promise<void>[] = [];

  // Naiset on mallinnettu miehen pituisiksi; pelissä heidät skaalataan hieman pienemmiksi.
  const [ex, ez] = fromLocal(tb, 1.85, 0.75);
  const [potX, potZ] = fromLocal(tb, 2.5, -0.5);
  jobs.push(spawnVillager(scene, {
    url: villagersFUrl, character: "emanta", x: ex, y: groundHeight(ex, ez), z: ez, yaw: facing(ex, ez, potX + 0.6, potZ + 3), scale: 0.95,
    armL: { upper: [0.1, -1, 0.1], fore: [-0.25, -0.75, 0.6] }, armR: { upper: [0.1, -1, 0.1], fore: [-0.25, -0.75, 0.6] },
  }));
  solid("emanta", ex, ez, 0.35);

  // Tietäjä asuu vain rannalla (MVP:ssä yksi tietäjä). Pihassa, jossa ei ole jousineitoa, tulen
  // vieressä seisoo nuori urho (aseeton, rauhassa).
  if (!siteInstance.archer) {
    const ux = FIRE.x + 2.5, uz = FIRE.z - 1.5;
    jobs.push(spawnVillager(scene, {
      id: "urho", url: charactersUrl, character: "urho", x: ux, y: groundHeight(ux, uz), z: uz, yaw: facing(ux, uz, FIRE.x - 2, FIRE.z + 4),
      armL: { upper: [0.14, -1, 0.04], fore: [0.1, -0.8, 0.45] }, armR: { upper: [0.14, -1, 0.04], fore: [0.1, -0.8, 0.45] },
    }));
    solid("urho", ux, uz, 0.4);
  }

  // Jousineito on vain siinä pihassa, jonka instanssi niin määrää (satunnaisesti valittu talo):
  // loukkaantuneena maassa, kunnes pelaaja on parantanut hänet laululla (V6).
  if (siteInstance.archer) {
    const healed = yardState.archerHealed;
    jobs.push(spawnArcher(scene, healed));
    solid("jousineito", ARCHER_AT.x, ARCHER_AT.z, 0.38);
    if (!healed) {
      const yaw = Math.atan2(-1 - ARCHER_AT.x, 0 - ARCHER_AT.z);
      const body = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
      ARCHER_BODY_IDS.forEach((id, i) => {
        const k = 0.65 * (i + 1);
        collision.add({ id, kind: "circle", x: ARCHER_AT.x + body.x * k, z: ARCHER_AT.z + body.z * k, radius: 0.34, blocksMovement: true, blocksMelee: false });
      });
    }
  }

  const dx = -1.7, dz = -3.9;
  jobs.push(spawnAnimal(scene, { url: dogUrl, x: dx, y: groundHeight(dx, dz), z: dz, yaw: facing(dx, dz, 1, 3), behavior: "dog" }));
  solid("koira", dx, dz, 0.3);

  // Kukko orrella kopin kyljessä, kanat maassa kulkulaudan edessä.
  const [rx, rz] = fromLocal(COOP, 1.15, 0);
  jobs.push(spawnAnimal(scene, { url: fowlUrl, node: "kukko", x: rx, y: groundHeight(rx, rz) + 0.6, z: rz, yaw: COOP.yaw + 0.5 }));
  const [hx, hz] = fromLocal(COOP, -0.55, 1.9);
  jobs.push(spawnAnimal(scene, { url: fowlUrl, node: "kana_b", x: hx, y: groundHeight(hx, hz), z: hz, yaw: COOP.yaw + 2.2 }));
  solid("kana_b", hx, hz, 0.15);
  const [kx, kz] = fromLocal(COOP, 0.75, 2.5);
  jobs.push(spawnAnimal(scene, { url: henUrl, x: kx, y: groundHeight(kx, kz), z: kz, yaw: COOP.yaw - 0.7, behavior: "idle", clip: "olo" }));
  solid("kana", kx, kz, 0.18);

  // Possu kiertää aitauksen avointa puolta; kaukalo jää ympyrän ulkopuolelle.
  const [px, pz] = fromLocal(STY, -0.4, 0.5);
  jobs.push(spawnAnimal(scene, { url: pigUrl, x: px, y: groundHeight(px, pz), z: pz, yaw: 0, behavior: "circle", radius: 0.62, speed: 0.3, ground: groundHeight }));

  return Promise.all(jobs).then(() => undefined);
}

/** Rantakohtauksen väki: tietäjä seisoo keittotulen vieressä sauvaansa nojaten, koira lepäilee
 *  tulen ja mökin välissä. */
function populateLakeLife(scene: THREE.Scene, collision: CollisionWorld) {
  const facing = (x: number, z: number, tx: number, tz: number) => Math.atan2(tx - x, tz - z);
  const solid = (id: string, x: number, z: number, radius: number) => {
    collision.add({ id: `folk:${id}`, kind: "circle", x, z, radius, blocksMovement: true, blocksMelee: false });
    // Pihan ja rannan väelle voi puhua (src/interact.ts); kana_b on toinen kana.
    addTalkable({ id, x, z, name: t(`folk.${id === "kana_b" ? "kana" : id}` as TextKey) });
  };
  const jobs: Promise<void>[] = [];

  if (RUIN) {
    // Tuhon jälkeen: tietäjä makaa kuolleena selällään, sauva putosi viereen; koiraa ei ole.
    const { x, z } = ruinSagePos();
    jobs.push(spawnVillager(scene, {
      url: villagersUrl, character: "tietaja", x, y: groundHeight(x, z), z, yaw: RUIN_SAGE.yaw, lying: true,
      armL: { upper: [1, -0.3, 0.1], fore: [0.9, -0.2, 0.55] }, armR: { upper: [0.4, -0.9, 0.15], fore: [-0.5, -0.5, 0.8] },
      prop: { name: "sauva", hand: "R", kind: "staff", grip: GRIP_MALE_R },
    }));
    for (const k of [0.45, 1.1, 1.65]) {
      collision.add({ id: `folk:tietaja-ruumis${k}`, kind: "circle", x: x + RUIN_BODY.x * k, z: z + RUIN_BODY.z * k, radius: 0.34, blocksMovement: true, blocksMelee: false });
    }
    return Promise.all(jobs).then(() => undefined);
  }

  const sx = FIRE.x + 1.45, sz = FIRE.z + 0.45;
  jobs.push(spawnVillager(scene, {
    url: villagersUrl, character: "tietaja", x: sx, y: groundHeight(sx, sz), z: sz, yaw: facing(sx, sz, FIRE.x, FIRE.z),
    armR: { upper: [0.2, -1, 0.3], fore: [0.05, -0.1, 1] },
    prop: { name: "sauva", hand: "R", kind: "staff", grip: GRIP_MALE_R },
  }));
  solid("tietaja", sx, sz, 0.4);

  const dx = FIRE.x - 1.15, dz = FIRE.z - 1.2;
  jobs.push(spawnAnimal(scene, { url: dogUrl, x: dx, y: groundHeight(dx, dz), z: dz, yaw: facing(dx, dz, FIRE.x, FIRE.z), behavior: "dog" }));
  solid("koira", dx, dz, 0.3);

  return Promise.all(jobs).then(() => undefined);
}

/** Lintujen laulun taso 0..1 kalmistolla: kuppikiven luona linnut ovat täysin hiljaa ja laulu palaa täyteen kauempana (ambience.ts).
 *  Muilla paikoilla ei ole tässä ohjattua lintuääntä (0). */
export function birdSongLevel(x: number, z: number): number {
  if (!CAIRN) return 0;
  return birdLevelAtDistance(Math.hypot(x - CUPSTONE.x, z - CUPSTONE.z));
}

/** Kalmiston väki: Louhi seisoo karsikkomännyn vieressä ja katsoo kuppikiveä kohti, rauhassa ja liikkumatta. */
function populateCairnLife(scene: THREE.Scene, collision: CollisionWorld) {
  if (cairnState.louhiBanished) return Promise.resolve();      // karkotettu: tallennus muistaa
  const { x, z } = LOUHI_AT;
  const yaw = Math.atan2(CUPSTONE.x - x, CUPSTONE.z - z);
  collision.add({ id: "folk:louhi", kind: "circle", x, z, radius: 0.4, blocksMovement: true, blocksMelee: false });
  addTalkable({ id: "louhi", x, z, name: t("folk.louhi") });
  // Naishahmon käsivarret kuten emännällä: kädet edessä rennosti yhdessä.
  return spawnVillager(scene, {
    id: "louhi", url: louhiUrl, character: "louhi", x, y: groundHeight(x, z), z, yaw,
    armL: { upper: [0.1, -1, 0.1], fore: [-0.25, -0.75, 0.6] }, armR: { upper: [0.1, -1, 0.1], fore: [-0.25, -0.75, 0.6] },
  });
}

/** Musta maa kivien välissä: pehmeäreunaiset tummat läiskät, jotka seuraavat maastoa (ei kaksoiskuvaa, vaan yksi tekstuuri joka läikälle). */
function buildDarkSoil(scene: THREE.Scene) {
  for (const p of DARK_SOIL) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 128;
    const g = cv.getContext("2d")!;
    const rr = rand(Math.floor(p.seed * 977) + 13);
    for (let i = 0; i < 22; i++) {
      const a = rr() * Math.PI * 2, d = Math.sqrt(rr()) * 0.5 * 58, rad = 9 + rr() * 16;
      const cx = 64 + Math.cos(a) * d, cy = 64 + Math.sin(a) * d;
      const grd = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
      grd.addColorStop(0, "rgba(70,56,42,0.5)");
      grd.addColorStop(0.5, "rgba(70,56,42,0.34)");
      grd.addColorStop(1, "rgba(70,56,42,0)");
      g.fillStyle = grd;
      g.fillRect(0, 0, 128, 128);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const seg = 14, size = p.r * 2;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = p.x + pos.getX(i), z = p.z + pos.getZ(i);
      pos.setXYZ(i, x, groundHeight(x, z) + 0.035, z);
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      map: tex, transparent: true, depthWrite: false, roughness: 1, metalness: 0,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }));
    mesh.receiveShadow = true;
    mesh.renderOrder = 0;
    scene.add(mesh);
  }
}

/** Kaukainen tumma vesilintu (kuikka) järvellä: uiskentelee hitaasti, kaulaa kallistaen, ja sukeltaa välillä. Vain siluetti,
 *  piirretään ilman sumua (muuten se katoaisi) ja väri on sekoitettu sumuun. */
function buildLoon(scene: THREE.Scene) {
  const col = new THREE.Color(0x232c30).lerp(new THREE.Color(FOG_COLOR), 0.3);
  const mat = new THREE.MeshBasicMaterial({ color: col, fog: false });
  const bird = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 6), mat);
  body.scale.set(1.5, 0.55, 0.65);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.62, 6), mat);
  neck.position.set(0.62, 0.3, 0);
  neck.rotation.z = -0.28;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 5), mat);
  head.position.set(0.7, 0.62, 0);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.26, 4), mat);
  beak.position.set(0.88, 0.62, 0);
  beak.rotation.z = -Math.PI / 2;
  bird.add(body, neck, head, beak);
  bird.scale.setScalar(1.5);
  bird.frustumCulled = false;
  scene.add(bird);
  let t0 = 0;
  const home = { x: -12, z: 112 };
  return (dt: number) => {
    t0 += dt;
    const cycle = t0 % 70;                                  // 70 s kierros: 8 s sukellus
    const dive = cycle > 52 && cycle < 60;
    const k = Math.floor(t0 / 70);
    const bx = home.x + Math.sin(t0 * 0.021 + k * 1.7) * 30, bz = home.z + Math.cos(t0 * 0.017 + k) * 7;
    const vx = Math.cos(t0 * 0.021 + k * 1.7) * 30 * 0.021, vz = -Math.sin(t0 * 0.017 + k) * 7 * 0.017;
    bird.position.set(bx, WATER_LEVEL + 0.05 + Math.sin(t0 * 0.9) * 0.025, bz);
    bird.rotation.y = Math.atan2(-vz, vx);          // nokka (mallin +x) kulkusuuntaan
    bird.visible = !dive;
    neck.rotation.z = -0.28 + Math.sin(t0 * 0.35) * 0.12;
    head.position.y = 0.62 + Math.sin(t0 * 0.35) * 0.03;
  };
}

/** Rannan reunaan ja laiturin sivuille törmäykset: sankari voi kahlata matalassa mutta ei mene syvään veteen. */
function addLakeColliders(collision: CollisionWorld) {
  const cell = 0.9;
  const deep = (x: number, z: number) => terrainHeight(x, z) < WATER_LEVEL - 0.1;
  let id = 0;
  for (let x = -44; x <= 44; x += cell) {
    for (let z = -2; z <= 62; z += cell) {
      if (!deep(x, z)) continue;
      let edge = false;
      for (const ox of [-cell, 0, cell]) for (const oz of [-cell, 0, cell]) if ((ox || oz) && !deep(x + ox, z + oz)) edge = true;
      if (!edge) continue;
      // Laiturin kohta jätetään auki.
      if (LAKESIDE && Math.abs(x - JETTY_AT.x) < JETTY.half + 0.9 && z > JETTY_AT.z - 0.5 && z < JETTY_AT.z + JETTY.len + 1.0) continue;
      collision.add({ id: `shore:${id++}`, kind: "circle", x, z, radius: 0.7, blocksMovement: true, blocksMelee: false });
    }
  }
  if (!LAKESIDE) return id;
  // Laiturin reunat ja pää: kannelta ei pääse sivulle veteen.
  const zc = JETTY_AT.z + (0.3 + JETTY.len) / 2;
  for (const s of [-1, 1]) {
    collision.add({ id: `jetty:rail${s}`, kind: "box", x: JETTY_AT.x + s * 1.4, z: zc, yaw: 0, halfX: 0.5, halfZ: (JETTY.len - 0.3) / 2, blocksMovement: true, blocksMelee: false });
  }
  collision.add({ id: "jetty:end", kind: "box", x: JETTY_AT.x, z: JETTY_AT.z + JETTY.len + 0.5, yaw: 0, halfX: 1.4, halfZ: 0.5, blocksMovement: true, blocksMelee: false });
  return id;
}

export function buildWorld(scene: THREE.Scene, renderer: THREE.WebGLRenderer): World {
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  // Loppukesän ilta-aurinko: lämmin sivuvalo, viileä taivaanvalo, utu metsän syvyydessä.
  const sunPos = new THREE.Vector3(-22, 24, -15);
  scene.background = new THREE.Color(0xc8cfc9);
  scene.fog = new THREE.FogExp2(FOG_COLOR, RUIN ? 0.0125 : CAIRN ? 0.0115 : 0.0105);     // tuhon jälkeen ja kalmistolla utuisempaa
  const sky = buildSky(scene, sunPos.clone().normalize());
  const envScene = new THREE.Scene();
  envScene.add(sky.clone());
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(envScene, 0, 1, 400).texture;
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight(0xc6d2e2, 0x6e6a52, RUIN ? 1.8 : 2.0));
  const sun = new THREE.DirectionalLight(RUIN ? 0xe8d2b4 : 0xffcf9a, RUIN ? 2.7 : 3.6);
  sun.position.copy(sunPos);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera;
  sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 110;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.05;
  scene.add(sun);

  const groundTex = buildGround(scene, maxAniso);
  const water = LAKE ? buildWater(scene, envMap) : null;
  if (LAKE) buildFarShore(scene);
  const loon = CAIRN ? buildLoon(scene) : null;
  if (CAIRN) buildDarkSoil(scene);
  const protos = new Map<string, Proto>();
  const runtimeSceneItems = new Map<string, RuntimeSceneItem>();
  // Kampanja voi asettaa nämä ennen GLB-latauksen valmistumista; populate ei silloin luo juuria lainkaan.
  const takenSceneItemIds = new Set<string>();
  const removeSceneItem = (id: string) => {
    takenSceneItemIds.add(id);
    const item = runtimeSceneItems.get(id);
    if (!item) return false;
    item.root.removeFromParent();
    runtimeSceneItems.delete(id);
    return true;
  };
  const setTakenSceneItemIds = (ids: readonly string[]) => {
    for (const id of ids) removeSceneItem(id);
  };
  const fire = buildFire(scene);
  const collision = new CollisionWorld();
  if (!CAIRN) collision.add({
    id: "campfire", kind: "circle", x: FIRE.x, z: FIRE.z, radius: COLLISION.fireCoreRadius,
    blocksMovement: true, blocksMelee: true,
  });
  if (!RUIN && !CAIRN) collision.addHazard({
    // Rantakohtauksen keittotuli on pieni ja rauhallinen: kivikehän vierestä ei pala.
    id: "campfire", kind: "circle", x: FIRE.x, z: FIRE.z, radius: LAKE ? COLLISION.fireHazardRadius * 0.45 : COLLISION.fireHazardRadius,
    damagePerSecond: COLLISION.fireDamagePerSecond,
  });
  SITE.footprints.forEach((f, i) => addFootprintCollider(collision, `building:${i}`, f));
  if (LAKE) addLakeColliders(collision);

  // Talon savu nousee päädyn savuaukosta (pihapiiri) tai mökin kattoluukusta (ranta).
  let houseSmoke: ((dt: number) => void) | null = null;
  if (LAKESIDE) {
    const [sx, sz] = RUIN ? fromLocal(CABIN, 0.4, 0.3) : fromLocal(CABIN, -0.9, -0.44);
    const g = new THREE.Group();
    g.position.set(sx, groundHeight(sx, sz), sz);
    scene.add(g);
    // Tuhon jälkeen raunio kytee: hidas, tumma savupatsas hiiltyneiden hirsien keskeltä.
    houseSmoke = RUIN ? makeSmoke(g, 20, 11, 0.8, 3.2, 0.2, [0.3, 0.29, 0.28]) : makeSmoke(g, 12, 7, 3.5, 1.8, 0.09);
  } else if (HAS_YARD) {
    const [sx, sz] = fromLocal(HOUSE, 5.0, 0);
    const g = new THREE.Group();
    g.position.set(sx, groundHeight(sx, sz), sz);
    scene.add(g);
    houseSmoke = makeSmoke(g, 16, 8, 4.5, 2.6, 0.1);
  }

  const loader = new GLTFLoader();
  const files = ARENA === "yard" ? [forestUrl, homesteadUrl, householdUrl, yardUrl]
    : CAIRN ? [forestUrl, cairnfieldUrl]
    : LAKESIDE ? [forestUrl, homesteadUrl, householdUrl, lakesideUrl, ...(RUIN ? [lakeruinUrl] : [])]
      : HAS_YARD ? [forestUrl, homesteadUrl] : [forestUrl];
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
    const stats = populate(scene, protos, collision, runtimeSceneItems, takenSceneItemIds);
    // Liitetään tilastot samaan `__world`-olioon, jossa on maailmamoottorin konsoli (engine/worldConsole.ts).
    const host = window as unknown as { __world?: object };
    Object.assign(host.__world ??= {}, { ...stats, collision: collision.stats() });
    if (ARENA === "yard") return populateYardLife(scene, collision);
    if (CAIRN) return populateCairnLife(scene, collision);
    if (LAKESIDE) return populateLakeLife(scene, collision);
  });
  ready.catch((e) => console.error("Maailman mallien lataus epäonnistui", e));

  return {
    campfireLight: fire.light,
    envMap,
    ready,
    groundTex,
    proto: (name) => protos.get(name) ?? [],
    collision,
    sceneItems: () => [...runtimeSceneItems.values()],
    sceneItem: (id) => runtimeSceneItems.get(id),
    setTakenSceneItemIds,
    removeSceneItem,
    removeNpc: (npcId) => removeNpcFromScene(npcId, collision),
    setNpcState: (npcId, state) => setNpcStateInScene(scene, collision, npcId, state),
    clearCamera(pos) {
      const r = Math.hypot(pos.x, pos.z);
      if (r > SITE.camMaxR) { pos.x *= SITE.camMaxR / r; pos.z *= SITE.camMaxR / r; }
    },
    update(_t, dt, camera, focus) {
      // Järven kaukainen vastaranta on yli 300 m päässä: kameran kantama pidennetään.
      const persp = camera as THREE.PerspectiveCamera;
      if (LAKE && persp.far < 700) { persp.far = 700; persp.updateProjectionMatrix(); }
      fire.update(dt, camera);
      houseSmoke?.(dt);
      water?.update(dt);
      loon?.(dt);
      updateFolk(dt, focus ?? null);
    },
  };
}
