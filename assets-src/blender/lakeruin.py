"""Järvenrannan tuhottu tila: poltettu mökki, sammunut ja sortunut keittopaikka, kaatunut
kuivausteline ja verilammikko. Vie tiedoston assets/lakeruin.glb; peli sijoittelee mallit
nimen mukaan samoihin paikkoihin kuin lakeside.glb:n vastineet (kohtaus `lakeruin`).

Käyttää lakeside.py:n (siis homestead.py:n ja household.py:n) rakentajia ja materiaaleja,
joten ne luetaan ensin samaan nimiavaruuteen. Aja taustalla:

    blender --background --factory-startup --python assets-src/blender/lakeruin.py

Vientikansio: KALEVALA_ASSETS_OUT. Esikatselukuvat: KALEVALA_PREVIEW=<polku ilman päätettä>.

Koordinaatit kuten lakeside.py: Z ylös, etusivu -Y, origo pohjan keskellä maan tasossa.
- mokki_palanut: sama pohja kuin mokki (hirret ±2,2 x ±1,7 m). Seinät ovat palaneet eri korkeuksille
  (takaseinä ja +X-pääty korkeimmat, etuseinä ja -X-pääty matalimmat), ovi- ja ikkunaaukko ovat
  tallessa. Sisällä tuhkaa, sortuneita kattoparruja, turvelaattoja ja tuohta. Ympärillä noen
  tummentama maa. Pelin törmäys: sama laatikko kuin mökillä, mutta matalampi.
- keittopaikka_sammunut: kivikehä (säde 0,56, muutama kivi syrjässä), kylmä tuhka ja hiiltyneet
  kalikat, sortunut kolmijalka, maahan valahtanut ketju ja kaatunut pata (suu +X-suuntaan), sen
  vierellä läikkä läikkynyttä keittoa. Ei kiinnityspisteitä: ei liekkiä, valoa eikä höyryä.
- haasia_kaatunut: kuivausteline kaatuneena kyljelleen, heinät hajallaan ja yksi orsi irti.
- verilammikko: noin 1,7 x 1,3 m lammikko, jonka reunalla pieniä roiskeita (makaava hahmo
  asetetaan sen keskelle). verilammikko_pieni: noin 0,8 m läikkä ja pisaroita (jälki muualla).
"""
import bpy, bmesh, math, os, random
import numpy as np
from mathutils import Vector, Matrix

_HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else r"C:\Data\3D Kalevala\assets-src\blender"
# lakeside.py ilman pääohjelmaa (se rakentaisi ja veisi rantakohtauksen)
exec(open(os.path.join(_HERE, "lakeside.py"), encoding="utf-8").read().rsplit('if __name__ == "__main__":', 1)[0])

OUT = os.environ.get("KALEVALA_ASSETS_OUT", OUT)
BLEND = os.path.join(ROOT, "assets-src", "lakeruin.blend")


def make_ruin_materials():
    make_lake_materials()
    MATS["blood"] = pbr("M_Blood", None, None, rough=0.12, twosided=True, color=(1, 1, 1, 1))


def char(seed, lo=0.13, hi=0.27, ash=0.3):
    """Palanut puu: lähes musta, joukossa harmaata tuhkaa."""
    def fn(p):
        n = nz(p, 5.0, seed)
        k = lo + (hi - lo) * n
        a = max(0.0, nz(p, 11.0, seed + 7) - 0.58) * ash * 2.0
        return (k * 1.03 + a, k * 0.97 + a, k * 0.9 + a * 0.95)
    return fn


def blob(b, cx, cy, z, R, mat, color, seed, n=30, stretch=(1.0, 1.0), rot=0.0, lobes=0.28, uvtile=1.0):
    """Epäsäännöllinen litteä läikkä (napaverkko, keskipiste mukana, jotta väri voi vaihtua reunaa kohti)."""
    ca, sa = math.cos(rot), math.sin(rot)

    def fn(u, v):
        a = u * math.tau
        r = R * (1 + lobes * (0.5 * math.sin(2 * a + seed) + 0.3 * math.sin(3 * a + seed * 1.7) + 0.15 * math.sin(5 * a + seed * 2.3)))
        x, y = math.cos(a) * r * v * stretch[0], math.sin(a) * r * v * stretch[1]
        return V((cx + x * ca - y * sa, cy + x * sa + y * ca, z))
    b.grid(fn, n, 3, mat, color, uvfn=lambda u, v: (math.cos(u * math.tau) * v * R / uvtile, math.sin(u * math.tau) * v * R / uvtile), smooth=False)


# ---------- poltettu mökki ----------
def build_cabin_burnt(col):
    b = HH("mokki_palanut", 201)
    rng = b.rng
    OV = 0.28
    tint = char(3)
    sand = (0.5, 0.43, 0.33)                  # metsänpohjan väri, johon noki häviää reunalla

    # noen peittämä maa mökin ympärillä: keskellä lähes musta, reunalla maan väri
    def ground(p):
        r = math.hypot(p[0] / 1.35, p[1] / 1.15) / 2.6
        k = min(1.0, max(0.0, (r - 0.3) / 0.7))
        k = k * k * (3 - 2 * k)
        soot = (0.21 + 0.05 * nz(p, 4.0, 5.0), 0.2 + 0.045 * nz(p, 4.0, 5.0), 0.19 + 0.04 * nz(p, 4.0, 5.0))
        return tuple(soot[i] * (1 - k) + sand[i] * k for i in range(3))
    blob(b, 0.0, 0.0, 0.085, 2.6, "plain", ground, 11, n=48, stretch=(1.4, 1.2), lobes=0.12, uvtile=1.5)

    # perustuskivet
    for (x, y) in ((-CX + 0.15, -CY + 0.15), (CX - 0.15, -CY + 0.15), (-CX + 0.15, CY - 0.15), (CX - 0.15, CY - 0.15), (0.0, CY - 0.1), (0.9, -CY + 0.1), (-1.8, -CY + 0.1)):
        stone(b, (x, y, 0.02), 0.27 + rng.uniform(-0.04, 0.05), 40 + x * 3 + y)

    def chunks(lo, hi):
        out, x = [], lo
        while x < hi - 0.05:
            e = min(hi, x + rng.uniform(0.7, 1.6))
            out.append((x, e))
            x = e + rng.uniform(0.0, 0.12)
        return out

    # etu- ja takaseinä (X-suuntaiset hirret): korkeus kerroksina paikan mukaan
    height_front = lambda x: max(1.0, min(5.5, 3.0 + 2.5 * math.sin(x * 1.25 + 0.4)))
    height_back = lambda x: max(3.0, min(8.5, 6.0 + 2.3 * math.sin(x * 0.9 + 2.0)))
    gaps_front = [(DOOR[0], DOOR[1], -1, DOOR[2])]
    for i in range(NC):
        z = Z0 + i * DZ
        for sy, gaps, hf in ((-1, gaps_front, height_front), (1, [], height_back)):
            for s0, s1 in cut_segments(-CX - OV, CX + OV, gaps, z):
                for a, c in chunks(s0, s1):
                    h = hf((a + c) / 2)
                    if i >= h:
                        continue
                    if i >= h - 1:                                 # ylin kerros: katkenneita, lyhyitä pätkiä
                        c = a + (c - a) * rng.uniform(0.4, 0.95)
                    hirsi(b, (a, sy * CY + rng.uniform(-0.02, 0.02), z - rng.uniform(0.0, 0.03)), (c, sy * CY + rng.uniform(-0.02, 0.02), z - rng.uniform(0.0, 0.03)),
                          R_LOG * rng.uniform(0.82, 1.0), tint, sag=-0.004)
    # päätyseinät (Y-suuntaiset hirret): +X korkea ikkunan kanssa, -X matala
    height_x = {1: lambda y: max(4.0, min(9.0, 7.0 + 2.0 * math.sin(y * 1.7))), -1: lambda y: max(1.0, min(5.0, 2.6 + 2.0 * math.sin(y * 2.1 + 1.0)))}
    wx = [(WINDOW[0], WINDOW[1], WINDOW[2], WINDOW[3])]
    for k in range(10):
        z = Z0 + (k + 0.5) * DZ
        for sx in (-1, 1):
            gp = wx if sx == 1 else []
            for s0, s1 in cut_segments(-CY - OV, CY + OV, gp, z):
                for a, c in chunks(s0, s1):
                    h = height_x[sx]((a + c) / 2)
                    if k >= h:
                        continue
                    if k >= h - 1:
                        c = a + (c - a) * rng.uniform(0.4, 0.95)
                    hirsi(b, (sx * CX + rng.uniform(-0.02, 0.02), a, z), (sx * CX + rng.uniform(-0.02, 0.02), c, z), R_LOG * rng.uniform(0.82, 1.0), tint, sag=-0.004)

    # oviaukon pielet: palaneet tyngät, ja ovi makaa ulkopuolella
    for x, hgt in ((DOOR[0] - 0.06, 1.35), (DOOR[1] + 0.06, 0.8)):
        b.box(V((x, -CY, hgt / 2 + 0.05)), (0.12, 0.3, hgt), "wood", char(8, 0.09, 0.17), tile=0.8, grain=2)
    b.box(V((-1.0, -CY - 0.05, 0.05)), (0.95, 0.4, 0.08), "wood", char(9, 0.1, 0.18), tile=0.8, grain=0)
    b.box(V((-1.35, -CY - 1.0, 0.07)), (0.85, 1.45, 0.05), "wood", char(10, 0.1, 0.19), tile=0.8,
          rot=Matrix.Rotation(0.55, 3, 'Z') @ Matrix.Rotation(0.05, 3, 'X'), grain=1)

    # sisus: tuhkaa ja hiiltä
    def ashf(p):
        n = nz(p, 6.0, 4.0)
        g = max(0.0, nz(p, 9.0, 13.0) - 0.45)
        k = 0.1 + 0.07 * n + g * 0.35
        return (k * 1.03, k, k * 0.96)
    b.face([V((-CX + 0.1, -CY + 0.1, 0.14)), V((CX - 0.1, -CY + 0.1, 0.14)), V((CX - 0.1, CY - 0.1, 0.14)), V((-CX + 0.1, CY - 0.1, 0.14))], "plain", ashf, tile=0.6)

    # sortuneet kattoparrut ja orsi: hiiltyneinä seinien päältä sisälle lattialle
    for i in range(11):
        s = -1 if i % 2 else 1
        x0 = rng.uniform(-CX + 0.3, CX - 0.3)
        a = V((x0, s * (CY - 0.05), rng.uniform(0.9, 1.5)))
        c = V((x0 + rng.uniform(-0.7, 0.7), s * rng.uniform(0.15, 1.0), rng.uniform(0.2, 0.34)))
        b.pole(a, c, rng.uniform(0.04, 0.065), "bark", 6, char(20 + i, 0.07, 0.16, 0.35), taper=0.75, vtile=1.0)
    b.pole(V((CX - 0.1, 0.1, 1.55)), V((-CX + 0.6, 0.35, 0.3)), 0.075, "bark", 6, char(40, 0.08, 0.16), taper=0.9, vtile=1.0)
    for i in range(5):                                      # katonlaudat ja tuohiliuskat
        c = V((rng.uniform(-1.7, 1.7), rng.uniform(-1.0, 1.1), 0.2 + rng.uniform(0, 0.12)))
        rot = Matrix.Rotation(rng.uniform(0, math.tau), 3, 'Z') @ Matrix.Rotation(rng.uniform(-0.25, 0.25), 3, 'X')
        b.box(c, (rng.uniform(1.0, 1.6), 0.16, 0.035), "wood", char(50 + i, 0.09, 0.18, 0.4), tile=0.7, rot=rot, grain=0)
    for i in range(7):                                      # sortuneet turvelaatat, osa palanutta, osa vielä vihertävää
        c = V((rng.uniform(-1.6, 1.6), rng.uniform(-1.0, 1.0), 0.3 + rng.uniform(0.0, 0.3)))
        rot = Matrix.Rotation(rng.uniform(0, math.tau), 3, 'Z') @ Matrix.Rotation(rng.uniform(-0.35, 0.35), 3, 'X') @ Matrix.Rotation(rng.uniform(-0.3, 0.3), 3, 'Y')
        fresh = i in (1, 4)
        base = (0.22, 0.26, 0.12) if fresh else (0.11, 0.1, 0.07)
        b.box(c, (rng.uniform(0.9, 1.3), rng.uniform(0.7, 1.0), 0.16), "turf",
              lambda p, base=base, i=i: tuple(base[j] * (0.8 + 0.4 * nz(p, 5.0, 60 + i)) for j in range(3)), tile=0.7, rot=rot)
    for i in range(6):
        c = V((rng.uniform(-1.9, 1.9), rng.uniform(-1.2, 1.2), 0.27 + rng.uniform(0.0, 0.25)))
        rot = Matrix.Rotation(rng.uniform(0, math.tau), 3, 'Z') @ Matrix.Rotation(rng.uniform(-0.5, 0.5), 3, 'X')
        b.box(c, (rng.uniform(0.5, 0.9), rng.uniform(0.4, 0.6), 0.015), "birch", (0.22, 0.2, 0.17), tile=0.5, rot=rot)
    return b.finish(col)


# ---------- sammunut ja sortunut keittopaikka ----------
def build_cookfire_out(col):
    b = HH("keittopaikka_sammunut", 211)
    rng = b.rng
    # kivikehä: kaksi kiveä on potkaistu syrjään
    for i in range(11):
        a = i / 11 * math.tau + rng.uniform(-0.08, 0.08)
        R = 0.56
        if i in (3, 8):
            R = 0.95 + rng.uniform(0, 0.15)
        stone(b, (math.cos(a) * R, math.sin(a) * R, 0.05), rng.uniform(0.12, 0.17), 5.0 + i * 3.3)

    sand = (0.5, 0.43, 0.33)

    def ash(p, cx=0.0, cy=0.0, R=0.62):
        r = math.hypot(p[0] - cx, p[1] - cy) / R
        k = 0.2 + 0.09 * nz(p, 7.0, 2.0) + 0.08 * min(1.0, max(0.0, 1 - r)) * nz(p, 12.0, 8.0)
        f = min(1.0, max(0.0, (r - 0.4) / 0.6))
        f = f * f * (3 - 2 * f)
        return tuple((k * (1.02, 1.0, 0.97)[i]) * (1 - f) + sand[i] * f for i in range(3))
    blob(b, 0.0, 0.0, 0.03, 0.62, "plain", ash, 21, n=40, lobes=0.18, uvtile=0.6)
    blob(b, 0.1, -0.05, 0.034, 1.05, "plain", lambda p: tuple(c * 0.8 for c in ash(p, 0.1, -0.05, 1.05)), 23, n=48, lobes=0.3, uvtile=0.8)
    # kylmät, hiiltyneet kalikat
    for i in range(6):
        a = i * math.tau / 6 + rng.uniform(-0.2, 0.2)
        d = V((math.cos(a), math.sin(a), 0))
        lo = d * 0.5 + V((0, 0, 0.05))
        hi = d * rng.uniform(0.05, 0.25) + V((0, 0, 0.1 + 0.05 * (i % 2)))
        b.tube([lo, lo.lerp(hi, 0.5), hi], [0.045, 0.05, 0.04], "bark", 6, char(30 + i, 0.07, 0.14, 0.4), vtile=0.5)
    # sortunut kolmijalka: kolme seivästä eri tavoin maassa
    legs = (((0.55, 0.75, 0.06), (-0.75, -0.2, 0.34)), ((-1.35, 0.5, 0.05), (0.15, 0.35, 0.16)), ((1.4, -0.7, 0.05), (0.05, -1.05, 0.12)))
    for i, (p0, p1) in enumerate(legs):
        b.tube([V(p0), V(p0).lerp(V(p1), 0.5) + V((0.0, 0.0, 0.03)), V(p1)], [0.055, 0.047, 0.036], "bark", 6, (0.5, 0.46, 0.4), vtile=0.9)
    b.tube([V((0.0, 0.0, 0.0)) + V((0.1, 0.55, 0.045)), V((0.5, 0.9, 0.04)), V((0.2, 1.2, 0.035))], 0.011, "plain", 5, (0.18, 0.17, 0.16), vtile=0.2, caps=False)
    # ketju maassa
    links = [V((0.85 - 0.12 * math.sin(t * 3.0) * 0.5 - t * 0.9, -0.35 + 0.55 * t + 0.06 * math.sin(t * 7.0), 0.03 + 0.012 * (i % 2))) for i, t in enumerate(np.linspace(0, 1, 14))]
    b.tube(links, [0.013 if i % 2 == 0 else 0.022 for i in range(len(links))], "plain", 5, (0.22, 0.21, 0.2), vtile=0.2)
    # kaatunut pata: suu +X-suuntaan ja hieman alas, sen vieressä valunut keitto
    prof = [(0.0, 0.0), (0.11, 0.02), (0.21, 0.10), (0.27, 0.225), (0.256, 0.34), (0.21, 0.41), (0.235, 0.455), (0.21, 0.462), (0.2, 0.41), (0.21, 0.365), (0.0, 0.365)]
    z_pot = 0.0

    def colr(p):
        r = math.hypot(p[1] + 0.35, p[2] - 0.27)
        k = (0.5 + 0.1 * nz(p, 9.0)) * 0.55
        return (k * 1.08, k * 0.86, k * 0.68)
    rot = Matrix.Rotation(math.radians(98), 3, 'Y')
    lathe(b, prof, 18, "clay", colr, c=(0.62, -0.38, 0.27), rot=rot, uvrep=(1.6, 0.8))
    spill = lambda p: (0.17 + 0.04 * nz(p, 8.0, 4.0), 0.115 + 0.03 * nz(p, 8.0, 4.0), 0.06 + 0.015 * nz(p, 8.0, 4.0))
    blob(b, 1.2, -0.35, 0.036, 0.42, "plain", spill, 31, n=40, stretch=(1.4, 0.9), rot=0.2, lobes=0.3, uvtile=0.5)
    blob(b, 0.85, -0.5, 0.037, 0.2, "plain", spill, 33, n=32, stretch=(1.0, 1.0), lobes=0.3, uvtile=0.4)
    return b.finish(col)


# ---------- kaatunut kuivausteline ----------
def build_rack_fallen(col):
    b = HB("haasia_kaatunut", 273)
    rng = b.rng
    Lr, Hr = 3.2, 1.9
    ang = math.radians(72)
    Rf = Matrix.Rotation(-ang, 3, 'X')                  # kaatuu -Y-suuntaan
    Rz = Matrix.Rotation(0.15, 3, 'Z')
    lift = 0.0
    # nostetaan koko kasa niin, että alin piste on maassa
    pts_probe = [V((x, y, z)) for x in (-1.9, 1.9) for y in (-0.6, 0.6) for z in (-0.15, 2.2)]
    lift = -min((Rz @ Rf @ p).z for p in pts_probe) + 0.04
    tf = lambda p: Rz @ (Rf @ V(p)) + V((0.0, 0.0, lift))
    for sx in (-1, 1):
        x = sx * Lr / 2
        for s in (-1, 1):
            b.pole(tf((x, s * 0.55, -0.15)), tf((x, -s * 0.12, Hr + 0.25)), 0.05, "bark", 5, (0.6, 0.58, 0.55), taper=0.7)
    hay = thatch_tint(4.0, 0, Hr, (0.8, 0.76, 0.6))
    for j, z in enumerate((0.75, 1.3, Hr)):
        yo = 0.36 * (1 - z / Hr)
        for s in ((-1, 1) if j < 2 else (0,)):
            y = s * yo
            b.pole(tf((-Lr / 2 - 0.3, y, z)), tf((Lr / 2 + 0.3, y, z)), 0.035, "bark", 5, (0.58, 0.56, 0.52), vtile=1.0)

            def drape(u, v, y=y, z=z, s=s, j=j):
                x = -Lr / 2 + 0.15 + (Lr - 0.3) * u
                t = v * 2 - 1
                hang = 0.42 + 0.1 * nz((x * 2.5, j, s), 1.0, 5.0)
                at = tf((x, y + t * 0.1, z + 0.06))                      # kiinnityskohta orressa, heinä roikkuu maailman alas-suunnassa
                p = at + V((0.03 * nz((x * 4, t, j), 1.0, 1.0), t * 0.1, -abs(t) ** 1.4 * hang))
                return V((p.x, p.y, max(0.025, p.z)))
            b.grid(drape, 12, 4, "thatch", hay, uvfn=lambda u, v: (u * 2.0, abs(v * 2 - 1) * 0.35))
    # irtonainen orsi ja heinäkimppuja maassa
    b.pole(V((-1.6, -1.95, 0.05)), V((1.2, -2.3, 0.08)), 0.035, "bark", 5, (0.58, 0.56, 0.52), vtile=1.0)
    for i in range(7):
        c = V((rng.uniform(-1.8, 1.6), rng.uniform(-2.2, -1.3), 0.0))
        a = rng.uniform(0, math.tau)
        d = V((math.cos(a), math.sin(a), 0)) * rng.uniform(0.25, 0.5)
        for k in range(3):
            o = V((rng.uniform(-0.05, 0.05), rng.uniform(-0.05, 0.05), 0.0))
            b.pole(c + o, c + d + o * 2 + V((0, 0, 0.03)), 0.02, "straw", 4, hay, taper=0.5)
    return b.finish(col)


# ---------- veri ----------
def build_blood(col):
    b = HH("verilammikko", 301)
    col_f = lambda p: (0.5 + 0.07 * nz(p, 5.0, 1.0), 0.03, 0.022)      # tumma punainen; väri tulee verteksiväreistä
    blob(b, 0.0, 0.0, 0.0, 0.8, "blood", col_f, 41, n=56, stretch=(1.15, 0.85), rot=0.4, lobes=0.3, uvtile=1.0)
    blob(b, 0.55, 0.2, 0.0, 0.32, "blood", col_f, 43, n=36, stretch=(1.2, 0.8), rot=0.9, lobes=0.3, uvtile=1.0)
    for i in range(9):                                          # roiskeet
        a = rng_a = i * 0.7 + 0.3
        d = 1.0 + 0.45 * (i % 3) + 0.1 * i / 9
        blob(b, math.cos(a) * d, math.sin(a) * d * 0.8, 0.0, 0.035 + 0.025 * ((i * 7) % 4) / 3, "blood", col_f, 50 + i, n=14, lobes=0.25, uvtile=1.0)
    ob = b.finish(col)
    b2 = HH("verilammikko_pieni", 302)
    blob(b2, 0.0, 0.0, 0.0, 0.38, "blood", col_f, 61, n=40, stretch=(1.3, 0.8), rot=-0.5, lobes=0.3, uvtile=1.0)
    for i in range(7):
        a = i * 0.9
        blob(b2, math.cos(a) * (0.55 + 0.08 * i), math.sin(a) * (0.35 + 0.05 * i), 0.0, 0.02 + 0.012 * (i % 3), "blood", col_f, 70 + i, n=14, lobes=0.25, uvtile=1.0)
    b2.finish(col)
    return ob


BUILDERS_RUIN = [build_cabin_burnt, build_cookfire_out, build_rack_fallen, build_blood]


def build_lakeruin(export=True):
    col = bpy.data.collections.get("GAME")
    if not col:
        col = bpy.data.collections.new("GAME")
        bpy.context.scene.collection.children.link(col)
    for o in list(col.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    make_ruin_materials()
    for f in BUILDERS_RUIN:
        f(col)
    bpy.context.view_layer.update()
    out = {o.name: {"tris": sum(len(p.vertices) - 2 for p in o.data.polygons), "dim": [round(d, 2) for d in o.dimensions]} for o in col.objects}
    if export:
        out["glb_mb"] = export_lakeruin()
    return out


def export_lakeruin():
    col = bpy.data.collections["GAME"]
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    objs = list(col.objects)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    path = os.path.join(OUT, "lakeruin.glb")
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True,
        export_image_format='WEBP', export_image_quality=82,
        export_vertex_color='NAME', export_vertex_color_name='Col', export_all_vertex_colors=False,
        export_apply=True, export_animations=False, export_yup=True,
        export_cameras=False, export_lights=False,
    )
    return round(os.path.getsize(path) / 1e6, 2)


def preview_ruin(prefix):
    """Esikatselu: maa, mallit omilla paikoillaan ja muutama kuva."""
    sc = bpy.context.scene
    obs = {o.name: o for o in bpy.data.collections["GAME"].objects}
    obs["mokki_palanut"].location = (0, 0, 0)
    obs["keittopaikka_sammunut"].location = (6.0, -3.0, 0)
    obs["haasia_kaatunut"].location = (-6.5, -2.0, 0)
    obs["verilammikko"].location = (0.0, -7.0, 0.02)
    obs["verilammikko_pieni"].location = (3.0, -7.5, 0.02)
    gmesh = bpy.data.meshes.new("pv_ground")
    bm = bmesh.new()
    bm.faces.new([bm.verts.new(p) for p in ((-16, -16, 0), (16, -16, 0), (16, 16, 0), (-16, 16, 0))])
    bm.to_mesh(gmesh)
    g = bpy.data.objects.new("pv_ground", gmesh)
    sc.collection.objects.link(g)
    gm = bpy.data.materials.new("pv_g")
    gm.diffuse_color = (0.3, 0.26, 0.17, 1)
    gmesh.materials.append(gm)
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
    sc.render.resolution_x, sc.render.resolution_y = 1400, 800
    shots = [
        ("a", (0.0, 0.0, 1.2), (3.5, -9.0, 3.4), 32),
        ("b", (0.0, 0.0, 1.0), (-6.0, 5.0, 4.5), 32),
        ("c", (6.0, -3.0, 0.4), (8.5, -5.8, 1.6), 38),
        ("d", (-6.5, -2.0, 0.6), (-4.2, -6.2, 2.4), 38),
        ("e", (1.5, -7.2, 0.0), (1.5, -10.0, 2.6), 40),
    ]
    for name, tgt, pos, lens in shots:
        cam.location = V(pos)
        cam.rotation_euler = (V(tgt) - V(pos)).to_track_quat('-Z', 'Y').to_euler()
        cam.data.lens = lens
        sc.render.filepath = prefix + "_" + name + ".png"
        bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    import json
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    res = build_lakeruin(export=os.environ.get("KALEVALA_NO_EXPORT") is None)
    pv = os.environ.get("KALEVALA_PREVIEW")
    if pv:
        preview_ruin(pv)
    print("RESULT_JSON " + json.dumps(res))
