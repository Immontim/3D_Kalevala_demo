"""Kalmisto koivikossa: kuppikivi, matalat kiviröykkiöt ja karsikkomänty. Vie tiedoston
assets/cairnfield.glb; peli sijoittelee mallit nimen mukaan (kohtaus `cairnfield`).

Käyttää homestead.py:n rakentajaa (HB), household.py:n apuja (HH) sekä trees.py:n
mäntyputkea (Builder, oksakorttiatlas) ilman, että ne sotkeutuvat toisiinsa: trees.py
luetaan omaan nimiavaruuteensa. Aja taustalla:

    blender --background --factory-startup --python assets-src/blender/cairnfield.py

Vientikansio: KALEVALA_ASSETS_OUT. Esikatselukuvat: KALEVALA_PREVIEW=<polku ilman päätettä>.

Koordinaatit: Z ylös, origo pohjan keskellä maan tasossa; etusivua ei ole. Mitat metreinä.
- kuppikivi: iso vanha maakivi, noin 2,45 x 1,85 m ja 0,88 m korkea, lakipinta litteä ja
  hieman kallellaan. Lakipinnassa 11 kuppia (säde 3,5-5 cm, syvyys 2-3 cm) ja yksi
  juoksutusura (leveys noin 5 cm), joka lähtee kupista kohti kiven reunaa. Pohja on 0,3 m
  maan alla (helma): peli upottaa kiven maahan noin 0,1 m. Törmäys: laatikko, puolimitat
  1,1 x 0,8 m.
- roykkio_a (pyöreä, säde noin 1,7 m, korkeus 0,5 m), roykkio_b (soikea 2,2 x 1,3 m säteillä,
  0,4 m), roykkio_c (kehäröykkiö, jonka keskusta on kuoppa, säde 2,0 m, 0,45 m) ja roykkio_d
  (pieni, säde 1,1 m, 0,35 m): kasa nyrkki- ja kalliokokoisia kiviä sammalpeitteen alla.
  Törmäys: ympyrä noin 0,85 x säde.
- karsikko: vanha mänty (korkeus 14 m), jonka alaoksat on karsittu rungon tyngiksi aina
  11 m:iin asti; latvassa pieni oksatupsu. Törmäys: ympyrä, säde 0,34 m.
"""
import bpy, bmesh, math, os, random, json
import numpy as np
from mathutils import Vector, Matrix

_HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else r"C:\Data\3D Kalevala\assets-src\blender"
exec(open(os.path.join(_HERE, "homestead.py"), encoding="utf-8").read())
# household.py ilman pääohjelmaa (se rakentaisi ja veisi talousesineet)
exec(open(os.path.join(_HERE, "household.py"), encoding="utf-8").read().split('if __name__ == "__main__":')[0])

OUT = os.environ.get("KALEVALA_ASSETS_OUT", OUT)
BLEND = os.path.join(ROOT, "assets-src", "cairnfield.blend")


def make_cairn_materials():
    make_materials()
    hs = dict(MATS)
    d = load_px(os.path.join(DL, "tex_mossy_rock", "mossy_rock_Diffuse_1k.jpg"), 1024)
    lum = d.mean(axis=-1, keepdims=True)
    lum = np.clip(0.42 + 0.58 * lum, 0, 1)          # sammalet pois: pelkkä kiven rakenne
    rd = np.clip(lum * np.array([1.0, 1.0, 1.0], dtype=np.float32), 0, 1)
    rn = load_px(os.path.join(DL, "tex_mossy_rock", "mossy_rock_nor_gl_1k.jpg"), 1024)
    MATS.clear()
    MATS["rock"] = pbr("M_CairnRock", save_px(rd, "cf_rock_diff"), save_px(rn, "cf_rock_nor", "Non-Color"), rough=1.0, twosided=False)
    ld, ln = scan("tex_forest_leaves_02", "forest_leaves_02", 512, "cf_moss", gain=(0.95, 1.2, 0.62), res="2k")
    MATS["moss"] = pbr("M_CairnMoss", ld, ln, rough=1.0, twosided=True)


class RB(HH):
    """Kivirakentaja: verteksiväri sRGB:nä, ja UV lasketaan tahkon normaalin mukaan (laatikkoprojektio)."""

    def surface(self, P, mat, color, tile=1.1, close_u=False):
        """Verkko pisteistä P[j][i]; jaetut verteksit pehmeää varjostusta varten."""
        nv, nu = len(P) - 1, len(P[0]) - 1
        B = [[self.bm.verts.new(p) for p in row] for row in P]
        self._faces(B, nu, nv, mat, color, tile, close_u)
        return B

    def _faces(self, B, nu, nv, mat, color, tile, close_u=False):
        mi = self.mi(mat)
        n_u = nu + (0 if not close_u else 1)
        for j in range(nv):
            for i in range(nu):
                i2 = (i + 1) % (nu if close_u else nu + 1)
                vs = [B[j][i], B[j][i2], B[j + 1][i2], B[j + 1][i]]
                try:
                    f = self.bm.faces.new(vs)
                except ValueError:
                    continue
                self._finish_face(f, mi, color, tile)

    def _finish_face(self, f, mi, color, tile):
        f.material_index = mi
        f.smooth = True
        f.normal_update()
        n = f.normal
        ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
        for l in f.loops:
            p = l.vert.co
            if az >= ax and az >= ay:
                uv = (p.x / tile, p.y / tile)
            elif ax >= ay:
                uv = (p.y / tile + 0.37, p.z / tile)
            else:
                uv = (p.x / tile + 0.61, p.z / tile)
            l[self.uv].uv = uv
            l[self.col] = self._c(color, p)


def smooth01(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def mix(a, b, k):
    return tuple(a[i] * (1 - k) + b[i] * k for i in range(3))


# ---------- kuppikivi ----------
SA, SB, SH = 1.22, 0.92, 0.82          # kiven puoliakselit (x, y) ja korkeus
CUPS = [(-0.62, 0.36, 0.044), (-0.2, 0.46, 0.04), (0.3, 0.5, 0.036), (-0.86, 0.02, 0.04), (-0.4, 0.04, 0.046),
        (0.08, 0.12, 0.05), (0.55, 0.2, 0.038), (-0.52, -0.3, 0.042), (-0.16, -0.38, 0.04), (0.36, -0.28, 0.036),
        (0.7, -0.02, 0.04)]
GROOVE = [(0.08, 0.12), (0.32, -0.04), (0.58, -0.18), (0.82, -0.3)]      # juoksutusura kupista reunaa kohti


def seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - ax - t * dx, py - ay - t * dy)


def cup_depth(x, y):
    """Kuppien ja uran syvyys pisteessä (m) sekä niiden peittämä osuus 0..1 värin tummentamiseen."""
    dep, cov = 0.0, 0.0
    for cx, cy, r0 in CUPS:
        r = r0 * 1.3
        d = math.hypot(x - cx, y - cy)
        if d < r * 1.3:
            w = 1 - smooth01(r * 0.55, r * 1.1, d)
            dep = max(dep, 0.036 * w)
            cov = max(cov, 1 - smooth01(r * 0.7, r * 1.2, d))
    for a, b in zip(GROOVE, GROOVE[1:]):
        d = seg_dist(x, y, a[0], a[1], b[0], b[1])
        if d < 0.05:
            w = 1 - smooth01(0.015, 0.032, d)
            fade = 1 - smooth01(0.0, 1.0, (x - GROOVE[0][0]) / (GROOVE[-1][0] - GROOVE[0][0])) * 0.6
            dep = max(dep, 0.016 * w * fade)
            cov = max(cov, 0.8 * w)
    return dep, cov


def disc(s, t):
    return s * math.sqrt(max(0.0, 1 - t * t / 2)), t * math.sqrt(max(0.0, 1 - s * s / 2))


def cupstone_pt(s, t):
    p, q = disc(s, t)
    rho = math.hypot(p, q)
    ang = math.atan2(q, p)
    wob = 1 + 0.07 * (nz(V((math.cos(ang) * 1.4, math.sin(ang) * 1.4, 0.5)), 1.0, 2.0) - 0.5) * 2
    x, y = p * SA * wob, q * SB * wob
    shape = max(0.0, 1 - rho ** 5.0) ** 0.45
    z = SH * shape
    z += 0.03 * (x / SA) * shape                                                   # lakipinta kallistuu hieman
    lump = (nz(V((x * 1.1, y * 1.1, 0)), 1.0, 7.0) - 0.5) * 0.055 + (nz(V((x * 4.0, y * 4.0, 0)), 1.0, 3.0) - 0.5) * 0.014
    z += lump * max(0.0, 1 - rho ** 4) ** 0.5
    if rho < 0.86:
        z -= cup_depth(x, y)[0]
    return V((x, y, z)), rho


def cupstone_color(p):
    x, y = p.x, p.y
    n = nz(p, 7.0, 4.0)
    k = 0.56 + 0.1 * n + 0.04 * nz(p, 22.0, 9.0)
    c = (k * 1.03, k * 1.0, k * 0.98)                                              # vaaleanharmaa, punertava graniitti
    lichen = smooth01(0.55, 0.72, nz(p, 4.2, 12.0)) * smooth01(0.1, 0.5, p.z)
    c = mix(c, (0.74, 0.76, 0.66), lichen * 0.75)                                  # vaaleat jäkäläläikät
    dots = smooth01(0.74, 0.8, nz(p, 15.0, 31.0))
    c = mix(c, (0.84, 0.85, 0.78), dots * 0.6)
    moss = smooth01(0.34, 0.06, p.z) * smooth01(0.28, 0.5, nz(p, 5.0, 17.0))      # sammalta tyvellä
    c = mix(c, (0.2, 0.29, 0.1), moss * 0.85)
    if p.z > 0.4:
        d, cov = cup_depth(x, y)
        c = mix(c, (0.15, 0.135, 0.13), cov * 0.95)                               # kuppien sisus on tummempi
    return c


def build_cupstone(col, n=112):
    b = RB("kuppikivi", 401)
    P = [[None] * (n + 1) for _ in range(n + 1)]
    rho = [[0.0] * (n + 1) for _ in range(n + 1)]
    for j in range(n + 1):
        for i in range(n + 1):
            P[j][i], rho[j][i] = cupstone_pt(i / n * 2 - 1, j / n * 2 - 1)
    B = b.surface(P, "rock", cupstone_color, tile=1.15)
    # helma: reunan alle 0,3 m syvyyteen, ettei kiven alla näy rakoa maan kohotessa
    ring = [(j, 0) for j in range(0, 1)]
    loop = [(0, i) for i in range(n + 1)] + [(j, n) for j in range(1, n + 1)] + [(n, i) for i in range(n - 1, -1, -1)] + [(j, 0) for j in range(n - 1, 0, -1)]
    sk = []
    for (j, i) in loop:
        p = P[j][i]
        sk.append(b.bm.verts.new(V((p.x * 0.97, p.y * 0.97, -0.3))))
    mi = b.mi("rock")
    for k in range(len(loop)):
        k2 = (k + 1) % len(loop)
        r1, r2 = B[loop[k][0]][loop[k][1]], B[loop[k2][0]][loop[k2][1]]
        try:
            f = b.bm.faces.new([sk[k], sk[k2], r2, r1])
        except ValueError:
            continue
        b._finish_face(f, mi, cupstone_color, 1.15)
    return b.finish(col)


# ---------- kiviröykkiöt ----------
def foot(ang, seed):
    return 1 + 0.15 * math.sin(2 * ang + seed) + 0.09 * math.sin(3 * ang + seed * 1.7) + 0.05 * math.sin(5 * ang + seed * 2.3)


def mound_h(rho, hc, ring):
    if ring:
        return hc * 0.55 * math.exp(-(((rho - 0.68) / 0.3) ** 2)) + 0.02
    return hc * 0.5 * max(0.0, 1 - rho * rho) ** 0.9


def rock_pt(rx, ry, rz, e, seed, u, v):
    a, th = u * math.tau, (v - 0.5) * math.pi
    ca, sa, ct, st = math.cos(a), math.sin(a), math.cos(th), math.sin(th)
    sg = lambda w: math.copysign(abs(w) ** e, w)
    d = V((sg(ca) * sg(ct), sg(sa) * sg(ct), sg(st)))
    r = 1 + 0.16 * (nz(d, 1.7, seed) - 0.5) * 2 + 0.04 * (nz(d, 5.0, seed + 5) - 0.5) * 2
    return V((d.x * rx * r, d.y * ry * r, d.z * rz * r))


def build_cairn(col, name, seed, rx, ry, hc, ring):
    b = RB(name, seed)
    rng = b.rng
    moss_a = (0.36, 0.45, 0.17)
    moss_b = (0.25, 0.34, 0.11)

    # sammalpeite ja multa kivien välissä
    def mound_color(p):
        n = nz(p, 2.4, seed)
        c = mix(moss_b, moss_a, smooth01(0.3, 0.7, n))
        return mix(c, (0.22, 0.17, 0.11), smooth01(0.62, 0.8, nz(p, 5.0, seed + 2)) * 0.8)
    nr, na = 7, 44
    P = []
    for j in range(nr + 1):
        row = []
        for i in range(na + 1):
            ang = (i % na) / na * math.tau
            rho = j / nr
            f = foot(ang, seed)
            x, y = math.cos(ang) * rx * f * rho, math.sin(ang) * ry * f * rho
            z = mound_h(rho, hc, ring) * 1.05 - 0.06 * smooth01(0.7, 1.0, rho)
            if j == nr:
                z = -0.07
            row.append(V((x, y, z)))
        P.append(row)
    B = [[b.bm.verts.new(p) for p in row[:na]] for row in P]
    mi = b.mi("moss")
    for j in range(nr):
        for i in range(na):
            i2 = (i + 1) % na
            try:
                f = b.bm.faces.new([B[j][i], B[j + 1][i], B[j + 1][i2], B[j][i2]])
            except ValueError:
                continue
            b._finish_face(f, mi, mound_color, 1.4)

    # kivet
    placed = []
    attempts = 260 if not ring else 300
    for _ in range(attempts):
        rho = math.sqrt(rng.random()) * 0.97
        if ring:
            rho = 0.3 + 0.68 * math.sqrt(rng.random())
        ang = rng.random() * math.tau
        f = foot(ang, seed)
        x, y = math.cos(ang) * rx * f * rho, math.sin(ang) * ry * f * rho
        big = rng.random() < 0.13
        s = rng.uniform(0.3, 0.46) if big else rng.uniform(0.11, 0.3) * (1.0 - 0.25 * rho * 0)
        if rho > 0.78:
            s *= 0.8
        if any(math.hypot(x - q[0], y - q[1]) < 0.55 * (s + q[2]) for q in placed):
            continue
        placed.append((x, y, s))
        h = mound_h(rho, hc, ring) * 1.0
        e = rng.uniform(0.82, 1.0)
        rzf = rng.uniform(0.55, 0.85)
        c = V((x, y, h + s * rzf * rng.uniform(-0.2, 0.2)))
        R = (Matrix.Rotation(rng.uniform(0, math.tau), 3, 'Z') @ Matrix.Rotation(rng.uniform(-0.45, 0.45), 3, 'Y')
             @ Matrix.Rotation(rng.uniform(-0.45, 0.45), 3, 'X'))
        sx, sy = s * rng.uniform(0.9, 1.5), s * rng.uniform(0.75, 1.2)
        mossy = rng.uniform(0.45, 1.0)
        sd = rng.uniform(0, 100)
        cen = c.copy()

        def colr(p, cen=cen, mossy=mossy, sd=sd):
            k = 0.52 + 0.1 * nz(p, 8.0, sd)
            cc = (k * 1.02, k * 1.0, k * 0.98)
            lich = smooth01(0.55, 0.72, nz(p, 5.0, sd + 4.0))
            cc = mix(cc, (0.74, 0.76, 0.66), lich * 0.6)
            up = smooth01(-0.1, 0.5, (p.z - cen.z) / 0.25)
            m = mossy * (0.4 + 0.6 * up) * smooth01(0.25, 0.55, nz(p, 4.0, sd + 9.0) + 0.25 * mossy)
            return mix(cc, (0.2 + 0.1 * nz(p, 3.0, sd), 0.3, 0.1), min(0.92, m))
        nu, nv = 11, 7
        PP = [[c + R @ rock_pt(sx, sy, s * rzf, e, sd, i / nu, j / nv) for i in range(nu + 1)] for j in range(nv + 1)]
        # sauma auki u = 0 ja 1: yhdistetään pisteet
        for j in range(nv + 1):
            PP[j][nu] = PP[j][0]
        Bv = {}
        rows = []
        for j in range(nv + 1):
            row = []
            for i in range(nu):
                row.append(b.bm.verts.new(PP[j][i]))
            rows.append(row)
        mi_r = b.mi("rock")
        for j in range(nv):
            for i in range(nu):
                i2 = (i + 1) % nu
                try:
                    fc = b.bm.faces.new([rows[j][i], rows[j][i2], rows[j + 1][i2], rows[j + 1][i]])
                except ValueError:
                    continue
                b._finish_face(fc, mi_r, colr, 0.9)
    return b.finish(col)


CAIRNS = [
    ("roykkio_a", 301, 1.7, 1.6, 0.5, False),
    ("roykkio_b", 302, 2.2, 1.3, 0.4, False),
    ("roykkio_c", 303, 2.0, 1.95, 0.45, True),
    ("roykkio_d", 304, 1.1, 1.0, 0.35, False),
]


# ---------- karsikko ----------
def build_karsikko(col):
    """Vanha mänty, jonka alaoksat on karsittu tyngiksi. Rakennetaan trees.py:n (Builder, oksakortit) avulla."""
    ns = {"__name__": "trees_ns"}
    exec(open(os.path.join(_HERE, "trees.py"), encoding="utf-8").read(), ns)
    with open(os.path.join(ns["ROOT"], "cards", "atlas.json")) as f:
        ns["ATLAS"] = json.load(f)
    # edellisen ajon kuvat pois, jotta muuttuneet tekstuurit latautuvat uudelleen
    for nm in ("pine_bark_diff", "pine_bark_nor", "pine_bark_warm_diff", "foliage_atlas"):
        im = bpy.data.images.get(nm)
        if im:
            bpy.data.images.remove(im)
    ns["MATS"] = ns["make_materials"]()
    Bd, spine, at_height, trunk_radii = ns["Builder"], ns["spine"], ns["at_height"], ns["trunk_radii"]
    A = ns["ATLAS"]
    height, r0, crown = 14.0, 0.27, 0.80
    b = Bd("karsikko", 77, ["pine", "foliage"])
    rng = b.rng
    pts = spine(rng, height - 0.8, lean=0.035, wobble=0.03, step=1.0)
    radii = trunk_radii(pts, r0, height, 0.7, 0.5, tip=0.035)
    cols = []
    for p in pts:
        k = min(1, max(0, (p.z - height * 0.28) / (height * 0.3)))
        k = k * k * (3 - 2 * k)
        cols.append(tuple(V((0.5, 0.52, 0.55)).lerp(V((0.8, 0.74, 0.68)), k)))     # harmaa kaarna, ylempänä punertava
    b.tube(pts, radii, 11, "pine", vtile=1.4, colors=cols)
    zc = height * crown
    # karsitut oksat: tyngät kiertävät runkoa kerroksittain
    z = 1.3
    ang0 = 0.0
    while z < zc - 0.3:
        n = rng.randint(2, 4)
        ang0 += rng.uniform(0.5, 1.6)
        for k in range(n):
            if rng.random() < 0.3:
                continue
            ang = ang0 + k * math.tau / n + rng.uniform(-0.35, 0.35)
            zz = z + rng.uniform(-0.12, 0.12)
            base = at_height(pts, zz)
            rr = radii[min(len(radii) - 1, max(0, int(zz + 0.4)))] * 0.85
            d = V((math.cos(ang), math.sin(ang), rng.uniform(-0.18, 0.25))).normalized()
            L = rng.uniform(0.05, 0.28) * (1.2 if zz < 6 else 0.9) * (2.2 if rng.random() < 0.12 else 1.0)
            r = rng.uniform(0.028, 0.055) * (1.25 if zz < 6 else 0.9)
            weather = rng.uniform(0.68, 0.9)
            e0 = base + d * rr * 0.6
            b.tube([e0, base + d * (rr * 0.6 + L * 0.5), base + d * (rr * 0.6 + L), base + d * (rr * 0.6 + L + 0.012)],
                   [r * 1.25, r, r * 0.9, 0.004], 5, "pine", vtile=0.5, color=(weather, weather, weather * 1.02))
        z += rng.uniform(0.5, 1.0)
    # latva: pieni oksatupsu
    ctr = V((0, 0, height * (crown + 1) / 2 + 0.5))
    nb = 7
    for i in range(nb):
        t = (i + rng.random() * 0.6) / nb
        zb = zc + (height - 1.3 - zc) * t
        ang = i * 2.4 + rng.uniform(-0.4, 0.4)
        L = (2.7 - 1.5 * t) * rng.uniform(0.75, 1.1)
        rise = 0.15 + 0.7 * t + rng.uniform(-0.1, 0.15)
        out = V((math.cos(ang), math.sin(ang), 0))
        base = at_height(pts, zb)
        bp = [base]
        d = (out + UP * rise * 0.5).normalized()
        segs = 4
        for s in range(segs):
            d = (d + UP * 0.16 + V((rng.uniform(-0.12, 0.12), rng.uniform(-0.12, 0.12), 0))).normalized()
            bp.append(bp[-1] + d * (L / segs))
        rb = max(0.03, radii[min(len(radii) - 1, int(zb + 0.4))] * 0.5)
        b.tube(bp, [rb * (1 - 0.8 * s / segs) for s in range(segs + 1)], 5, "pine", vtile=0.8)
        for s in range(2, segs + 1):
            for _ in range(5 if s < segs else 6):
                p = bp[s - 1].lerp(bp[s], rng.random())
                td = (d * 0.5 + V((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(0.2, 1.0)))).normalized()
                cell = A[rng.choice(["pine_side", "pine_side2"])]["uv"]
                sz = rng.uniform(1.3, 2.0)
                b.cross(p, td, d, sz, sz * 0.67, cell, segs=2, tint=rng.uniform(0.8, 1.0), shade_root=0.65, center=ctr)
        tip = bp[-1]
        b.card(tip - V((0.9, 0, 0.1)), V((1, 0, 0)), UP, 1.8, 1.8, A["pine_top"]["uv"], segs=1, tint=0.75, shade_root=1.0, center=ctr)
    top = pts[-1]
    for _ in range(6):
        td = V((rng.uniform(-0.6, 0.6), rng.uniform(-0.6, 0.6), 1)).normalized()
        b.cross(top - UP * 0.4, td, V((1, 0, 0)), 1.6, 1.1, A["pine_side"]["uv"], segs=2, tint=0.95, shade_root=0.6, center=ctr)
    # trees.py:n Builder.finish hakee materiaalit sen omasta MATS-taulukosta
    ob = b.finish(col)
    return ob


# ---------- kokonaisuus ----------
def build_cairnfield(export=True):
    col = bpy.data.collections.get("GAME")
    if not col:
        col = bpy.data.collections.new("GAME")
        bpy.context.scene.collection.children.link(col)
    for o in list(col.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    make_cairn_materials()
    obs = [build_cupstone(col)]
    for nm, sd, rx, ry, hc, ring in CAIRNS:
        obs.append(build_cairn(col, nm, sd, rx, ry, hc, ring))
    obs.append(build_karsikko(col))
    bpy.context.view_layer.update()
    out = {o.name: {"tris": sum(len(p.vertices) - 2 for p in o.data.polygons), "dim": [round(d, 2) for d in o.dimensions]} for o in obs}
    if export:
        out["glb_mb"] = export_cairnfield()
    return out


def export_cairnfield():
    col = bpy.data.collections["GAME"]
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    objs = list(col.objects)
    locs = {o.name: (o.location.copy(), o.rotation_euler.copy()) for o in objs if o.parent is None}
    for o in objs:
        if o.parent is None:
            o.location = (0, 0, 0)
            o.rotation_euler = (0, 0, 0)
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    path = os.path.join(OUT, "cairnfield.glb")
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True,
        export_image_format='WEBP', export_image_quality=82,
        export_vertex_color='NAME', export_vertex_color_name='Col', export_all_vertex_colors=False,
        export_apply=True, export_animations=False, export_yup=True,
        export_cameras=False, export_lights=False,
    )
    for o in objs:
        if o.parent is None:
            o.location, o.rotation_euler = locs[o.name]
    return round(os.path.getsize(path) / 1e6, 2)


def preview_scene(prefix):
    """Esikatselu: maa ja mallit rivissä; kuvat läheltä ja kaukaa."""
    sc = bpy.context.scene
    obs = {o.name: o for o in bpy.data.collections["GAME"].objects}
    obs["kuppikivi"].location = (0, 0, 0)
    obs["kuppikivi"].rotation_euler = (0, 0, math.radians(20))
    spots = {"roykkio_a": (-5.5, 1.0), "roykkio_b": (5.5, 3.0), "roykkio_c": (-5.0, 7.0), "roykkio_d": (4.5, -4.0), "karsikko": (-10.5, 4.0)}
    for k, (x, y) in spots.items():
        obs[k].location = (x, y, 0)
    gm = bpy.data.materials.new("pv_g")
    gm.diffuse_color = (0.14, 0.2, 0.07, 1)
    ground = bpy.data.meshes.new("pv_ground")
    bm = bmesh.new()
    bm.faces.new([bm.verts.new(p) for p in ((-40, -30, -0.02), (40, -30, -0.02), (40, 40, -0.02), (-40, 40, -0.02))])
    bm.to_mesh(ground)
    ground.materials.append(gm)
    sc.collection.objects.link(bpy.data.objects.new("pv_ground", ground))
    sun = bpy.data.objects.new("pv_sun", bpy.data.lights.new("pv_sun", 'SUN'))
    sun.data.energy = 4
    sun.rotation_euler = (0.9, 0.2, 0.6)
    sc.collection.objects.link(sun)
    wd = bpy.data.worlds.new("pv_world")
    wd.use_nodes = True
    wd.node_tree.nodes["Background"].inputs[0].default_value = (0.7, 0.78, 0.85, 1)
    sc.world = wd
    cam = bpy.data.objects.new("pv_cam", bpy.data.cameras.new("pv_cam"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = 1600, 900
    shots = [
        ("a", (0.0, 0.0, 0.5), (-1.0, -3.6, 2.4), 45),          # kuppikivi lakipinta
        ("b", (-0.2, 0.2, 0.7), (1.2, -2.6, 1.0), 40),
        ("c", (-5.5, 1.0, 0.2), (-5.5, -4.0, 2.2), 40),         # röykkiö a
        ("d", (-5.0, 7.0, 0.2), (-5.0, 2.5, 3.6), 40),          # kehäröykkiö
        ("e", (-10.5, 4.0, 5.0), (-10.5, -12.0, 3.0), 38),      # karsikko
        ("f", (-9.5, 4.0, 11.5), (-4.5, -2.5, 8.0), 40),        # karsikon latva
        ("g", (0.0, 3.0, 0.3), (0.0, -16.0, 5.5), 36),          # koko kalmisto
    ]
    for name, tgt, pos, lens in shots:
        cam.location = V(pos)
        cam.rotation_euler = (V(tgt) - V(pos)).to_track_quat('-Z', 'Y').to_euler()
        cam.data.lens = lens
        sc.render.filepath = prefix + "_" + name + ".png"
        bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    res = build_cairnfield(export=os.environ.get("KALEVALA_NO_EXPORT") is None)
    pv = os.environ.get("KALEVALA_PREVIEW")
    if pv:
        preview_scene(pv)
    print("RESULT_JSON " + json.dumps(res))
