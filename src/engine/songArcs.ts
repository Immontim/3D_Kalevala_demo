// ---------- Säekaaret ----------
// Laulun säkeet singahtavat laulunauhalta sankarin ylle ja asettuvat sisäkkäisiksi kaariksi
// (säepari = yksi kaari). Osuttu säe hohtaa kultaisena, ohi mennyt jää tuhkanharmaaksi.
// Laulun päätyttyä kaaret hiipuvat laulukohtaisessa ajassa (SONG.fade). Pelkkää näyttöä:
// kaaret eivät vaikuta laulun tulokseen. Geometria on puhtaana logiikkana songLogic.ts:ssä.
import * as THREE from "three";
import { VerbatimText } from "../i18n";
import { ArcLayout, SONG, SongId, arcExtent, arcLayout, arcMid, arcPath, fadeOpacity, ringRadii, versePlace } from "../songLogic";
import { $ } from "./dom";
import { g } from "./state";
import { camera } from "./view";

const SVG_NS = "http://www.w3.org/2000/svg";
const FONT_FAMILY = `Georgia, "Palatino Linotype", serif`;

interface ArcsState {
  id: SongId;
  verses: readonly VerbatimText[];
  font: number;
  layout: ArcLayout;
  /** Kaarten tarvitsema tila keskipisteestä: sivuille ja ylös (fontti mukana). */
  halfWidth: number;
  up: number;
  root: SVGGElement;
  items: SVGGElement[];
  /** Kaarten keskipiste ruudulla (pehmennetty, seuraa sankarin päätä). */
  cx: number;
  cy: number;
  placed: boolean;
  lastTime: number;
  /** Hiipumisen alku (reaaliaikaa) ja kesto; -1 = laulu on yhä käynnissä. */
  fadeStart: number;
  fade: number;
}

let arcs: ArcsState | null = null;
let measureCtx: CanvasRenderingContext2D | null = null;

/** Sama koko kuin nauhan säerivillä: clamp(18px, 3vw, 30px). */
function fontSize(): number {
  return Math.max(18, Math.min(30, window.innerWidth * 0.03));
}
/** Kaarten ja ruudun sivureunan väli. */
const MARGIN = 8;
/** Kaarten yläpuolelle jätettävä tila: yläkulmien elämä- ja kestävyysmittarit jäävät näkyviin. */
const topMargin = () => Math.max(MARGIN, window.innerHeight * 0.1);

function textWidth(text: string, font: number): number {
  measureCtx ??= document.createElement("canvas").getContext("2d");
  if (!measureCtx) return text.length * font * 0.5;
  measureCtx.font = `italic ${font}px ${FONT_FAMILY}`;
  return measureCtx.measureText(text).width;
}

const headP = new THREE.Vector3();
/** Sankarin pään kohta ruudulla. */
function headOnScreen(): [number, number] {
  headP.copy(g.player.pos).setY(g.player.pos.y + 1.85).project(camera);
  return [(headP.x * 0.5 + 0.5) * window.innerWidth, (-headP.y * 0.5 + 0.5) * window.innerHeight];
}

/** Kaarten keskipiste: sankarin pää, mutta niin, että uloin kaari mahtuu ruudulle. */
function anchor(a: ArcsState): [number, number] {
  const w = window.innerWidth, h = window.innerHeight;
  const [hx, hy] = headOnScreen();
  const side = a.halfWidth + MARGIN;
  const cx = side * 2 < w ? Math.max(side, Math.min(w - side, Number.isFinite(hx) ? hx : w / 2)) : w / 2;
  const cy = Math.max(a.up + topMargin(), Math.min(h * 0.78, Number.isFinite(hy) ? hy : h * 0.5));
  return [cx, cy];
}

/** Aloittaa uuden laulun kaaret. Edellisen laulun hiipuvat kaaret poistuvat heti. */
export function beginSongArcs(id: SongId, verses: readonly VerbatimText[]) {
  clearSongArcs();
  const svg = $("songArcs") as unknown as SVGSVGElement;
  const rings = Math.ceil(verses.length / 2);
  // Fontti on nauhan säerivin kokoinen; pienennetään vain, jos kaaret eivät muuten mahdu ikkunaan.
  const fits = (font: number) => {
    const layout = arcLayout(Math.max(...verses.map((v) => textWidth(v.text, font))), font, rings);
    const e = arcExtent(layout);
    const halfWidth = e.halfWidth + font, up = e.up + font * 1.1;
    return { font, layout, halfWidth, up, ok: (halfWidth + MARGIN) * 2 <= window.innerWidth && up + topMargin() <= window.innerHeight * 0.78 };
  };
  let fit = fits(fontSize());
  while (!fit.ok && fit.font > 14) fit = fits(fit.font - 1);
  const { font, layout, halfWidth, up } = fit;
  const root = document.createElementNS(SVG_NS, "g");
  const defs = document.createElementNS(SVG_NS, "defs");
  root.appendChild(defs);
  const items = verses.map((v, i) => {
    const { ring, side } = versePlace(i);
    const [rx, ry] = ringRadii(layout, ring);
    const path = document.createElementNS(SVG_NS, "path");
    path.id = `songArc${i}`;
    path.setAttribute("d", arcPath(0, 0, rx, ry, side));
    defs.appendChild(path);
    const item = document.createElementNS(SVG_NS, "g");
    item.setAttribute("class", "verseArc");
    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("font-size", String(font));
    text.setAttribute("lang", v.lang);
    const tp = document.createElementNS(SVG_NS, "textPath");
    tp.setAttribute("href", `#songArc${i}`);
    tp.setAttribute("startOffset", "50%");
    tp.setAttribute("text-anchor", "middle");
    tp.textContent = v.text;
    text.appendChild(tp);
    item.appendChild(text);
    root.appendChild(item);
    return item;
  });
  svg.appendChild(root);
  svg.style.opacity = "1";
  svg.classList.remove("hidden");
  arcs = { id, verses, font, layout, halfWidth, up, root, items, cx: 0, cy: 0, placed: false, lastTime: g.realTime, fadeStart: -1, fade: 0 };
  place(arcs, 0);
}

/** Säe i on arvioitu: se lentää nauhalta kaarelleen kultaisena (osuma) tai harmaana (ohi). */
export function revealVerse(i: number, hit: boolean) {
  const a = arcs;
  const item = a?.items[i];
  if (!a || !item) return;
  const { ring, side } = versePlace(i);
  const [mx, my] = arcMid(0, 0, ...ringRadii(a.layout, ring), side);
  // Lähtöpiste: laulunauhan keskikohta ruudulla, kaarten omassa koordinaatistossa.
  const track = $("track").getBoundingClientRect();
  const fromX = track.width > 0 ? track.left + track.width / 2 : window.innerWidth / 2;
  const fromY = track.height > 0 ? track.top : window.innerHeight * 0.8;
  item.style.setProperty("--dx", `${(fromX - a.cx - mx).toFixed(1)}px`);
  item.style.setProperty("--dy", `${(fromY - a.cy - my).toFixed(1)}px`);
  item.setAttribute("class", `verseArc ${hit ? "hit" : "miss"}`);
}

/** Laulu päättyi tai katkesi: kaaret jäävät näkyviin ja hiipuvat laulun omassa ajassa. */
export function fadeSongArcs() {
  if (!arcs || arcs.fadeStart >= 0) return;
  arcs.fadeStart = g.realTime;
  arcs.fade = SONG.fade[arcs.id];
}

/**
 * Poistaa kaaret heti (uusi yritys, kohtauksen vaihto). Hiipumisen päättyessä laulun tulosviesti
 * saattaa yhä näkyä, joten sen paikka palautuu vasta seuraavassa viestissä (hud.showMsg).
 */
export function clearSongArcs(keepMsgPlace = false) {
  arcs = null;
  const svg = $("songArcs");
  svg.replaceChildren();
  svg.classList.add("hidden");
  if (!keepMsgPlace) document.documentElement.style.removeProperty("--msg-top");
}


function place(a: ArcsState, k: number) {
  const [tx, ty] = anchor(a);
  if (!a.placed) { a.cx = tx; a.cy = ty; a.placed = true; }
  else { a.cx += (tx - a.cx) * k; a.cy += (ty - a.cy) * k; }
  a.root.setAttribute("transform", `translate(${a.cx.toFixed(1)} ${a.cy.toFixed(1)})`);
  // Laulun tulosviesti asettuu kaarten sisään sankarin pään ylle, ei säkeiden päälle.
  document.documentElement.style.setProperty("--msg-top", `${Math.round(a.cy - a.layout.inner * 0.55)}px`);
}

/** Joka ruutu: kaaret seuraavat sankarin päätä pehmeästi, ja hiipuminen etenee reaaliajassa. */
export function updateSongArcs() {
  const a = arcs;
  if (!a) return;
  const dt = Math.max(0, g.realTime - a.lastTime);
  a.lastTime = g.realTime;
  place(a, 1 - Math.exp(-8 * dt));
  if (a.fadeStart < 0) return;
  const opacity = fadeOpacity(g.realTime - a.fadeStart, a.fade);
  if (opacity <= 0) { clearSongArcs(true); return; }
  ($("songArcs") as unknown as SVGSVGElement).style.opacity = opacity.toFixed(3);
}

/** Savutestiä varten: näkyvien kaarten tila. */
export function songArcsDebug() {
  const a = arcs;
  if (!a) return null;
  return {
    id: a.id, font: a.font, inner: Math.round(a.layout.inner), halfWidth: Math.round(a.halfWidth), up: Math.round(a.up), cx: Math.round(a.cx), cy: Math.round(a.cy),
    fading: a.fadeStart >= 0, opacity: Number(($("songArcs") as unknown as SVGSVGElement).style.opacity || 1),
    verses: a.items.map((el) => el.getAttribute("class")),
  };
}
