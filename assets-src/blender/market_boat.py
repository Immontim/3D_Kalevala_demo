"""Markkinapaikan kauppalaiva: rantaan teloille vedetty klinkkerilaiva, masto kahtena vaihtoehtona,
lasti, telat ja airo. Vie tiedoston assets/market_boat.glb; peli sijoittelee mallit nimen mukaan.

Esikuva: Saaremaan Salmen laivat (Viro, n. 700–750 jKr.): limisaumaiset laudat rautaniiteillä,
köli, kevyet kaaret, soutuhangat, irrotettava masto ja yksi raakapurje. Keulapuun päässä on
pelkistetty hirvenpää (karjalaisten kalliopiirrosten veneet; Kalevalan "hirvipää"), ei lohikäärmettä.

Käyttää homestead.py:n rakentajaa (HB), household.py:n apuja ja materiaaleja (HH,
make_household_materials) sekä smithy.py:n apureita (mount, face_dir). Aja taustalla:

    blender --background --factory-startup --python assets-src/blender/market_boat.py

Vientikansio: KALEVALA_ASSETS_OUT. Esikatselukuvat (viennin jälkeen uudelleen tuodusta GLB:stä):
KALEVALA_PREVIEW=<polku ilman päätettä>. Tekstuurien välikansio: KALEVALA_TEXDIR (rinnakkaisajot).

Koordinaatit: Z ylös, keula -Y (pelissä +Z), mitat metreinä. **Kaikilla tämän tiedoston solmuilla
airoa lukuun ottamatta on sama origo: kölin keskikohta maan tasossa telojen alla.** Kölin alapinta on
z = 0,16 eli telojen yläpinnan korkeudella; peli sijoittaa siis laivan, telat, maston ja lastin yhdellä
ja samalla muunnoksella. Vene seisoo telojen päällä vaakatasossa: maaston pitää olla laivan alla
tasainen (telat ovat maan tasossa, z = 0..0,16).

Veneessä keulaan (-Y) katsovan oikea käsi on -X:n puolella; ohjausmela on siis perässä (+Y) -X-laidalla.

- laiva: runko, köli ja keula- ja peräpuu, kaaret, tuhdot, lattialaudat, mastonkenkä, hankapuut ja
  -tapit sekä ohjausmela. Pituus kaikkiaan noin 11,6 m (peräpuun ulkoreuna y = +5,6, hirvenpään turpa
  y = -6,08; nostettu ohjausmela ulottuu y = +6,28:aan), leveys 2,5 m (laitojen ulkopinta x = ±1,25
  keskellä). Laidan yläreuna keskellä z = 1,16 (1,0 m kölin alapinnasta) ja nousee päihin noin 1,7 m:iin;
  peräpuun yläpää z = 2,11, hirvenpää 2,42 (lapiosarvien kärjet 2,58). Kuusi limittäistä lautakerrosta kummallakin puolella,
  niittirivit tekstuurissa. Kaaret y = ±0,45, ±1,35, ±2,25, ±3,15. Viisi tuhtoa y = -2,6, -1,3, 0, 1,3,
  2,6, yläpinta z = 0,82 (keskimmäinen on mastotuhto, jossa maston reikä). Lattialaudat y -2,6..2,6
  noin z 0,34..0,55. Mastonkenkä (0; 0), yläpinta z = 0,42. Hankatapit tuhtojen kohdalla 0,35 m
  perään päin (soutaja istuu kasvot perään). Ohjausmela on nostettu: varsi lähes vaakasuorassa
  (8° alaspäin perään), lapa ylöspäin perän takana, alin kohta z noin 1,05; varsi x noin -0,78 ja
  ohjauspinna ulottuu laidan yli x -0,32:een. Tyhjät pisteet: `mount_keula` (hirvenpään keskellä; valo, efektit) ja
  `mount_lautta` (maassa perän vieressä +X-puolella, (1,6; 3,9; 0); laivalauta tai maihinnousukohta).
  Törmäys: laatikko x -1,3..1,3, y -4,6..4,6 ja ympyrät (0; -5,2) ja (0; 5,1) säde 0,6; ohjausmela
  laatikkona x -0,9..-0,5, y 4,3..6,3. Laivan sisälle ei kävellä (laita 1,16 m).
- laiva_masto: pystymasto (juuri z = 0,42 mastonkengässä, latva z = 7,75), raaka x-suunnassa z = 6,9
  (pituus 5,5 m) ja sen ympärille kääritty raitapurje (villa, punaruskea ja luonnonvalkoinen), etu- ja
  takaharus keula- ja peräpuuhun, kaksi sivuharusta laitoihin ja nostoköysi. Oma solmu, jotta peli
  voi piilottaa tai vaihtaa sen.
- laiva_masto_laskettu: sama masto laskettuna pituussuunnassa tuhtojen päälle (x = -0,25) ja raaka
  purjekääröineen sen vieressä (x = +0,24). Käytä joko tätä tai `laiva_masto`a, ei molempia.
- laiva_lasti: kaksi nahkasäkkiä keulapuolen tuhtojen välissä (x ±0,47, y noin -1,9, yläpää alle
  tuhtojen tason, jotta laskettu masto mahtuu päälle), taljakäärö (y 0,65) ja köysivyyhti (0,38; 1,95)
  lattialaudoilla. Oma solmu, jotta peli voi piilottaa sen.
- laiva_telat: kolme kuorellista telaa (pituus 3,0 m, halkaisija 0,16 m) poikittain y = -2,4, 0, 2,4
  sekä kaksi haarapukkia laidan alla (+X-puolella y = -1,2, -X-puolella y = 1,2; jalat x noin ±1,75).
  Törmäys: haarapukit ympyröinä (säde 0,15); telat voi jättää ilman törmäystä.
- airo: pituus 3,6 m, oma origo airon kahvan päässä, lapa suuntaan -Y (kahva y = 0, lapa y -2,5..-3,6,
  leveys 0,16). Lepää vaakatasossa lapa lappeellaan. Peli voi monistaa sen (esim. nojalleen laitaa
  vasten tai laivan sisälle tuhtojen päälle).
"""
import bpy, bmesh, math, os, random, json
import numpy as np
from mathutils import Vector, Matrix

_HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else r"C:\Data\3D Kalevala\assets-src\blender"
# smithy.py ilman pääohjelmaa: se lukee itse cairnfield.py:n, homestead.py:n ja household.py:n
exec(open(os.path.join(_HERE, "smithy.py"), encoding="utf-8").read().rsplit('\nif __name__ == "__main__":', 1)[0])

TEXDIR = os.environ.get("KALEVALA_TEXDIR", TEXDIR)
OUT = os.environ.get("KALEVALA_ASSETS_OUT", OUT)
GLB_NAME = "market_boat.glb"

# ---------- rungon mitat ----------
KB = 0.16            # kölin alapinta (= telan yläpinta)
KD = 0.16            # kölin ja keulapuun korkeus (sisäänpäin)
RBT = 0.10           # lautojen kiinnityslinja (rabbet) kölin ulkopinnasta sisään
YF = 3.0             # kölin suora osa |y| <= YF
EA, EB = 2.6, 1.95   # keula- ja peräpuun ulkokaaren puoliakselit (y, z)
RA, RZ = EA - RBT, EB - RBT
ZR = KB + RBT        # kiinnityslinjan korkeus suoralla kölillä
ZG0 = 1.16           # laidan yläreuna keskellä
ZS = 1.70            # laidan yläreuna keula- ja peräpuussa
PHS = math.acos(1 - (ZS - ZR) / RZ)          # laidan pää keulapuulla
YE = YF + RA * math.sin(PHS)
ZK1 = 0.50                                    # alimman laudan (kölilaudan) pää keulapuulla
PHK = math.acos(1 - (ZK1 - ZR) / RZ)
YK1 = YF + RA * math.sin(PHK)
CK = YE - YK1
BH = 1.25            # puolileveys keskellä
NSTR = 6             # lautakerroksia
TH = 0.022           # limityksen porras (laudan paksuus)
TI = 0.02            # sisäpinta ulkopinnasta
RW, RH = 0.07, 0.06  # laidan yläpuun leveys ja korkeus
FD = 0.05            # kaaren paksuus
FRAMES_Y = [-3.15, -2.25, -1.35, -0.45, 0.45, 1.35, 2.25, 3.15]
THWARTS_Y = [-2.6, -1.3, 0.0, 1.3, 2.6]
THW_Z, THW_T, THW_W = 0.82, 0.05, 0.22
MAST_Z0, MAST_Z1 = 0.42, 7.75
YARD_Z, YARD_L = 6.9, 5.5
NU = 64


def smooth(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def mir(p):
    return V((-p[0], p[1], p[2]))


# ---------- rungon muoto ----------
def rab(phi):
    """Kiinnityslinja keula- tai peräpuulla kulmassa phi: (|y|, z)."""
    return (YF + RA * math.sin(phi), ZR + RZ * (1 - math.cos(phi)))


def rab_z(ya):
    if ya <= YF:
        return ZR
    return rab(math.asin(min(1.0, (ya - YF) / RA)))[1]


def half_b(sa):
    return BH * max(0.0, 1 - sa ** 2.3) ** 1.05


def S(s, t):
    """Rungon perusmuoto: s -1..1 keulasta perään, t 0 (köli) .. 1 (laidan yläreuna). Oikea puoli (+X).
    Pituussuunta ja korkeus Coonsin pinnalla (köli, laidan yläreuna, keula- ja peräpuun kaari),
    leveys poikkileikkausfunktiolla (keskellä pyöreä pohja ja levenevä laita, päissä V)."""
    sa = min(1.0, abs(s))
    sg = 1.0 if s >= 0 else -1.0
    q = 1.55 - 0.45 * sa * sa
    a = 0.25 + 0.55 * sa * sa
    T = t ** q
    f = a * t + (1 - a) * (2 * t - t * t)
    yk = YE * sa - CK * sa ** 3
    k = (yk, rab_z(yk))
    g = (YE * sa, ZG0 + (ZS - ZG0) * sa ** 2.4)
    y = (1 - T) * k[0] + T * g[0]
    z = (1 - T) * k[1] + T * g[1]
    w = smooth(0.55, 1.0, sa)
    if w > 0:
        d = rab(PHK + (PHS - PHK) * T)
        y += w * (d[0] - ((1 - T) * YK1 + T * YE))
        z += w * (d[1] - ((1 - T) * ZK1 + T * ZS))
    return V((half_b(sa) * f, sg * y, z))


def N(s, t):
    """Ulospäin osoittava normaali (oikea puoli)."""
    e = 1e-3
    sc = max(-0.99, min(0.99, s))
    tc = max(0.02, min(1.0, t))
    t0, t1 = max(0.0, tc - e), min(1.0, tc + e)
    Ss = S(sc + e, tc) - S(sc - e, tc)
    St = S(sc, t1) - S(sc, t0)
    n = Ss.cross(St)
    return n.normalized()


def St_dir(s, t):
    e = 1e-3
    return (S(s, min(1, t)) - S(s, max(0, t - 2 * e))).normalized()


def at_y(y, t):
    """s, jolla rungon piste korkeusparametrilla t on tasossa y."""
    ya = abs(y)
    lo, hi = 0.0, 0.999
    for _ in range(40):
        m = (lo + hi) / 2
        if S(m, t).y < ya:
            lo = m
        else:
            hi = m
    return (lo + hi) / 2 * (1 if y >= 0 else -1)


def tstr(i):
    return i / NSTR


def outer_pt(s, t, i=None):
    """Ulkopinnan piste: laudan alareuna (w=0) on portaan verran ulompana."""
    if i is None:
        i = min(NSTR - 1, int(t * NSTR + 1e-9))
    w = t * NSTR - i
    return S(s, t) + N(s, t) * TH * (1 - w)


def inner_pt(s, t):
    p = S(s, t) - N(s, t) * TI
    p.x = max(0.002, p.x)
    return p


def section_poly(y, fn):
    """Poikkileikkaus tasossa y (oikea puoli) lautarivien kohdalta: [(x, z)] alhaalta ylös."""
    out = []
    for i in range(NSTR + 1):
        t = tstr(i)
        p = fn(at_y(y, t), t)
        out.append((p.x, p.z))
    return out


def x_at_z(poly, z):
    for (x0, z0), (x1, z1) in zip(poly[:-1], poly[1:]):
        if z0 <= z <= z1:
            k = (z - z0) / max(1e-6, z1 - z0)
            return x0 + (x1 - x0) * k
    return poly[-1][0] if z > poly[-1][1] else poly[0][0]


def z_at_x(poly, x):
    for (x0, z0), (x1, z1) in zip(poly[:-1], poly[1:]):
        if x0 <= x <= x1:
            k = (x - x0) / max(1e-6, x1 - x0)
            return z0 + (z1 - z0) * k
    return poly[-1][1] if x > poly[-1][0] else poly[0][1]


def outer_x_at(y, z):
    pts = []
    for i in range(NSTR):
        s0, s1 = at_y(y, tstr(i)), at_y(y, tstr(i + 1))
        pts.append(S(s0, tstr(i)) + N(s0, tstr(i)) * TH)
        pts.append(S(s1, tstr(i + 1)))
    return x_at_z([(p.x, p.z) for p in pts], z)


# ---------- tekstuurit ja materiaalit ----------
def hull_px(w=512, h=256, seed=7):
    """Laivan lauta: u = 1 m pituutta, v = laudan leveys. Tervattu ruskea puu, syyt pituussuuntaan,
    alareunan limityksen varjo ja rautaniittirivi alareunan tuntumassa (kuusi niittiä metrillä)."""
    rs = np.random.RandomState(seed)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    v, u = yy / h, xx / w
    warp = tile_noise(rs, w, h, 3, 2, 6) * 6
    g = np.zeros((h, w), dtype=np.float32)
    for f, a in ((7, 0.5), (19, 0.3), (47, 0.18), (90, 0.1)):
        g += a * np.sin(2 * np.pi * f * (yy + warp) / h + rs.uniform(0, 6.28) + tile_noise(rs, w, h, 4, 1, 4) * 2.5)
    g /= 1.1
    base = 0.5 + 0.1 * g + tile_noise(rs, w, h, 3, 2, 8) * 0.1 + rs.normal(0, 0.012, (h, w))
    # oksankohdat
    for _ in range(2):
        cx, cy = rs.uniform(0, w), rs.uniform(0.3, 0.8) * h
        dx = np.minimum(np.abs(xx - cx), w - np.abs(xx - cx))
        d = np.sqrt((dx / 9) ** 2 + ((yy - cy) / 7) ** 2)
        base *= 1 - 0.35 * np.exp(-d * d)
    edge = np.clip(1 - v / 0.07, 0, 1) ** 1.5 * 0.55 + np.clip((v - 0.94) / 0.06, 0, 1) * 0.3
    base *= 1 - edge
    col = np.stack([base * 0.78, base * 0.56, base * 0.36], axis=-1)
    hgt = 0.5 + 0.15 * g - edge * 0.8
    # niitit
    ru, rv = 0.012, 0.042
    for k in range(6):
        cu = (k + 0.5) / 6 + rs.uniform(-0.012, 0.012)
        cv = 0.16 + rs.uniform(-0.01, 0.01)
        du = np.minimum(np.abs(u - cu), 1 - np.abs(u - cu)) / ru
        dv = (v - cv) / rv
        d = np.sqrt(du * du + dv * dv)
        head = np.clip(1 - d, 0, 1)
        halo = np.clip(1 - np.abs(d - 1.35) / 0.5, 0, 1) * 0.5
        iron = np.array([0.11, 0.09, 0.08], dtype=np.float32) * (0.8 + 0.6 * head[..., None])
        rust = np.array([0.36, 0.2, 0.11], dtype=np.float32)
        m = (head > 0)[..., None]
        col = np.where(m, iron, col * (1 - halo[..., None]) + rust * halo[..., None])
        hgt = hgt + np.sqrt(head) * 0.9
    return col.astype(np.float32), height_to_normal(hgt.astype(np.float32), 4.0)


def sail_px(size=256, seed=12):
    """Villapurje: punaruskeat ja luonnonvalkoiset raidat v-suunnassa (yksi pari metrillä),
    rullan poimut u-suunnassa ja karkea villan kudos."""
    rs = np.random.RandomState(seed)
    lin = load_px(os.path.join(DL, "tex_rough_linen", "rough_linen_diff_1k.jpg"), size)
    lnor = load_px(os.path.join(DL, "tex_rough_linen", "rough_linen_nor_1k.jpg"), size)
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    v, u = yy / size, xx / size
    ph = (v * 1 + tile_noise(rs, size, size, 1, 2, 4) * 0.012) % 1.0
    red = (ph < 0.5).astype(np.float32)
    soft = np.clip(np.minimum(np.abs(ph - 0.5), np.minimum(ph, 1 - ph)) / 0.01, 0, 1)
    c_red = np.array([0.38, 0.14, 0.085], dtype=np.float32)
    c_wht = np.array([0.66, 0.6, 0.48], dtype=np.float32)
    col = c_wht + (c_red - c_wht) * red[..., None]
    col *= (0.85 + 0.15 * soft)[..., None]
    fold = 0.5 + 0.5 * np.sin(2 * np.pi * (u * 5 + tile_noise(rs, size, size, 2, 3, 6) * 0.6))
    fold = fold ** 3
    lum = lin.mean(axis=-1, keepdims=True)
    col = col * (0.75 + 0.35 * lum / max(1e-3, float(lum.mean()))) * (1 - 0.35 * fold[..., None])
    return np.clip(col, 0, 1).astype(np.float32), lnor


def make_boat_materials():
    make_household_materials()               # wood, bark, birch, plain (+ käyttämättömät)
    hd, hn = hull_px()
    sd, sn = sail_px()
    ld = load_px(os.path.join(DL, "tex_brown_leather", "brown_leather_diff_1k.jpg"), 512)
    ln = load_px(os.path.join(DL, "tex_brown_leather", "brown_leather_nor_1k.jpg"), 512)
    MATS.update({
        "hull": pbr("M_MK_Laivalauta", save_px(hd, "mk_hull_diff"), save_px(hn, "mk_hull_nor", "Non-Color"), rough=0.8),
        "sail": pbr("M_MK_Purje", save_px(sd, "mk_sail_diff"), save_px(sn, "mk_sail_nor", "Non-Color"), rough=1.0),
        "leather": pbr("M_MK_Nahka", save_px(ld, "mk_leather_diff"), save_px(ln, "mk_leather_nor", "Non-Color"), rough=0.75),
    })


# ---------- apurit ----------
def sheet(b, P, UV, mat, color, smooth_=True, out=None):
    """Nelikulmioverkko riveistä P[r][c] (jaetut verteksit). out(p) = haluttu normaalin suunta;
    kääntö ratkaistaan koko arkin enemmistöllä."""
    rows, cols = len(P), len(P[0])
    P = [[V(p) for p in row] for row in P]
    flip = False
    if out is not None:
        acc = 0.0
        for r in range(rows - 1):
            for c in range(cols - 1):
                a, bq, cc, d = P[r][c], P[r][c + 1], P[r + 1][c + 1], P[r + 1][c]
                n = (bq - a).cross(d - a) + (cc - bq).cross(d - bq)
                acc += n.dot(V(out((a + P[r + 1][c + 1]) / 2)))
        flip = acc < 0
    vs = [[b.bm.verts.new(p) for p in row] for row in P]
    mi = b.mi(mat)
    for r in range(rows - 1):
        for c in range(cols - 1):
            idx = [(r, c), (r, c + 1), (r + 1, c + 1), (r + 1, c)]
            if flip:
                idx = idx[::-1]
            try:
                f = b.bm.faces.new([vs[i][j] for i, j in idx])
            except ValueError:
                continue
            f.material_index = mi
            f.smooth = smooth_
            for l, (i, j) in zip(f.loops, idx):
                l[b.uv].uv = UV[i][j]
                l[b.col] = b._c(color, P[i][j])


def hexa(b, lo, hi, mat, color, tile=0.3, grain=None):
    """Kuusitahokas: lo ja hi ovat neljän pisteen renkaat (sama kiertosuunta)."""
    lo, hi = [V(p) for p in lo], [V(p) for p in hi]
    c = sum(lo + hi, V((0, 0, 0))) / 8
    def ua(n):
        if grain is None:
            return None
        g, n = V(grain).normalized(), n.normalized()
        u = g.cross(n)
        return u if u.length > 0.3 else None
    for ring in (lo, hi):
        rc = sum(ring, V((0, 0, 0))) / 4
        face_dir(b, ring, rc - c, mat, color, tile, uaxis=ua(rc - c))
    for i in range(4):
        j = (i + 1) % 4
        q = [lo[i], lo[j], hi[j], hi[i]]
        o = (q[0] + q[2]) / 2 - c
        face_dir(b, q, o, mat, color, tile, uaxis=ua(o))


def obox(b, c, ax, ay, az, hx, hy, hz, mat, color, tile=0.3, grain=None):
    """Suunnattu laatikko: keskipiste c, akselit ax, ay, az, puolimitat."""
    c, ax, ay, az = V(c), V(ax), V(ay), V(az)
    ring = lambda sz: [c + ax * sx * hx + ay * sy * hy + az * sz * hz for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    hexa(b, ring(-1), ring(1), mat, color, tile, grain)


def etube(b, pts, ax1, ax2, r1, r2, mat, sides, color, vtile=0.8, urep=1.0, caps=True):
    """Soikea putki suoraa tai kaarevaa polkua pitkin; poikkileikkauksen akselit ax1, ax2 annetaan
    joka pisteelle (tai yhteiset), säteet r1, r2 listoina."""
    pts = [V(p) for p in pts]
    n = len(pts)
    A1 = ax1 if isinstance(ax1, list) else [V(ax1)] * n
    A2 = ax2 if isinstance(ax2, list) else [V(ax2)] * n
    rings, vacc, vs = [], 0.0, []
    for i, p in enumerate(pts):
        if i:
            vacc += (p - pts[i - 1]).length
        vs.append(vacc / vtile)
        rings.append([p + A1[i] * math.cos(k / sides * math.tau) * r1[i] + A2[i] * math.sin(k / sides * math.tau) * r2[i]
                      for k in range(sides)])
    P = [r + [r[0]] for r in rings]
    UV = [[(k / sides * urep, vs[i]) for k in range(sides + 1)] for i in range(n)]
    axis = pts[-1] - pts[0]
    sheet(b, P, UV, mat, color, True, out=lambda p: p - closest_on(pts, p))
    if caps:
        for ring, d in ((rings[0], -(pts[1] - pts[0])), (rings[-1], pts[-1] - pts[-2])):
            cc = color(ring[0]) if callable(color) else color
            face_dir(b, ring, d, mat, tuple(min(1, x * 1.12) for x in cc), 0.3)


def closest_on(pts, p):
    best, bd = pts[0], 1e9
    for a, c in zip(pts[:-1], pts[1:]):
        d = c - a
        k = max(0.0, min(1.0, (p - a).dot(d) / max(1e-9, d.length_squared)))
        q = a + d * k
        if (q - p).length < bd:
            best, bd = q, (q - p).length
    return best


def rope(b, a, c, r=0.011, color=(0.55, 0.45, 0.3), sag=0.0, n=1):
    a, c = V(a), V(c)
    pts = [a.lerp(c, i / n) - V((0, 0, sag * 4 * (i / n) * (1 - i / n))) for i in range(n + 1)]
    b.tube(pts, r, "plain", 5, color, vtile=0.3, caps=False)


# ---------- laiva ----------
S_GRID = [u * (1.15 - 0.15 * u * u) for u in [-1 + 2 * k / NU for k in range(NU + 1)]]


def hull_tint(seed):
    rng = random.Random(seed)
    tones = [rng.uniform(0.86, 1.05) for _ in range(NSTR)]

    def fn(p, i):
        k = tones[i] * (0.72 + 0.28 * smooth(0.2, 1.1, p[2])) * (0.9 + 0.1 * nz(p, 1.3, seed))
        return (k, k * 0.97, k * 0.93)
    return fn


def arclen(pts):
    out, acc = [0.0], 0.0
    for a, c in zip(pts[:-1], pts[1:]):
        acc += (c - a).length
        out.append(acc)
    return out


def build_hull(b):
    """Ulkolaudat portaineen, sisäpinta ja laidan yläpuu, kummallekin puolelle."""
    tint_r, tint_l = hull_tint(3), hull_tint(5)
    Sg = S_GRID
    cache = {}

    def SN(s, t):
        key = (round(s, 6), round(t, 6))
        if key not in cache:
            cache[key] = (S(s, t), N(s, t))
        return cache[key]

    for side, tint in ((1, tint_r), (-1, tint_l)):
        tf = (lambda p: p) if side > 0 else mir
        # ulkolaudat
        for i in range(NSTR):
            t0, t1 = tstr(i), tstr(i + 1)
            lo = [SN(s, t0)[0] + SN(s, t0)[1] * TH for s in Sg]
            hi = [SN(s, t1)[0] for s in Sg]
            mid = [(a + c) / 2 for a, c in zip(lo, hi)]
            U = arclen(mid)
            P = [[tf(p) for p in lo], [tf(p) for p in hi]]
            UV = [[(u, 0.0) for u in U], [(u, 1.0) for u in U]]
            sheet(b, P, UV, "hull", lambda p, i=i: tint(p, i), True,
                  out=lambda p, side=side: V((side * abs(p.x) * 4 + 0.0, 0, 0)) + V((0, 0, p.z - 1.3)))
            if i > 0:                      # porras alemman laudan yläreunan ja tämän alareunan välillä
                top_prev = [SN(s, t0)[0] for s in Sg]
                P = [[tf(p) for p in top_prev], [tf(p) for p in lo]]
                UV = [[(u, 0.0) for u in U], [(u, 0.035) for u in U]]
                sheet(b, P, UV, "hull", (0.45, 0.42, 0.4), False,
                      out=lambda p, s_=side: V((0, 0, -1)) + V((s_ * 0.3, 0, 0)))
        # sisäpinta
        rows = []
        for i in range(NSTR + 1):
            t = tstr(i)
            rows.append([inner_pt(s, t) for s in Sg])
        U = arclen([(a + c) / 2 for a, c in zip(rows[2], rows[3])])
        P = [[tf(p) for p in r] for r in rows]
        UV = [[(u, -i) for u in U] for i in range(NSTR + 1)]
        in_col = lambda p: tuple(k * (0.72 + 0.22 * smooth(0.25, 0.9, p[2])) * (0.92 + 0.08 * nz(p, 1.7, 2.0)) for k in (1.0, 0.95, 0.88))
        sheet(b, P, UV, "hull", in_col, True, out=lambda p, s_=side: V((-s_ * abs(p.x) * 4, 0, 0)) + V((0, 0, 1.3 - p.z)))
        # laidan yläpuu: kansi, sisäsivu, alapinta
        A, Qt, Qb, Bn = [], [], [], []
        for s in Sg:
            s1, n1 = SN(s, 1.0)
            h = V((n1.x, n1.y, 0)).normalized() if V((n1.x, n1.y, 0)).length > 1e-6 else V((1, 0, 0))
            q = s1 - h * RW
            q.x = max(0.002, q.x)
            std = St_dir(s, 1.0)
            bn = s1 - n1 * TI - std * (RH / max(0.3, std.z))
            bn.x = max(0.002, bn.x)
            qb = q - V((0, 0, RH))
            A.append(s1)
            Qt.append(q)
            Qb.append(qb)
            Bn.append(bn)
        U = arclen(A)
        rail_c = lambda p: (0.62 * (0.9 + 0.1 * nz(p, 2.0, 7.0)), 0.5, 0.38)
        for r0, r1, want, vv in ((A, Qt, (0, 0, 1), 0.07), (Qt, Qb, None, 0.06), (Qb, Bn, (0, 0, -1), 0.07)):
            P = [[tf(p) for p in r0], [tf(p) for p in r1]]
            UV = [[(0.0, u) for u in U], [(vv / 0.3, u) for u in U]]
            if want is None:
                o = lambda p, s_=side: V((-s_, 0, 0))
            else:
                o = lambda p, w_=want: V(w_)
            sheet(b, P, UV, "wood", rail_c, True, out=o)


def stem_path():
    """Kölin ja keula- ja peräpuun ulkoreuna: [(piste, sisäänpäin osoittava normaali, puolileveys)]."""
    out = []
    for sg, rng_ in ((-1, range(14, -1, -1)), (1, range(0, 15))):
        if sg > 0:
            for yy in (-1.5, 0.0, 1.5):
                out.append((V((0, yy, KB)), V((0, 0, 1)), 0.055))
        for k in rng_:
            phi = k / 14 * math.pi / 2
            p = V((0, sg * (YF + EA * math.sin(phi)), KB + EB * (1 - math.cos(phi))))
            n = V((0, -sg * EB * math.sin(phi), EA * math.cos(phi))).normalized()
            out.append((p, n, 0.055 - 0.01 * k / 14))
    return out


def build_stem(b):
    path = stem_path()
    O = [p for p, n, w in path]
    I = [p + n * KD for p, n, w in path]
    W = [w for p, n, w in path]
    U = arclen(O)
    kc = lambda p: (0.55 * (0.9 + 0.1 * nz(p, 2.0, 3.0)), 0.44, 0.33)
    ox = lambda P_, sx: [p + V((sx * w, 0, 0)) for p, w in zip(P_, W)]
    faces = [(ox(O, 1), ox(O, -1), lambda p: V((0, 0, -1)) if abs(p.y) < YF else V((0, p.y, -0.3))),     # ulkoreuna
             (ox(I, -1), ox(I, 1), lambda p: V((0, 0, 1)) if abs(p.y) < YF else V((0, -p.y, 0.3))),     # sisäreuna
             (ox(O, 1), ox(I, 1), lambda p: V((1, 0, 0))),
             (ox(O, -1), ox(I, -1), lambda p: V((-1, 0, 0)))]
    for r0, r1, o in faces:
        sheet(b, [r0, r1], [[(0, u) for u in U], [(0.3, u) for u in U]], "wood", kc, False, out=o)
    # peräpuun yläpään kansi (keulassa jatkuu hirvenpää)
    p, n, w = path[-1]
    q = p + n * KD
    face_dir(b, [p + V((w, 0, 0)), p + V((-w, 0, 0)), q + V((-w, 0, 0)), q + V((w, 0, 0))], (0, 0, 1), "wood", kc, 0.2)


HEAD = [(-5.43, 2.05), (-5.61, 2.05), (-5.635, 2.14), (-5.67, 2.20), (-5.70, 2.205), (-5.725, 2.12), (-5.755, 2.10),
        (-5.775, 2.19), (-5.84, 2.215), (-5.95, 2.205), (-6.02, 2.205), (-6.045, 2.235), (-6.08, 2.25), (-6.085, 2.30),
        (-6.05, 2.335), (-5.97, 2.33), (-5.88, 2.355), (-5.80, 2.39), (-5.72, 2.42), (-5.65, 2.41), (-5.59, 2.36),
        (-5.52, 2.27), (-5.46, 2.15)]
HEAD_BULK = [(-5.68, 2.215), (-5.84, 2.225), (-5.95, 2.215), (-6.015, 2.215), (-6.035, 2.24), (-6.07, 2.255),
             (-6.075, 2.30), (-6.045, 2.327), (-5.97, 2.322), (-5.88, 2.347), (-5.80, 2.382), (-5.72, 2.41),
             (-5.655, 2.40), (-5.62, 2.34)]
MUZZLE = [(-5.965, 2.222), (-6.012, 2.222), (-6.03, 2.244), (-6.062, 2.258), (-6.066, 2.298), (-6.04, 2.32), (-5.97, 2.316)]
# lapiomaiset sarvet: (ulospäin, taaksepäin) sarven tasossa, piikit yläreunassa
ANTLER = [(0.0, -0.025), (0.09, -0.05), (0.19, -0.085), (0.25, -0.1), (0.29, -0.08), (0.255, -0.055), (0.31, -0.03),
          (0.27, -0.008), (0.315, 0.025), (0.265, 0.04), (0.28, 0.08), (0.22, 0.07), (0.14, 0.045), (0.06, 0.03), (0.0, 0.022)]


def extrude(b, prof, hw, mat, color):
    """Sivuprofiili (y, z) pursotettuna x-suunnassa paksuuteen 2*hw."""
    R = [V((hw, y, z)) for y, z in prof]
    L = [V((-hw, y, z)) for y, z in prof]
    face_dir(b, R, (1, 0, 0), mat, color, 0.4)
    face_dir(b, L, (-1, 0, 0), mat, color, 0.4)
    n = len(prof)
    area = sum(prof[i][0] * prof[(i + 1) % n][1] - prof[(i + 1) % n][0] * prof[i][1] for i in range(n))
    sg = 1 if area > 0 else -1
    for i in range(n):
        j = (i + 1) % n
        q = [R[i], R[j], L[j], L[i]]
        e = R[j] - R[i]
        face_dir(b, q, V((0, e.z, -e.y)) * sg, mat, color, 0.4)


def plate(b, origin, A, B, prof, th, mat, color):
    """Litteä levy: profiili (a, b) tasossa origin + A*a + B*b, paksuus th normaalin suuntaan."""
    A, B = V(A).normalized(), V(B)
    B = (B - A * B.dot(A)).normalized()
    n = A.cross(B)
    P0 = [V(origin) + A * a + B * b_ - n * th / 2 for a, b_ in prof]
    P1 = [p + n * th for p in P0]
    face_dir(b, P1, n, mat, color, 0.3)
    face_dir(b, P0, -n, mat, color, 0.3)
    c = sum(P0, V((0, 0, 0))) / len(P0)
    k = len(prof)
    area = sum(prof[i][0] * prof[(i + 1) % k][1] - prof[(i + 1) % k][0] * prof[i][1] for i in range(k))
    for i in range(k):
        j = (i + 1) % k
        e = P0[j] - P0[i]
        o = e.cross(n) * (1 if area < 0 else -1)
        face_dir(b, [P0[i], P0[j], P1[j], P1[i]], o, mat, color, 0.3)


def build_head(b):
    hc = lambda p: (0.6 * (0.88 + 0.12 * nz(p, 9.0, 1.0)), 0.47, 0.34)
    extrude(b, HEAD, 0.046, "wood", hc)
    extrude(b, HEAD_BULK, 0.064, "wood", hc)
    extrude(b, MUZZLE, 0.078, "wood", hc)
    for sx in (1, -1):
        # leveät korvat sivuille ja hieman taakse
        base, tip = V((sx * 0.055, -5.685, 2.405)), V((sx * 0.19, -5.63, 2.45))
        etube(b, [base, base.lerp(tip, 0.45), tip], V((0, 0, 1)), V((0, 1, 0)).cross(tip - base).normalized(),
              [0.012, 0.01, 0.004], [0.04, 0.042, 0.006], "wood", 4, hc, vtile=0.3, caps=False)
        # lapiosarvet korvien takana
        plate(b, V((sx * 0.05, -5.655, 2.415)), V((sx * 1.0, 0.25, 0.55)), V((0, 1, 0.25)), ANTLER, 0.026, "wood", hc)
        # silmä
        e0 = V((sx * 0.0655, -5.79, 2.355))
        ring = [e0 + V((0, math.cos(k / 6 * math.tau) * 0.016, math.sin(k / 6 * math.tau) * 0.013)) for k in range(6)]
        face_dir(b, ring, (sx, 0, 0), "plain", (0.08, 0.06, 0.05), 0.2)


def frame_rows(y):
    """Kaaren pisteet tasossa y: sisäpinta ja kaaren sisäreuna, oikealta laidalta kölin yli vasemmalle."""
    inn, top = [], []
    for i in range(NSTR + 1):
        t = tstr(i)
        s = at_y(y, t)
        p = inner_pt(s, t) - N(s, t) * 0.004
        n = N(s, t)
        q = p - n * FD
        p.x, q.x = max(0.0, p.x), max(0.0, q.x)
        inn.append(p)
        top.append(q)
    return inn, top


def build_frames(b):
    fc = lambda p: (0.66 * (0.88 + 0.12 * nz(p, 3.0, 5.0)), 0.55, 0.42)
    tops = {}
    for y in FRAMES_Y:
        inn, top = frame_rows(y)
        tops[y] = [(q.x, q.z) for q in top]
        # yksi kaari laidasta laitaan: vasen yläpää -> köli -> oikea yläpää; viimeinen piste laidan yläpuun alle
        A = [mir(p) for p in reversed(inn[1:])] + inn
        B = [mir(p) for p in reversed(top[1:])] + top
        dy = V((0, 0.03, 0))
        L = arclen(A)
        rows_side = lambda off: ([p + off for p in A], [q + off for q in B])
        a0, b0 = rows_side(-dy)
        a1, b1 = rows_side(dy)
        UV = [[(0, l) for l in L], [(0.2, l) for l in L]]
        sheet(b, [b0, b1], UV, "wood", fc, False, out=lambda p, y=y: V((0, y, 1.4)) - p)
        sheet(b, [a0, b0], UV, "wood", fc, False, out=lambda p: V((0, -1, 0)))
        sheet(b, [a1, b1], UV, "wood", fc, False, out=lambda p: V((0, 1, 0)))
    return tops


def frame_top_z(tops, x, y):
    """Kaarien yläreunan korkeus kohdassa (x, y), lineaarisesti kaarien välillä."""
    ys = FRAMES_Y
    xa = abs(x)
    if y <= ys[0]:
        return z_at_x(tops[ys[0]], xa)
    if y >= ys[-1]:
        return z_at_x(tops[ys[-1]], xa)
    for y0, y1 in zip(ys[:-1], ys[1:]):
        if y0 <= y <= y1:
            k = (y - y0) / (y1 - y0)
            return z_at_x(tops[y0], xa) * (1 - k) + z_at_x(tops[y1], xa) * k


BOARDS = [(0.10, 0.36), (0.375, 0.62)]
BOARD_Y = (-2.45, 2.45)
BT = 0.025


def floor_z(tops, x, y):
    xa = min(max(abs(x), BOARDS[0][0]), BOARDS[-1][1])
    ys = [y_ for y_ in FRAMES_Y if BOARD_Y[0] - 0.5 < y_ < BOARD_Y[1] + 0.5]
    return max(frame_top_z(tops, xa, y_) for y_ in ys if abs(y_ - y) < 0.95) + BT


def build_floor(b, tops):
    bc = lambda p: tuple(k * (0.88 + 0.12 * nz(p, 2.5, 11.0)) for k in (1.0, 0.93, 0.85))
    ys = [BOARD_Y[0]] + [y for y in FRAMES_Y if BOARD_Y[0] < y < BOARD_Y[1]] + [BOARD_Y[1]]
    for side in (1, -1):
        for x0, x1 in BOARDS:
            def zz(x, y):
                yy = min(max(y, -2.25), 2.25)
                ref = [y_ for y_ in FRAMES_Y if abs(y_ - yy) < 0.92 and abs(y_) < 2.3]
                return max(frame_top_z(tops, x, y_) for y_ in ref) + 0.002
            lo0 = [V((side * x0, y, zz(x0, y))) for y in ys]
            lo1 = [V((side * x1, y, zz(x1, y))) for y in ys]
            hi0 = [p + V((0, 0, BT)) for p in lo0]
            hi1 = [p + V((0, 0, BT)) for p in lo1]
            # laivalaudan tekstuuri ilman niittejä ja reunavarjoja (v 0,32..0,9)
            v0 = 0.32 + 0.1 * ((x0 * 7) % 1.0) * 0.3
            UV = [[(y + x0 * 3, v0) for y in ys], [(y + x0 * 3, v0 + 0.55) for y in ys]]
            sheet(b, [hi0, hi1], UV, "hull", bc, False, out=lambda p: V((0, 0, 1)))
            sheet(b, [lo0, hi0], [[(y, 0.0) for y in ys], [(y, 0.06) for y in ys]], "hull", bc, False, out=lambda p, s_=side: V((-s_, 0, 0)))
            sheet(b, [lo1, hi1], [[(y, 0.0) for y in ys], [(y, 0.06) for y in ys]], "hull", bc, False, out=lambda p, s_=side: V((s_, 0, 0)))
            for k, d in ((0, -1), (-1, 1)):
                face_dir(b, [lo0[k], lo1[k], hi1[k], hi0[k]], (0, d, 0), "hull", bc, 0.2)


def build_thwarts(b):
    tc = lambda p: (0.6 * (0.87 + 0.13 * nz(p, 2.0, 13.0)), 0.48, 0.36)
    for y in THWARTS_Y:
        polys = [section_poly(y + dy, inner_pt) for dy in (-THW_W / 2, THW_W / 2)]
        z0, z1 = THW_Z - THW_T, THW_Z
        xs0 = min(x_at_z(p, z0) for p in polys) + 0.012
        xs1 = min(x_at_z(p, z1) for p in polys) + 0.012
        lo = [V((-xs0, y - THW_W / 2, z0)), V((xs0, y - THW_W / 2, z0)), V((xs0, y + THW_W / 2, z0)), V((-xs0, y + THW_W / 2, z0))]
        hi = [V((-xs1, y - THW_W / 2, z1)), V((xs1, y - THW_W / 2, z1)), V((xs1, y + THW_W / 2, z1)), V((-xs1, y + THW_W / 2, z1))]
        hexa(b, lo, hi, "wood", tc, 0.4, grain=(1, 0, 0))
        # tuhdon kannattimet: lyhyet tukipuut laitaa vasten (polvet)
        for sx in (1, -1):
            pz = THW_Z - 0.30
            xk = x_at_z(section_poly(y, inner_pt), pz)
            p0 = V((sx * (xk - 0.01), y, pz))
            p1 = V((sx * (xs0 - 0.16), y, z0 - 0.005))
            p2 = V((sx * (xs0 - 0.02), y, z0 - 0.005))
            b.tube([p0, p1.lerp(p2, 0.3)], [0.03, 0.03], "wood", 4, tc, vtile=0.4, caps=True)
        if abs(y) < 1e-6:        # maston reikä mastotuhdossa
            c = V((0, 0, z1 + 0.002))
            ring = [c + V((math.cos(k / 8 * math.tau) * 0.105, math.sin(k / 8 * math.tau) * 0.105, 0)) for k in range(8)]
            face_dir(b, ring, (0, 0, 1), "plain", (0.06, 0.05, 0.04), 0.2)


def build_mast_step(b):
    sc = lambda p: (0.6, 0.5, 0.38)
    frustum(b, (0, 0, 0.30), 0.18, 1.1, 0.16, 1.0, 0.0, 0.12, "wood", sc, tile=0.4)
    c = V((0, 0, 0.422))
    ring = [c + V((math.cos(k / 8 * math.tau) * 0.09, math.sin(k / 8 * math.tau) * 0.09, 0)) for k in range(8)]
    face_dir(b, ring, (0, 0, 1), "plain", (0.06, 0.05, 0.04), 0.2)


def sheer_frame(y):
    """Laidan yläpuun kannen keskikohta ja suunta kohdassa y (oikea puoli)."""
    s = at_y(y, 1.0)
    s1, n1 = S(s, 1.0), N(s, 1.0)
    h = V((n1.x, n1.y, 0)).normalized()
    m = s1 - h * RW / 2
    e = 1e-3
    tg = (S(s + e, 1.0) - S(s - e, 1.0)).normalized()
    return m, h, tg


def build_tholes(b):
    tc = lambda p: (0.6, 0.5, 0.38)
    for y in THWARTS_Y:
        yt = y + 0.35
        for sx in (1, -1):
            m, h, tg = sheer_frame(yt)
            up = tg.cross(h).normalized()
            if up.z < 0:
                up = -up
            if sx < 0:
                m, h, tg, up = mir(m), mir(h), mir(tg), mir(up)
            obox(b, m + up * 0.03, h, tg, up, 0.036, 0.17, 0.032, "wood", tc, 0.3, grain=tg)
            base = m + up * 0.06
            b.tube([base, base + V((0, 0, 0.14))], [0.018, 0.014], "wood", 5, (0.55, 0.46, 0.35), vtile=0.3)


RUD_P = V((0, 4.5, 1.36))       # ohjausmelan kiinnityskohta (x lasketaan rungosta)
RUD_ANG = math.radians(8)


def sheer_z(y):
    return S(at_y(y, 1.0), 1.0).z


def build_rudder(b):
    xh = outer_x_at(RUD_P.y, RUD_P.z)
    d = V((0, math.cos(RUD_ANG), -math.sin(RUD_ANG)))    # varresta lapaan: perään ja hieman alas
    e = V((0, math.sin(RUD_ANG), math.cos(RUD_ANG)))     # lavan leveys: nostetussa melassa lapa ulottuu ylös (+e)
    # varren etäisyys laidasta: varsi ei saa koskea runkoon millään kohdalla
    need = xh + 0.12
    for k in range(-19, 13):
        p = RUD_P + d * (k * 0.05)
        if p.y < 5.3 and p.z < sheer_z(p.y) + 0.07:
            need = max(need, outer_x_at(p.y, min(p.z + 0.06, sheer_z(p.y))) + 0.085)
    xr = -need
    P = V((xr, RUD_P.y, RUD_P.z))
    rc = lambda p: (0.62 * (0.88 + 0.12 * nz(p, 2.0, 21.0)), 0.5, 0.37)
    top = P - d * 0.95
    # varsi
    b.tube([top, P - d * 0.2, P + d * 0.45], [0.05, 0.055, 0.05], "wood", 7, rc, vtile=0.6)
    # lapa: levenee ja ohenee reunoja kohti
    prof = [(0.35, 0.05), (0.6, 0.1), (0.95, 0.15), (1.35, 0.16), (1.72, 0.14), (1.78, 0.08)]
    cen = [P + d * k + e * (w - 0.04) for k, w in prof]
    etube(b, cen, V((1, 0, 0)), e, [0.026, 0.024, 0.022, 0.02, 0.018, 0.016], [w for k, w in prof], "wood", 6, rc, vtile=0.6)
    # ohjauspinna (kahva) sisään laidan yli
    b.tube([top + d * 0.05, top + d * 0.05 + V((0.85, 0, 0.03))], [0.03, 0.025], "wood", 5, rc, vtile=0.4)
    # kiinnityspakka laidan ulkopinnassa ja vitsaside
    x_in, x_out = -(xh - 0.03), xr + 0.03
    obox(b, V(((x_in + x_out) / 2, RUD_P.y, RUD_P.z - 0.02)), (1, 0, 0), (0, 1, 0), (0, 0, 1),
         (x_in - x_out) / 2, 0.11, 0.08, "wood", rc, 0.3)
    b.tube([P - d * 0.035, P + d * 0.035], [0.066, 0.066], "plain", 7, (0.42, 0.35, 0.24), vtile=0.2, caps=False)
    return xr


def build_laiva(col):
    b = HH("laiva", 301)
    build_hull(b)
    build_stem(b)
    build_head(b)
    tops = build_frames(b)
    build_floor(b, tops)
    build_thwarts(b)
    build_mast_step(b)
    build_tholes(b)
    build_rudder(b)
    ob = b.finish(col)
    mount(col, ob, "mount_keula", (0, -5.85, 2.32))
    mount(col, ob, "mount_lautta", (1.6, 3.9, 0.0))
    return ob, tops


# ---------- masto ----------
def mast_geo(b, p0, p1, r0=0.10, r1=0.065):
    mc = lambda p: (0.66 * (0.9 + 0.1 * nz(p, 1.5, 31.0)), 0.55, 0.42)
    p0, p1 = V(p0), V(p1)
    pts = [p0.lerp(p1, k) for k in (0.0, 0.08, 0.5, 0.92, 1.0)]
    rs = [r0, r0 * 0.99, (r0 + r1) / 2, r1 * 1.02, r1 * 0.85]
    b.tube(pts, rs, "wood", 8, mc, vtile=1.2)
    # latvan köysiuurre (kiinnityskohta): tumma rengas
    d = (p1 - p0).normalized()
    b.tube([p1 - d * 0.32, p1 - d * 0.22], [r1 * 1.25, r1 * 1.25], "plain", 8, (0.5, 0.41, 0.28), vtile=0.2, caps=True)


def yard_and_sail(b, c, ax, up, seed=4):
    """Raaka keskipisteessä c akselin ax suuntaan ja sen ympärille kääritty purje (rulla raa'an alla)."""
    c, ax, up = V(c), V(ax).normalized(), V(up).normalized()
    side = ax.cross(up).normalized()
    yc = lambda p: (0.62, 0.52, 0.4)
    yp = [c + ax * k for k in (-YARD_L / 2, -1.5, 0.0, 1.5, YARD_L / 2)]
    b.tube(yp, [0.036, 0.055, 0.066, 0.055, 0.036], "wood", 7, yc, vtile=1.0)
    rng = random.Random(seed)
    n = 18
    L = 4.7
    pts, r1, r2, a1, a2 = [], [], [], [], []
    for i in range(n + 1):
        k = i / n
        x = -L / 2 + L * k
        env = math.sin(math.pi * (0.04 + 0.92 * k)) ** 0.4
        r = 0.065 + 0.085 * env * (0.92 + 0.16 * rng.random())
        pts.append(c + ax * x - up * (0.045 + 0.02 * env) + side * 0.01 * math.sin(k * 7))
        r1.append(r * 1.05)
        r2.append(r * 0.92)
        a1.append(side)
        a2.append(up)
    etube(b, pts, a1, a2, r1, r2, "sail", 10, lambda p: (0.95 + 0.05 * nz(p, 4.0, seed),) * 3, vtile=1.0, urep=1.0, caps=True)
    # sitomaköydet
    for k in (0.1, 0.27, 0.44, 0.61, 0.78, 0.92):
        i = k * n
        i0 = int(i)
        f = i - i0
        p = pts[i0].lerp(pts[min(n, i0 + 1)], f)
        rr = (r1[i0] * (1 - f) + r1[min(n, i0 + 1)] * f) * 1.06
        b.tube([p - ax * 0.025, p + ax * 0.025], [rr, rr], "plain", 10, (0.5, 0.41, 0.28), vtile=0.2, caps=False)


def mast_top():
    return V((0, 0, MAST_Z1))


def build_masto(col):
    b = HH("laiva_masto", 401)
    mast_geo(b, (0, 0, MAST_Z0), (0, 0, MAST_Z1))
    yc = V((0, -0.135, YARD_Z))
    yard_and_sail(b, yc, (1, 0, 0), (0, 0, 1))
    rc = (0.5, 0.41, 0.28)
    tz = MAST_Z1 - 0.27
    # etuharus keulapuuhun, takaharus peräpuuhun
    for sg in (-1, 1):
        phi = math.radians(78)
        p = V((0, sg * (YF + EA * math.sin(phi) - 0.08), KB + EB * (1 - math.cos(phi))))
        rope(b, V((0, sg * 0.06, tz)), p, 0.012, rc)
    # sivuharukset laidan yläpuuhun maston takana
    for sx in (1, -1):
        m, h, tg = sheer_frame(0.75)
        if sx < 0:
            m = mir(m)
        rope(b, V((sx * 0.06, 0.03, tz)), m + V((0, 0, 0.01)), 0.012, rc)
    # nostoköysi raa'alta latvan kautta mastotuhtoon
    rope(b, yc + V((0, 0, 0.05)), V((0, -0.08, MAST_Z1 - 0.05)), 0.011, rc)
    rope(b, V((0, 0.075, MAST_Z1 - 0.05)), V((0.0, 0.12, THW_Z + 0.01)), 0.011, rc)
    return b.finish(col)


def build_masto_laskettu(col):
    b = HH("laiva_masto_laskettu", 402)
    L = MAST_Z1 - MAST_Z0
    xm, yfoot = -0.25, 3.35
    r0, r1 = 0.10, 0.065
    p0 = V((xm, yfoot, THW_Z + r0 + 0.002))
    p1 = V((xm, yfoot - L, THW_Z + r1 + 0.002))
    mast_geo(b, p0, p1, r0, r1)
    yc = V((0.24, -0.15, THW_Z + 0.228))
    yard_and_sail(b, yc, (0, 1, 0), (0, 0, 1), seed=9)
    # harukset kerättynä vyyhdeksi tuhdolle maston viereen
    coil(b, V((-0.66, 1.3, THW_Z + 0.006)), 0.17, 0.03, 3, 0.012, 21)
    return b.finish(col)


def coil(b, c, R, rise, turns, r, seed, color=(0.55, 0.45, 0.3)):
    rng = random.Random(seed)
    n = int(turns * 12)
    pts = []
    for i in range(n + 1):
        a = i / 12 * math.tau
        rr = R * (1 + 0.06 * math.sin(a * 2.3 + rng.random())) - 0.012 * (i / 12)
        pts.append(V(c) + V((math.cos(a) * rr, math.sin(a) * rr, rise * i / n)))
    b.tube(pts, r, "plain", 5, color, vtile=0.25, caps=True)


# ---------- lasti ----------
SACK_PROF = [(0.0, 0.0), (0.82, 0.0), (1.0, 0.12), (0.97, 0.38), (0.8, 0.6), (0.5, 0.78), (0.24, 0.88), (0.2, 0.93)]


def sack(b, c, R0, H, tilt, yaw, seed):
    """Nahkasäkki: painunut, kapeneva pussi, ryppyinen kaula, nyörisidos ja röyhelö suulla.
    Pohja on c:n korkeudella; säkki kallistuu kulmaan tilt suuntaan yaw."""
    c = V(c)
    R = Matrix.Rotation(yaw, 3, 'Z') @ Matrix.Rotation(tilt, 3, 'Y')
    m = len(SACK_PROF) - 1

    def prof(v):
        i = min(m - 1, int(v * m))
        f = v * m - i
        (r0, z0), (r1, z1) = SACK_PROF[i], SACK_PROF[i + 1]
        return r0 + (r1 - r0) * f, z0 + (z1 - z0) * f

    def fn(u, v):
        a = u * math.tau
        r, z = prof(v)
        d = V((math.cos(a), math.sin(a), z))
        k = 1 + 0.13 * nz(d * 1.0, 2.0, seed) + 0.05 * nz(d, 6.0, seed)
        k *= 1 + 0.12 * math.cos(7 * a + seed) * max(0.0, z - 0.55) / 0.4      # kaulan rypyt
        sx = 1.15 if z < 0.5 else 1.0                                          # painunut, leveämpi pohja
        return c + R @ V((math.cos(a) * r * R0 * k * sx, math.sin(a) * r * R0 * k, z * H))
    lc = lambda p: (0.84 + 0.1 * nz(p, 5.0, seed), 0.76, 0.64)
    b.grid(fn, 12, m, "leather", lc, uvfn=lambda u, v: (u * 2.0, v * 1.0))
    top = c + R @ V((0, 0, 0.93 * H))
    up = R @ V((0, 0, 1))
    b.tube([top - up * 0.03, top + up * 0.05, top + up * 0.09], [0.2 * R0 * 1.02, 0.3 * R0, 0.42 * R0], "leather", 7, lc, vtile=0.3, caps=False)
    b.tube([top - up * 0.035, top + up * 0.0], [0.22 * R0 * 1.08, 0.22 * R0 * 1.08], "plain", 7, (0.42, 0.34, 0.24), vtile=0.2, caps=False)


def build_lasti(col, tops):
    b = HH("laiva_lasti", 501)
    for x, y, r0, h, tilt, yaw, sd in ((0.47, -1.98, 0.19, 0.37, 0.2, 0.15, 1), (-0.48, -1.86, 0.18, 0.34, 0.26, math.pi - 0.2, 2)):
        z = floor_z(tops, x, y)
        sack(b, (x, y, z - 0.015), r0, h, tilt, yaw, sd)
    # taljakäärö poikittain lattialla
    y = 0.65
    zc = floor_z(tops, 0.45, y)
    pts = [V((x, y, zc + 0.125 + 0.01 * math.sin(x * 9))) for x in (-0.62, -0.4, 0.0, 0.4, 0.62)]
    lc = lambda p: (0.8 + 0.1 * nz(p, 4.0, 7.0), 0.66, 0.5)
    b.tube(pts, [0.11, 0.135, 0.14, 0.135, 0.11], "leather", 9, lc, vtile=0.5)
    for x in (-0.3, 0.3):
        b.tube([V((x - 0.02, y, zc + 0.125)), V((x + 0.02, y, zc + 0.125))], [0.15, 0.15], "plain", 9, (0.45, 0.37, 0.26), vtile=0.2, caps=False)
    # köysivyyhti
    coil(b, V((0.38, 1.95, floor_z(tops, 0.38, 1.95) + 0.015)), 0.2, 0.06, 3.5, 0.016, 31)
    return b.finish(col)


# ---------- telat ja tuet ----------
ROLLERS_Y = [-2.4, 0.0, 2.4]


def build_telat(col):
    b = HH("laiva_telat", 601)
    for k, y in enumerate(ROLLERS_Y):
        mat = "birch" if k == 1 else "bark"
        rng = random.Random(70 + k)
        pts = [V((x, y + 0.012 * math.sin(x * 2 + k), 0.08)) for x in (-1.5, -0.75, 0.0, 0.75, 1.5)]
        col_ = (0.92, 0.92, 0.92) if mat == "birch" else (0.85, 0.8, 0.76)
        b.tube(pts, [0.078, 0.08, 0.08, 0.08, 0.079], mat, 8, col_, vtile=0.8, urep=1.0, caps=False)
        for p, d in ((pts[0], -1), (pts[-1], 1)):
            ring = [p + V((0, math.cos(i / 8 * math.tau) * 0.079, math.sin(i / 8 * math.tau) * 0.079)) for i in range(8)]
            face_dir(b, ring, (d, 0, 0), "wood", (0.78, 0.68, 0.52), 0.2)
    # haarapukit: jalka maassa, haara laidan ulkopintaa vasten
    for sx, y in ((1, -1.2), (-1, 1.2)):
        F = lambda p, sx=sx: V((sx * p.x, p.y, p.z))
        zc = 0.55
        xh = outer_x_at(y, zc)
        crotch = V((xh + 0.07, y, zc - 0.07))
        foot = V((xh + 0.55, y + 0.05, -0.04))
        tc = (0.8, 0.76, 0.7)
        b.tube([F(foot), F(foot.lerp(crotch, 0.5) + V((0.02, 0, 0))), F(crotch)], [0.05, 0.045, 0.04], "bark", 6, tc, vtile=0.8)
        for dy in (-1, 1):
            zt = zc + 0.03
            tip = V((outer_x_at(y + dy * 0.09, zt) + 0.012, y + dy * 0.09, zt))
            b.tube([F(crotch), F(crotch.lerp(tip, 0.5) + V((0.015, 0, 0.0))), F(tip)], [0.035, 0.028, 0.022], "bark", 5, tc, vtile=0.5)
    return b.finish(col)


# ---------- airo ----------
def build_airo(col):
    b = HH("airo", 701)
    ac = lambda p: (0.7 * (0.9 + 0.1 * nz(p, 3.0, 41.0)), 0.6, 0.46)
    b.tube([V((0, 0, 0)), V((0, -0.14, 0)), V((0, -0.17, 0))], [0.021, 0.022, 0.022], "wood", 6, ac, vtile=0.4)
    b.tube([V((0, -0.17, 0)), V((0, -0.2, 0)), V((0, -1.3, 0)), V((0, -2.45, 0))], [0.026, 0.036, 0.034, 0.028], "wood", 6, ac, vtile=0.8, caps=False)
    prof = [(-2.45, 0.028, 0.026), (-2.6, 0.05, 0.02), (-2.9, 0.074, 0.014), (-3.4, 0.078, 0.012), (-3.6, 0.05, 0.01)]
    etube(b, [V((0, y, 0)) for y, w, t in prof], V((1, 0, 0)), V((0, 0, 1)), [w for y, w, t in prof], [t for y, w, t in prof],
          "wood", 6, ac, vtile=0.6)
    return b.finish(col)


# ---------- kokoaminen ja vienti ----------
def build_market_boat(export=True):
    col = bpy.data.collections.get("GAME")
    if not col:
        col = bpy.data.collections.new("GAME")
        bpy.context.scene.collection.children.link(col)
    for o in list(col.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    make_boat_materials()
    laiva, tops = build_laiva(col)
    obs = [laiva, build_masto(col), build_masto_laskettu(col), build_lasti(col, tops), build_telat(col), build_airo(col)]
    bpy.context.view_layer.update()
    out = {}
    for o in obs:
        xs = [v.co for v in o.data.vertices]
        me = o.data
        me.calc_loop_triangles()
        out[o.name] = {"tris": len(me.loop_triangles),
                       "min": [round(min(c[i] for c in xs), 2) for i in range(3)],
                       "max": [round(max(c[i] for c in xs), 2) for i in range(3)]}
    out["tris_total"] = sum(v["tris"] for v in out.values())
    rv = [v.co for v in laiva.data.vertices if v.co.x < -0.3 and v.co.y > 3.4 and v.co.z > 0.9]
    out["ohjausmela"] = {"min": [round(min(c[i] for c in rv), 2) for i in range(3)], "max": [round(max(c[i] for c in rv), 2) for i in range(3)]}
    if export:
        out["glb_mb"] = export_market_boat()
    return out


def export_market_boat():
    col = bpy.data.collections["GAME"]
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    objs = list(col.objects)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    path = os.path.join(OUT, GLB_NAME)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True,
        export_image_format='WEBP', export_image_quality=82,
        export_vertex_color='NAME', export_vertex_color_name='Col', export_all_vertex_colors=False,
        export_apply=True, export_animations=False, export_yup=True,
        export_cameras=False, export_lights=False,
    )
    return round(os.path.getsize(path) / 1e6, 2)


# ---------- esikatselu viedystä GLB:stä ----------
def preview_from_glb(prefix):
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(OUT, GLB_NAME))
    obs = {o.name: o for o in bpy.data.objects}
    info = {}
    for o in obs.values():
        if o.type == 'MESH':
            o.data.calc_loop_triangles()
            info[o.name] = len(o.data.loop_triangles)
    sc = bpy.context.scene
    gm = bpy.data.materials.new("pv_g")
    gm.diffuse_color = (0.55, 0.5, 0.38, 1)
    gm.use_nodes = True
    gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.42, 0.37, 0.26, 1)
    ground = bpy.data.meshes.new("pv_ground")
    bm = bmesh.new()
    bm.faces.new([bm.verts.new(p) for p in ((-40, -40, 0.0), (40, -40, 0.0), (40, 40, 0.0), (-40, 40, 0.0))])
    bm.to_mesh(ground)
    ground.materials.append(gm)
    sc.collection.objects.link(bpy.data.objects.new("pv_ground", ground))
    rm = bpy.data.materials.new("pv_ref")
    rm.use_nodes = True
    rm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.1, 0.15, 0.5, 1)
    poles = []
    for nm, loc in (("pv_pylvas", (2.4, -2.0, 0.9)), ("pv_istuja", (0.6, -1.3, 0.0))):
        if nm == "pv_istuja":
            # istuva hahmo tuhdolla: lantio tuhdon päällä, pää noin 0,9 m tuhdon yläpuolella
            bpy.ops.mesh.primitive_cylinder_add(radius=0.17, depth=0.9, location=(0.6, -1.3, THW_Z + 0.45))
        else:
            bpy.ops.mesh.primitive_cylinder_add(radius=0.2, depth=1.8, location=loc)
        o = bpy.context.active_object
        o.name = nm
        o.data.materials.append(rm)
        poles.append(o)
    sun = bpy.data.objects.new("pv_sun", bpy.data.lights.new("pv_sun", 'SUN'))
    sun.data.energy = 4
    sun.rotation_euler = (0.85, 0.15, 0.9)
    sc.collection.objects.link(sun)
    wd = bpy.data.worlds.new("pv_world")
    wd.use_nodes = True
    wd.node_tree.nodes["Background"].inputs[0].default_value = (0.7, 0.78, 0.85, 1)
    wd.node_tree.nodes["Background"].inputs[1].default_value = 1.0
    sc.world = wd
    cam = bpy.data.objects.new("pv_cam", bpy.data.cameras.new("pv_cam"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = 1600, 900
    airo = obs.get("airo")
    if airo:
        airo.location = (2.6, 1.8, 0.036)
    # kaikki pelin mallit rivissä erikseen (vain kuva "rivi")
    sets = {
        "pysty": {"laiva", "laiva_masto", "laiva_lasti", "laiva_telat", "airo"},
        "lask": {"laiva", "laiva_masto_laskettu", "laiva_lasti", "laiva_telat", "airo"},
        "runko": {"laiva", "laiva_telat"},
        "sisus": {"laiva", "laiva_lasti", "laiva_telat"},
    }
    shots = [
        ("koko", "pysty", (0, 0, 2.6), (13.0, -15.0, 6.5), 30, False),
        ("sivu", "pysty", (0, 0, 2.5), (-26.0, 0.0, 2.4), 40, False),
        ("sivu_lask", "lask", (0, 0, 1.0), (-22.0, 0.0, 1.2), 45, False),
        ("keula", "pysty", (0, 0, 2.2), (0.6, -20.0, 1.6), 45, False),
        ("pera", "lask", (0, 2, 1.0), (-4.0, 11.0, 2.4), 32, False),
        ("sisus", "sisus", (0, 0.0, 0.6), (5.0, -8.0, 6.5), 28, True),
        ("sisus_lask", "lask", (0, 0.0, 0.6), (-5.0, -7.5, 6.8), 28, True),
        ("pelikamera", "lask", (0, 0, 0.8), (4.5, -6.0, 5.2), 26, True),
        ("hirvi", "runko", (0, -5.75, 2.25), (1.8, -7.2, 2.8), 40, False),
        ("telat", "runko", (0, -1.0, 0.4), (4.8, -4.2, 1.3), 30, False),
        ("airo", "pysty", (2.6, 0.0, 0.1), (4.6, 2.6, 1.6), 30, False),
        ("ylhaalta", "pysty", (0, 0.0, 0.5), (0.0, 0.01, 30.0), 35, False),
        ("lahi", "runko", (0, -0.9, 0.5), (1.2, -2.6, 3.6), 30, False),
        ("lasti", "sisus", (0, -1.4, 0.55), (1.5, -3.5, 2.4), 32, False),
        ("keula_lahi", "runko", (0, -4.9, 1.0), (2.6, -7.4, 1.1), 35, False),
        ("lahi_pera", "runko", (-0.4, 4.3, 1.2), (-3.2, 2.2, 2.8), 30, False),
    ]
    only = os.environ.get("KALEVALA_SHOTS")
    if only:
        shots = [s_ for s_ in shots if s_[0] in only.split(",")]
    for name, key, tgt, pos, lens, sit in shots:
        vis = sets[key]
        for n_, o in obs.items():
            root = o
            while root.parent:
                root = root.parent
            if o.type == 'MESH':
                o.hide_render = root.name not in vis
        poles[1].hide_render = not sit
        poles[0].hide_render = name in ("hirvi", "ylhaalta")
        cam.location = V(pos)
        cam.rotation_euler = (V(tgt) - V(pos)).to_track_quat('-Z', 'Y').to_euler()
        cam.data.lens = lens
        sc.render.filepath = prefix + "_" + name + ".png"
        bpy.ops.render.render(write_still=True)
    return info


if __name__ == "__main__":
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    res = build_market_boat(export=os.environ.get("KALEVALA_NO_EXPORT") is None)
    print("RESULT_JSON " + json.dumps(res))
    pv = os.environ.get("KALEVALA_PREVIEW")
    if pv:
        print("GLB_TRIS " + json.dumps(preview_from_glb(pv)))
