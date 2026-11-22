"""Villisika (Sus scrofa, aikuinen karju) proseduraalisena low poly -mallina.

Valmista CC0-mallia ei ole, joten skripti rakentaa koko eläimen itse: rungon ja pään
yhtenä loftina soikeista poikkileikkausrenkaista, erilliset kapenevat jalat
sorkkineen, korvat, syöksyhampaat, pienet yläleuan torahampaat, silmät,
piikkimäisen harjan selässä, poskiparrat, vatsan karvatupsut ja hännän tupsuineen.
Kaikki yhdistetään yhdeksi verkoksi, jolla on yksi materiaali (Principled,
pohjaväri verteksiväristä Col -> glTF COLOR_0, roughness 0,9). Tekstuureja ei ole.

Aja taustalla:

    blender --background --factory-startup --python assets-src/blender/boar.py

Tulokset:
- assets/animals/villisika.glb: juurisolmu `villisika` (armature), lapsena skinnattu
  verkko `villisika_mesh`. Ei kameraa, valoa eikä maata.
- assets-src/boar.blend: lähdetiedosto (armature, verkko ja kuusi Actionia)
- KALEVALA_PREVIEW-kansioon tarkistuskuvat ja report.json. Tarkistus lukee juuri
  viedyn GLB:n uudelleen tyhjään tiedostoon, mittaa sen ja renderöi kuvat siitä.

Akselit ja mitat (metrejä): Blenderissä Z ylös ja kärsä suuntaan -Y. glTF-vienti
(Y ylös) kääntää kärsän pelissä suuntaan +Z, kuten jäniksen paikkamallissa. Origo
on maassa neljän jalan keskellä; sorkkien pohjat ovat tasan z = 0 lepoasennossa ja
idlen ruudussa 0. Kärsä-peppu noin 1,52 m (ilman häntää), säkä noin 0,865 m
(ilman harjaa), harja nousee noin 0,12 m sen yli, leveys hartioista 0,43 m.
Syöksyhampaiden näkyvä osa noin 8 cm, tyvi suupielessä noin 13 cm kiekon takana.
Etusorkat y = -0,35, takasorkat y = +0,35. Mittasuhteet säädetään alla olevista
vakioista (RINGS, BODY_DZ, FRONT/HIND-nivelet, *_TUBE, TUSK_SCALE, EAR_*,
MANE_PROFILE). Kolmioita noin 3 430.

Luut (28, kaikki deform): root (origossa), hips, spine1, chest, neck, head,
ear_L/R, tail1, tail2, etujalat scapula/upperarm/forearm/frontfoot/fronttoe _L/_R,
takajalat thigh/shin/hindfoot/hindtoe _L/_R. Painot lasketaan skriptissä (osat
jäykästi luulleen, nivelissä pehmeä liuku; korkeintaan 4 vaikuttajaa, normalisoitu).

Leikkeet (30 fps, paikallaan, ei juurisiirtymää eteen; jokaisen luun jokainen
kanava avaimitettu joka ruutuun; silmukoissa ensimmäinen ja viimeinen ruutu samat):
- idle   2,0 s silmukka: hengitys, pään liike, korvan heilautus, hännän huiskaus.
- walk   1,0 s silmukka: lateraalikäynti LH, LF, RH, RF. Sorkat pysyvät maassa,
         kun hahmo liikkuu nopeudella WALK_SPEED = 1,2 m/s.
- run    0,5 s silmukka: rynnistys/laukka, pää alhaalla, runko keinuu.
         Maanopeus RUN_SPEED = 6,5 m/s.
- attack 0,8 s: pää painuu alas ja iskee syöksyhampailla jyrkästi ylös ja sivulle.
         Osumaikkuna 0,30-0,45 s (huippu noin 0,38 s).
- hit    0,4 s: säpsähdys (pää nykäisee, runko vetäytyy), palaa idlen asentoon.
- death  1,5 s: jalat pettävät, sika kaatuu vasemmalle kyljelleen; viimeinen ruutu
         on lepäävä loppuasento (pidä viimeinen ruutu, clampWhenFinished).

Ympäristömuuttujat: KALEVALA_ASSETS_OUT (vientikansio, oletus <repo>/assets; tiedosto
menee sen alikansioon animals/), KALEVALA_PREVIEW (kansio tarkistuskuville; jos
puuttuu, kuvia ei tehdä), KALEVALA_BLEND (lähdetiedoston polku).
"""
import bpy, bmesh, math, os, json, struct, random
import numpy as np
from mathutils import Vector, Matrix, Quaternion, Euler, noise

_HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else os.path.join(os.getcwd(), "assets-src", "blender")
ROOT = os.path.dirname(os.path.dirname(_HERE))
OUT = os.path.join(os.environ.get("KALEVALA_ASSETS_OUT", os.path.join(ROOT, "assets")), "animals")
BLEND = os.environ.get("KALEVALA_BLEND", os.path.join(ROOT, "assets-src", "boar.blend"))
PREVIEW = os.environ.get("KALEVALA_PREVIEW")
NAME = "villisika"
FPS = 30

# --- Värit (sRGB, muunnetaan lineaariseksi) ----------------------------------
COLORS = dict(body="#3b3029", cheek="#6b5a4b", dark="#1e1915", hoof="#2b241f",
              disc="#4d3d37", tusk="#dccfb4", eye="#0b0908", tip="#55473b")

# --- Rungon ja pään profiili --------------------------------------------------
# Renkaat takaa (+Y, peppu) eteen (-Y, kärsän kiekko). Sarakkeet:
# y, yläreuna z, alareuna z, puolileveys, muotoeksponentti (2 ellipsi, >2 kulmikas,
# <2 suippo), selkäharjanne (m), leveimmän kohdan korkeus (0 = alareuna, 1 = yläreuna)
RINGS = [
    ( 0.545, 0.640, 0.570, 0.036, 2.0, 0.000, 0.50),   # peppu, hännän tyvi
    ( 0.525, 0.688, 0.500, 0.097, 2.2, 0.000, 0.55),
    ( 0.470, 0.722, 0.452, 0.133, 2.3, 0.000, 0.58),
    ( 0.380, 0.748, 0.418, 0.153, 2.4, 0.000, 0.58),   # lantio (matalampi ja kapeampi kuin hartiat)
    ( 0.240, 0.770, 0.390, 0.165, 2.4, 0.000, 0.56),
    ( 0.100, 0.800, 0.370, 0.188, 2.4, 0.004, 0.55),   # selän keskikohta
    (-0.050, 0.840, 0.355, 0.200, 2.4, 0.010, 0.55),
    (-0.200, 0.884, 0.345, 0.212, 2.4, 0.018, 0.55),
    (-0.300, 0.898, 0.348, 0.215, 2.4, 0.022, 0.55),   # säkä
    (-0.400, 0.893, 0.362, 0.206, 2.4, 0.022, 0.50),
    (-0.480, 0.876, 0.380, 0.190, 2.3, 0.018, 0.44),   # niska (kaulaa tuskin on)
    (-0.555, 0.850, 0.383, 0.178, 2.1, 0.010, 0.36),   # takaraivo, korvat, syvät leukaperät
    (-0.630, 0.808, 0.390, 0.166, 2.0, 0.000, 0.32),   # posket
    (-0.705, 0.752, 0.398, 0.140, 1.9, 0.000, 0.34),   # silmät
    (-0.780, 0.690, 0.405, 0.110, 1.9, 0.000, 0.40),
    (-0.850, 0.628, 0.408, 0.086, 2.0, 0.000, 0.44),
    (-0.905, 0.572, 0.408, 0.069, 2.1, 0.000, 0.46),
    (-0.935, 0.546, 0.409, 0.064, 2.2, 0.000, 0.48),   # kärsän kiekon reuna
    (-0.950, 0.541, 0.410, 0.063, 2.2, 0.000, 0.48),
]
BODY_DZ = -0.055      # koko rungon korkeussiirto (jalat lyhenevät/pitenevät samalla)
RINGS = [(r[0], r[1] + BODY_DZ, r[2] + BODY_DZ) + r[3:] for r in RINGS]
RING_SUB = 2          # renkaita per taulukon väli
SEGS = 20             # rungon kehän jako (parillinen)
LSEG = 8              # jalan kehän jako

# --- Jalat (y, z); x vakio per jalka ----------------------------------------
FRONT_X, HIND_X = 0.115, 0.095
FRONT = [(-0.27, 0.80), (-0.40, 0.57), (-0.29, 0.37), (-0.325, 0.165), (-0.335, 0.062), (-0.35, 0.0)]
#        lapaluun yläpää  olkanivel     kyynärpää     ranne           vuohisnivel     sorkan keskipiste maassa
HIND = [(0.31, 0.65), (0.21, 0.43), (0.37, 0.21), (0.355, 0.062), (0.35, 0.0)]
#        lonkka        polvi         kinner        vuohisnivel     sorkka maassa
# Putken renkaat: (väli, t välin sisällä, puolileveys x, puolisyvyys y)
FRONT_TUBE = [(1, -0.30, 0.050, 0.075), (1, 0.0, 0.068, 0.098), (1, 0.5, 0.070, 0.092),
              (2, 0.0, 0.066, 0.090), (2, 0.3, 0.056, 0.071), (2, 0.7, 0.044, 0.053),
              (3, 0.0, 0.031, 0.036), (3, 0.5, 0.025, 0.028), (4, 0.0, 0.027, 0.031),
              (4, 0.55, 0.021, 0.026)]
HIND_TUBE = [(0, 0.20, 0.045, 0.085), (0, 0.55, 0.060, 0.105),
             (1, 0.0, 0.074, 0.103), (1, 0.4, 0.060, 0.077), (2, 0.0, 0.036, 0.045),
             (2, 0.5, 0.025, 0.029), (3, 0.0, 0.027, 0.031), (3, 0.55, 0.021, 0.026)]
FRONT = [(y, z + BODY_DZ * min(1.0, max(0.0, (z - 0.1) / 0.3))) for y, z in FRONT]
HIND = [(y, z + BODY_DZ * min(1.0, max(0.0, (z - 0.1) / 0.3))) for y, z in HIND]
TIP = 0.042           # sorkan kärki on näin paljon E-pisteen edessä

# --- Pienet osat -------------------------------------------------------------
TUSK_SCALE = 1.0      # alasyöksyhampaan pituuskerroin (näkyvä osa ≈ 8 cm)
TUSK_Y = -0.82        # syöksyhampaan tyvi, noin 13 cm kärsän kiekon takana
MOUTH_A = 2.05        # suupielen kulma poikkileikkauksessa (0 = selkä, pi = vatsa)
TUSK_R = 0.012        # syöksyhampaan säde tyvessä
EAR_LEN = 0.15
EAR_DIR = (0.42, 0.06, 1.0)  # korvan suunta vasemmalla puolella (x peilataan)
MANE_PROFILE = [(-0.585, 0.055), (-0.50, 0.085), (-0.40, 0.105), (-0.30, 0.110),
                (-0.18, 0.095), (-0.05, 0.070), (0.05, 0.045), (0.14, 0.020)]
MANE_COUNT = 40
MANE_LEAN = 0.55      # piikin kallistus taaksepäin (osuus korkeudesta)
TAIL = [(0.0, 0.525, 0.680), (0.0, 0.552, 0.655), (0.0, 0.585, 0.565), (0.0, 0.598, 0.475), (0.0, 0.596, 0.425)]
TAIL = [(x, y, z + BODY_DZ) for x, y, z in TAIL]
TAIL_R = [0.022, 0.019, 0.014, 0.011, 0.009]

# --- Animaation parametrit ---------------------------------------------------
WALK = dict(T=1.0, duty=0.55, sweep=0.66, lift_f=0.075, lift_h=0.065, flex3_f=0.9, flex4_f=0.7,
            flex3_h=0.35, flex4_h=0.8, roll=0.45, k3=0.9, ks=0.7, drop=0.025,
            offs=dict(HL=0.0, FL=0.25, HR=0.5, FR=0.75))
RUN = dict(T=0.5, duty=0.2, sweep=0.65, lift_f=0.15, lift_h=0.12, flex3_f=1.4, flex4_f=1.0,
           flex3_h=0.6, flex4_h=1.0, roll=0.7, k3=1.1, ks=0.7, drop=0.05,
           offs=dict(HL=0.0, HR=0.1, FL=0.42, FR=0.52))
WALK_SPEED = WALK["sweep"] / (WALK["duty"] * WALK["T"])
RUN_SPEED = RUN["sweep"] / (RUN["duty"] * RUN["T"])
ROLL_FRAC = 0.3       # tukivaiheen loppuosuus, jolla kanta nousee
HIT_WINDOW = (0.30, 0.45)


# =============================================================================
# Apufunktiot
# =============================================================================
def lin(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


C = {k: lin(v) for k, v in COLORS.items()}


def mix(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def ss(a, b, x):
    t = 0.0 if b == a else min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def pulse(t, a, b):
    if t <= a or t >= b:
        return 0.0
    return math.sin(math.pi * (t - a) / (b - a)) ** 2


def S(k, t, ph=0.0):
    return math.sin(2 * math.pi * k * t + ph)


def cr(p0, p1, p2, p3, t):
    t2, t3 = t * t, t * t * t
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)


def ring_at_u(u):
    n = len(RINGS)
    i = min(max(int(math.floor(u)), 0), n - 2)
    t = u - i
    rows = [RINGS[max(0, min(n - 1, k))] for k in (i - 1, i, i + 1, i + 2)]
    return tuple(cr(rows[0][j], rows[1][j], rows[2][j], rows[3][j], t) for j in range(7))


def ring_at_y(y):
    lo, hi = 0.0, len(RINGS) - 1.0
    for _ in range(40):
        mid = (lo + hi) / 2
        if ring_at_u(mid)[0] > y:
            lo = mid
        else:
            hi = mid
    return ring_at_u((lo + hi) / 2)


def sect(r, a):
    y, top, bot, hw, n, ridge, wz = r
    zw = bot + (top - bot) * wz
    s, c = math.sin(a), math.cos(a)
    e = 2.0 / n
    x = hw * math.copysign(abs(s) ** e, s)
    h = (top - zw) if c > 0 else (zw - bot)
    z = zw + h * math.copysign(abs(c) ** e, c)
    if c > 0:
        z += ridge * c ** 10
    return Vector((x, y, z))


def surf(y, a):
    return sect(ring_at_y(y), a)


def surf_normal(y, a):
    p = surf(y, a)
    da = surf(y, a + 0.01) - surf(y, a - 0.01)
    dy = surf(y + 0.005, a) - surf(y - 0.005, a)
    n = da.cross(dy).normalized()
    r = ring_at_y(y)
    ctr = Vector((0, y, (r[1] + r[2]) / 2))
    if n.dot(p - ctr) < 0:
        n = -n
    return p, n


def top_z(y):
    return surf(y, 0.0).z


def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (p - (a + ab * t)).length


# =============================================================================
# Painot
# =============================================================================
# Nivelrajat: (y0, z0, kallistus dy/dz, puolileveys, takaluu, etuluu)
JOINT_PLANES = [(0.10, 0.74 + BODY_DZ, 0.0, 0.10), (-0.12, 0.78 + BODY_DZ, 0.0, 0.10),
                (-0.36, 0.76 + BODY_DZ, 0.45, 0.07), (-0.56, 0.72 + BODY_DZ, 0.25, 0.05)]
SPINE = ["hips", "spine1", "chest", "neck", "head"]


def spine_weights(p):
    fs = []
    for (y0, z0, k, h) in JOINT_PLANES:
        yb = y0 + k * (p.z - z0)
        fs.append(ss(-h, h, yb - p.y))
    w = {"hips": 1 - fs[0], "spine1": fs[0] * (1 - fs[1]), "chest": fs[1] * (1 - fs[2]),
         "neck": fs[2] * (1 - fs[3]), "head": fs[3]}
    return w


def p3(x, yz):
    return Vector((x, yz[0], yz[1]))


def body_weights(p):
    w = spine_weights(p)
    legw = {}
    for s, sx in (("L", 1), ("R", -1)):
        if p.x * sx < 0.03:
            continue
        segs = [("scapula_" + s, p3(sx * FRONT_X, FRONT[0]), p3(sx * FRONT_X, FRONT[1]), 0.12, 0.30),
                ("upperarm_" + s, p3(sx * FRONT_X, FRONT[1]), p3(sx * FRONT_X, FRONT[2]), 0.12, 0.40),
                ("thigh_" + s, p3(sx * HIND_X, HIND[0]), p3(sx * HIND_X, HIND[1]), 0.14, 0.45)]
        for b, a, c, R, wmax in segs:
            d = seg_dist(p, a, c)
            if d < R:
                legw[b] = max(legw.get(b, 0.0), wmax * (1 - d / R) ** 2)
    tot = sum(legw.values())
    if tot > 0.5:
        legw = {k: v * 0.5 / tot for k, v in legw.items()}
        tot = 0.5
    w = {k: v * (1 - tot) for k, v in w.items()}
    w.update(legw)
    return w


def norm_weights(w):
    items = sorted(((v, k) for k, v in w.items() if v > 1e-4), reverse=True)[:4]
    s = sum(v for v, _ in items)
    return {k: v / s for v, k in items}


# =============================================================================
# Verkon rakentaja
# =============================================================================
class MB:
    def __init__(self):
        self.v, self.w, self.f, self.fz, self.fs = [], [], [], [], []

    def vert(self, co, w):
        self.v.append(Vector(co))
        self.w.append(norm_weights(w))
        return len(self.v) - 1

    def face(self, idx, zone, smooth=True):
        self.f.append(tuple(idx))
        self.fz.append(zone)
        self.fs.append(smooth)


def frames(pts):
    T = []
    for i in range(len(pts)):
        a, b = pts[max(i - 1, 0)], pts[min(i + 1, len(pts) - 1)]
        T.append((b - a).normalized())
    ref = Vector((0, 0, 1)) if abs(T[0].z) < 0.9 else Vector((1, 0, 0))
    N, n = [], (ref - T[0] * ref.dot(T[0])).normalized()
    for t in T:
        n = (n - t * n.dot(t)).normalized()
        N.append(n)
    return T, N, [t.cross(n) for t, n in zip(T, N)]


def tube(mb, pts, radii, wts, zone, segs=6, tip=True, smooth=True):
    """Putki pisteiden läpi, alku suljettu, loppu kärkeen (tip) tai kanteen."""
    T, N, B = frames(pts)
    rings = []
    last = len(pts) - 1
    for i, p in enumerate(pts):
        if tip and i == last:
            rings.append([mb.vert(p, wts[i])])
            continue
        r = radii[i]
        rings.append([mb.vert(p + N[i] * (r * math.cos(2 * math.pi * k / segs)) +
                              B[i] * (r * math.sin(2 * math.pi * k / segs)), wts[i]) for k in range(segs)])
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        for k in range(segs):
            k1 = (k + 1) % segs
            if len(b) == 1:
                mb.face((a[k], a[k1], b[0]), zone, smooth)
            else:
                mb.face((a[k], a[k1], b[k1], b[k]), zone, smooth)
    c0 = mb.vert(pts[0] - T[0] * 0.003, wts[0])
    for k in range(segs):
        mb.face((rings[0][(k + 1) % segs], rings[0][k], c0), zone, smooth)
    if not tip:
        c1 = mb.vert(pts[-1] + T[-1] * 0.003, wts[-1])
        for k in range(segs):
            mb.face((rings[-1][k], rings[-1][(k + 1) % segs], c1), zone, smooth)


def spike(mb, base, apex, along, hl, hw, w, zone):
    """Ohut nelitahoinen piikki: kanta upotettuna pintaan, kärki apex."""
    ax = (apex - base).normalized()
    a1 = (along - ax * along.dot(ax)).normalized()
    a2 = ax.cross(a1).normalized()
    q = [mb.vert(base + a1 * sx * hl + a2 * sy * hw, w) for sx, sy in ((1, 1), (1, -1), (-1, -1), (-1, 1))]
    t = mb.vert(apex, w)
    for i in range(4):
        mb.face((q[i], q[(i + 1) % 4], t), zone, False)
    mb.face((q[3], q[2], q[1], q[0]), zone, False)


def sphere(mb, c, r, w, zone, segs=8, rings=5):
    top = mb.vert(c + Vector((0, 0, r)), w)
    rows = []
    for j in range(1, rings):
        el = math.pi / 2 - math.pi * j / rings
        rows.append([mb.vert(c + Vector((r * math.cos(el) * math.cos(2 * math.pi * k / segs),
                                         r * math.cos(el) * math.sin(2 * math.pi * k / segs),
                                         r * math.sin(el))), w) for k in range(segs)])
    bot = mb.vert(c - Vector((0, 0, r)), w)
    for k in range(segs):
        k1 = (k + 1) % segs
        mb.face((top, rows[0][k], rows[0][k1]), zone)
        mb.face((bot, rows[-1][k1], rows[-1][k]), zone)
    for j in range(len(rows) - 1):
        for k in range(segs):
            k1 = (k + 1) % segs
            mb.face((rows[j][k], rows[j + 1][k], rows[j + 1][k1], rows[j][k1]), zone)


def box(mb, pts8, w, zone):
    idx = [mb.vert(p, w) for p in pts8]
    b0, b1, b2, b3, t0, t1, t2, t3 = idx
    for f in ((b0, b3, b2, b1), (t0, t1, t2, t3), (b0, b1, t1, t0), (b1, b2, t2, t1), (b2, b3, t3, t2), (b3, b0, t0, t3)):
        mb.face(f, zone, False)


# --- Osat --------------------------------------------------------------------
def build_body(mb):
    n = len(RINGS)
    us = [k / RING_SUB for k in range((n - 1) * RING_SUB + 1)]
    rings = []
    for u in us:
        r = ring_at_u(u)
        rings.append([mb.vert(p, body_weights(p)) for p in (sect(r, 2 * math.pi * k / SEGS) for k in range(SEGS))])
    for j in range(len(rings) - 1):
        a, b = rings[j], rings[j + 1]
        for k in range(SEGS):
            k1 = (k + 1) % SEGS
            mb.face((a[k], a[k1], b[k1], b[k]), "body")
    # peppu
    r0 = ring_at_u(0)
    cp = Vector((0, r0[0] + 0.012, (r0[1] + r0[2]) / 2))
    c0 = mb.vert(cp, body_weights(cp))
    for k in range(SEGS):
        mb.face((rings[0][(k + 1) % SEGS], rings[0][k], c0), "body")
    # kärsän kiekko: litteä sisärengas ja keskipiste
    rl = ring_at_u(n - 1)
    ctr = Vector((0, rl[0] - 0.006, rl[2] + (rl[1] - rl[2]) * rl[6]))
    hw = {"head": 1.0}
    inner = []
    for k in range(SEGS):
        p = mb.v[rings[-1][k]]
        q = ctr + (p - ctr) * 0.6
        q.y = rl[0] - 0.005
        inner.append(mb.vert(q, hw))
    cc = mb.vert(ctr - Vector((0, 0.002, 0)), hw)
    for k in range(SEGS):
        k1 = (k + 1) % SEGS
        mb.face((rings[-1][k], inner[k], inner[k1], rings[-1][k1]), "disc", False)
        mb.face((inner[k], cc, inner[k1]), "nostril" if k in (6, 7, 13, 14) else "disc", False)


def build_leg(mb, kind, side):
    sx = 1 if side == "L" else -1
    if kind == "front":
        pts, tube_def, x = FRONT, FRONT_TUBE, sx * FRONT_X
        bones = [b + "_" + side for b in ("scapula", "upperarm", "forearm", "frontfoot", "fronttoe")]
    else:
        pts, tube_def, x = HIND, HIND_TUBE, sx * HIND_X
        bones = [b + "_" + side for b in ("thigh", "shin", "hindfoot", "hindtoe")]
    P = [Vector(p) for p in pts]
    rings, ctrs, tans, ws = [], [], [], []
    for (i, t, rx, ry) in tube_def:
        a, b = P[i], P[i + 1]
        c = a + (b - a) * t
        td = (b - a).normalized()
        if t == 0 and i > 0:
            td = ((a - P[i - 1]).normalized() + td).normalized()
        nrm = Vector((-td.y, td.x))
        if (t <= 0) and i > 0:
            w = {bones[i - 1]: 0.5, bones[i]: 0.5}
        else:
            w = {bones[i]: 1.0}
        ring = []
        for k in range(LSEG):
            an = 2 * math.pi * k / LSEG
            off = nrm * (ry * math.sin(an))
            ring.append(mb.vert((x + rx * math.cos(an), c.x + off.x, c.y + off.y), w))
        rings.append(ring)
        ctrs.append(Vector((x, c.x, c.y)))
        tans.append(Vector((0, td.x, td.y)))
        ws.append(w)
    for j in range(len(rings) - 1):
        for k in range(LSEG):
            k1 = (k + 1) % LSEG
            mb.face((rings[j][k], rings[j][k1], rings[j + 1][k1], rings[j + 1][k]), "leg")
    c0 = mb.vert(ctrs[0] - tans[0] * 0.02, ws[0])
    c1 = mb.vert(ctrs[-1] + tans[-1] * 0.004, ws[-1])
    for k in range(LSEG):
        k1 = (k + 1) % LSEG
        mb.face((rings[0][k1], rings[0][k], c0), "leg")
        mb.face((rings[-1][k], rings[-1][k1], c1), "leg")
    # sorkat: kaksi kynttä
    E = P[-1]
    w = {bones[-1]: 1.0}
    yt, yh = E.x - TIP, E.x + 0.024
    for s in (-1, 1):
        def X(d):  # etäisyys jalan keskilinjasta; kynsien väliin jää 6 mm loveus
            return x + s * d
        box(mb, [Vector((X(0.004), yt, 0)), Vector((X(0.017), yt + 0.008, 0)),
                 Vector((X(0.026), yh, 0)), Vector((X(0.003), yh, 0)),
                 Vector((X(0.004), yt + 0.018, 0.013)), Vector((X(0.014), yt + 0.020, 0.013)),
                 Vector((X(0.023), yh - 0.002, 0.045)), Vector((X(0.004), yh - 0.002, 0.045))], w, "hoof")


def build_head_parts(mb):
    hw = {"head": 1.0}
    for s in (1, -1):
        side = "L" if s > 0 else "R"
        # korva
        p, n = surf_normal(-0.585, s * 0.62)
        base = p - n * 0.012
        d = Vector((s * EAR_DIR[0], EAR_DIR[1], EAR_DIR[2])).normalized()
        f0 = Vector((s * 0.75, -1.0, 0.3))
        f = (f0 - d * f0.dot(d)).normalized()
        wax = d.cross(f).normalized()
        ring_def = [(0.0, 0.058, 0.019), (0.05, 0.055, 0.014), (0.10, 0.031, 0.010)]
        ew = [{"head": 0.5, "ear_" + side: 0.5}, {"ear_" + side: 1.0}, {"ear_" + side: 1.0}]
        rings = []
        for (dist, a, b), w in zip(ring_def, ew):
            c = base + d * dist
            rings.append([mb.vert(c + wax * (a * math.cos(2 * math.pi * k / 6)) + f * (b * math.sin(2 * math.pi * k / 6)), w) for k in range(6)])
        tipv = mb.vert(base + d * EAR_LEN + Vector((0, 0.01, 0)), {"ear_" + side: 1.0})
        for j in range(len(rings) - 1):
            for k in range(6):
                k1 = (k + 1) % 6
                mb.face((rings[j][k], rings[j][k1], rings[j + 1][k1], rings[j + 1][k]), "ear", False)
        for k in range(6):
            mb.face((rings[-1][k], rings[-1][(k + 1) % 6], tipv), "ear", False)
        cb = mb.vert(base - d * 0.01, ew[0])
        for k in range(6):
            mb.face((rings[0][(k + 1) % 6], rings[0][k], cb), "ear", False)
        # silmä
        p, n = surf_normal(-0.705, s * 0.80)
        sphere(mb, p - n * 0.005, 0.0125, hw, "eye")
        # alasyöksyhammas
        X0, n0 = surf_normal(TUSK_Y, s * MOUTH_A)
        k = TUSK_SCALE
        ctrl = [X0 - n0 * 0.02, X0 + Vector((s * 0.006, 0, 0.004))] + [
            X0 + Vector((s * dx, dy, dz)) * k for dx, dy, dz in
            ((0.024, -0.008, 0.025), (0.042, -0.001, 0.050), (0.046, 0.017, 0.068))]
        pts = smooth_path(ctrl, 3)
        m = len(pts)
        radii = [TUSK_R * (1.0 - 0.75 * (i / (m - 1)) ** 1.6) for i in range(m)]
        tube(mb, pts, radii, [hw] * m, "tusk", segs=6, tip=True)
        # yläleuan torahammas
        X1, n1 = surf_normal(TUSK_Y - 0.035, s * (MOUTH_A - 0.12))
        ctrl = [X1 - n1 * 0.012, X1 + Vector((s * 0.005, 0, 0.003)), X1 + Vector((s * 0.017, 0.002, 0.017)),
                X1 + Vector((s * 0.022, 0.012, 0.032))]
        # suupieli: ohut tumma listake, josta syöksyhammas nousee
        ys = [RINGS[-1][0] + 0.008 + i * 0.03 for i in range(5)]  # päättyy syöksyhampaan tyveen
        for ya, yb in zip(ys, ys[1:]):
            pa, na = surf_normal(ya, s * MOUTH_A)
            pb, nb = surf_normal(yb, s * MOUTH_A)
            up = Vector((0, 0, 0.0045))
            box(mb, [pa - na * 0.004 - up, pb - nb * 0.004 - up, pb + nb * 0.0025 - up, pa + na * 0.0025 - up,
                     pa - na * 0.004 + up, pb - nb * 0.004 + up, pb + nb * 0.0025 + up, pa + na * 0.0025 + up], hw, "mouth")
        pts = smooth_path(ctrl, 2)
        m = len(pts)
        tube(mb, pts, [0.0075 * (1 - 0.7 * i / (m - 1)) for i in range(m)], [hw] * m, "tusk", segs=5, tip=True)
        # poskiparta
        rng = random.Random(7 if s > 0 else 8)
        for i in range(5):
            y = -0.665 + i * 0.026 + rng.uniform(-0.006, 0.006)
            a = s * rng.uniform(1.95, 2.3)
            p, n = surf_normal(y, a)
            dirv = (n * 0.45 + Vector((0, 0.8, -0.45))).normalized()
            L = rng.uniform(0.036, 0.05)
            spike(mb, p - n * 0.012, p + dirv * L, Vector((0, 1, 0)), 0.022, 0.010, spine_weights(p), "beard")


def smooth_path(ctrl, sub):
    out = []
    n = len(ctrl)
    for i in range(n - 1):
        p0, p1, p2, p3 = ctrl[max(i - 1, 0)], ctrl[i], ctrl[i + 1], ctrl[min(i + 2, n - 1)]
        for j in range(sub):
            out.append(cr(p0, p1, p2, p3, j / sub))
    out.append(ctrl[-1].copy())
    return out


def mane_height(y):
    pr = MANE_PROFILE
    if y <= pr[0][0]:
        return pr[0][1]
    for (y0, h0), (y1, h1) in zip(pr, pr[1:]):
        if y <= y1:
            return h0 + (h1 - h0) * (y - y0) / (y1 - y0)
    return pr[-1][1]


def build_hair(mb):
    rng = random.Random(42)
    y0, y1 = MANE_PROFILE[0][0], MANE_PROFILE[-1][0]
    for i in range(MANE_COUNT):
        y = y0 + (y1 - y0) * i / (MANE_COUNT - 1) + rng.uniform(-0.006, 0.006)
        h = mane_height(y) * rng.uniform(0.75, 1.2)
        x = (0.009 if i % 2 else -0.009) + rng.uniform(-0.004, 0.004)
        zt = top_z(y)
        base = Vector((x, y, zt - 0.022))
        splay = (1 if i % 2 else -1) * rng.uniform(0.1, 0.3) * h
        apex = Vector((x + splay, y + MANE_LEAN * h, zt + h))
        spike(mb, base, apex, Vector((0, 1, 0)), 0.032, 0.014, spine_weights(base), "mane")
    # vatsan karvatupsut
    for i in range(9):
        y = -0.22 + i * 0.055 + rng.uniform(-0.01, 0.01)
        for s in (1, -1):
            p, n = surf_normal(y, math.pi + s * rng.uniform(0.25, 0.45))
            apex = p + Vector((s * 0.008, 0.03, -rng.uniform(0.018, 0.03)))
            spike(mb, p + Vector((0, 0, 0.012)), apex, Vector((0, 1, 0)), 0.022, 0.012, body_weights(p), "hair")
    # häntä ja tupsu
    pts = [Vector(p) for p in TAIL]
    wts = [{"hips": 1.0}, {"hips": 0.5, "tail1": 0.5}, {"tail1": 0.5, "tail2": 0.5}, {"tail2": 1.0}, {"tail2": 1.0}]
    tube(mb, pts, TAIL_R, wts, "tail", segs=6, tip=False)
    end = pts[-1]
    for i in range(7):
        a = 2 * math.pi * i / 7
        dirv = Vector((0.45 * math.cos(a), 0.15 + 0.4 * math.sin(a), -1.0)).normalized()
        spike(mb, end + Vector((0, 0, 0.02)), end + dirv * rng.uniform(0.06, 0.08), Vector((0, 0, 1)) if abs(dirv.z) < 0.9 else Vector((1, 0, 0)),
              0.012, 0.008, {"tail2": 1.0}, "tuft")


# --- Värit -------------------------------------------------------------------
EYE_POS = {}


def colour(zone, p):
    if zone == "hoof":
        return C["hoof"]
    if zone == "tusk":
        return C["tusk"]
    if zone == "eye":
        return C["eye"]
    if zone == "disc":
        return C["disc"]
    if zone == "mouth":
        return mix(C["dark"], C["body"], 0.3)
    if zone == "nostril":
        return mix(C["disc"], C["eye"], 0.7)
    g = noise.noise(p * 14.0)
    if zone == "beard":
        return mix(C["cheek"], C["dark"], 0.35 + 0.15 * g)
    if zone in ("mane", "hair", "tuft"):
        zt = top_z(max(min(p.y, 0.5), -0.9)) if zone == "mane" else p.z + 1
        k = ss(zt + 0.03, zt + 0.11, p.z) if zone == "mane" else 0.0
        c = mix(C["dark"], C["tip"], 0.65 * k + 0.12 * (g + 1))
        return c
    if zone == "ear":
        return mix(C["dark"], C["body"], 0.25)
    base = C["body"]
    if zone in ("leg", "tail"):
        base = mix(C["body"], C["dark"], 0.85 * (1 - ss(0.20, 0.40, p.z)) if zone == "leg" else 0.4)
        return tuple(x * (1 + 0.15 * g) for x in base)
    r = ring_at_y(max(min(p.y, RINGS[0][0]), RINGS[-1][0]))
    top, bot = r[1] + r[5], r[2]
    c = base
    # harmaantuneet posket ja kyljet
    kc = math.exp(-((p.y + 0.63) / 0.08) ** 2) * math.exp(-((p.z - 0.53) / 0.08) ** 2) * min(1.0, abs(p.x) / 0.07)
    c = mix(c, C["cheek"], 0.65 * kc)
    kf = math.exp(-((p.z - (bot + 0.55 * (top - bot))) / 0.12) ** 2) * ss(0.06, 0.16, abs(p.x)) * ss(-0.5, -0.35, -p.y) * 0
    kf = math.exp(-((p.z - (bot + 0.55 * (top - bot))) / 0.12) ** 2) * ss(0.06, 0.16, abs(p.x)) * (1 - ss(-0.62, -0.5, p.y) * 0)
    c = mix(c, C["cheek"], 0.18 * kf)
    # tumma selkälinja ja vatsa
    c = mix(c, C["dark"], 0.5 * ss(top - 0.09, top - 0.01, p.z))
    c = mix(c, C["dark"], 0.35 * (1 - ss(bot + 0.01, bot + 0.07, p.z)))
    # kärsä vaalenee kiekkoa kohti
    c = mix(c, C["disc"], 0.6 * ss(0.84, 0.93, -p.y))
    # silmän ympärys
    for e in EYE_POS.values():
        d = (p - e).length
        c = mix(c, C["dark"], 0.6 * (1 - ss(0.02, 0.045, d)))
    return tuple(x * (1 + 0.16 * g) for x in c)


# =============================================================================
# Kokoaminen
# =============================================================================
BONES = {}  # nimi -> (head, tail, parent, connect)


def define_bones():
    B = BONES
    B["root"] = ((0, 0, 0), (0, -0.25, 0), None, False)
    dz = BODY_DZ
    rl = RINGS[-1]
    B["hips"] = ((0, 0.31, 0.70 + dz), (0, 0.10, 0.74 + dz), "root", False)
    B["spine1"] = ((0, 0.10, 0.74 + dz), (0, -0.12, 0.78 + dz), "hips", True)
    B["chest"] = ((0, -0.12, 0.78 + dz), (0, -0.36, 0.76 + dz), "spine1", True)
    B["neck"] = ((0, -0.36, 0.76 + dz), (0, -0.56, 0.72 + dz), "chest", True)
    B["head"] = ((0, -0.56, 0.72 + dz), (0, rl[0] - 0.006, rl[2] + (rl[1] - rl[2]) * rl[6]), "neck", True)
    for s in (1, -1):
        side = "L" if s > 0 else "R"
        p, n = surf_normal(-0.585, s * 0.62)
        base = p - n * 0.012
        d = Vector((s * EAR_DIR[0], EAR_DIR[1], EAR_DIR[2])).normalized()
        B["ear_" + side] = (tuple(base), tuple(base + d * EAR_LEN), "head", False)
        x = s * FRONT_X
        names = ["scapula", "upperarm", "forearm", "frontfoot", "fronttoe"]
        par = "chest"
        for i, nm in enumerate(names):
            B[nm + "_" + side] = (tuple(p3(x, FRONT[i])), tuple(p3(x, FRONT[i + 1])), par, i > 0)
            par = nm + "_" + side
        x = s * HIND_X
        names = ["thigh", "shin", "hindfoot", "hindtoe"]
        par = "hips"
        for i, nm in enumerate(names):
            B[nm + "_" + side] = (tuple(p3(x, HIND[i])), tuple(p3(x, HIND[i + 1])), par, i > 0)
            par = nm + "_" + side
    B["tail1"] = (TAIL[1], TAIL[2], "hips", False)
    B["tail2"] = (TAIL[2], TAIL[4], "tail1", True)


def build_armature():
    arm_data = bpy.data.armatures.new(NAME)
    arm = bpy.data.objects.new(NAME, arm_data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    ebs = {}
    for name, (h, t, par, con) in BONES.items():
        eb = arm_data.edit_bones.new(name)
        eb.head, eb.tail = Vector(h), Vector(t)
        d = (eb.tail - eb.head).normalized()
        z = Vector((1, 0, 0)).cross(d).normalized()
        eb.align_roll(z)
        eb.use_deform = True
        ebs[name] = eb
    for name, (h, t, par, con) in BONES.items():
        if par:
            ebs[name].parent = ebs[par]
            ebs[name].use_connect = con
    bpy.ops.object.mode_set(mode="OBJECT")
    for b in arm_data.bones:
        if b.name in ("ear_L", "ear_R"):
            continue
        x = b.matrix_local.col[0].xyz
        assert (x - Vector((1, 0, 0))).length < 1e-4, (b.name, x)
    return arm


def build_mesh(arm):
    mb = MB()
    for s in (1, -1):
        p, n = surf_normal(-0.705, s * 0.80)
        EYE_POS[s] = p
    build_body(mb)
    for kind in ("front", "hind"):
        for side in ("L", "R"):
            build_leg(mb, kind, side)
    build_head_parts(mb)
    build_hair(mb)

    me = bpy.data.meshes.new(NAME + "_mesh")
    me.from_pydata([tuple(v) for v in mb.v], [], mb.f)
    me.update()
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    me.polygons.foreach_set("use_smooth", mb.fs)
    ca = me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    for poly in me.polygons:
        z = mb.fz[poly.index]
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            c = colour(z, mb.v[vi])
            ca.data[li].color = (c[0], c[1], c[2], 1.0)
    me.color_attributes.active_color = ca
    try:
        me.color_attributes.render_color_index = me.color_attributes.active_color_index
    except Exception:
        pass
    me.update()

    mat = bpy.data.materials.new(NAME)
    try:
        mat.use_nodes = True
    except Exception:
        pass
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    vc = nt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "Col"
    nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.9
    mat.use_backface_culling = True
    me.materials.append(mat)

    ob = bpy.data.objects.new(NAME + "_mesh", me)
    bpy.context.scene.collection.objects.link(ob)
    ob.parent = arm
    groups = {b.name: ob.vertex_groups.new(name=b.name) for b in arm.data.bones}
    for vi, w in enumerate(mb.w):
        for bn, val in w.items():
            groups[bn].add([vi], val, "REPLACE")
    mod = ob.modifiers.new("Armature", "ARMATURE")
    mod.object = arm
    body_idx = [i for i, z in enumerate(mb.fz) if z == "body"]
    body_verts = set(v for i in body_idx for v in mb.f[i])
    stats = dict(tris=sum(len(f) - 2 for f in mb.f), verts=len(mb.v))
    bz = [mb.v[i] for i in body_verts if -0.33 <= mb.v[i].y <= -0.27]
    stats["withers_body_top"] = round(max(v.z for v in bz), 3)
    stats["shoulder_width"] = round(2 * max(abs(v.x) for v in bz), 3)
    return ob, stats


# =============================================================================
# Animaatio: asento -> luiden matriisit (oma FK ja tasoratkaisu jaloille)
# =============================================================================
def v2(p):
    return Vector((p[0], p[1]))


def ang2(v):
    return math.atan2(v[1], v[0])


def u2(a):
    return Vector((math.cos(a), math.sin(a)))


def wrap(a):
    return (a + math.pi) % (2 * math.pi) - math.pi


class Leg:
    def __init__(self, key, kind, side):
        sx = 1 if side == "L" else -1
        self.key, self.kind = key, kind
        if kind == "front":
            self.x, pts, self.parent = sx * FRONT_X, FRONT, "chest"
            self.bones = [b + "_" + side for b in ("scapula", "upperarm", "forearm", "frontfoot", "fronttoe")]
            self.k = 1
        else:
            self.x, pts, self.parent = sx * HIND_X, HIND, "hips"
            self.bones = [b + "_" + side for b in ("thigh", "shin", "hindfoot", "hindtoe")]
            self.k = 0
        self.P = [v2(p) for p in pts]
        self.L = [(self.P[i + 1] - self.P[i]).length for i in range(len(self.P) - 1)]
        self.th0 = [ang2(self.P[i + 1] - self.P[i]) for i in range(len(self.P) - 1)]
        A, B, Cc = self.P[self.k], self.P[self.k + 1], self.P[self.k + 2]
        self.bend = 1.0 if wrap(ang2(B - A) - ang2(Cc - A)) > 0 else -1.0
        self.E0 = self.P[-1].copy()

    def solve(self, F, E, ds=0.0, d3=0.0, d4=0.0):
        fy = F.to_3x3() @ Vector((0, 1, 0))
        Pt = math.atan2(fy.z, fy.y)

        def w2(p):
            q = F @ Vector((self.x, p.x, p.y))
            return Vector((q.y, q.z))
        n, k = len(self.L), self.k
        th = [0.0] * n
        if k == 1:
            S0 = w2(self.P[0])
            th[0] = self.th0[0] + Pt + ds
            A = S0 + self.L[0] * u2(th[0])
        else:
            A = w2(self.P[0])
        th[n - 1] = self.th0[n - 1] + d4
        D = E - self.L[n - 1] * u2(th[n - 1])
        th[n - 2] = self.th0[n - 2] + d3
        Cc = D - self.L[n - 2] * u2(th[n - 2])
        L1, L2 = self.L[k], self.L[k + 1]
        dv = Cc - A
        d = dv.length
        dc = min(max(d, abs(L1 - L2) + 1e-4), L1 + L2 - 1e-4)
        over = d - dc
        base = ang2(dv)
        ca = (L1 * L1 + dc * dc - L2 * L2) / (2 * L1 * dc)
        th[k] = base + self.bend * math.acos(max(-1.0, min(1.0, ca)))
        Bp = A + L1 * u2(th[k])
        th[k + 1] = ang2(A + dc * u2(base) - Bp)
        deltas, prev = [], 0.0
        for a, a0 in zip(th, self.th0):
            dd = wrap(a - Pt - a0)
            deltas.append(wrap(dd - prev))
            prev = dd
        return deltas, over


LEGS = [Leg("FL", "front", "L"), Leg("FR", "front", "R"), Leg("HL", "hind", "L"), Leg("HR", "hind", "R")]
LEGD = {l.key: l for l in LEGS}


class Pose:
    def __init__(self):
        self.root = Matrix.Identity(4)
        self.hips = Vector((0, 0, 0))
        self.rot = {}
        self.legs = {}
        self.deltas = {}

    def r(self, bone, rx=0.0, ry=0.0, rz=0.0):
        a = self.rot.setdefault(bone, [0.0, 0.0, 0.0])
        a[0] += rx
        a[1] += ry
        a[2] += rz


def solve_pose(arm, pose):
    bones = arm.data.bones
    Mr = {b.name: b.matrix_local.copy() for b in bones}
    basis = {b.name: Matrix.Identity(4) for b in bones}
    basis["root"] = Mr["root"].inverted() @ pose.root @ Mr["root"]
    for name, (rx, ry, rz) in pose.rot.items():
        basis[name] = Euler((rx, ry, rz), "XYZ").to_matrix().to_4x4()
    loc = Mr["hips"].to_3x3().inverted() @ pose.hips
    basis["hips"] = Matrix.Translation(loc) @ basis["hips"]
    M = {}

    def fk(name):
        if name in M:
            return M[name]
        b = bones[name]
        if b.parent:
            m = fk(b.parent.name) @ Mr[b.parent.name].inverted() @ Mr[name] @ basis[name]
        else:
            m = Mr[name] @ basis[name]
        M[name] = m
        return m
    over = {}
    for leg in LEGS:
        spec = pose.legs.get(leg.key, ("ik", leg.E0.copy(), 0.0, 0.0, 0.0))
        if spec[0] == "fk":
            deltas = spec[1]
        else:
            F = fk(leg.parent) @ Mr[leg.parent].inverted()
            deltas, o = leg.solve(F, spec[1], spec[2], spec[3], spec[4])
            over[leg.key] = (o, spec[1].y, spec[1].x)
        pose.deltas[leg.key] = list(deltas)
        for b, d in zip(leg.bones, deltas):
            basis[b] = Quaternion((1, 0, 0), d).to_matrix().to_4x4()
    return basis, over


def write_keys(arm, basis, f, prevq):
    for pb in arm.pose.bones:
        loc, q, sc = basis[pb.name].decompose()
        pq = prevq.get(pb.name)
        if pq is not None and pq.dot(q) < 0:
            q = -q
        prevq[pb.name] = q
        pb.rotation_mode = "QUATERNION"
        pb.location = loc
        pb.rotation_quaternion = q
        pb.scale = (1, 1, 1)
        for prop in ("location", "rotation_quaternion", "scale"):
            pb.keyframe_insert(prop, frame=f)


# --- Leikkeet ----------------------------------------------------------------
def gait_foot(ph, g, kind, E0):
    duty, sweep, roll, k3 = g["duty"], g["sweep"], g["roll"], g["k3"]
    lift = g["lift_f"] if kind == "front" else g["lift_h"]
    f3 = g["flex3_f"] if kind == "front" else g["flex3_h"]
    f4 = g["flex4_f"] if kind == "front" else g["flex4_h"]
    e0 = E0.x  # 2D-vektori: x = y-koordinaatti, y = z
    yf, yb = e0 - sweep / 2, e0 + sweep / 2

    def rolled(ey, rho):
        return Vector((ey - TIP + TIP * math.cos(rho), TIP * math.sin(rho)))
    if ph < duty:
        s = ph / duty
        ey = yf + sweep * s
        rho = roll * ss(1 - ROLL_FRAC, 1.0, s)
        return rolled(ey, rho), k3 * (ey - e0), rho, ey, True
    s = (ph - duty) / (1 - duty)
    m = 0.5 - 0.5 * math.cos(math.pi * s)
    Elo = rolled(yb, roll)
    E = Vector((Elo.x + (yf - Elo.x) * m, Elo.y * (1 - m) + lift * math.sin(math.pi * s)))
    ny = yb + (yf - yb) * m
    d4 = roll * (1 - m) + f4 * math.sin(math.pi * s)
    d3 = k3 * (ny - e0) + f3 * math.sin(math.pi * s)
    return E, d3, d4, ny, False


def gait_legs(p, t, g):
    for leg in LEGS:
        ph = (t - g["offs"][leg.key]) % 1.0
        E, d3, d4, ny, st = gait_foot(ph, g, leg.kind, leg.E0)
        ds = g["ks"] * (ny - leg.E0.x) if leg.kind == "front" else 0.0
        p.legs[leg.key] = ("ik", E, ds, d3, d4)


def pose_idle(t):
    p = Pose()
    b = S(1, t)
    p.hips = Vector((0, 0, 0.003 * b))
    p.r("spine1", rx=-0.008 * b)
    p.r("chest", rx=0.014 * b)
    p.r("neck", rx=0.03 * S(1, t, 0) * 0.6, rz=0.03 * S(1, t))
    p.r("head", rx=0.04 * S(2, t) - 0.06 * pulse(t, 0.62, 0.92), rz=0.07 * S(1, t))
    p.r("ear_L", rx=-0.35 * pulse(t, 0.45, 0.58), rz=0.5 * pulse(t, 0.45, 0.58))
    p.r("ear_R", rx=-0.2 * pulse(t, 0.12, 0.22), rz=-0.3 * pulse(t, 0.12, 0.22))
    p.r("tail1", rx=0.08 * S(1, t), rz=0.30 * S(2, t))
    p.r("tail2", rz=0.35 * S(2, t, -0.9))
    return p


def pose_walk(t):
    g = WALK
    p = Pose()
    p.hips = Vector((0, 0, -g["drop"] + 0.008 * S(2, t, math.pi / 2)))
    p.r("hips", rx=0.012 * S(2, t))
    p.r("spine1", rz=0.02 * S(1, t))
    p.r("chest", rz=-0.02 * S(1, t))
    p.r("neck", rx=0.03 * S(2, t, 1.0), rz=0.03 * S(1, t))
    p.r("head", rx=0.04 * S(2, t, 1.6), rz=0.04 * S(1, t, 0.5))
    for s in ("L", "R"):
        p.r("ear_" + s, rx=0.08 * S(2, t, 2.0))
    p.r("tail1", rx=0.1, rz=0.25 * S(1, t))
    p.r("tail2", rz=0.3 * S(1, t, -0.8))
    gait_legs(p, t, g)
    return p


def pose_run(t):
    g = RUN
    p = Pose()
    sp = S(1, t, -2 * math.pi * 0.85)
    p.hips = Vector((0, 0, -g["drop"] + 0.028 * S(1, t, 0.6)))
    p.r("hips", rx=0.087 - 0.07 * sp + 0.04 * S(1, t, 2.2))
    p.r("spine1", rx=0.08 * sp)
    p.r("chest", rx=0.05 * sp)
    p.r("neck", rx=0.10 - 0.06 * sp)
    p.r("head", rx=0.16 + 0.06 * S(1, t, 1.0))
    for s, sx in (("L", 1), ("R", -1)):
        p.r("ear_" + s, rx=-0.65, rz=sx * 0.1)
    p.r("tail1", rx=0.9 + 0.15 * S(1, t), rz=0.15 * S(1, t, 1.0))
    p.r("tail2", rx=0.35, rz=0.2 * S(1, t, 0.2))
    gait_legs(p, t, g)
    return p


def blend_pose(parts):
    """parts: [(paino, asentofunktion tulos)] -> summa rotaatioista ja siirroista."""
    p = Pose()
    for w, q in parts:
        p.hips = p.hips + q.hips * w
        for b, (rx, ry, rz) in q.rot.items():
            p.r(b, rx * w, ry * w, rz * w)
    return p


def attack_dip():
    p = Pose()
    p.hips = Vector((0, 0.03, -0.035))
    p.r("hips", rx=-0.03)
    p.r("spine1", rx=0.06)
    p.r("chest", rx=0.04)
    p.r("neck", rx=0.24)
    p.r("head", rx=0.33, rz=-0.08)
    for s in ("L", "R"):
        p.r("ear_" + s, rx=-0.55)
    p.r("tail1", rx=0.7)
    p.r("tail2", rx=0.3)
    return p


def attack_hook():
    p = Pose()
    p.hips = Vector((0, -0.10, -0.045))
    p.r("hips", rx=0.03)
    p.r("spine1", rx=0.0, rz=-0.05)
    p.r("chest", rx=0.02, rz=-0.06)
    p.r("neck", rx=0.0, rz=-0.24, ry=-0.10)
    p.r("head", rx=-0.08, rz=-0.38, ry=-0.34)
    for s in ("L", "R"):
        p.r("ear_" + s, rx=-0.6)
    p.r("tail1", rx=0.8, rz=0.2)
    p.r("tail2", rx=0.3)
    return p


def pose_attack(t):
    e1 = ss(0.0, 0.28, t)
    e2 = ss(0.29, 0.38, t)
    r = ss(0.46, 0.80, t)
    dip, hook = attack_dip(), attack_hook()
    p = blend_pose([(e1 * (1 - e2) * (1 - r), dip), (e2 * (1 - r), hook)])
    return p


def pose_hit(t):
    env = ss(0.0, 0.07, t) * (1 - ss(0.09, 0.40, t))
    wob = 1 + 0.25 * math.sin(2 * math.pi * t / 0.18) * ss(0.07, 0.15, t)
    e = env * wob
    p = Pose()
    p.hips = Vector((0, 0.05, -0.025)) * e
    p.r("hips", rx=-0.02 * e)
    p.r("spine1", rx=-0.05 * e, rz=-0.04 * e)
    p.r("chest", rz=-0.05 * e)
    p.r("neck", rx=-0.16 * e, rz=-0.10 * e)
    p.r("head", rx=-0.30 * e, rz=-0.22 * e, ry=-0.15 * e)
    for s in ("L", "R"):
        p.r("ear_" + s, rx=-0.6 * e)
    p.r("tail1", rx=0.45 * e)
    return p


DEATH_N = 45
DEATH_FA, DEATH_FB = 12 / 45, 33 / 45
DEATH_PIVOT = Vector((0.12, 0.0, 0.0))
LYING = {"front": [-0.10, -0.45, 0.35, 0.30, 0.35], "hind": [0.30, -0.15, 0.20, 0.40]}
_DEATH_IK = {}


def death_body_a(eA):
    p = Pose()
    p.hips = Vector((0, 0.03, -0.10)) * eA
    p.r("hips", rx=-0.05 * eA)
    p.r("spine1", rx=0.12 * eA)
    p.r("chest", rx=0.06 * eA)
    p.r("neck", rx=0.18 * eA)
    p.r("head", rx=0.22 * eA, rz=0.1 * eA)
    for s in ("L", "R"):
        p.r("ear_" + s, rx=-0.5 * eA)
    p.r("tail1", rx=-0.1 * eA)
    return p


def death_body_lying():
    p = Pose()
    p.r("spine1", rx=0.02)
    p.r("neck", rx=0.10, rz=-0.22)
    p.r("head", rx=0.12, rz=-0.18, ry=0.1)
    p.r("ear_L", rx=-0.4, rz=0.3)
    p.r("ear_R", rx=-0.4, rz=-0.2)
    p.r("tail1", rx=0.2, rz=-0.5)
    p.r("tail2", rz=-0.3)
    return p


def death_legs_a(p, eA):
    for leg in LEGS:
        d3 = (0.55 if leg.kind == "front" else 0.12) * eA
        p.legs[leg.key] = ("ik", leg.E0.copy(), 0.0, d3, 0.0)


def pose_death(t):
    eA = ss(0.0, DEATH_FA, t)
    s = min(1.0, max(0.0, (t - DEATH_FA) / (DEATH_FB - DEATH_FA)))
    m = ss(0.0, 1.0, s)
    p = blend_pose([(1 - m, death_body_a(eA)), (m, death_body_lying())])
    roll = (math.pi / 2 + 0.05) * s ** 1.7
    if t > DEATH_FB:
        u = (t - DEATH_FB) / (1 - DEATH_FB)
        roll -= 0.06 * math.sin(math.pi * min(1.0, u / 0.35)) * (1 - u)
    p.root = Matrix.Translation(DEATH_PIVOT) @ Matrix.Rotation(roll, 4, "Y") @ Matrix.Translation(-DEATH_PIVOT)
    if t <= DEATH_FA:
        death_legs_a(p, eA)
    else:
        ml = ss(0.0, 0.8, s)
        tw = pulse(t, 0.80, 0.92)
        for leg in LEGS:
            a = _DEATH_IK[leg.key]
            b = LYING[leg.kind]
            d = [x + (y - x) * ml for x, y in zip(a, b)]
            if leg.key == "HR":
                d[0] += 0.25 * tw
                d[1] -= 0.2 * tw
            if leg.key in ("FL", "HL"):
                d[1] += 0.1 * ml
            p.legs[leg.key] = ("fk", d)
    return p


CLIPS = [  # nimi, ruutuja, silmukka, asentofunktio
    ("idle", 60, True, pose_idle),
    ("walk", 30, True, pose_walk),
    ("run", 15, True, pose_run),
    ("attack", 24, False, pose_attack),
    ("hit", 12, False, pose_hit),
    ("death", DEATH_N, False, pose_death),
]


def mesh_min_z(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = ev.to_mesh()
    co = np.empty(len(me.vertices) * 3, dtype=np.float32)
    me.vertices.foreach_get("co", co)
    ev.to_mesh_clear()
    return float(co.reshape(-1, 3)[:, 2].min())


def bake_all(arm, ob):
    sc = bpy.context.scene
    sc.render.fps = FPS
    arm.animation_data_create()
    # kuolemaan: jalkojen IK-kulmat polvistumisen lopussa
    p = Pose()
    p = blend_pose([(1.0, death_body_a(1.0))])
    death_legs_a(p, 1.0)
    solve_pose(arm, p)
    _DEATH_IK.update(p.deltas)
    report = {}
    actions = []
    for name, n, loop, fn in CLIPS:
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        arm.animation_data.action = act
        prevq = {}
        worst = 0.0
        stored = {}
        for f in range(n + 1):
            t = (f % n) / n if loop else f / n
            pose = fn(t)
            basis, over = solve_pose(arm, pose)
            for k, (o, ez, ey) in over.items():
                if ez < 0.002:
                    worst = max(worst, o)
            stored[f] = basis
            write_keys(arm, basis, f, prevq)
        if name == "death":
            Mr = arm.data.bones["root"].matrix_local
            prevq = {}
            for f in range(n + 1):
                t = f / n
                if t <= DEATH_FA:
                    continue
                sc.frame_set(f)
                mz = mesh_min_z(ob)
                s = min(1.0, (t - DEATH_FA) / (DEATH_FB - DEATH_FA))
                corr = -mz if mz < 0 else -mz * ss(0.55, 0.95, s)
                b = stored[f]
                b["root"] = Mr.inverted() @ Matrix.Translation((0, 0, corr)) @ Mr @ b["root"]
                pb = arm.pose.bones["root"]
                loc, q, _ = b["root"].decompose()
                pb.location = loc
                pb.rotation_quaternion = q
                pb.keyframe_insert("location", frame=f)
                pb.keyframe_insert("rotation_quaternion", frame=f)
        mins = []
        for f in range(n + 1):
            sc.frame_set(f)
            mins.append(mesh_min_z(ob))
        report[name] = dict(frames=n, seconds=n / FPS, loop=loop, stance_overreach_m=round(worst, 4),
                            min_z=round(min(mins), 4), min_z_last=round(mins[-1], 4))
        actions.append(act)
    arm.animation_data.action = actions[0]
    sc.frame_start, sc.frame_end = 0, 60
    sc.frame_set(0)
    return actions, report


def export_glb(arm, ob):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, NAME + ".glb")
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True, export_yup=True,
        export_apply=False, export_cameras=False, export_lights=False,
        export_vertex_color="NAME", export_vertex_color_name="Col", export_all_vertex_colors=False,
        export_skins=True, export_all_influences=False, export_def_bones=False,
        export_animations=True, export_animation_mode="ACTIONS", export_force_sampling=True,
        export_frame_step=1, export_optimize_animation_size=False,
        export_anim_single_armature=True, export_reset_pose_bones=True, export_morph=False,
        export_materials="EXPORT")
    return path


# =============================================================================
# Tarkistus: GLB uudelleen sisään ja mittaukset + kuvat
# =============================================================================
def glb_json(path):
    with open(path, "rb") as fh:
        data = fh.read()
    clen = struct.unpack_from("<I", data, 12)[0]
    return json.loads(data[20:20 + clen])


def check_glb(path):
    js = glb_json(path)
    nodes = js["nodes"]
    scene_roots = [nodes[i]["name"] for i in js["scenes"][0]["nodes"]]
    anims = []
    for a in js.get("animations", []):
        dur = max(js["accessors"][s["input"]]["max"][0] for s in a["samplers"])
        targets = set((c["target"]["node"], c["target"]["path"]) for c in a["channels"])
        anims.append(dict(name=a["name"], duration=round(dur, 4), channels=len(a["channels"]),
                          bones_keyed=len(set(n for n, _ in targets))))
    prims = js["meshes"][0]["primitives"]
    attrs = sorted(prims[0]["attributes"].keys())
    pos = js["accessors"][prims[0]["attributes"]["POSITION"]]
    return dict(scene_roots=scene_roots, root_children=[nodes[c]["name"] for c in nodes[js["scenes"][0]["nodes"][0]].get("children", [])],
                joints=len(js["skins"][0]["joints"]), animations=anims, attributes=attrs,
                materials=len(js.get("materials", [])), gltf_pos_min=pos["min"], gltf_pos_max=pos["max"],
                size_kb=round(os.path.getsize(path) / 1024, 1))


def set_engine(sc):
    for e in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT", "BLENDER_WORKBENCH"):
        try:
            sc.render.engine = e
            return e
        except Exception:
            continue


def verify_and_preview(path):
    clear_scene()
    sc = bpy.context.scene
    sc.render.fps = FPS
    bpy.ops.import_scene.gltf(filepath=path)
    arm = bpy.data.objects[NAME]
    ob = bpy.data.objects[NAME + "_mesh"]
    for o in list(bpy.data.objects):   # tuojan luiden apumuodot yms. pois kuvista
        if o not in (arm, ob):
            bpy.data.objects.remove(o, do_unlink=True)
    out = dict(root_object=arm.name, root_parent=str(arm.parent), mesh=ob.name, mesh_parent=ob.parent.name if ob.parent else None,
               objects=sorted(o.name for o in bpy.data.objects), bones=len(arm.data.bones))
    out["tris"] = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    acts = {}
    for a in bpy.data.actions:
        for cn, *_ in CLIPS:
            if a.name == cn or a.name.startswith(cn + "_") or a.name.startswith(cn + "."):
                acts.setdefault(cn, a)

    def use(cn, t):
        a = acts[cn]
        arm.animation_data.action = a
        try:
            if a.slots:
                arm.animation_data.action_slot = a.slots[0]
        except Exception:
            pass
        f0, f1 = a.frame_range
        sc.frame_set(int(round(f0 + t * FPS)))

    def coords():
        dg = bpy.context.evaluated_depsgraph_get()
        ev = ob.evaluated_get(dg)
        me = ev.to_mesh()
        co = np.empty(len(me.vertices) * 3, dtype=np.float32)
        me.vertices.foreach_get("co", co)
        ev.to_mesh_clear()
        co = co.reshape(-1, 3)
        mw = np.array(ob.matrix_world)
        return co @ mw[:3, :3].T + mw[:3, 3]
    out["action_ranges"] = {k: [round(x, 2) for x in a.frame_range] for k, a in acts.items()}
    use("idle", 0.0)
    co = coords()
    lo, hi = co.min(0), co.max(0)
    out["bbox_idle0"] = dict(min=[round(float(x), 3) for x in lo], max=[round(float(x), 3) for x in hi])
    out["length_y_incl_tail"] = round(float(hi[1] - lo[1]), 3)
    body = co[co[:, 1] < 0.56]
    out["length_snout_to_rump"] = round(float(body[:, 1].max() - lo[1]), 3)
    out["height_total"] = round(float(hi[2]), 3)
    out["width"] = round(float(hi[0] - lo[0]), 3)
    out["snout_min_y_point"] = [round(float(x), 3) for x in co[co[:, 1].argmin()]]
    out["idle0_min_z"] = round(float(lo[2]), 5)
    out["idle0_verts_on_ground"] = int((np.abs(co[:, 2]) < 0.001).sum())
    for qx, qy, nm in ((1, -1, "FL"), (-1, -1, "FR"), (1, 1, "HL"), (-1, 1, "HR")):
        sel = co[(co[:, 0] * qx > 0.05) & (co[:, 1] * qy > 0.2) & (co[:, 2] < 0.06)]
        out["foot_min_z_" + nm] = round(float(sel[:, 2].min()), 5)
    use("death", 1.5)
    out["death_last_min_z"] = round(float(coords()[:, 2].min()), 4)
    if not PREVIEW:
        return out
    os.makedirs(PREVIEW, exist_ok=True)
    eng = set_engine(sc)
    out["render_engine"] = eng
    try:
        sc.eevee.taa_render_samples = 32
    except Exception:
        pass
    sc.view_settings.view_transform = "Standard"
    w = bpy.data.worlds.new("pv_world")
    try:
        w.use_nodes = True
    except Exception:
        pass
    bg = next(n for n in w.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs[0].default_value = (0.42, 0.45, 0.5, 1)
    bg.inputs[1].default_value = 0.9
    sc.world = w
    sun = bpy.data.objects.new("pv_sun", bpy.data.lights.new("pv_sun", "SUN"))
    sun.data.energy = 3.2
    sun.data.angle = math.radians(3)
    sun.rotation_euler = (math.radians(48), 0, math.radians(-35))
    sc.collection.objects.link(sun)
    gme = bpy.data.meshes.new("pv_ground")
    gme.from_pydata([(-60, -60, 0), (60, -60, 0), (60, 60, 0), (-60, 60, 0)], [], [(0, 1, 2, 3)])
    gm = bpy.data.materials.new("pv_ground")
    try:
        gm.use_nodes = True
    except Exception:
        pass
    gb = next(n for n in gm.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    gb.inputs["Base Color"].default_value = (0.2, 0.2, 0.2, 1)
    gb.inputs["Roughness"].default_value = 1.0
    gme.materials.append(gm)
    g = bpy.data.objects.new("pv_ground", gme)
    sc.collection.objects.link(g)
    cam = bpy.data.objects.new("pv_cam", bpy.data.cameras.new("pv_cam"))
    sc.collection.objects.link(cam)
    sc.camera = cam

    def shot(fname, loc, tgt, lens=50, clip=None, t=0.0, res=(1024, 768)):
        use(clip or "idle", t)
        cam.data.lens_unit = "MILLIMETERS"
        cam.data.sensor_fit = "AUTO"
        cam.data.lens = lens
        cam.location = loc
        cam.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        sc.render.resolution_x, sc.render.resolution_y = res
        sc.render.resolution_percentage = 100
        sc.render.filepath = os.path.join(PREVIEW, fname)
        bpy.ops.render.render(write_still=True)
    c = (0, -0.2, 0.5)
    shot("front.png", (0.25, -3.6, 1.15), c)
    shot("side.png", (3.8, -0.2, 0.65), c)
    shot("threeq.png", (2.4, -2.9, 1.7), c)
    shot("rear_threeq.png", (-2.4, 2.8, 1.5), c)
    shot("walk_side.png", (3.8, -0.2, 0.65), c, clip="walk", t=0.0)
    shot("run_side.png", (3.8, -0.2, 0.65), c, clip="run", t=0.2)
    shot("attack_side.png", (3.8, -0.2, 0.65), c, clip="attack", t=0.38)
    shot("walk_rear_threeq.png", (-2.4, 2.8, 1.5), c, clip="walk", t=0.3)
    shot("run_rear_threeq.png", (-2.4, 2.8, 1.5), c, clip="run", t=0.1)
    shot("attack_threeq.png", (2.4, -2.9, 1.7), c, clip="attack", t=0.38)
    shot("death_side.png", (-2.9, -0.2, 1.6), (0.5, -0.2, 0.2), clip="death", t=1.5)
    # 20 m: 60 asteen pystykenttä, 1920x1080, rajataan eläimen todellinen pikselikoko
    use("idle", 0.0)
    cam.data.sensor_fit = "VERTICAL"
    cam.data.lens_unit = "FOV"
    cam.data.angle_y = math.radians(60)
    cam.location = (20.0, -0.2, 1.7)
    cam.rotation_euler = (Vector((0, -0.2, 0.5)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    W, H = 1920, 1080
    sc.render.resolution_x, sc.render.resolution_y = W, H
    bpy.context.view_layer.update()
    full = os.path.join(PREVIEW, "_far20m_full.png")
    sc.render.filepath = full
    bpy.ops.render.render(write_still=True)
    from bpy_extras.object_utils import world_to_camera_view
    co = coords()
    uv = [world_to_camera_view(sc, cam, Vector(p)) for p in co[::7]]
    xs = [u.x * W for u in uv]
    ys = [u.y * H for u in uv]
    m = 8
    x0, x1 = max(0, int(min(xs)) - m), min(W, int(max(xs)) + m)
    y0, y1 = max(0, int(min(ys)) - m), min(H, int(max(ys)) + m)
    out["far20m_boar_px"] = [round(max(xs) - min(xs), 1), round(max(ys) - min(ys), 1)]
    img = bpy.data.images.load(full)
    px = np.array(img.pixels[:], dtype=np.float32).reshape(H, W, 4)
    crop = px[y0:y1, x0:x1]
    for fname, arr in (("far20m.png", crop), ("far20m_x4.png", np.repeat(np.repeat(crop, 4, 0), 4, 1))):
        h, wdt = arr.shape[:2]
        im = bpy.data.images.new(fname, wdt, h, alpha=True)
        im.pixels = arr.ravel()
        im.filepath_raw = os.path.join(PREVIEW, fname)
        im.file_format = "PNG"
        im.save()
    return out


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)


def main():
    clear_scene()
    define_bones()
    arm = build_armature()
    ob, stats = build_mesh(arm)
    actions, clips = bake_all(arm, ob)
    os.makedirs(os.path.dirname(BLEND), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    path = export_glb(arm, ob)
    rep = dict(build=stats, clips=clips, walk_speed=round(WALK_SPEED, 3), run_speed=round(RUN_SPEED, 3),
               hit_window=HIT_WINDOW, bones=[b for b in BONES], glb=check_glb(path))
    rep["reimport"] = verify_and_preview(path)
    txt = json.dumps(rep, indent=1, ensure_ascii=False)
    print("BOAR_REPORT", txt)
    if PREVIEW:
        with open(os.path.join(PREVIEW, "report.json"), "w", encoding="utf-8") as fh:
            fh.write(txt)


main()
