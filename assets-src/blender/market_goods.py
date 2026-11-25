"""Markkinapaikan kauppatavarat: kimpiastiat (nassakat, suolakalatynnyrit), viljakorit,
maavaate tavaroineen ja kuivakalanippu. Vie tiedoston assets/market_goods.glb; peli sijoittelee
mallit nimen mukaan.

Käyttää smithy.py:n apuja (frustum, grid_out, face_dir, rock), household.py:n apuja (HH, lathe,
weave_px) ja homestead.py:n rakentajaa (HB) ilman, että smithy.py:n pääohjelma ajetaan. Aja
taustalla:

    blender --background --factory-startup --python assets-src/blender/market_goods.py

Vientikansio: KALEVALA_ASSETS_OUT. Esikatselukuvat (tuodaan viedystä GLB:stä):
KALEVALA_PREVIEW=<polku ilman päätettä>. Tekstuurikansio: KALEVALA_TEXDIR (rinnakkaisajoihin).

Historia: rautakaudella astiat ovat kimpiastioita puu- tai vitsavanteilla. Kaikissa astioissa on
vitsavanteet (kierretty katajan- tai pajunvitsa, ei rautaa), kannet ovat puulevyä.

Koordinaatit: Z ylös, mitat metreinä, etusivu -Y (pelissä +Z). **Jokaisella solmulla on oma
origo maan tasossa** (kuivakalanipulla ripustuskohdassa). Kuolleita kiinnityspisteitä ei ole.

- nassakka: pystyssä oleva pieni kimpiastia simalle tai viinille. Korkeus 0,42 m, suurin Ø 0,30 m
  (lievä pullistus), 13 kimpilautaa, kaksi vitsavannetta, kansi päällä ja puutappi kyljessä
  etupuolella (-Y). Origo pohjan keskellä. Törmäys: ympyrä, säde 0,16 m.
- nassakka_kylki: sama kyljellään kahden pikku kiilan päällä, akseli x-suunnassa (pohja -X,
  kansi +X), tappi ylhäällä. Origo kosketuspisteiden (kiilojen) keskellä maassa. Törmäys:
  laatikko x -0,22..0,22, y -0,16..0,16.
- tynnyri_suolakala: avoin kimpiastia, korkeus 0,70 m, Ø 0,55 m, 14 lautaa, kolme vitsavannetta.
  Sisällä suolatut kalat ladottuina 8 cm reunan alapuolella (z 0,62), karkea suola valkoisena.
  Kansi irrallaan nojaa kylkeen etuoikealla (suunta -55° eli -Y:stä oikealle), alareuna maassa
  noin 0,46 m:n päässä akselista. Origo pohjan keskellä. Törmäys: ympyrä, säde 0,30 m
  (kansi mukana ympyrä 0,5 m keskipisteessä (0,26; -0,37)).
- tynnyri_kiinni: sama, kansi päällä (z 0,70..0,73) ja painokivi kannella. Törmäys: ympyrä
  säde 0,29 m.
- viljakori_a: matala leveä tuohivakka, Ø 0,45 m, korkeus 0,22 m (vahvikevanne reunassa),
  ohraa kumpuna 4,5 cm reunan yli ja pari kourallista maassa edessä. Törmäys: ympyrä 0,24 m.
- viljakori_b: korkeampi tuohikori, Ø 0,32 m, korkeus 0,38 m, tummempaa ruista ja puinen
  kauha (kappa) jyvien päällä, varsi lepää korin reunalla (kauha ulottuu 0,25 m:iin oikealle
  eteen). Törmäys: ympyrä 0,17 m.
- maavaate: villakangas 2,0 x 1,4 m (x -1..1, y -0,7..0,7), pinta 1,3 cm maan yläpuolella
  (reunat 1,3 cm, rypyt enintään 3 cm; tavaroiden alla tasainen), ja päällä: 4 savi-
  ruukkua (kampakeraaminen koristelu), tuohirasia, tuohirasia jossa suolaa, nahkahihnojen
  kääre, pronssikorut (4 rannerengasta kasana ja kaularengas), kolme meripihkahelminauhaa,
  kaksi luukampaa, liuskekivinen hioinkivi ja kolme rautaharkkoa. Etusivu -Y (tavarat
  asetettu myyjän vastapuolen katsomaan). Törmäys: ei (matala); peli voi käyttää laatikkoa
  x +-1,0, y +-0,7 korkeudella 0,05.
- kuivakala_nippu: kuusi kuivattua kalaa hännistä narulla sidottuna; origo ripustuskohdassa
  (narun yläpää), kalat roikkuvat 0,44 m alaspäin pää alaspäin viuhkana (alin kärki z -0,44, viuhkana x +-0,16). Peli voi ripustaa
  telineeseen tai katokseen siirtämällä solmun orren kohtaan.
"""
import bpy, bmesh, math, os, random, json
import numpy as np
from mathutils import Vector, Matrix

_HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else r"C:\Data\3D Kalevala\assets-src\blender"
# smithy.py ilman pääohjelmaa (ketju smithy -> cairnfield -> homestead, household)
exec(open(os.path.join(_HERE, "smithy.py"), encoding="utf-8").read().rsplit('\nif __name__ == "__main__":', 1)[0])

TEXDIR = os.environ.get("KALEVALA_TEXDIR", TEXDIR)
OUT = os.environ.get("KALEVALA_ASSETS_OUT", OUT)
TAU = math.tau


# ---------- tekstuurit ----------
def smooth_noise(rs, h, w, cells):
    g = rs.rand(cells + 1, cells + 1).astype(np.float32)
    ys, xs = np.linspace(0, cells, h, endpoint=False), np.linspace(0, cells, w, endpoint=False)
    iy, ix = np.floor(ys).astype(int), np.floor(xs).astype(int)
    fy, fx = ys - iy, xs - ix
    fy, fx = (fy * fy * (3 - 2 * fy))[:, None], (fx * fx * (3 - 2 * fx))[None, :]
    a = g[np.ix_(iy, ix)] * (1 - fx) + g[np.ix_(iy, ix + 1)] * fx
    c = g[np.ix_(iy + 1, ix)] * (1 - fx) + g[np.ix_(iy + 1, ix + 1)] * fx
    return a * (1 - fy) + c * fy


def grain_px(size=256, seed=3):
    """Viljanjyvät: tiheä kasa soikeita jyviä, joissa on keskiuurre; jyvien väliset raot tummia."""
    rs = np.random.RandomState(seed)
    img = np.empty((size, size, 3), dtype=np.float32)
    img[:] = (0.46, 0.33, 0.16)
    hgt = np.zeros((size, size), dtype=np.float32)
    R = 6
    ys, xs = np.mgrid[-R:R + 1, -R:R + 1].astype(np.float32)
    for _ in range(4400):
        cx, cy = rs.randint(0, size, 2)
        ang = rs.uniform(0, math.pi)
        ca, sa = math.cos(ang), math.sin(ang)
        a, b = rs.uniform(4.0, 5.0), rs.uniform(2.1, 2.7)
        u, v = (xs * ca + ys * sa) / a, (-xs * sa + ys * ca) / b
        d = u * u + v * v
        m = d < 1.0
        shade = np.sqrt(np.clip(1 - d, 0, 1))
        groove = 1 - 0.38 * np.exp(-(v / 0.16) ** 2) * (np.abs(u) < 0.8)
        base = np.array([0.88, 0.69, 0.33], dtype=np.float32) * rs.uniform(0.82, 1.12)
        base = base * np.array([1.0, rs.uniform(0.94, 1.04), rs.uniform(0.9, 1.1)], dtype=np.float32)
        yi, xi = (cy + ys[m].astype(int)) % size, (cx + xs[m].astype(int)) % size
        col = base[None, :] * (0.62 + 0.5 * shade[m])[:, None] * groove[m][:, None]
        img[yi, xi] = col
        hgt[yi, xi] = np.maximum(hgt[yi, xi], shade[m] * groove[m])
    return np.clip(img, 0, 1), height_to_normal(hgt, 3.5)


def _stamp(img, hgt, x, y, wid, col, depth, S):
    for dy in range(-wid, wid + 1):
        for dx in range(-wid, wid + 1):
            if dx * dx + dy * dy <= wid * wid + 0.6:
                xi, yi = int(round(x)) + dx, int(round(y)) + dy
                img[yi % S, xi % S] = col
                hgt[yi % S, xi % S] -= depth


def _seg(img, hgt, x0, y0, x1, y1, wid, col, depth, S):
    n = int(max(abs(x1 - x0), abs(y1 - y0)) * 1.5) + 2
    for t in np.linspace(0, 1, n):
        _stamp(img, hgt, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, wid, col, depth, S)


def pottery_px(S=256, seed=5):
    """Savi, jonka yläosassa kampakeraaminen koriste: kampaviivat, kalanruoto, siksak ja kuoppajono.
    Rivit sijaitsevat ruukun ulkopinnan v-välillä 0,35..0,95 (0 = pohja, 1 = suun reuna)."""
    rs = np.random.RandomState(seed)
    n1 = smooth_noise(rs, S, S, 8)
    n2 = smooth_noise(rs, S, S, 32)
    k = 0.86 + 0.2 * n1 + 0.1 * n2 + rs.normal(0, 0.015, (S, S))
    img = np.stack([k * 0.66, k * 0.47, k * 0.33], axis=-1).astype(np.float32)
    hgt = (0.5 + 0.25 * n2).astype(np.float32)
    dark = np.array([0.24, 0.16, 0.11], dtype=np.float32)
    V_ = lambda f: f * S
    cols = 24
    for f in (0.93, 0.895, 0.74, 0.71, 0.44, 0.41):                 # kampaviivat
        for x in range(S * 2):
            _stamp(img, hgt, x * 0.5, V_(f), 1, dark, 0.25, S)
    for i in range(cols):                                             # kalanruoto
        x = (i + 0.5) / cols * S
        sl = 3 if i % 2 == 0 else -3
        _seg(img, hgt, x - sl, V_(0.78), x + sl, V_(0.86), 1, dark, 0.25, S)
    for i in range(cols):                                             # sikksak
        x0, x1 = i / cols * S, (i + 1) / cols * S
        ya, yb = (0.56, 0.66) if i % 2 == 0 else (0.66, 0.56)
        _seg(img, hgt, x0, V_(ya), x1, V_(yb), 1, dark, 0.25, S)
    for i in range(cols):                                             # kuopat
        _stamp(img, hgt, (i + 0.5) / cols * S, V_(0.5), 2, dark * 0.85, 0.4, S)
    return np.clip(img, 0, 1), height_to_normal(hgt, 2.5)


def wool_px(W=512, H=512, seed=2):
    """Villakangas 2,0 x 1,4 m (kuva venytetään koko kankaalle): punamultainen pohja,
    raitareuna ja kaksi poikkiraitaa; kierteinen toimikasside."""
    rs = np.random.RandomState(seed)
    X = ((np.arange(W) + 0.5) / W * 2.0)[None, :].repeat(H, 0)
    Y = ((np.arange(H) + 0.5) / H * 1.4)[:, None].repeat(W, 1)
    d = np.minimum.reduce([X, 2.0 - X, Y, 1.4 - Y])
    img = np.empty((H, W, 3), dtype=np.float32)
    img[:] = (0.5, 0.22, 0.14)
    DB, CR, MA, OC = (0.22, 0.12, 0.08), (0.82, 0.70, 0.46), (0.63, 0.27, 0.16), (0.76, 0.52, 0.2)
    for d0, d1, c in ((0.0, 0.025, DB), (0.025, 0.04, CR), (0.04, 0.075, MA), (0.075, 0.095, DB), (0.095, 0.105, OC), (0.105, 0.115, DB)):
        img[(d >= d0) & (d < d1)] = c
    dd = np.minimum(X, 2.0 - X)
    inner = (Y > 0.15) & (Y < 1.25)
    for d0, d1, c in ((0.30, 0.345, DB), (0.345, 0.36, CR), (0.36, 0.40, OC), (0.40, 0.445, DB), (0.445, 0.455, CR)):
        img[(dd >= d0) & (dd < d1) & inner] = c
    p = 0.011
    cx, cy = np.floor(X / p), np.floor(Y / p)
    fx, fy = (X / p) % 1.0, (Y / p) % 1.0
    over = ((cx - cy) % 4) < 2
    weft = np.sin(np.pi * fy) ** 0.6 * (0.62 + 0.38 * np.sin(np.pi * fx))
    warp = np.sin(np.pi * fx) ** 0.6 * (0.62 + 0.38 * np.sin(np.pi * fy))
    hgt = np.where(over, weft, warp).astype(np.float32)
    shade = 0.7 + 0.4 * hgt
    tint = 0.9 + 0.2 * smooth_noise(rs, H, W, 10) + rs.normal(0, 0.03, (H, W))
    img = img * (shade * tint)[..., None]
    return np.clip(img, 0, 1).astype(np.float32), height_to_normal(hgt, 2.0)


def make_market_materials():
    make_household_materials()          # wood, bark, clay, straw, weave, birch, plain
    d = load_px(os.path.join(DL, "tex_mossy_rock", "mossy_rock_Diffuse_1k.jpg"), 512)
    rd = np.repeat(np.clip(0.42 + 0.58 * d.mean(axis=-1, keepdims=True), 0, 1), 3, axis=-1)
    rn = load_px(os.path.join(DL, "tex_mossy_rock", "mossy_rock_nor_gl_1k.jpg"), 512)
    ld = np.clip(load_px(os.path.join(DL, "tex_brown_leather", "brown_leather_diff_1k.jpg"), 512) * np.array([1.15, 0.95, 0.78], dtype=np.float32), 0, 1)
    ln = load_px(os.path.join(DL, "tex_brown_leather", "brown_leather_nor_1k.jpg"), 512)
    plain = save_px(np.ones((8, 8, 3), dtype=np.float32), "mk_plain")
    gd, gn = grain_px()
    pd_, pn = pottery_px()
    wd_, wn = wool_px()
    MATS.update({
        "rock": pbr("M_SM_Rock", save_px(rd, "mk_rock_diff"), save_px(rn, "mk_rock_nor", "Non-Color"), rough=1.0, twosided=False),
        "leather": pbr("M_SM_Leather", save_px(ld, "mk_leather_diff"), save_px(ln, "mk_leather_nor", "Non-Color"), rough=0.75),
        "grain": pbr("M_MK_Grain", save_px(gd, "mk_grain_diff"), save_px(gn, "mk_grain_nor", "Non-Color"), rough=0.7, twosided=False),
        "pottery": pbr("M_MK_Pottery", save_px(pd_, "mk_pot_diff"), save_px(pn, "mk_pot_nor", "Non-Color"), rough=0.92, twosided=False),
        "wool": pbr("M_MK_Wool", save_px(wd_, "mk_wool_diff"), save_px(wn, "mk_wool_nor", "Non-Color"), rough=1.0),
        "bronze": pbr("M_MK_Bronze", plain, rough=0.45),
        "amber": pbr("M_MK_Amber", plain, rough=0.14),
        "fish": pbr("M_MK_Fish", plain, rough=0.38),
        "iron": pbr("M_MK_Iron", plain, rough=0.6),
    })
    MATS["bronze"].node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = 0.3
    MATS["iron"].node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = 0.3


# ---------- geometria-apurit ----------
def xform(b, M):
    bmesh.ops.transform(b.bm, matrix=M, verts=b.bm.verts[:])


def lathe_arc(b, prof, n, mat, color, c=(0, 0, 0), uscale=1.0, vlen=None, v0=0.0, rot=None, smooth=True):
    """Pyörähdyskappale profiilista [(säde, korkeus)]; UV:n v kulkee profiilin kaarenpituutta
    (m / vlen). Profiili ylöspäin = normaalit ulos, alaspäin = normaalit sisään."""
    c = V(c)
    R = rot if rot else Matrix.Identity(3)
    m = len(prof) - 1
    cum = [0.0]
    for i in range(m):
        cum.append(cum[-1] + math.hypot(prof[i + 1][0] - prof[i][0], prof[i + 1][1] - prof[i][1]))
    tot = cum[-1]
    vlen = vlen or tot

    def loc(v):
        i = min(m - 1, int(v * m + 1e-9))
        return i, v * m - i

    def fn(u, v):
        i, f = loc(v)
        r = prof[i][0] + (prof[i + 1][0] - prof[i][0]) * f
        z = prof[i][1] + (prof[i + 1][1] - prof[i][1]) * f
        a = u * TAU
        return c + R @ V((math.cos(a) * r, math.sin(a) * r, z))

    def uvfn(u, v):
        i, f = loc(v)
        return (u * uscale, v0 + (cum[i] + f * (cum[i + 1] - cum[i])) / vlen)
    b.grid(fn, n, m, mat, color, uvfn=uvfn, smooth=smooth)


def octa(b, c, r, mat, color, sq=0.8, yaw=0.0, n=6, smooth=True):
    """Pieni helmi, nuppi tai kide: n-sivuinen kaksoispyramidi (2n kolmiota), jaetut verteksit."""
    c = V(c)
    mi = b.mi(mat)
    ring = [b.bm.verts.new(c + V((math.cos(yaw + i / n * TAU) * r, math.sin(yaw + i / n * TAU) * r, 0))) for i in range(n)]
    top, bot = b.bm.verts.new(c + V((0, 0, r * sq))), b.bm.verts.new(c - V((0, 0, r * sq)))
    for i in range(n):
        j = (i + 1) % n
        for vs in ((ring[i], ring[j], top), (ring[j], ring[i], bot)):
            f = b.bm.faces.new(vs)
            f.material_index = mi
            f.smooth = smooth
            for l in f.loops:
                l[b.uv].uv = (0.0, 0.0)
                l[b.col] = b._c(color, l.vert.co)


def clip_poly(poly, axis, val, keep_ge):
    out = []
    n = len(poly)
    for i in range(n):
        a, c = poly[i], poly[(i + 1) % n]
        ina = (a[axis] >= val) if keep_ge else (a[axis] <= val)
        inc = (c[axis] >= val) if keep_ge else (c[axis] <= val)
        if ina:
            out.append(a)
        if ina != inc:
            t = (val - a[axis]) / (c[axis] - a[axis])
            out.append((a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t))
    return out


def lid(b, c, au, aw, nrm, R, t, nseg, nstrips, seed, bottom=True, tone=(0.95, 0.83, 0.66)):
    """Pyöreä puukansi: paksuus t, tasot au (lautojen suunta) ja aw, normaali nrm ylöspäin.
    nstrips lautaa vierekkäin (eri sävyt)."""
    rng = random.Random(seed)
    c, au, aw, nrm = V(c), V(au).normalized(), V(aw).normalized(), V(nrm).normalized()
    circ = [(math.cos(i / nseg * TAU) * R * (1 + 0.01 * rng.uniform(-1, 1)), math.sin(i / nseg * TAU) * R * (1 + 0.01 * rng.uniform(-1, 1))) for i in range(nseg)]
    W = lambda p, s: c + au * p[0] + aw * p[1] + nrm * (s * t / 2)
    bounds = [-R - 1] + [(-R + 2 * R * (k + 1) / nstrips) + rng.uniform(-0.02, 0.02) * R for k in range(nstrips - 1)] + [R + 1]
    for s in range(nstrips):
        poly = clip_poly(circ, 1, bounds[s], True)
        poly = clip_poly(poly, 1, bounds[s + 1], False)
        if len(poly) < 3:
            continue
        k = rng.uniform(0.7, 1.05)
        col = tuple(x * k for x in tone)
        face_dir(b, [W(p, 1) for p in poly], nrm, "wood", col, tile=0.3, uaxis=aw)
        if bottom:
            face_dir(b, [W(p, -1) for p in poly], -nrm, "wood", tuple(x * 0.8 for x in col), tile=0.3, uaxis=aw)
    for i in range(nseg):
        p0, p1 = circ[i], circ[(i + 1) % nseg]
        q = [W(p0, 1), W(p0, -1), W(p1, -1), W(p1, 1)]
        face_dir(b, q, au * (p0[0] + p1[0]) + aw * (p0[1] + p1[1]), "wood", tuple(x * 0.78 for x in tone), tile=0.3)


def hoop(b, c, z, R, r, nseg, sides, seed, tone=(0.66, 0.52, 0.34)):
    """Vitsavanne: kierretty vitsa renkaana (neliömäinen poikkileikkaus, pehmeä varjostus)."""
    rng = random.Random(seed)
    ph = rng.uniform(0, TAU)
    c = V(c)

    def fn(u, v):
        a, t = u * TAU, (v + 0.125) * TAU
        rr = R + 0.0025 * math.sin(2 * a + ph) + r * math.cos(t)
        return c + V((math.cos(a) * rr, math.sin(a) * rr, z + 0.002 * math.sin(3 * a + ph) + r * 1.15 * math.sin(t)))
    colf = lambda p: tuple(k * (0.9 + 0.14 * math.sin(math.atan2(p[1] - c.y, p[0] - c.x) * nseg * 0.5)) for k in tone)
    b.grid(fn, nseg, sides, "wood", colf, uvfn=lambda u, v: (v * 0.15, u * R * TAU / 0.25))


def kimpi(b, N, H, rf, zs, thick, seed, inner_from=None, top_ring=False, bottom=False, bed=False,
          tone=(0.93, 0.80, 0.62), inner_tone=(0.76, 0.69, 0.58)):
    """Kimpiastian seinä: N tasaista lautaa (tasokylkiä), jokaisella oma sävy; solmukorkeudet zs
    (vanteet solmujen kohdalla, jotta pullistus pysyy oikeana). Sisäseinä kohdasta inner_from ylös."""
    rng = random.Random(seed)
    ks = [rng.uniform(0.68, 1.04) for _ in range(N)]
    offs = [rng.uniform(0, 1) for _ in range(N)]
    P = lambda i, r, z: V((math.cos(i / N * TAU) * r, math.sin(i / N * TAU) * r, z))
    for i in range(N):
        k = ks[i]
        colf = lambda p, k=k: tuple(t_ * k * (0.86 + 0.14 * p[2] / H) for t_ in tone)
        for j in range(len(zs) - 1):
            z0, z1 = zs[j], zs[j + 1]
            q = [P(i, rf(z0), z0), P(i + 1, rf(z0), z0), P(i + 1, rf(z1), z1), P(i, rf(z1), z1)]
            w = (q[1] - q[0]).length / 0.3
            o = offs[i]
            b.face(q, "wood", colf, uvs=[(o, z0 / 0.3), (o + w, z0 / 0.3), (o + w, z1 / 0.3), (o, z1 / 0.3)], smooth=False)
        mid = (P(i, 1, 0) + P(i + 1, 1, 0)) / 2
        if inner_from is not None:
            q = [P(i, rf(inner_from) - thick, inner_from), P(i + 1, rf(inner_from) - thick, inner_from),
                 P(i + 1, rf(H) - thick, H), P(i, rf(H) - thick, H)]
            face_dir(b, q, -mid, "wood", tuple(t_ * k for t_ in inner_tone), tile=0.3)
        if top_ring:
            q = [P(i, rf(H), H), P(i + 1, rf(H), H), P(i + 1, rf(H) - thick, H), P(i, rf(H) - thick, H)]
            face_dir(b, q, (0, 0, 1), "wood", tuple(min(1, t_ * k * 1.12) for t_ in tone), tile=0.2)
    if bed:
        face_dir(b, [P(i, rf(inner_from) - thick - 0.002, inner_from) for i in range(N)], (0, 0, 1), "plain", (0.5, 0.52, 0.53), tile=0.3)
    if bottom:
        face_dir(b, [P(i, rf(0), 0) for i in range(N)], (0, 0, -1), "wood", tuple(t_ * 0.7 for t_ in tone), tile=0.3)


def barrel_rf(H, r0, r1, bg):
    return lambda z: r0 + (r1 - r0) * z / H + bg * 4 * (z / H) * (1 - z / H)


def peg(b, rf, N, z, dirv, rr=0.016):
    """Puutappi kyljessä suuntaan dirv (vaakasuora): tappi ja tumma reikä sen ympärillä."""
    d = V(dirv).normalized()
    ap = rf(z) * math.cos(math.pi / N)
    b.tube([d * (ap - 0.012) + V((0, 0, z)), d * (ap + 0.02) + V((0, 0, z))], [rr, rr * 0.85], "wood", 6, (1.0, 0.86, 0.64), vtile=0.1)
    s = V((0, 0, 1)).cross(d).normalized()
    u = V((0, 0, 1))
    ring = [d * (ap + 0.0025) + V((0, 0, z)) + s * math.cos(i / 8 * TAU) * (rr + 0.007) + u * math.sin(i / 8 * TAU) * (rr + 0.007) for i in range(8)]
    face_dir(b, ring, d, "plain", (0.2, 0.13, 0.08), tile=0.1)


def barrel_hoops(b, N, rf, zhs, r, nseg, seed):
    for i, z in enumerate(zhs):
        hoop(b, (0, 0, 0), z, rf(z) * math.cos(math.pi / N) + r * 0.6, r, nseg, 4, seed + i)


# ---------- nassakat ----------
def build_nassakka(col, lying=False):
    b = HH("nassakka_kylki" if lying else "nassakka", 301)
    H, N = 0.42, 13
    rf = barrel_rf(H, 0.13, 0.12, 0.025)
    zs = [0.0, 0.07, H / 2, 0.35, H]
    kimpi(b, N, H, rf, zs, 0.014, 11, bottom=lying)
    lid(b, (0, 0, H + 0.01), (1, 0, 0), (0, 1, 0), (0, 0, 1), rf(H) + 0.007, 0.02, 12, 1, 12, bottom=False)
    barrel_hoops(b, N, rf, (0.07, 0.35), 0.0065, N, 20)
    if not lying:
        peg(b, rf, N, 0.27, (0, -1, 0))
        return b.finish(col)
    peg(b, rf, N, 0.27, (-1, 0, 0))
    # kyljelleen: z -> x (kansi +X), nostettu kiilojen varaan
    lift = 0.04
    M = Matrix.Translation(V((-H / 2, 0, rf(H / 2) + lift))) @ Matrix.Rotation(math.pi / 2, 4, 'Y')
    xform(b, M)
    for dx in (-0.07, 0.07):
        zl = H / 2 + dx
        h = rf(H / 2) + lift - rf(zl) + 0.003
        frustum(b, (dx, 0, 0), 0.08, 0.11, 0.05, 0.05, 0.0, h, "wood", (0.78, 0.66, 0.5), tile=0.2)
    return b.finish(col)


# ---------- tynnyrit ----------
TH, TN = 0.70, 12
T_RF = barrel_rf(TH, 0.26, 0.24, 0.025)
T_ZS = [0.0, 0.08, 0.34, 0.60, TH]
T_HOOPS = (0.08, 0.34, 0.60)
T_FISH_Z = 0.62       # kalakerroksen yläpinta (8 cm reunan alapuolella)


def silver_fish(b, c, L, W, yaw, hz, seed):
    """Ladottu hopeinen silakka/siika: selkäharjanne ja kyljet, tumma selkä ja vaalea kylki."""
    rng = random.Random(seed)
    c = V(c)
    R = Matrix.Rotation(yaw, 3, 'Z')
    secs = [(0.5, 0.05, 0.3), (0.2, 0.46, 0.9), (-0.12, 0.5, 1.0), (-0.42, 0.12, 0.3)]
    kf = rng.uniform(0.82, 1.12)
    ridge = [c + R @ V((x * L, 0, h * hz)) for x, w, h in secs]
    left = [c + R @ V((x * L, w * W / 2, 0)) for x, w, h in secs]
    right = [c + R @ V((x * L, -w * W / 2, 0)) for x, w, h in secs]
    col = lambda p: tuple(min(1.0, ((0.12 + 0.52 * max(0.0, 1.0 - (p.z - c.z) / (hz * 0.8))) * kf + 0.22 * max(0.0, nz(p, 45.0, seed))) * k) for k in (0.95, 1.0, 1.06))
    for k in range(3):
        b.face([ridge[k], left[k], left[k + 1], ridge[k + 1]], "fish", col, 0.1, smooth=True)
        b.face([ridge[k], ridge[k + 1], right[k + 1], right[k]], "fish", col, 0.1, smooth=True)
    tail = [c + R @ V((-0.42 * L, 0, 0.002)), c + R @ V((-0.58 * L, W * 0.38, 0.002)), c + R @ V((-0.53 * L, 0, 0.002)), c + R @ V((-0.58 * L, -W * 0.38, 0.002))]
    face_dir(b, tail, (0, 0, 1), "fish", (0.4, 0.42, 0.45), tile=0.1)


def build_tynnyri(col, open_):
    b = HH("tynnyri_suolakala" if open_ else "tynnyri_kiinni", 311)
    rf = T_RF
    rng = b.rng
    zin = T_FISH_Z - 0.02
    kimpi(b, TN, TH, rf, T_ZS, 0.024, 31, inner_from=zin if open_ else None, top_ring=open_, bed=open_)
    barrel_hoops(b, TN, rf, T_HOOPS, 0.011, TN, 40)
    if not open_:
        lid(b, (0, 0, TH + 0.014), (1, 0, 0), (0, 1, 0), (0, 0, 1), rf(TH) + 0.012, 0.028, 14, 3, 32, bottom=False)
        zt = TH + 0.028
        rock(b, (0.015, -0.01, zt + 0.032), (1, 0.3, 0), (-0.3, 1, 0), 0.115, 0.09, 0.05, 321,
             lambda p: tuple(x * (0.58 + 0.12 * nz(p, 9.0, 3.0)) for x in (1.0, 0.97, 0.93)), e=0.7, nu=10, nv=5)
        return b.finish(col)
    # sisällä suolatut kalat: ulompi rengas, sisempi rengas ja keskellä yksi
    fz = T_FISH_Z - 0.026
    rin = rf(T_FISH_Z) - 0.024
    spots = []
    for i in range(9):
        a = i / 9 * TAU + 0.2
        spots.append((math.cos(a) * (rin - 0.062), math.sin(a) * (rin - 0.062), a + math.pi / 2 + rng.uniform(-0.1, 0.1), 0.165))
    for i in range(4):
        a = i / 4 * TAU + 0.6
        spots.append((math.cos(a) * 0.07, math.sin(a) * 0.07, a + math.pi / 2 + rng.uniform(-0.2, 0.2), 0.13))
    spots.append((0.0, 0.0, 0.5, 0.12))
    for i, (x, y, yaw, L) in enumerate(spots):
        silver_fish(b, (x, y, fz + 0.006 * (i % 3)), L, 0.088, yaw, 0.03, 330 + i)
    # karkeaa suolaa: kiteitä kalojen päällä
    for i in range(26):
        r = (rin - 0.02) * math.sqrt(rng.random())
        a = rng.uniform(0, TAU)
        s = rng.uniform(0.0028, 0.0052)
        g = rng.uniform(0.78, 0.95)
        octa(b, (math.cos(a) * r, math.sin(a) * r, fz + 0.03 + s * 0.2), s, "plain", (g, g, g * 0.97), sq=rng.uniform(0.4, 1.0), yaw=rng.uniform(0, 3), n=3, smooth=False)
    # kansi nojaa kylkeen etuoikealla
    th_, al = -math.radians(55), math.radians(17)
    rad = V((math.cos(th_), math.sin(th_), 0))
    aw = V((-rad.y, rad.x, 0))
    t_ = 0.028
    Rl = rf(TH) + 0.012
    zc = Rl * math.cos(al) + t_ / 2 * math.sin(al)
    ztop = zc + Rl * math.cos(al) - t_ / 2 * math.sin(al)
    crad = rf(ztop) * math.cos(math.pi / TN) + 0.011 + 0.006 + Rl * math.sin(al) + t_ / 2 * math.cos(al)
    ud = V((0, 0, math.cos(al))) - rad * math.sin(al)
    nout = rad * math.cos(al) + V((0, 0, math.sin(al)))
    lid(b, rad * crad + V((0, 0, zc)), ud, aw, nout, Rl, t_, 14, 3, 32)
    return b.finish(col)


# ---------- viljakorit ----------
def grain_mound(b, fn_h, rim_r, nu, color_seed, rho_min=0.1, nv=4, ctr=(0, 0)):
    """Jyväkumpu: ylhäältä katsottuna pyöreä, korkeus fn_h(rho, p) ja pieni kohina."""
    def fn(u, v):
        a = u * TAU
        rho = 1.0 - v * (1.0 - rho_min)
        x, y = ctr[0] + math.cos(a) * rho * rim_r, ctr[1] + math.sin(a) * rho * rim_r
        p = V((x, y, 0))
        z = fn_h(rho) + 0.007 * nz(p, 22.0, color_seed) + 0.004 * nz(p, 55.0, color_seed + 1)
        return V((x, y, z))
    return fn


def build_viljakori(col, which):
    b = HH("viljakori_a" if which == "a" else "viljakori_b", 341 if which == "a" else 351)
    rng = b.rng
    if which == "a":
        prof = [(0.15, 0.0), (0.185, 0.045), (0.21, 0.125), (0.225, 0.22)]
        zrim, rim_r, base_z, peak = 0.22, 0.225, 0.19, 0.265
        gcol = lambda p: tuple(k * (0.94 + 0.12 * nz(p, 14.0, 4.0)) for k in (1.0, 0.97, 0.92))
    else:
        prof = [(0.115, 0.0), (0.128, 0.1), (0.145, 0.25), (0.16, 0.38)]
        zrim, rim_r, base_z, peak = 0.38, 0.16, 0.345, 0.405
        gcol = lambda p: tuple(k * (0.9 + 0.12 * nz(p, 14.0, 6.0)) for k in (0.74, 0.7, 0.68))
    n = 18
    L = sum(math.hypot(prof[i + 1][0] - prof[i][0], prof[i + 1][1] - prof[i][1]) for i in range(3))
    tint = lambda p: tuple(c_ * (0.9 + 0.12 * p[2] / zrim + 0.07 * nz(p, 6.0, 2.0)) for c_ in (1.0, 0.98, 0.94))
    # ulkoseinä tuohipunosta; v kulkee korkeussuunnassa
    lathe_arc(b, prof, n, "weave", tint, uscale=prof[-1][0] * TAU / 0.18, vlen=0.18)
    lathe_arc(b, [(prof[-1][0] - 0.012, zrim), (prof[-1][0] - 0.016, base_z - 0.005)], n, "weave", (0.55, 0.5, 0.42), uscale=prof[-1][0] * TAU / 0.18, vlen=0.18)
    rr = rim_r - 0.011

    def mound_h(rho):
        return base_z + (peak - base_z) * max(0.0, 1 - rho ** 2.4) ** 0.8
    fnm = grain_mound(b, mound_h, rr, n, 7.0 if which == "a" else 8.0)
    grid_out(b, fnm, n, 4, "grain", gcol, uvfn=lambda u, v: (fnm(u, v).x / 0.3, fnm(u, v).y / 0.3), out=lambda p: (0, 0, 1))
    # keskikorkki
    cap = [V((math.cos(i / n * TAU) * 0.1 * rr, math.sin(i / n * TAU) * 0.1 * rr, peak + 0.002)) for i in range(n)]
    face_dir(b, cap, (0, 0, 1), "grain", (0.95, 0.9, 0.85), tile=0.3)
    # reunan vahvikevanne (halkaistu vitsa)
    hr = 0.012 if which == "a" else 0.011
    hoop(b, (0, 0, 0), zrim, rim_r - 0.004, hr, n, 4, 360 + (which == "b"), tone=(0.92, 0.74, 0.5))
    if which == "a":
        # vähän jyviä läikkynyt eteen maahan
        c0 = V((0.06, -0.33, 0.0))

        def spill(u, v):
            a = u * TAU
            rr_ = 0.07 * (1 - v) * (1 + 0.25 * nz((math.cos(a), math.sin(a), 3.0), 2.0, 2.0))
            return c0 + V((math.cos(a) * rr_ * 1.3, math.sin(a) * rr_, 0.004 + 0.009 * (1 - v) ** 0.7))
        grid_out(b, spill, 14, 2, "grain", (0.92, 0.9, 0.85), uvfn=lambda u, v: (spill(u, v).x / 0.3, spill(u, v).y / 0.3), out=lambda p: (0, 0, 1))
    else:
        # puinen kauha jyvien päällä; varsi kulkee korin reunan yli oikealle eteen
        P0 = V((0.025, 0.02, 0.0))
        zb = mound_h(math.hypot(P0.x, P0.y) / rr) + 0.007 - 0.004
        bo = [(0.0, 0.0), (0.035, 0.012), (0.06, 0.04), (0.066, 0.056)]
        bi = [(0.066, 0.056), (0.058, 0.056), (0.05, 0.033), (0.0, 0.018)]
        lathe_arc(b, bo, 10, "wood", (0.86, 0.7, 0.5), c=P0 + V((0, 0, zb)), uscale=2.0, vlen=0.2)
        lathe_arc(b, bi, 10, "wood", (0.6, 0.48, 0.34), c=P0 + V((0, 0, zb)), uscale=2.0, vlen=0.2)
        dv = V((0.62, -0.78, 0)).normalized()
        a0 = P0 + dv * 0.05 + V((0, 0, zb + 0.05))
        a1 = P0 + dv * 0.15 + V((0, 0, zb + 0.056 - 0.02))
        a2 = P0 + dv * 0.28 + V((0, 0, zb + 0.056 - 0.062))
        b.tube([a0, a1, a2], [0.012, 0.0105, 0.0085], "wood", 6, (0.9, 0.74, 0.54), vtile=0.2)
    return b.finish(col)


# ---------- kuivakala ----------
def dry_fish(b, base, d, L, seed, back):
    """Kuivattu kala: häntä (pyrstöevä) kohdassa base ylhäällä, pää suuntaan d alhaalla; selkä suuntaan back.
    Viisikulmainen poikkileikkaus, paksu selkä, suippeneva pyrstövarsi, haarainen pyrstöevä, selkäevä ja silmä."""
    base, d = V(base), V(d).normalized()
    u = (V(back) - d * V(back).dot(d)).normalized()
    s = d.cross(u).normalized()
    rng = random.Random(seed)
    k = rng.uniform(0.9, 1.08)
    secs = [(0.0, 0.007, 0.004), (0.14, 0.011, 0.006), (0.36, 0.03, 0.015), (0.62, 0.037, 0.018),
            (0.84, 0.028, 0.013), (0.96, 0.013, 0.007), (1.0, 0.003, 0.003)]
    rings = []
    for t, hh, ww in secs:
        c = base + d * (t * L)
        ring = []
        for i in range(5):
            a = i / 5 * TAU
            ring.append(c + u * (math.cos(a) * hh * (1.0 if math.cos(a) > 0 else 0.8)) + s * (math.sin(a) * ww))
        rings.append(ring)
    cols = [(0.3, 0.23, 0.15), (0.74, 0.62, 0.42), (0.86, 0.8, 0.66), (0.74, 0.62, 0.42), (0.3, 0.23, 0.15)]
    for ti, (a, c2) in enumerate(zip(rings, rings[1:])):
        for i in range(5):
            q = [a[i], a[(i + 1) % 5], c2[(i + 1) % 5], c2[i]]
            ctr = sum(q, V((0, 0, 0))) / 4
            axis = sum(a, V((0, 0, 0))) / 4
            sh = 0.78 if ti >= 4 else 1.0                  # pää tummempi
            face_dir(b, q, ctr - axis, "fish", tuple(x * k * sh for x in cols[i]), tile=0.1)
    dark = (0.28 * k, 0.21 * k, 0.14 * k)
    # haarainen pyrstöevä (ylhäällä)
    fin = [base + d * 0.012, base - d * 0.038 + u * 0.026, base - d * 0.022, base - d * 0.038 - u * 0.026]
    face_dir(b, fin, s, "fish", dark, tile=0.1)
    face_dir(b, fin, -s, "fish", dark, tile=0.1)
    # selkäevä kolmiona
    p0, p1, p2 = base + d * L * 0.4 + u * 0.03, base + d * L * 0.5 + u * 0.062, base + d * L * 0.62 + u * 0.037
    face_dir(b, [p0, p1, p2], s, "fish", dark, tile=0.1)
    face_dir(b, [p0, p1, p2], -s, "fish", dark, tile=0.1)
    # silmä
    for sg in (1, -1):
        e = base + d * L * 0.88 + u * 0.004 + s * sg * 0.0125
        eq = [e + u * 0.005 + d * 0.005, e + u * 0.005 - d * 0.005, e - u * 0.005 - d * 0.005, e - u * 0.005 + d * 0.005]
        face_dir(b, eq, s * sg, "fish", (0.06, 0.05, 0.04), tile=0.1)


def build_kuivakala(col):
    b = HH("kuivakala_nippu", 361)
    rng = b.rng
    b.tube([V((0, 0, 0.0)), V((0.004, 0, -0.04)), V((0, 0, -0.1))], 0.005, "plain", 4, (0.62, 0.52, 0.36), vtile=0.1, caps=False)
    lens = (0.3, 0.26, 0.34, 0.28, 0.25, 0.32)
    angs = (-40, -25, -9, 9, 25, 40)
    for i in range(6):
        be = math.radians(angs[i])
        d = V((math.sin(be), 0.0, -math.cos(be)))
        yo = (0.016 if i % 2 else -0.016)
        sg = 1 if be > 0 else -1
        dry_fish(b, V((0.0, yo, -0.1)), d, lens[i], 370 + i, (sg, 0, 0.35))
    def band(u, v):
        a, t = u * TAU, v * TAU
        return V((math.cos(a) * (0.03 + 0.005 * math.cos(t)), math.sin(a) * (0.03 + 0.005 * math.cos(t)), -0.105 + 0.005 * math.sin(t)))
    b.grid(band, 8, 3, "plain", (0.5, 0.4, 0.27))
    return b.finish(col)


# ---------- maavaate ----------
CLOTH_L, CLOTH_W = 2.0, 1.4
CZ = 0.013                 # kankaan pinta tavaroiden alla
OCC = []                   # (x, y, r): tavaroiden jalanjäljet, joiden alla kangas on tasainen


def occupy(x, y, r):
    OCC.append((x, y, r))


def cloth_z(x, y):
    w = 0.0095 * (1 + nz((x * 2.5, y * 2.5, 0.0), 1.0, 3.0)) + 0.0065 * (1 + nz((x * 4.2, y * 4.2, 1.7), 1.0, 7.0))
    de = min(CLOTH_L / 2 - abs(x), CLOTH_W / 2 - abs(y))
    w *= min(1.0, 0.35 + de / 0.2)
    m = 1.0
    for ox, oy, r in OCC:
        t = max(0.0, min(1.0, (math.hypot(x - ox, y - oy) - r) / 0.09))
        m = min(m, t * t * (3 - 2 * t))
    return CZ + w * m


def pot(b, c, r, h, kind, seed, yaw=0.0):
    """Savi-ruukku (kampakeraaminen): kind 0 korkea purkki, 1 pyöreä, 2 leveä kulho."""
    shapes = {0: [(0.55, 0.0), (0.82, 0.14), (1.0, 0.45), (0.92, 0.74), (0.66, 0.92), (0.72, 1.0)],
              1: [(0.5, 0.0), (0.82, 0.13), (1.0, 0.45), (0.95, 0.72), (0.74, 0.92), (0.78, 1.0)],
              2: [(0.5, 0.0), (0.82, 0.22), (1.0, 0.55), (1.08, 0.82), (1.12, 1.0)]}[kind]
    prof = [(a * r, z * h) for a, z in shapes]
    c = V(c)
    ro = prof[-1][0]
    cl = lambda p: tuple(k * (0.94 + 0.1 * nz(p, 10.0, seed)) for k in (1.0, 0.97, 0.95))
    n = 10
    L = sum(math.hypot(prof[i + 1][0] - prof[i][0], prof[i + 1][1] - prof[i][1]) for i in range(len(prof) - 1))
    rot = Matrix.Rotation(yaw, 3, 'Z')
    lathe_arc(b, prof, n, "pottery", cl, c=c, uscale=1.0, vlen=L, rot=rot)
    t_ = 0.012 * (r / 0.09)
    inner = [(ro, h), (ro - t_, h), (ro - t_ - 0.006, h * 0.86), (ro * 0.8, h * 0.62), (0.0, h * 0.5)]
    lathe_arc(b, inner, n, "pottery", (0.45, 0.4, 0.37), c=c, uscale=1.0, vlen=L, v0=0.02, rot=rot)
    occupy(c.x, c.y, r * 1.1)


def tuohirasia(b, c, r, h, seed, open_salt=False):
    c = V(c)
    if not open_salt:
        prof = [(r * 0.92, 0.0), (r, 0.015), (r, h * 0.62), (r * 1.1, h * 0.64), (r * 1.1, h), (0.0, h)]
        lathe_arc(b, prof, 10, "birch", (1.0, 0.92, 0.74), c=c, uscale=1.2, vlen=0.4)
    else:
        prof = [(r * 0.92, 0.0), (r, 0.015), (r, h), (r * 0.86, h), (r * 0.84, h * 0.7)]
        lathe_arc(b, prof, 10, "birch", (1.0, 0.92, 0.74), c=c, uscale=1.2, vlen=0.4)
        zb = h * 0.72

        def salt(u, v):
            a = u * TAU
            rho = 1 - v * 0.88
            x, y = math.cos(a) * rho * r * 0.84, math.sin(a) * rho * r * 0.84
            z = zb + h * 0.34 * max(0.0, 1 - rho ** 2) ** 0.7 + 0.006 * nz(V((x, y, 0)) + c, 40.0, seed)
            return c + V((x, y, z))
        face_dir(b, [c + V((math.cos(i / 10 * TAU) * r * 0.1, math.sin(i / 10 * TAU) * r * 0.1, zb + h * 0.34 + 0.004)) for i in range(10)],
                 (0, 0, 1), "plain", (0.93, 0.93, 0.9), tile=0.1)
        grid_out(b, salt, 10, 3, "plain", lambda p: tuple(0.9 + 0.08 * nz(p, 60.0, seed) for _ in range(3)),
                 uvfn=lambda u, v: (u, v), out=lambda p: (0, 0, 1))
    occupy(c.x, c.y, r * 1.15)


def leather_roll(b, c, yaw):
    c = V(c)
    r = 0.046
    R = Matrix.Rotation(yaw, 3, 'Z') @ Matrix.Rotation(math.pi / 2, 3, 'Y')
    prof = [(0.0, -0.11), (r * 0.82, -0.11), (r, -0.098), (r, 0.098), (r * 0.82, 0.11), (0.0, 0.11)]
    lathe_arc(b, prof, 8, "leather", (0.95, 0.78, 0.62), c=c + V((0, 0, r - 0.001)), uscale=2.0, vlen=0.2, rot=R)
    Rz = Matrix.Rotation(yaw, 3, 'Z')
    for dx in (-0.045, 0.045):
        cc = c + Rz @ V((dx, 0, r - 0.001))

        def wr(u, v, cc=cc):
            a, t = u * TAU, v * TAU
            rr = r + 0.003 + 0.004 * math.cos(t)
            return cc + Rz @ V((0.004 * math.sin(t), math.cos(a) * rr, math.sin(a) * rr))
        b.grid(wr, 8, 3, "leather", (0.72, 0.5, 0.32))
    # hihnan irtonainen pää kääreen alta kankaalle
    b.box(c + Rz @ V((0.02, -0.07, 0.003)), (0.22, 0.014, 0.004), "leather", (0.95, 0.72, 0.5), tile=0.2, rot=Matrix.Rotation(yaw + 0.5, 3, 'Z'))
    occupy(c.x, c.y, 0.07)
    occupy(c.x + math.cos(yaw) * 0.07, c.y + math.sin(yaw) * 0.07, 0.06)
    occupy(c.x - math.cos(yaw) * 0.07, c.y - math.sin(yaw) * 0.07, 0.06)


def ring_flat(b, c, R, r, nseg, z, gap=0.0, col=(0.72, 0.46, 0.14)):
    """Vaakasuora rengas (renkaan keskipiste c, alareuna maassa kohdassa z - r)."""
    c = V(c)
    a0 = gap / 2

    def fn(u, v):
        a, t = a0 + u * (TAU - gap), (v + 0.125) * TAU
        rr = R + r * math.cos(t)
        return c + V((math.cos(a) * rr, math.sin(a) * rr, z + r * math.sin(t)))
    b.grid(fn, nseg, 4, "bronze", col, smooth=True)


def bronze(b, cx, cy):
    z0 = CZ - 0.001
    rb, tb = 0.033, 0.0078
    pts = []
    for i in range(3):
        a = i / 3 * TAU + 0.4
        pts.append((cx + math.cos(a) * 0.0358, cy + math.sin(a) * 0.0358))
    cols = [(0.72, 0.46, 0.14), (0.66, 0.42, 0.12), (0.76, 0.5, 0.16), (0.7, 0.45, 0.13)]
    for k, (x, y) in enumerate(pts):
        ring_flat(b, (x, y, 0), rb, tb, 10, z0 + tb * 1.15, col=cols[k])
    ring_flat(b, (cx, cy, 0), rb, tb, 10, z0 + 3.1 * tb, gap=0.0, col=cols[3])
    occupy(cx, cy, 0.075)
    # kaularengas: avoin rengas, päissä nupit
    tx, ty, TR, tt = cx - 0.22, cy - 0.2, 0.085, 0.0105
    ring_flat(b, (tx, ty, 0), TR, tt, 16, z0 + tt * 1.15, gap=0.5, col=(0.72, 0.47, 0.15))
    for s in (-1, 1):
        a = 0.25 if s < 0 else TAU - 0.25
        octa(b, (tx + math.cos(a) * TR, ty + math.sin(a) * TR, z0 + tt * 1.15), tt * 1.9, "bronze", (0.78, 0.5, 0.16), sq=0.9, n=6)
    occupy(tx, ty, TR + 0.025)


def amber(b, A, B, bulge, n, seed, tone):
    rng = random.Random(seed)
    A, B = V((A[0], A[1], 0)), V((B[0], B[1], 0))
    d = B - A
    nrm = V((-d.y, d.x, 0)).normalized()
    for i in range(n):
        t = i / (n - 1)
        p = A + d * t + nrm * bulge * math.sin(math.pi * t)
        r = rng.uniform(0.0145, 0.0185) * (1.15 if i in (n // 2,) else 1.0)
        k = rng.uniform(0.88, 1.06)
        octa(b, (p.x, p.y, CZ - 0.001 + r * 0.75), r, "amber", tuple(min(1.0, c_ * k) for c_ in tone), sq=0.8, yaw=rng.uniform(0, 1), n=7)
        occupy(p.x, p.y, r + 0.01)


def comb(b, c, yaw):
    c = V(c)
    R = Matrix.Rotation(yaw, 3, 'Z')
    bone = (0.9, 0.84, 0.7)
    b.box(c + R @ V((0, 0.02, 0.0065)), (0.1, 0.022, 0.011), "plain", bone, tile=0.1, rot=R)
    for i in range(7):
        x = -0.045 + i * 0.015
        b.box(c + R @ V((x, -0.014, 0.0045)), (0.006, 0.046, 0.008), "plain", tuple(k * 0.96 for k in bone), tile=0.1, rot=R)
    occupy(c.x, c.y, 0.07)


def market_blanket(col):
    del OCC[:]
    b = HH("maavaate", 371)
    rng = b.rng
    # tavarat ensin (jalanjäljet tasoittavat kankaan), sitten kangas
    pot(b, (-0.66, 0.34, 0), 0.1, 0.25, 0, 1, 0.3)
    pot(b, (-0.38, 0.46, 0), 0.085, 0.19, 1, 2, 1.2)
    pot(b, (-0.1, 0.38, 0), 0.075, 0.11, 2, 3, 2.1)
    pot(b, (-0.45, 0.1, 0), 0.07, 0.14, 1, 4, 0.7)
    tuohirasia(b, (0.25, 0.42, CZ - 0.001), 0.065, 0.085, 5)
    tuohirasia(b, (0.52, 0.42, CZ - 0.001), 0.06, 0.07, 6, open_salt=True)
    leather_roll(b, (0.76, 0.18, CZ), 0.35)
    bronze(b, 0.5, -0.12)
    amber(b, (-0.38, -0.52), (0.0, -0.33), 0.06, 14, 11, (1.0, 0.6, 0.07))
    amber(b, (-0.34, -0.27), (-0.03, -0.14), -0.05, 13, 12, (0.96, 0.5, 0.04))
    amber(b, (-0.05, -0.62), (0.33, -0.55), -0.04, 14, 13, (1.0, 0.7, 0.14))
    comb(b, (-0.78, -0.3, CZ), 0.35)
    comb(b, (-0.72, -0.47, CZ), -0.25)
    # liuskekivinen hioinkivi
    R_ = Matrix.Rotation(0.2, 3, 'Z')
    frustum(b, (-0.1, -0.02, 0), 0.17, 0.036, 0.15, 0.03, CZ - 0.001, CZ + 0.02, "plain", (0.45, 0.46, 0.48), tile=0.1, rot=R_)
    occupy(-0.1, -0.02, 0.09)
    # kolme rautaharkkoa: kaksi vierekkäin, kolmas päällä
    for i, (dx, dy, yw, zz, cc) in enumerate(((0.0, 0.0, -0.12, 0.0, (0.3, 0.29, 0.28)), (0.0, 0.055, -0.08, 0.0, (0.4, 0.3, 0.24)),
                                                (0.0, 0.027, -0.1, 0.021, (0.28, 0.27, 0.27)))):
        Rz = Matrix.Rotation(yw, 3, 'Z')
        frustum(b, (0.72 + dx, -0.5 + dy, 0), 0.32, 0.045, 0.3, 0.04, CZ - 0.001 + zz, CZ + 0.02 + zz, "iron", cc, tile=0.1, rot=Rz)
    occupy(0.72, -0.47, 0.17)
    occupy(0.6, -0.48, 0.1)
    occupy(0.85, -0.48, 0.1)
    # kangas
    nu, nv = 20, 14

    def cloth(u, v):
        x, y = -CLOTH_L / 2 + CLOTH_L * u, -CLOTH_W / 2 + CLOTH_W * v
        return V((x, y, cloth_z(x, y)))
    grid_out(b, cloth, nu, nv, "wool", lambda p: tuple(0.94 + 0.09 * nz(p, 7.0, 3.0) for _ in range(3)),
             uvfn=lambda u, v: (u, v), out=lambda p: (0, 0, 1))
    return b.finish(col)


# ---------- kokoaminen ja vienti ----------
BUILDERS = [lambda c: build_nassakka(c, False), lambda c: build_nassakka(c, True),
            lambda c: build_tynnyri(c, True), lambda c: build_tynnyri(c, False),
            lambda c: build_viljakori(c, "a"), lambda c: build_viljakori(c, "b"),
            market_blanket, build_kuivakala]
LIMITS = {"nassakka": 450, "nassakka_kylki": 450, "tynnyri_suolakala": 900, "tynnyri_kiinni": 600,
          "viljakori_a": 700, "viljakori_b": 700, "maavaate": 3500, "kuivakala_nippu": 500}


def build_goods(export=True):
    col = bpy.data.collections.get("GAME")
    if not col:
        col = bpy.data.collections.new("GAME")
        bpy.context.scene.collection.children.link(col)
    for o in list(col.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    make_market_materials()
    obs = [f(col) for f in BUILDERS]
    bpy.context.view_layer.update()
    out = {}
    for o in obs:
        xs = [v.co for v in o.data.vertices]
        out[o.name] = {"tris": sum(len(p.vertices) - 2 for p in o.data.polygons), "limit": LIMITS[o.name],
                       "min": [round(min(c[i] for c in xs), 3) for i in range(3)],
                       "max": [round(max(c[i] for c in xs), 3) for i in range(3)]}
    out["tris_total"] = sum(v["tris"] for v in out.values())
    if export:
        out["glb_mb"] = export_goods()
    return out


def export_goods():
    col = bpy.data.collections["GAME"]
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    objs = list(col.objects)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    path = os.path.join(OUT, "market_goods.glb")
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True,
        export_image_format='WEBP', export_image_quality=82,
        export_vertex_color='NAME', export_vertex_color_name='Col', export_all_vertex_colors=False,
        export_apply=False, export_animations=False, export_morph=False, export_yup=True,
        export_cameras=False, export_lights=False,
    )
    return round(os.path.getsize(path) / 1e6, 2)


def preview_scene(prefix):
    """Esikatselu viedystä GLB:stä: maa, 1,8 m:n pylväs, rivi malleja ja lähikuvat."""
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    sc = bpy.context.scene
    bpy.ops.import_scene.gltf(filepath=os.path.join(OUT, "market_goods.glb"))
    objs = {o.name.split(".")[0]: o for o in bpy.data.objects if o.type == 'MESH'}
    xs = {"nassakka": 0.0, "nassakka_kylki": 0.7, "tynnyri_suolakala": 1.6, "tynnyri_kiinni": 2.6, "viljakori_a": 3.6,
          "viljakori_b": 4.5, "kuivakala_nippu": 5.4, "maavaate": 7.2}
    for k, o in objs.items():
        o.location.x += xs[k]
    objs["kuivakala_nippu"].location.z += 1.7
    stats = {}
    for k, o in objs.items():
        bpy.context.view_layer.update()
        bb = [o.matrix_world @ V(c) for c in o.bound_box]
        stats[k] = ([round(min(p[i] for p in bb), 3) for i in range(3)], [round(max(p[i] for p in bb), 3) for i in range(3)])
    print("IMPORT_BBOX " + json.dumps(stats))
    gm = bpy.data.materials.new("pv_g")
    gm.diffuse_color = (0.2, 0.25, 0.12, 1)
    ground = bpy.data.meshes.new("pv_ground")
    bm = bmesh.new()
    bm.faces.new([bm.verts.new(p) for p in ((-30, -30, 0.0), (40, -30, 0.0), (40, 30, 0.0), (-30, 30, 0.0))])
    bm.to_mesh(ground)
    ground.materials.append(gm)
    sc.collection.objects.link(bpy.data.objects.new("pv_ground", ground))
    rm = bpy.data.materials.new("pv_ref")
    rm.diffuse_color = (0.25, 0.3, 0.55, 1)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.12, depth=1.8, location=(-0.9, 0.0, 0.9))
    bpy.context.active_object.data.materials.append(rm)
    # orsi kuivakalalle
    bpy.ops.mesh.primitive_cylinder_add(radius=0.025, depth=0.8, location=(5.4, 0.0, 1.7), rotation=(0, math.pi / 2, 0))
    bpy.context.active_object.data.materials.append(rm)
    sun = bpy.data.objects.new("pv_sun", bpy.data.lights.new("pv_sun", 'SUN'))
    sun.data.energy = 4
    sun.rotation_euler = (0.9, 0.2, 0.6)
    sc.collection.objects.link(sun)
    wd = bpy.data.worlds.new("pv_world")
    wd.use_nodes = True
    bg = wd.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.7, 0.78, 0.85, 1)
    bg.inputs[1].default_value = 1.0
    sc.world = wd
    cam = bpy.data.objects.new("pv_cam", bpy.data.cameras.new("pv_cam"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = 1600, 900

    def near(name, dist, az=25, el=35, lens=50, dz=0.0, tz=None):
        o = objs[name]
        bb = [o.matrix_world @ V(c) for c in o.bound_box]
        ctr = sum(bb, V((0, 0, 0))) / 8
        if tz is not None:
            ctr.z = tz
        a, e = math.radians(az), math.radians(el)
        pos = ctr + V((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * dist
        return (tuple(ctr), tuple(pos), lens)
    shots = {
        "all": ((3.9, 0.0, 0.6), (3.9, -14.0, 7.0), 40),
        "all_front": ((4.0, 0.0, 0.5), (4.0, -10.5, 2.4), 32),
        "row_a": ((2.3, 0.0, 0.45), (2.3, -8.0, 2.8), 40),
        "nassakka": near("nassakka", 1.3, 25, 35, 50),
        "nassakka_b": near("nassakka", 1.3, -50, 15, 50),
        "kylki": near("nassakka_kylki", 1.3, 25, 35, 50),
        "kylki_b": near("nassakka_kylki", 1.3, 150, 40, 50),
        "suolakala": near("tynnyri_suolakala", 2.4, 25, 35, 50),
        "suolakala_top": near("tynnyri_suolakala", 2.0, 15, 62, 50),
        "kiinni": near("tynnyri_kiinni", 2.4, 25, 35, 50),
        "kori_a": near("viljakori_a", 1.8, 20, 38, 50),
        "kori_a_top": near("viljakori_a", 1.6, 10, 65, 50),
        "kori_b": near("viljakori_b", 1.8, 20, 38, 50),
        "kori_b_top": near("viljakori_b", 1.6, -20, 60, 50),
        "kuiva": near("kuivakala_nippu", 1.4, 25, 20, 50),
        "vaate_top": ((7.2, 0.0, 0.0), (7.2, -0.2, 4.2), 40),
        "vaate_near": near("maavaate", 3.2, 15, 38, 50),
        "vaate_game": ((7.2, 0.2, 0.0), (7.2, -3.8, 3.7), 35),
        "vaate_nearL": near("maavaate", 1.6, -35, 30, 50, tz=0.05),
    }
    only = os.environ.get("KALEVALA_SHOTS")
    for name, (tgt, pos, lens) in shots.items():
        if only and name not in only.split(","):
            continue
        cam.location = V(pos)
        cam.rotation_euler = (V(tgt) - V(pos)).to_track_quat('-Z', 'Y').to_euler()
        cam.data.lens = lens
        sc.render.filepath = prefix + "_" + name + ".png"
        bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    res = build_goods(export=os.environ.get("KALEVALA_NO_EXPORT") is None)
    print("RESULT_JSON " + json.dumps(res))
    pv = os.environ.get("KALEVALA_PREVIEW")
    if pv:
        preview_scene(pv)
