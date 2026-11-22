"""Pihan talousesineet rauhalliseen kohtaukseen: pukkipöytä, penkki, vuode, tuohikontti,
keittopata tulikivillä, ruokatarpeet, viljalyhde ja Poly Havenin puuastiat.
Vie tiedoston assets/household.glb; peli sijoittelee mallit nimen mukaan.

Käyttää homestead.py:n rakentajaa (HB) ja tekstuurifunktioita, joten se luetaan
ensin samaan nimiavaruuteen. Lähdemallit: tools/fetch-household.ps1, tekstuurit
myös tools/fetch-homestead.ps1 ja tools/fetch-polyhaven.ps1. Aja taustalla:

    blender --background --factory-startup --python assets-src/blender/household.py

Vientikansion voi vaihtaa ympäristömuuttujalla KALEVALA_ASSETS_OUT (esim. toinen
työpuu). Esikatselukuva: KALEVALA_PREVIEW=<polku.png>.

Koordinaatit: Z ylös, esineen etusivu suuntaan -Y. Origo on esineen pohjan keskellä.
Nimet: pukkipoyta, penkki, vuode, tuohikontti, pata, rieska, nauriit, kuivakalat, lyhde,
kulho, kuppi, kauha, lautanen, kori sekä poyta_kattaus (pöydälle katetut esineet
yhtenä mallina; origo sama kuin pukkipöydällä).
"""
import bpy, bmesh, math, os, random
import numpy as np
from mathutils import Vector, Matrix

_HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else r"C:\Data\3D Kalevala\assets-src\blender"
exec(open(os.path.join(_HERE, "homestead.py"), encoding="utf-8").read())

OUT = os.environ.get("KALEVALA_ASSETS_OUT", OUT)
BLEND = os.path.join(ROOT, "assets-src", "household.blend")
TABLE_H = 0.76          # pöytälevyn yläpinta


# ---------- tekstuurit ----------
def weave_px(size=256, n=8, seed=5):
    """Tuohipunos: ristiin punotut tuohikaistat, joka toinen päällä."""
    rs = np.random.RandomState(seed)
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    cell = size / n
    cx, cy = np.floor(xx / cell).astype(np.int32), np.floor(yy / cell).astype(np.int32)
    fx, fy = (xx / cell) % 1.0, (yy / cell) % 1.0
    over = (cx + cy) % 2 == 0                               # vaakakaista päällä
    across = np.where(over, fy, fx)                         # kaistan poikki
    along = np.where(over, fx, fy)
    edge = np.clip(1 - np.abs(2 * across - 1) ** 8, 0, 1)
    hgt = edge * (0.55 + 0.45 * np.sin(np.pi * along))      # kaista kaartuu alle päistään
    tint_h, tint_v = rs.uniform(0.82, 1.08, n), rs.uniform(0.82, 1.08, n)
    tint = np.where(over, tint_h[cy % n], tint_v[cx % n])
    lines = 0.5 + 0.5 * np.sin(across * 37 + tint * 20)     # tuohen juovat kaistan suuntaan
    k = tint * (0.86 + 0.1 * lines) * (0.45 + 0.55 * hgt) + rs.normal(0, 0.012, (size, size))
    col = np.stack([k * 0.80, k * 0.62, k * 0.38], axis=-1)
    return col.astype(np.float32), height_to_normal(hgt.astype(np.float32), 4.0)


def ph_tex(tid, size, name):
    """Poly Haven -mallin tekstuurit (väri ja normaali) pienennettyinä."""
    d = load_px(os.path.join(DL, tid, "textures", tid + "_diff_1k.jpg"), size)
    n = load_px(os.path.join(DL, tid, "textures", tid + "_nor_gl_1k.jpg"), size)
    return save_px(d, name + "_diff"), save_px(n, name + "_nor", "Non-Color")


def make_household_materials():
    wd_d, wd_n = wood_px(seed=8)
    wd_d = np.clip(wd_d * np.array([1.25, 1.08, 0.86], dtype=np.float32), 0, 1)     # veistetty, vähemmän harmaantunut puu
    bk_d, bk_n = scan("tex_pine_bark", "pine_bark", 512, "hh_bark", gain=(1.0, 0.95, 0.88))
    cl_d, cl_n = scan("tex_clay_plaster", "clay_plaster", 512, "hh_clay", gain=(1.5, 1.42, 1.3))
    th_d, th_n = scan("tex_thatch_roof_angled", "thatch_roof_angled", 512, "hh_straw", gain=(2.05, 1.8, 1.3), lift=0.02)
    wv_d, wv_n = weave_px()
    birch = bpy.data.images.load(os.path.join(TEXDIR, "birch_bark_diff.png"))
    birch.name = "hh_birch_diff"
    birch.pack()
    plain = save_px(np.ones((8, 8, 3), dtype=np.float32), "hh_plain")
    MATS.clear()
    MATS.update({
        "wood": pbr("M_HH_Wood", save_px(wd_d, "hh_wood_diff"), save_px(wd_n, "hh_wood_nor", "Non-Color"), rough=0.85),
        "bark": pbr("M_HH_Bark", bk_d, bk_n, rough=0.95),
        "clay": pbr("M_HH_Clay", cl_d, cl_n, rough=1.0),
        "straw": pbr("M_HH_Straw", th_d, th_n, rough=1.0),
        "weave": pbr("M_HH_Weave", save_px(wv_d, "hh_weave_diff"), save_px(wv_n, "hh_weave_nor", "Non-Color"), rough=0.75),
        "birch": pbr("M_HH_Birch", birch, rough=0.8),
        "plain": pbr("M_HH_Plain", plain, rough=0.9),
    })


# ---------- apurit ----------
class HH(HB):
    """Kuten HB, mutta värit annetaan näytöllä näkyvinä (sRGB) ja muunnetaan lineaarisiksi,
    koska verteksivärit tallentuvat lineaarisina ja näyttäisivät muuten haalistuneilta."""

    def _c(self, color, p):
        c = color(p) if callable(color) else color
        return (max(0.0, c[0]) ** 2.2, max(0.0, c[1]) ** 2.2, max(0.0, c[2]) ** 2.2, 1)


def lathe(b, prof, n, mat, color, c=(0, 0, 0), sx=1.0, sy=1.0, uvrep=(1.0, 1.0), rot=None):
    """Pyörähdyskappale profiilista [(säde, korkeus), ...]."""
    c = V(c)
    R = rot if rot else Matrix.Identity(3)
    m = len(prof) - 1

    def fn(u, v):
        i = min(m - 1, int(v * m))
        f = v * m - i
        r = prof[i][0] + (prof[i + 1][0] - prof[i][0]) * f
        z = prof[i][1] + (prof[i + 1][1] - prof[i][1]) * f
        a = u * math.tau
        return c + R @ V((math.cos(a) * r * sx, math.sin(a) * r * sy, z))
    b.grid(fn, n, m, mat, color, uvfn=lambda u, v: (u * uvrep[0], v * uvrep[1]))


def stone(b, c, R, seed, mat="plain"):
    c = V(c)

    def fn(u, v):
        a, t = u * math.tau, (v - 0.5) * math.pi
        d = V((math.cos(a) * math.cos(t), math.sin(a) * math.cos(t), math.sin(t)))
        r = R * (1 + 0.28 * nz(d, 1.6, seed) + 0.08 * nz(d, 5.0, seed))
        return c + V((d.x * r, d.y * r, d.z * r * 0.72))

    def colr(p):
        k = 0.42 + 0.1 * nz(p, 14.0, seed)
        return (k * 0.9, k * 0.9, k * 0.92)
    b.grid(fn, 10, 6, mat, colr, uvfn=lambda u, v: (u * 1.5, v * 0.8))


# ---------- huonekalut ----------
def build_table(col):
    """Pukkipöytä: kolme halkaistua lankkua irrallaan kahden pukin päällä."""
    b = HH("pukkipoyta", 81)
    L, W, T = 2.3, 0.76, 0.05
    for i in range(3):
        w = W / 3 - 0.012
        y = -W / 2 + (i + 0.5) * W / 3
        k = 0.82 + 0.1 * b.rng.random()
        ln = L + b.rng.uniform(-0.12, 0.06)
        b.box(V((b.rng.uniform(-0.03, 0.03), y, TABLE_H - T / 2 - 0.004 * i % 2)), (ln, w, T), "wood", (k, k * 0.97, k * 0.92), tile=0.7, grain=0)
    zt = TABLE_H - T - 0.045
    for sx in (-1, 1):
        x = sx * 0.78
        b.pole(V((x, -0.42, zt)), V((x, 0.42, zt)), 0.045, "wood", 7, (0.7, 0.66, 0.6), taper=0.9)
        for sy in (-1, 1):
            for dx in (-1, 1):
                b.pole(V((x + dx * 0.24, sy * 0.44, -0.04)), V((x + dx * 0.02, sy * 0.3, zt + 0.02)), 0.032, "bark", 6, (0.78, 0.75, 0.72), taper=0.85)
    return b.finish(col)


def build_bench(col):
    """Penkki: halkaistu hirsi, tasainen puoli ylöspäin, neljä haarajalkaa."""
    b = HH("penkki", 82)
    L, H, R = 1.9, 0.44, 0.15
    b.grid(lambda u, v: V((-L / 2 + L * u, math.cos(math.pi + math.pi * v) * R, H + math.sin(math.pi + math.pi * v) * R * 0.8)),
           8, 6, "bark", (0.8, 0.77, 0.74), uvfn=lambda u, v: (v * 0.6, u * L / 0.8))
    b.face([V((-L / 2, -R, H)), V((L / 2, -R, H)), V((L / 2, R, H)), V((-L / 2, R, H))], "wood", (0.86, 0.82, 0.76), tile=0.7, uaxis=(0, 1, 0))
    for sx in (-1, 1):
        pts = [V((sx * L / 2, math.cos(math.pi + math.pi * j / 6) * R, H + math.sin(math.pi + math.pi * j / 6) * R * 0.8)) for j in range(7)]
        b.face(pts if sx > 0 else list(reversed(pts)), "wood", (0.95, 0.9, 0.8), tile=0.4)
        for sy in (-1, 1):
            b.pole(V((sx * 0.82, sy * 0.24, -0.04)), V((sx * 0.68, sy * 0.05, H - 0.06)), 0.03, "bark", 6, (0.76, 0.73, 0.7), taper=0.9)
    return b.finish(col)


BED_L, BED_W = 2.0, 0.86      # vuoteen pituus (X) ja leveys (Y)
BED_TOP = 0.50                # patjan ja taljan yläpinta keskeltä (pelin makaava hahmo asetetaan tälle)


def build_bed(col):
    """Vuode (lavitsa) nuotion ääreen: kaksi kuorellista sivuhirttä neljän haarajalan päällä,
    poikittaiset halkolaudat, olkipatja, talja ja olkityyny päädyssä +X. Ei metallia eikä
    sorvattua puuta, vain kirveellä tehtävää: sopii pronssi- ja varhaiseen rautakauteen."""
    b = HH("vuode", 89)
    L, W = BED_L, BED_W
    zr = 0.27                                              # sivuhirsien keskilinja
    for sy in (-1, 1):                                     # sivuhirret ulottuvat hieman päätyjen yli
        y = sy * (W / 2 - 0.05)
        b.tube([V((-L / 2 - 0.06, y, zr - 0.01)), V((0, y, zr + 0.01)), V((L / 2 + 0.06, y, zr - 0.005))],
               [0.075, 0.07, 0.066], "bark", 7, (0.74, 0.71, 0.67))
    for sx in (-1, 1):                                     # päätyorret ja jalat (haarukka hirren alla)
        x = sx * (L / 2 - 0.09)
        b.pole(V((x, -W / 2 - 0.02, zr - 0.06)), V((x, W / 2 + 0.02, zr - 0.06)), 0.05, "bark", 6, (0.7, 0.67, 0.63), taper=0.92)
        for sy in (-1, 1):
            y = sy * (W / 2 - 0.08)
            b.pole(V((x + sx * 0.04, y + sy * 0.03, -0.04)), V((x, y, zr - 0.02)), 0.045, "bark", 6, (0.72, 0.69, 0.66), taper=0.88)
    n = 9                                                  # halkolaudat sivuhirsien päällä
    for i in range(n):
        x = -L / 2 + 0.12 + i * (L - 0.24) / (n - 1)
        k = 0.8 + 0.12 * b.rng.random()
        b.box(V((x + b.rng.uniform(-0.02, 0.02), b.rng.uniform(-0.015, 0.015), zr + 0.085)), (0.15, W + 0.04, 0.035), "wood",
              (k, k * 0.95, k * 0.88), tile=0.6, rot=Matrix.Rotation(b.rng.uniform(-0.04, 0.04), 3, 'Z'), grain=1)

    zm0, zm1 = zr + 0.1, BED_TOP - 0.03                    # olkipatja: pyöristetty laatta
    ml, mw = L - 0.12, W - 0.1

    def mat_pt(u, v):
        a = u * math.tau
        cx, cy = math.cos(a), math.sin(a)
        # pyöristetty suorakaide: superellipsi, reunat pullistuvat ja yläpinta painuu keskeltä
        ex = math.copysign(abs(cx) ** 0.35, cx)
        ey = math.copysign(abs(cy) ** 0.35, cy)
        r = 0.72 + 0.28 * math.sin(v * math.pi)
        p = V((ex * ml / 2 * r, ey * mw / 2 * r, 0))
        z = zm0 + (zm1 - zm0) * (0.5 - 0.5 * math.cos(v * math.pi))
        z += 0.012 * nz((p.x * 3, p.y * 3, v), 1.0, 2.0)
        return p + V((0, 0, z))

    def straw_col(p):
        k = 0.78 + 0.1 * nz(p, 9.0, 1.0)
        return (k * 0.95, k * 0.84, k * 0.56)
    b.grid(mat_pt, 24, 5, "straw", straw_col, uvfn=lambda u, v: (u * 4.0, v * 0.6))
    b.face([mat_pt(i / 24, 1.0) for i in range(24)], "straw", (0.8, 0.7, 0.45), tile=0.5)

    def pelt_pt(u, v):                                     # talja: laskeutuu patjan reunoille, epätasainen reuna
        x = -L / 2 + 0.16 + u * (L * 0.72)
        y = (v - 0.5) * (W + 0.14)
        edge = abs(v - 0.5) * 2
        drop = max(0.0, edge - 0.72) / 0.28
        rag = 0.035 * nz((x * 4, y * 4, 0), 1.0, 5.0)
        z = BED_TOP + 0.012 - drop * drop * 0.16 + rag * drop + 0.008 * nz((x * 6, y * 6, 1), 1.0, 3.0)
        return V((x, y * (1 - 0.06 * drop), z))

    def pelt_col(p):
        k = 0.36 + 0.07 * nz(p, 11.0, 6.0) + 0.05 * nz(p, 37.0, 2.0)
        ridge = 0.08 * max(0.0, 1 - abs(p.y) / 0.14)       # selkäraita tummempi
        rim = 0.08 * max(0.0, abs(p.y) / (W / 2) - 0.6)    # vatsapuolen karva vaaleampi
        return (k * 0.92 - ridge + rim, k * 0.7 - ridge + rim * 0.8, k * 0.5 - ridge + rim * 0.6)
    # olkitekstuurin kuitu taljan pituussuuntaan: tummaksi sävytettynä se lukeutuu karvaksi
    b.grid(pelt_pt, 12, 10, "straw", pelt_col, uvfn=lambda u, v: (v * 1.4, u * 3.2))

    pc = V((L / 2 - 0.2, 0, BED_TOP + 0.01))               # olkipielus poikittain päädyssä

    def pillow_pt(u, v):
        a, t = u * math.tau, (v - 0.5) * math.pi
        d = V((math.cos(a) * math.cos(t), math.sin(a) * math.cos(t), math.sin(t)))
        sq = 1 - 0.25 * abs(d.z) ** 3                      # litistynyt pää-ala
        return pc + V((d.x * 0.15 * sq, d.y * 0.3, max(d.z, -0.4) * 0.075 + 0.035))
    b.grid(pillow_pt, 14, 6, "straw", (0.84, 0.74, 0.5), uvfn=lambda u, v: (u * 3.0, v * 0.8))
    return b.finish(col)


def build_kontti(col):
    """Tuohikontti: punottu selkäreppu, läppä edessä ja kaksi olkaviilekettä takana."""
    b = HH("tuohikontti", 83)
    hw, hd, h = 0.17, 0.085, 0.40

    def ring(a, z, off=0.0):
        t = 1.0 - 0.1 * z / h
        ca, sa = math.cos(a), math.sin(a)
        x = (hw + off) * t * math.copysign(abs(ca) ** 0.4, ca)
        y = (hd + off) * t * math.copysign(abs(sa) ** 0.4, sa)
        return V((x, y, z))
    NS = 28
    raw = [ring(i / 200 * math.tau, 0.0) for i in range(201)]
    acc = [0.0]
    for i in range(200):
        acc.append(acc[-1] + (raw[i + 1] - raw[i]).length)
    per = acc[-1]

    def ang(u):                       # kulma, jossa kehää on kuljettu osuus u
        t = (u % 1.0) * per
        i = max(k for k in range(201) if acc[k] <= t + 1e-9)
        return min(i, 199) / 200 * math.tau + (0 if i >= 200 else (t - acc[i]) / max(1e-9, acc[i + 1] - acc[i]) / 200 * math.tau)
    _ring = ring
    ring = lambda a, z, off=0.0: _ring(ang(a / math.tau) if a < math.tau - 1e-6 else math.tau, z, off)
    tint = lambda p: tuple(c * (0.86 + 0.14 * p[2] / h + 0.06 * nz(p, 6.0, 2.0)) for c in (1.0, 0.98, 0.94))
    b.grid(lambda u, v: ring(u * math.tau, 0.01 + (h - 0.01) * v), 28, 6, "weave", tint, uvfn=lambda u, v: (u * per / 0.2, v * h / 0.2))
    b.face([ring(i / 28 * math.tau, 0.01) for i in range(28)][::-1], "weave", (0.6, 0.58, 0.55), tile=0.2)
    b.face([ring(i / 28 * math.tau, h - 0.02, -0.004) for i in range(28)], "plain", (0.05, 0.04, 0.03))       # tumma sisus
    # suun vahvikekaista
    b.grid(lambda u, v: ring(u * math.tau, h - 0.035 + 0.04 * v, 0.005), 28, 1, "birch", (0.92, 0.84, 0.66), uvfn=lambda u, v: (u * 3, 0.2 + v * 0.08))

    def flap(u, v):
        x = (-hw + 2 * hw * u) * 0.9
        if v < 0.5:
            t = v / 0.5
            return V((x, hd * 0.92 - 2 * hd * 0.96 * t, h + 0.012 + 0.012 * math.sin(math.pi * t)))
        t = (v - 0.5) / 0.5
        return V((x * (1 - 0.25 * t * t), -hd - 0.012 - 0.004 * t, h + 0.012 - 0.19 * t))
    b.grid(flap, 8, 8, "weave", (0.98, 0.95, 0.9), uvfn=lambda u, v: (u * 2 * hw / 0.2, v * 0.36 / 0.2))
    for s in (-1, 1):
        b.grid(lambda u, v, s=s: V((s * 0.085 + (u - 0.5) * 0.036 + s * 0.03 * math.sin(math.pi * v), hd * (1 - 0.1 * (1 - v)) + 0.006 + 0.075 * math.sin(math.pi * v) ** 0.8,
                                    0.05 + (h - 0.09) * v)),
               1, 10, "birch", (0.9, 0.82, 0.64), uvfn=lambda u, v: (0.3 + u * 0.08, v * 1.2))
    return b.finish(col)


# ---------- keittopaikka ----------
def build_pot(col):
    """Savinen keittopata kolmen tulikiven varassa, alla hiillos ja kekäleitä."""
    b = HH("pata", 84)
    z0 = 0.11
    prof = [(0.0, 0.0), (0.09, 0.015), (0.17, 0.08), (0.215, 0.18), (0.205, 0.27), (0.17, 0.33), (0.185, 0.37), (0.165, 0.372), (0.155, 0.33), (0.165, 0.29), (0.0, 0.29)]

    def colr(p):
        z = p[2] - z0
        r = math.hypot(p[0], p[1])
        if z > 0.28 and r < 0.168:
            k = 0.3 + 0.08 * nz(p, 30.0)                      # keitto
            return (k * 1.2, k * 0.95, k * 0.55)
        soot = max(0.0, 1 - z / 0.26)
        k = (0.55 + 0.1 * nz(p, 9.0)) * (1 - 0.72 * soot)
        return (k * 1.08, k * 0.86, k * 0.68)
    lathe(b, prof, 16, "clay", colr, c=(0, 0, z0), uvrep=(1.4, 0.7))
    for i in range(3):
        a = i * math.tau / 3 + 0.5
        stone(b, (math.cos(a) * 0.215, math.sin(a) * 0.215, 0.075), 0.115, 3.0 + i * 7.1)
    ash = [V((math.cos(i / 14 * math.tau) * 0.42 * (1 + 0.12 * nz((i, 0, 0), 0.9)), math.sin(i / 14 * math.tau) * 0.42 * (1 + 0.12 * nz((0, i, 0), 0.9)), 0.006)) for i in range(14)]
    b.face(ash, "plain", lambda p: tuple(c * (0.2 + 0.25 * min(1, math.hypot(p[0], p[1]) / 0.42)) for c in (0.8, 0.8, 0.82)), tile=0.5)
    for i in range(6):
        a = i * math.tau / 6 + 1.1 + b.rng.uniform(-0.2, 0.2)
        d = V((math.cos(a), math.sin(a), 0))
        k = b.rng.uniform(0.12, 0.3)
        b.tube([d * 0.06 + V((0, 0, 0.035)), d * b.rng.uniform(0.38, 0.5) + V((0, 0, 0.03))], [0.02, 0.028], "bark", 5, lambda p, k=k: tuple(
            c * min(1.0, k + 2.2 * max(0, math.hypot(p[0], p[1]) - 0.2)) for c in (0.75, 0.72, 0.7)), vtile=0.5)
    return b.finish(col)


# ---------- ruoka ----------
def build_bread(col):
    """Kolme ohrarieskaa pinossa."""
    b = HH("rieska", 85)
    z = 0.0
    for i in range(3):
        r = 0.125 - 0.006 * i + b.rng.uniform(-0.004, 0.004)
        cx, cy = b.rng.uniform(-0.012, 0.012), b.rng.uniform(-0.012, 0.012)
        prof = [(0.0, 0.0), (r * 0.9, 0.0), (r, 0.008), (r * 0.97, 0.018), (r * 0.6, 0.024), (0.0, 0.026)]
        sd = 10.0 * i

        def colr(p, sd=sd, z=z):
            spot = max(0.0, nz(p, 28.0, sd)) * 1.3 + max(0.0, nz(p, 9.0, sd + 3)) * 0.5
            k = 0.62 - 0.3 * spot - (0.12 if p[2] - z < 0.01 else 0)
            return (k * 1.12, k * 0.9, k * 0.6)
        lathe(b, prof, 16, "clay", colr, c=(cx, cy, z), sx=1.0, sy=b.rng.uniform(0.93, 1.0), uvrep=(2.0, 0.3))
        z += 0.022
    return b.finish(col)


def turnip(b, c, r, seed, rot=None):
    R = rot if rot else Matrix.Identity(3)
    prof = [(0.0, -1.7), (0.05, -1.25), (0.2, -0.95), (0.75, -0.6), (1.0, -0.05), (0.85, 0.4), (0.4, 0.62), (0.12, 0.66), (0.0, 0.66)]
    prof = [(a * r, (h + 1.7) * r * 0.8) for a, h in prof]
    zt = prof[-1][1]

    def colr(p):
        t = (R.inverted() @ (V(p) - V(c))).z / zt
        w = max(0.0, min(1.0, (t - 0.55) / 0.2))
        k = 0.8 + 0.08 * nz(p, 40.0, seed)
        return (k * (0.95 - 0.4 * w), k * (0.9 - 0.62 * w), k * (0.75 - 0.3 * w))
    lathe(b, prof, 10, "plain", colr, c=c, rot=R)
    top = V(c) + R @ V((0, 0, zt))
    for j in range(4):
        a = j * math.tau / 4 + seed
        d = R @ V((math.cos(a), math.sin(a), 0))
        up = R @ V((0, 0, 1))
        side = up.cross(d)
        ln = r * (1.5 + 0.4 * nz((j, seed, 0), 1.0))
        b.grid(lambda u, v, d=d, side=side, ln=ln: top + d * (ln * v * 0.8) + up * (ln * (0.55 * v - 0.75 * v * v)) + side * ((u - 0.5) * r * 1.3 * math.sin(math.pi * min(1, v * 1.15 + 0.08))),
               2, 4, "plain", lambda p: (0.22 + 0.08 * nz(p, 30.0), 0.4 + 0.1 * nz(p, 20.0), 0.14))


def build_turnips(col):
    """Neljä naurista naatteineen kasassa."""
    b = HH("nauriit", 86)
    turnip(b, (-0.07, 0.0, 0.045), 0.052, 1.0, Matrix.Rotation(1.35, 3, 'Y'))
    turnip(b, (0.06, -0.03, 0.04), 0.047, 2.3, Matrix.Rotation(-1.25, 3, 'Y') @ Matrix.Rotation(0.5, 3, 'X'))
    turnip(b, (0.0, 0.085, 0.043), 0.05, 4.1, Matrix.Rotation(1.3, 3, 'X'))
    turnip(b, (0.0, 0.02, 0.105), 0.044, 5.6, Matrix.Rotation(-1.2, 3, 'X') @ Matrix.Rotation(0.4, 3, 'Y'))
    return b.finish(col)


def fish(b, c, ln, yaw, seed):
    c = V(c)
    R = Matrix.Rotation(yaw, 3, 'Z')

    def fn(u, v):
        hh = 0.115 * ln * (math.sin(math.pi * min(1.0, u ** 0.75 * 1.02)) ** 0.7) + 0.006
        a = v * math.tau
        return c + R @ V((-ln / 2 + ln * u, math.cos(a) * hh, 0.014 + math.sin(a) * hh * 0.32))

    def colr(p):
        q = R.inverted() @ (V(p) - c)
        k = 0.42 + 0.1 * nz(p, 60.0, seed) + 0.9 * q.y          # selkä tumma, vatsa vaalea
        return (k * 1.0, k * 0.88, k * 0.66)
    b.grid(fn, 10, 8, "plain", colr)
    tail = [c + R @ V(p) for p in ((ln / 2 - 0.01, 0, 0.014), (ln / 2 + 0.05, 0.035, 0.012), (ln / 2 + 0.035, 0, 0.013), (ln / 2 + 0.05, -0.035, 0.012))]
    b.face(tail, "plain", (0.3, 0.26, 0.2))


def build_fish(col):
    """Kolme kuivattua kalaa rinnakkain."""
    b = HH("kuivakalat", 87)
    fish(b, (0.0, -0.055, 0), 0.24, 0.08, 1.0)
    fish(b, (0.01, 0.0, 0), 0.26, -0.05, 2.0)
    fish(b, (-0.01, 0.055, 0.0), 0.23, 0.12, 3.0)
    return b.finish(col)


def build_sheaf(col):
    """Viljalyhde pystyssä: korret sidottu vyötäröltä, tähkät nuokkuvat ylhäällä."""
    b = HH("lyhde", 88)
    H = 0.92
    prof = [(0.0, 0.0), (0.14, 0.0), (0.115, 0.25), (0.07, 0.56), (0.085, 0.7), (0.15, 0.86), (0.16, 0.95), (0.10, 1.02), (0.0, 1.04)]
    m = len(prof) - 1

    def pt(u, v):
        i = min(m - 1, int(v * m))
        f = v * m - i
        r = prof[i][0] + (prof[i + 1][0] - prof[i][0]) * f
        z = (prof[i][1] + (prof[i + 1][1] - prof[i][1]) * f) * H
        a = u * math.tau
        r *= 1 + 0.16 * nz((math.cos(a) * 2.5, math.sin(a) * 2.5, z * 3), 1.0, 7.0)
        return V((math.cos(a) * r, math.sin(a) * r, z))

    def colr(p):
        t = p[2] / H
        k = 0.8 + 0.12 * nz(p, 12.0, 3.0)
        if t > 0.72:
            return (k * 0.92, k * 0.74, k * 0.42)             # tähkät ruskeampia
        return (k * 1.0, k * 0.9, k * 0.6)
    b.grid(pt, 16, m, "straw", colr, uvfn=lambda u, v: (u * 2.5, v * 1.3))
    for j in range(10):                                          # ulos nuokkuvia tähkiä
        a = j * math.tau / 10 + 0.2 * nz((j, 0, 0), 1.3)
        d = V((math.cos(a), math.sin(a), 0))
        side = V((-d.y, d.x, 0))
        z0 = H * (0.8 + 0.08 * nz((0, j, 0), 1.7))
        ln = 0.2 + 0.05 * nz((j, j, 0), 2.1)
        b.grid(lambda u, v, d=d, side=side, z0=z0, ln=ln: d * (0.11 + ln * 0.75 * v) + V((0, 0, z0 + ln * (0.7 * v - 0.9 * v * v))) + side * ((u - 0.5) * 0.035 * (1 - 0.6 * v)),
               1, 4, "straw", (0.78, 0.62, 0.34), uvfn=lambda u, v: (0.2 + u * 0.08, v * 0.4))
    b.tube([V((math.cos(i / 10 * math.tau) * 0.078, math.sin(i / 10 * math.tau) * 0.078, H * 0.58)) for i in range(11)], 0.01, "straw", 4, (0.55, 0.45, 0.28), caps=False)
    return b.finish(col)


# ---------- Poly Haven -astiat ----------
PH_ITEMS = [  # (nimi pelissä, Poly Haven -tunniste, tekstuurin koko, tavoitekolmiot)
    ("kulho", "wooden_bowl_01", 512, 1400),
    ("kuppi", "wooden_bowl_02", 256, 700),
    ("kauha", "wooden_spoon", 256, 600),
    ("lautanen", "carved_wooden_plate", 256, 700),
    ("kori", "wicker_basket_01", 512, 5000),
]


def import_ph(col, name, tid, size, tris):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(DL, tid, tid + ".gltf"))
    new = [o for o in bpy.data.objects if o not in before]
    ob = [o for o in new if o.type == 'MESH'][0]
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    me = ob.data
    n = sum(len(p.vertices) - 2 for p in me.polygons)
    if n > tris:
        mod = ob.modifiers.new("dec", 'DECIMATE')
        mod.ratio = tris / n
        bpy.ops.object.modifier_apply(modifier=mod.name)
    lo = [min(v.co[i] for v in me.vertices) for i in range(3)]
    hi = [max(v.co[i] for v in me.vertices) for i in range(3)]
    off = V(((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, lo[2]))
    for v in me.vertices:
        v.co -= off
    for im in [m for m in bpy.data.images if m.users and m.name.startswith(tid)]:
        pass
    d, nr = ph_tex(tid, size, "hh_" + name)
    MATS[name] = pbr("M_HH_" + name.capitalize(), d, nr, rough=0.8)
    me.materials.clear()
    me.materials.append(MATS[name])
    if me.uv_layers:
        me.uv_layers[0].name = "UVMap"
    ca = me.color_attributes.new("Col", 'FLOAT_COLOR', 'CORNER')
    for c in ca.data:
        c.color = (1, 1, 1, 1)
    me.color_attributes.active_color = ca
    for c in list(ob.users_collection):
        c.objects.unlink(ob)
    col.objects.link(ob)
    ob.name = name
    me.name = name
    for o in new:
        if o is not ob:
            bpy.data.objects.remove(o, do_unlink=True)
    return ob


# ---------- kattaus ----------
SETTING = [  # (esine, x, y, z pöydän pinnasta, kierto z)
    ("kulho", -0.62, 0.05, 0.0, 0.4),
    ("nauriit", -0.62, 0.05, 0.035, 1.0),
    ("rieska", -0.12, -0.08, 0.0, 0.0),
    ("lautanen", 0.42, 0.08, 0.0, 0.0),
    ("kuivakalat", 0.42, 0.08, 0.012, 0.5),
    ("kuppi", -0.95, -0.2, 0.0, 0.3),
    ("kuppi", 0.1, 0.24, 0.0, 2.0),
    ("kuppi", 0.9, -0.16, 0.0, 4.0),
    ("kauha", -0.3, 0.22, 0.0, 1.2),
]


def build_setting(col, obs):
    parts = []
    for name, x, y, z, rz in SETTING:
        c = obs[name].copy()
        c.data = obs[name].data.copy()
        c.matrix_world = Matrix.Translation((x, y, TABLE_H + z)) @ Matrix.Rotation(rz, 4, 'Z')
        col.objects.link(c)
        parts.append(c)
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for c in parts:
        c.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    ob = parts[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    ob.name = "poyta_kattaus"
    ob.data.name = "poyta_kattaus"
    return ob


HH_BUILDERS = [build_table, build_bench, build_bed, build_kontti, build_pot, build_bread, build_turnips, build_fish, build_sheaf]


def build_household(export=True, save=True):
    col = bpy.data.collections.get("GAME")
    if not col:
        col = bpy.data.collections.new("GAME")
        bpy.context.scene.collection.children.link(col)
    for o in list(col.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    make_household_materials()
    obs = [f(col) for f in HH_BUILDERS]
    obs += [import_ph(col, *it) for it in PH_ITEMS]
    obs.append(build_setting(col, {o.name: o for o in obs}))
    out = {}
    x = 0.0
    for o in obs:
        bpy.context.view_layer.update()
        out[o.name] = {"tris": sum(len(p.vertices) - 2 for p in o.data.polygons), "dim": [round(d, 2) for d in o.dimensions]}
        x += o.dimensions.x / 2 + 0.25
        o.location = (x, 0, 0)          # rivissä esikatselua varten; vienti nollaa paikat
        x += o.dimensions.x / 2
    out["tris_total"] = sum(v["tris"] for v in out.values())
    if save:
        bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    if export:
        out["glb_mb"] = export_household()
    return out


def export_household():
    col = bpy.data.collections["GAME"]
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    objs = list(col.objects)
    locs = {o.name: o.location.copy() for o in objs}
    for o in objs:
        o.location = (0, 0, 0)
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    path = os.path.join(OUT, "household.glb")
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True,
        export_image_format='WEBP', export_image_quality=82,
        export_vertex_color='NAME', export_vertex_color_name='Col', export_all_vertex_colors=False,
        export_apply=True, export_animations=False, export_yup=True,
        export_cameras=False, export_lights=False,
    )
    for o in objs:
        o.location = locs[o.name]
    return round(os.path.getsize(path) / 1e6, 2)


def preview_household(path, target, dist, height=1.2, res=(1600, 900)):
    """Esikatselukuva EEVEE:llä (aurinko ja tasainen taivas)."""
    sc = bpy.context.scene
    if "pv_sun" not in bpy.data.objects:
        sun = bpy.data.objects.new("pv_sun", bpy.data.lights.new("pv_sun", 'SUN'))
        sun.data.energy = 4
        sun.rotation_euler = (0.9, 0.2, 0.6)
        sc.collection.objects.link(sun)
        w = bpy.data.worlds.new("pv_world")
        w.use_nodes = True
        w.node_tree.nodes["Background"].inputs[0].default_value = (0.75, 0.78, 0.8, 1)
        sc.world = w
        cam = bpy.data.objects.new("pv_cam", bpy.data.cameras.new("pv_cam"))
        sc.collection.objects.link(cam)
        sc.camera = cam
    cam = bpy.data.objects["pv_cam"]
    t = V(target)
    cam.location = t + V((dist * 0.35, -dist, height))
    cam.rotation_euler = (t - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = 50
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    import json
    for o in list(bpy.data.objects):        # tehdasasetusten kuutio, valo ja kamera pois
        bpy.data.objects.remove(o, do_unlink=True)
    res = build_household(export=os.environ.get("KALEVALA_NO_EXPORT") is None)
    pv = os.environ.get("KALEVALA_PREVIEW")
    if pv:
        obs = {o.name: o for o in bpy.data.collections["GAME"].objects}
        # pöytä ja kattaus päällekkäin, penkki eteen, muut ympärille
        place = {"pukkipoyta": (0, 0, 0), "poyta_kattaus": (0, 0, 0), "penkki": (0, -0.75, 0), "vuode": (-1.0, 1.4, 0), "tuohikontti": (-1.5, -0.6, 0), "lyhde": (1.5, 0.3, 0),
                 "pata": (2.3, -0.9, 0), "kori": (1.45, -0.75, 0), "rieska": (3.2, 0, 0), "nauriit": (3.6, 0, 0), "kuivakalat": (4.0, 0, 0),
                 "kulho": (3.2, -0.5, 0), "kuppi": (3.6, -0.5, 0), "kauha": (3.9, -0.5, 0), "lautanen": (4.3, -0.5, 0)}
        for n, p in place.items():
            obs[n].location = p
        preview_household(pv + "_a.png", (0.4, 0, 0.5), 4.6, 1.9)
        preview_household(pv + "_b.png", (0, 0, 0.8), 1.9, 0.9)
        preview_household(pv + "_c.png", (3.7, -0.25, 0.05), 1.6, 0.8)
        preview_household(pv + "_d.png", (2.0, -0.8, 0.25), 1.9, 0.9)
        preview_household(pv + "_e.png", (-1.5, -0.6, 0.25), 1.2, 0.5)
    print("RESULT_JSON " + json.dumps(res))
