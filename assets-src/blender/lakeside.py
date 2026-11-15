"""Järvenrannan mökkikohtaus: pieni hirsimökki, keittopaikka (kolmijalka, pata, tuli),
istuinhirsi, laituri, tukkivene ja ruoko/kaisla. Vie tiedoston assets/lakeside.glb;
peli sijoittelee mallit nimen mukaan. Tietäjä, koira, kuuset (forest.glb), kivet ja
nuotio ovat jo olemassa muissa tiedostoissa eikä niitä tehdä tässä uudestaan.

Käyttää homestead.py:n rakentajaa (HB), household.py:n apuja (HH, lathe, stone) ja
materiaaleja, joten ne luetaan ensin samaan nimiavaruuteen. Aja taustalla:

    blender --background --factory-startup --python assets-src/blender/lakeside.py

Vientikansion voi vaihtaa ympäristömuuttujalla KALEVALA_ASSETS_OUT (esim. toinen
työpuu). Esikatselukuvat: KALEVALA_PREVIEW=<polku ilman päätettä>.

Koordinaatit: Z ylös, etusivu suuntaan -Y (pelissä +Z), origo pohjan keskellä maan
tasossa, ellei toisin mainita. Mitat metreinä.
- mokki: hirsiseinät hirsien päineen noin 5,0 x 3,7 m (katto 5,7 x 4,0 m räystäineen),
  harjan korkeus noin 3,5 m (savuluukun kansi 3,9 m). Pitkä sivu (X) etuseinä -Y, jossa
  ovi (aukon keskellä x = -0,5, leveys 0,9, korkeus 1,6 m, ovi raollaan ulos, kääntyy
  alueelle y < -1,8). Ikkuna päätyseinässä +X. Pelin törmäyslaatikko: puolileveys x 2,5,
  puolisyvyys y 2,0 (hirsien päät ja kynnys mukana). Sisätila on pimeä laatikko, ei
  kulkukelpoinen.
- keittopaikka: kivikehä (säde 0,55), kolmijalka (korkeus 1,85), ketju ja savipata
  (pohja 0,55 m korkeudella, suun reuna 0,92 m). Tyhjät kiinnityspisteet:
  `mount_tuli` (liekin ja valon paikka, z 0,2) ja `mount_pata` (padan suun keskellä,
  höyryn paikka). Törmäys: pyöreä, säde 0,6.
- istuinhirsi: lepää X-suunnassa, pituus 1,3 m, istuinkorkeus 0,38 m.
- laituri: lähtee rannasta (origo, y = 0) suuntaan -Y, pituus 3,9 m, leveys 1,1 m.
  Kansi on 0,30 m origon yläpuolella, paalut ulottuvat 1,0 m alas, joten vesi voi olla
  mitä tahansa korkeutta z = -0,7 .. 0,1.
- vene: tukkivene, pituus 3,4 m, leveys 0,66 m, keula -Y, origo kölin keskellä.
- mela: lepää Y-suunnassa, pituus 1,35 m, origo varren keskellä (veneen sisälle).
- ruoko_a, ruoko_b (korkeus 1,2-2,0 m) ja kaisla (1,2-1,7 m): tupaat, origo tyvellä.
"""
import bpy, bmesh, math, os, random
import numpy as np
from mathutils import Vector, Matrix

_HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else r"C:\Data\3D Kalevala\assets-src\blender"
exec(open(os.path.join(_HERE, "homestead.py"), encoding="utf-8").read())
# household.py ilman pääohjelmaa (se rakentaisi ja veisi talousesineet)
exec(open(os.path.join(_HERE, "household.py"), encoding="utf-8").read().split('if __name__ == "__main__":')[0])

OUT = os.environ.get("KALEVALA_ASSETS_OUT", OUT)
BLEND = os.path.join(ROOT, "assets-src", "lakeside.blend")


def make_lake_materials():
    """Pihapiirin materiaalit (turve, tumma, savi) ja talousesineiden puu, kaarna ja tuohi."""
    make_materials()
    hs = dict(MATS)
    make_household_materials()
    for k in ("turf", "dark", "daub", "thatch", "wattle"):
        MATS[k] = hs[k]


# ---------- hirsimökki ----------
R_LOG = 0.125           # hirren säde
DZ = 0.205              # kerrosten väli (hirret limittyvät)
Z0 = 0.14
CX, CY = 2.2, 1.7       # seinien keskiviivat: x = ±CX (päädyt), y = ±CY (etu ja taka)
NC = 10                 # kerroksia etu- ja takaseinässä
Z_EAVE = 2.12           # kattotuolin alapinta seinälinjalla
PITCH = 0.65            # katon kaltevuus (rise/run), noin 33 astetta
DOOR = (-0.95, -0.05, 1.62)
WINDOW = (0.1, 0.6, 1.0, 1.4)   # y0, y1, z0, z1 päätyseinässä +X


def cut_segments(lo, hi, gaps, z):
    out = [(lo, hi)]
    for (g0, g1, zlo, zhi) in gaps:
        if z + R_LOG * 0.4 > zlo and z - R_LOG * 0.4 < zhi:
            new = []
            for s0, s1 in out:
                if g1 <= s0 or g0 >= s1:
                    new.append((s0, s1))
                else:
                    if s0 < g0:
                        new.append((s0, g0))
                    if s1 > g1:
                        new.append((g1, s1))
            out = new
    return out


def log_tint(zlo, zhi):
    def fn(p):
        t = min(1.0, max(0.0, (p[2] - zlo) / (zhi - zlo)))
        k = (0.62 + 0.18 * t) * (0.9 + 0.2 * nz(p, 1.3, 2.0))
        return (k * 0.97, k * 0.92, k * 0.85)
    return fn


def hirsi(b, a, c, r, tint, sag=0.0):
    a, c = V(a), V(c)
    d = c - a
    mid = a + d * 0.5 + V((b.rng.uniform(-0.01, 0.01), b.rng.uniform(-0.01, 0.01), sag + b.rng.uniform(-0.012, 0.012)))
    k = b.rng.uniform(0.92, 1.0)
    b.tube([a, mid, c], [r * k, r * (1.0 + b.rng.uniform(-0.04, 0.05)), r * (k + 0.03)], "wood", 8, tint, vtile=0.8, urep=1.5)


def build_cabin(col):
    b = HH("mokki", 101)
    tint = log_tint(0, 2.2)
    OV = 0.28
    # --- perustuskivet ---
    for (x, y) in ((-CX + 0.15, -CY + 0.15), (CX - 0.15, -CY + 0.15), (-CX + 0.15, CY - 0.15), (CX - 0.15, CY - 0.15), (0.0, CY - 0.1), (0.9, -CY + 0.1), (-1.8, -CY + 0.1)):
        stone(b, (x, y, 0.02), 0.27 + b.rng.uniform(-0.04, 0.05), 40 + x * 3 + y)
    # --- etu- ja takaseinä (X-suuntaiset hirret), päätyseinät (Y-suuntaiset, puolen kerroksen ylempänä) ---
    gaps_front = [(DOOR[0], DOOR[1], -1, DOOR[2])]
    for i in range(NC):
        z = Z0 + i * DZ
        for sy, gaps in ((-1, gaps_front), (1, [])):
            for s0, s1 in cut_segments(-CX - OV, CX + OV, gaps, z):
                hirsi(b, (s0, sy * CY, z), (s1, sy * CY, z), R_LOG, tint, sag=-0.004)
    wx = [(WINDOW[0], WINDOW[1], WINDOW[2], WINDOW[3])]
    k = 0
    while True:
        z = Z0 + (k + 0.5) * DZ
        if z + R_LOG > Z_EAVE:                          # katon alapinta rajaa pituuden
            hl = CY - (z + R_LOG - Z_EAVE) / PITCH - 0.12
        else:
            hl = CY + OV
        if hl < 0.15:
            break
        hl = min(hl, CY + OV)
        for sx in (-1, 1):
            gp = wx if sx == 1 else []
            for s0, s1 in cut_segments(-hl, hl, gp, z):
                hirsi(b, (sx * CX, s0, z), (sx * CX, s1, z), R_LOG, tint, sag=-0.004)
        k += 1
    z_top_log = Z0 + (k - 1 + 0.5) * DZ + R_LOG
    # päätykolmion yläosa pystylaudoilla harjalle asti
    for sx in (-1, 1):
        hl = CY - (z_top_log - Z_EAVE) / PITCH
        pts = [V((sx * CX, -hl, z_top_log)), V((sx * CX, hl, z_top_log)), V((sx * CX, 0, Z_EAVE + CY * PITCH + 0.02))]
        b.face(pts if sx == -1 else list(reversed(pts)), "wood", tint, tile=0.6, uaxis=(0, 1, 0))
    # --- oviaukko: pielet, kynnys, ovi raollaan, sisus pimeänä ---
    for x in (DOOR[0] - 0.06, DOOR[1] + 0.06):
        b.box(V((x, -CY, DOOR[2] / 2 + 0.05)), (0.12, 0.3, DOOR[2] + 0.1), "wood", (0.7, 0.64, 0.56), tile=0.8, grain=2)
    b.box(V(((DOOR[0] + DOOR[1]) / 2, -CY - 0.08, 0.04)), (0.95, 0.4, 0.08), "wood", (0.55, 0.5, 0.44), tile=0.8, grain=0)
    plank_door(b, (DOOR[0] + 0.02, -CY - 0.12, 0.08), DOOR[1] - DOOR[0] - 0.04, DOOR[2] - 0.1, math.radians(-72))
    cx = (DOOR[0] + DOOR[1]) / 2
    b.face([V((cx - 0.5, -CY + 0.45, 0.1)), V((cx + 0.5, -CY + 0.45, 0.1)), V((cx + 0.5, -CY + 0.45, DOOR[2] + 0.1)), V((cx - 0.5, -CY + 0.45, DOOR[2] + 0.1))], "dark")
    b.face([V((cx - 0.5, -CY + 0.1, 0.1)), V((cx + 0.5, -CY + 0.1, 0.1)), V((cx + 0.5, -CY + 0.5, 0.1)), V((cx - 0.5, -CY + 0.5, 0.1))], "dark")
    # lattia (näkyy raollaan olevasta ovesta ja ikkunasta)
    b.face([V((-CX + 0.1, -CY + 0.1, 0.11)), V((CX - 0.1, -CY + 0.1, 0.11)), V((CX - 0.1, CY - 0.1, 0.11)), V((-CX + 0.1, CY - 0.1, 0.11))], "dark")
    # --- ikkuna päätyseinässä: pimeä aukko, pielilaudat ja luukku auki ---
    y0, y1, z0, z1 = WINDOW
    xw = CX - 0.12
    b.face([V((xw, y0, z0 - 0.02)), V((xw, y1, z0 - 0.02)), V((xw, y1, z1 + 0.02)), V((xw, y0, z1 + 0.02))], "dark")
    for y in (y0 - 0.025, y1 + 0.025):
        b.box(V((CX + 0.02, y, (z0 + z1) / 2)), (0.2, 0.05, z1 - z0 + 0.12), "wood", (0.72, 0.66, 0.58), tile=0.5, grain=2)
    for z in (z0 - 0.03, z1 + 0.03):
        b.box(V((CX + 0.02, (y0 + y1) / 2, z)), (0.2, y1 - y0 + 0.1, 0.05), "wood", (0.72, 0.66, 0.58), tile=0.5, grain=1)
    Rz = Matrix.Rotation(math.radians(-58), 3, 'Z')
    for j in range(2):      # luukku saranoineen, aukeaa ulos
        pass
    b.box(V((CX + 0.25, y1 + 0.2, (z0 + z1) / 2)), (0.03, y1 - y0 - 0.02, z1 - z0 - 0.02), "wood", (0.62, 0.57, 0.5), tile=0.5,
          rot=Matrix.Rotation(math.radians(-55), 3, 'Z'), grain=2)
    # --- katto: purelinjat, tuohi, turve ---
    XR = CX + 0.5
    ZR = Z_EAVE + CY * PITCH
    OVH = 0.3
    eave_y = CY + OVH
    eave_z = Z_EAVE - OVH * PITCH
    for s in (-1, 1):
        for v in (0.1, 0.4, 0.7):
            y = s * eave_y * (1 - v)
            z = eave_z + (ZR - eave_z) * v - 0.05
            b.pole(V((-XR - 0.1, y, z)), V((XR + 0.1, y, z)), 0.05, "bark", 6, (0.62, 0.58, 0.52), taper=0.9, vtile=1.0)
    b.pole(V((-XR - 0.15, 0, ZR - 0.02)), V((XR + 0.15, 0, ZR - 0.02)), 0.075, "bark", 6, (0.62, 0.58, 0.52), taper=0.92, vtile=1.0)
    th = 0.17
    tcol = lambda p: (0.66 + 0.14 * nz(p, 1.2, 1.0), 0.74 + 0.12 * nz(p, 0.9, 5.0), 0.52 + 0.1 * nz(p, 1.6, 2.0))
    bcol = lambda p: (0.92 * (0.8 + 0.2 * nz(p, 4, 7)), 0.84 * (0.8 + 0.2 * nz(p, 4, 7)), 0.68 * (0.8 + 0.2 * nz(p, 4, 7)))
    for s in (-1, 1):
        nrm = V((0, s * PITCH, 1)).normalized()

        def surf(u, v, lift, s=s, nrm=nrm):
            x = -XR + 2 * XR * u
            y = s * eave_y * (1 - v)
            z = eave_z + (ZR - eave_z) * v
            p = V((x, y, z)) + nrm * lift
            if lift > 0.01:
                p += nrm * (0.035 * nz((x * 1.4, y * 1.4, 0), 1.0, 3.0))
            return p
        b.grid(lambda u, v, s=s: surf(u, v, th), 12, 4, "turf", tcol, uvfn=lambda u, v: (u * 2 * XR / 1.5, v * eave_y * 1.2 / 1.5))
        b.grid(lambda u, v, s=s: surf(u, v, 0.0), 6, 2, "birch", bcol, uvfn=lambda u, v: (u * 2 * XR / 1.2, v * 1.6))
        # räystään ja päätyjen reunapinnat: tuohi näkyy turpeen alta
        b.grid(lambda u, v, s=s: surf(u, 0.0, th * v - 0.03), 12, 1, "birch", lambda p: tuple(c * 1.05 for c in bcol(p)), uvfn=lambda u, v: (u * 2 * XR / 1.2, v * 0.3))
        for xs in (-1, 1):
            b.grid(lambda u, v, s=s, xs=xs: surf(0.0 if xs == -1 else 1.0, v, th * u - 0.03), 1, 4, "birch",
                   lambda p: tuple(c * 1.05 for c in bcol(p)), uvfn=lambda u, v: (u * 0.3, v * 1.6))
    # harjan turverulla
    b.tube([V((-XR - 0.05, 0, ZR + th + 0.04)), V((0, 0, ZR + th + 0.02)), V((XR + 0.05, 0, ZR + th + 0.04))], [0.14, 0.17, 0.14], "turf", 8, tcol, vtile=1.5)
    # savuluukku katon takasivulla (ei piippua): puukehys ja nostettu kansi.
    # Paikallinen kehys on katon pinnassa: X pitkin harjaa, Y alas rinnettä (kohti +Y), Z ulos pinnasta.
    ax, ay = V((1, 0, 0)), V((0, 1, -PITCH)).normalized()
    az = ax.cross(ay).normalized()
    if az.z < 0:
        az = -az
    Rs = Matrix(((ax.x, ay.x, az.x), (ax.y, ay.y, az.y), (ax.z, ay.z, az.z)))
    v_h = 0.78
    y_h = eave_y * (1 - v_h)
    z_h = eave_z + (ZR - eave_z) * v_h
    base = V((-0.9, y_h, z_h)) + V((0, 0, 1)).normalized() * 0.0 + az * th
    for (dx, dy, sx, sy) in ((-0.25, 0, 0.06, 0.56), (0.25, 0, 0.06, 0.56), (0, -0.25, 0.44, 0.06), (0, 0.25, 0.44, 0.06)):
        b.box(base + Rs @ V((dx, dy, 0.1)), (sx, sy, 0.2), "wood", (0.6, 0.55, 0.48), tile=0.5, rot=Rs)
    b.box(base + Rs @ V((0, 0, 0.012)), (0.44, 0.44, 0.02), "dark", rot=Rs)
    lid = Rs @ Matrix.Rotation(math.radians(-20), 3, 'X')
    b.box(base + Rs @ V((0, -0.42, 0.2)), (0.62, 0.55, 0.035), "wood", (0.66, 0.6, 0.52), tile=0.5, rot=lid)
    return b.finish(col)


# ---------- keittopaikka ----------
def build_cookfire(col):
    b = HH("keittopaikka", 111)
    rng = b.rng
    # kivikehä
    for i in range(11):
        a = i / 11 * math.tau + rng.uniform(-0.08, 0.08)
        stone(b, (math.cos(a) * 0.56, math.sin(a) * 0.56, 0.05), rng.uniform(0.12, 0.17), 5.0 + i * 3.3)
    # tuhka ja hiillos
    ash = [V((math.cos(i / 16 * math.tau) * 0.46 * (1 + 0.1 * nz((i, 0, 0), 0.9)), math.sin(i / 16 * math.tau) * 0.46 * (1 + 0.1 * nz((0, i, 0), 0.9)), 0.012)) for i in range(16)]
    b.face(ash, "plain", lambda p: tuple(c * (0.16 + 0.2 * min(1, math.hypot(p[0], p[1]) / 0.46)) for c in (0.8, 0.8, 0.82)), tile=0.5)
    # kalikat: tähtipino, päät tummuneet
    for i in range(6):
        a = i * math.tau / 6 + rng.uniform(-0.15, 0.15)
        d = V((math.cos(a), math.sin(a), 0))
        lo = d * 0.46 + V((0, 0, 0.07))
        hi = d * 0.08 + V((0, 0, 0.26 + 0.04 * (i % 2)))

        def burn(p, d=d):
            r = math.hypot(p[0], p[1])
            k = 0.5 * min(1.0, 0.15 + r * 1.6)
            return (k * 1.05, k * 0.9, k * 0.8)
        b.tube([lo, lo.lerp(hi, 0.5), hi], [0.045, 0.05, 0.04], "bark", 6, burn, vtile=0.5)
    for i in range(5):                                  # hehkuvia hiiltymiä
        a = i / 5 * math.tau + 0.4
        p = V((math.cos(a) * 0.17, math.sin(a) * 0.17, 0.02))
        b.face([p + V((dx * 0.045, dy * 0.045, 0.0)) for dx, dy in ((-1, -1), (1, -1), (1, 1), (-1, 1))], "plain", (1.0, 0.42, 0.1), tile=0.2)
    # kolmijalka
    A = V((0.0, 0.0, 1.85))
    for i in range(3):
        a = i * math.tau / 3 + 0.35
        B = V((math.cos(a) * 1.05, math.sin(a) * 1.05, -0.03))
        E = A + (A - B) * 0.1 + V((0.03 * math.sin(a * 2 + 1), 0.03 * math.cos(a), 0))
        b.tube([B, B.lerp(E, 0.5) + V((0.015, -0.01, 0.0)), E], [0.055, 0.045, 0.034], "bark", 6, (0.62, 0.58, 0.52), vtile=0.9)
    ring = [A + V((math.cos(t / 10 * math.tau) * 0.075, math.sin(t / 10 * math.tau) * 0.075, -0.18 + 0.02 * (t // 4))) for t in range(11)]
    b.tube(ring, 0.011, "plain", 4, (0.35, 0.3, 0.22), vtile=0.2, caps=False)      # sidontanaru
    b.tube([A + V((0, 0, -0.16)), A + V((0, 0, -0.18)), A + V((0.0, 0, -0.2))], 0.018, "plain", 5, (0.2, 0.2, 0.2))
    # ketju ja pata
    z_pot = 0.55
    top_bail = z_pot + 0.62
    links = []
    n = 12
    for i in range(n + 1):
        links.append(V((0, 0, A.z - 0.2 - (A.z - 0.2 - top_bail) * i / n)))
    b.tube(links, [0.013 if i % 2 == 0 else 0.022 for i in range(n + 1)], "plain", 5, (0.22, 0.21, 0.2), vtile=0.2)
    prof = [(0.0, 0.0), (0.11, 0.02), (0.21, 0.10), (0.27, 0.225), (0.256, 0.34), (0.21, 0.41), (0.235, 0.455), (0.21, 0.462), (0.2, 0.41), (0.21, 0.365), (0.0, 0.365)]

    def colr(p):
        z = p[2] - z_pot
        r = math.hypot(p[0], p[1])
        if z > 0.36 and r < 0.215:
            k = 0.3 + 0.08 * nz(p, 30.0)
            return (k * 1.2, k * 0.95, k * 0.55)
        soot = max(0.0, 1 - z / 0.3)
        k = (0.55 + 0.1 * nz(p, 9.0)) * (1 - 0.75 * soot)
        return (k * 1.08, k * 0.86, k * 0.68)
    lathe(b, prof, 18, "clay", colr, c=(0, 0, z_pot), uvrep=(1.6, 0.8))
    bail = [V((math.cos(t) * 0.235, 0.0, z_pot + 0.44 + math.sin(t) * 0.2)) for t in [math.pi * i / 8 for i in range(9)]]
    b.tube(bail, 0.011, "plain", 5, (0.2, 0.19, 0.18), vtile=0.3)
    ob = b.finish(col)
    for name, loc in (("mount_tuli", (0, 0, 0.2)), ("mount_pata", (0, 0, z_pot + 0.4))):
        e = bpy.data.objects.new(name, None)
        e.empty_display_type = 'PLAIN_AXES'
        e.empty_display_size = 0.12
        col.objects.link(e)
        e.parent = ob
        e.location = loc
    return ob


# ---------- istuinhirsi ----------
def build_seat_log(col):
    b = HH("istuinhirsi", 121)
    tint = lambda p: (0.58 + 0.1 * nz(p, 2.0, 1.0), 0.52 + 0.1 * nz(p, 2.0, 1.0), 0.44 + 0.08 * nz(p, 2.0, 1.0))
    b.tube([V((-0.65, 0, 0.19)), V((0, 0.01, 0.2)), V((0.65, 0, 0.19))], [0.19, 0.2, 0.18], "wood", 9, tint, vtile=0.9, urep=1.6)
    for sx in (-1, 1):
        stone(b, (sx * 0.48, -0.04, 0.05), 0.15, 71 + sx)
    return b.finish(col)


# ---------- laituri ----------
def build_jetty(col):
    b = HH("laituri", 131)
    rng = b.rng
    Ld, Wd = 3.9, 1.1
    ZT = 0.30
    gray = lambda k: (0.66 * k, 0.6 * k, 0.52 * k)
    # lankut poikittain, päät epätasaisia
    y = 0.25
    n = 0
    while y > -Ld:
        w = rng.uniform(0.125, 0.16)
        k = rng.uniform(0.8, 1.05)
        ln = Wd + rng.uniform(-0.05, 0.08)
        b.box(V((rng.uniform(-0.025, 0.025), y - w / 2, ZT - 0.027 - 0.004 * (n % 2))), (ln, w - 0.012, 0.055), "wood", gray(k), tile=0.8, grain=0)
        y -= w
        n += 1
    # kantopalkit
    for sx in (-1, 1):
        b.pole(V((sx * 0.38, 0.35, ZT - 0.12)), V((sx * 0.38, -Ld - 0.1, ZT - 0.14)), 0.06, "bark", 7, (0.55, 0.5, 0.45), taper=0.95, vtile=1.0)
    # paalut pareittain
    for yy in (-0.35, -1.55, -2.75, -3.75):
        for sx in (-1, 1):
            top = ZT + (0.32 if yy < -3.5 else 0.12) + rng.uniform(-0.02, 0.04)
            b.pole(V((sx * 0.55, yy, -1.0)), V((sx * 0.55 + rng.uniform(-0.01, 0.01), yy, top)), 0.075, "bark", 7, (0.5, 0.46, 0.42), taper=0.95, vtile=1.0)
    # kiinnitysköysi ja sen kela pään paalussa
    b.tube([V((0.55, -3.75, ZT + 0.22)), V((0.45, -3.7, ZT + 0.12)), V((0.62, -3.78, ZT + 0.05)), V((0.55, -3.75, ZT + 0.18))], 0.02, "plain", 5, (0.45, 0.38, 0.26), vtile=0.2, caps=False)
    # rannan puoleinen laakakivi ja pari kiveä
    stone(b, (0, 0.55, -0.02), 0.45, 9.0)
    stone(b, (-0.8, 0.2, -0.02), 0.22, 4.0)
    return b.finish(col)


# ---------- tukkivene ja mela ----------
def build_boat(col):
    b = HH("vene", 141)
    Lb, Bw = 3.4, 0.66

    def hull(u):
        s = math.sin(math.pi * u)
        w = Bw / 2 * (s ** 0.55 if u > 0.5 else s ** 0.5)
        c = 2 * u - 1
        zb = 0.03 + 0.3 * c ** 4
        zt = 0.32 + 0.34 * c ** 2
        return w, zb, zt

    def shell(u, t, inner):
        w, zb, zt = hull(u)
        if inner:
            w = max(w - 0.05, 0.0)
            zb += 0.05
        a = t * math.pi / 2
        return V((w * math.sin(a), -Lb / 2 + Lb * u, zb + (zt - zb) * (1 - math.cos(a))))

    out_c = lambda p: tuple(k * (0.8 + 0.2 * nz(p, 2.0, 4.0)) for k in (0.62, 0.56, 0.47))
    in_c = lambda p: tuple(k * (0.8 + 0.2 * nz(p, 2.5, 8.0)) for k in (0.38, 0.32, 0.26))
    uv = lambda u, v: (v * 1.0, u * Lb / 1.0)
    b.grid(lambda u, v: shell(u, 2 * v - 1, False), 18, 8, "wood", out_c, uvfn=uv)
    b.grid(lambda u, v: shell(u, 2 * v - 1, True), 18, 8, "wood", in_c, uvfn=uv)
    for s in (-1, 1):
        b.grid(lambda u, v, s=s: shell(u, s, False).lerp(shell(u, s, True), v), 18, 1, "wood", lambda p: tuple(k * 1.15 for k in out_c(p)), uvfn=lambda u, v: (v * 0.3, u * Lb))
    for u in (0.3, 0.7):
        w, zb, zt = hull(u)
        b.box(V((0, -Lb / 2 + Lb * u, zt - 0.06)), (2 * (w - 0.025), 0.19, 0.035), "wood", (0.6, 0.54, 0.45), tile=0.5, grain=0)
    return b.finish(col)


def build_paddle(col):
    b = HH("mela", 151)
    wd = lambda p: (0.7 + 0.1 * nz(p, 4.0), 0.6 + 0.1 * nz(p, 4.0), 0.46)
    b.tube([V((0, 0.5, 0.0)), V((0, -0.2, 0.0)), V((0, -0.62, 0.0))], [0.019, 0.018, 0.02], "wood", 6, wd, vtile=0.6)
    b.box(V((0, -0.9, 0.0)), (0.012, 0.0, 0.0), "wood", wd) if False else None
    for yy, hw in ((-0.64, 0.045), (-0.78, 0.075), (-0.92, 0.08), (-1.04, 0.06), (-1.12, 0.03)):
        pass
    # lapa: nelikulmio ja kärki
    pts_l = [(-0.66, 0.025), (-0.82, 0.075), (-1.0, 0.075), (-1.1, 0.05), (-1.15, 0.0)]
    for (y0, w0), (y1, w1) in zip(pts_l[:-1], pts_l[1:]):
        b.face([V((-w0, y0, -0.006)), V((w0, y0, -0.006)), V((w1, y1, -0.006)), V((-w1, y1, -0.006))], "wood", wd, tile=0.5)
        b.face([V((-w0, y0, 0.006)), V((-w1, y1, 0.006)), V((w1, y1, 0.006)), V((w0, y0, 0.006))], "wood", wd, tile=0.5)
    b.tube([V((-0.025, 0.5, 0.0)), V((0.025, 0.5, 0.0))], 0.026, "wood", 6, wd, vtile=0.3)
    b.tube([V((-0.02, -0.66, 0.0)), V((0.02, -0.66, 0.0))], 0.018, "wood", 5, wd, vtile=0.3)
    return b.finish(col)


# ---------- ruoko ja kaisla ----------
def blade(b, base, d, h, bend, w0, seed, c0, c1, segs=5):
    """Kapea kaareva lehtinauha."""
    base, d = V(base), V(d).normalized()
    side = V((-d.y, d.x, 0)).normalized()
    pts = []
    for i in range(segs + 1):
        t = i / segs
        p = base + V((0, 0, h * t)) + d * (bend * t * t * h)
        wd = w0 * (1 - t) ** 0.6 + 0.002
        pts.append((p - side * wd, p + side * wd, t))
    for (a0, a1, t0), (c_0, c_1, t1) in zip(pts[:-1], pts[1:]):
        col = lambda p, t0=t0, t1=t1: tuple(c0[i] + (c1[i] - c0[i]) * min(1, max(0, (p[2] - base.z) / h)) for i in range(3))
        b.face([a0, a1, c_1, c_0], "plain", col, tile=0.5)


def build_reeds(col, name, seed, n, hmin, hmax, plume):
    b = HH(name, seed)
    rng = b.rng
    for i in range(n):
        a = rng.uniform(0, math.tau)
        r = rng.uniform(0.0, 0.28)
        base = (math.cos(a) * r, math.sin(a) * r, -0.03)
        d = V((math.cos(a + rng.uniform(-0.6, 0.6)), math.sin(a + rng.uniform(-0.6, 0.6)), 0))
        h = rng.uniform(hmin, hmax)
        bend = rng.uniform(0.1, 0.38)
        blade(b, base, d, h, bend, rng.uniform(0.018, 0.03), seed + i, (0.3, 0.38, 0.17), (0.66, 0.62, 0.3))
        if plume and i % 3 == 0:                        # röyhy tai kaislan tähkä
            top = V(base) + V((0, 0, h * 1.08)) + d * (bend * h * 0.55)
            b.tube([V(base), V(base).lerp(top, 0.55) + d * (0.02 * h), top], [0.011, 0.008, 0.006], "plain", 4, (0.45, 0.45, 0.22), vtile=0.3, caps=False)
            if name == "kaisla":
                b.tube([top - V((0, 0, 0.02)), top + V((0, 0, 0.17))], [0.03, 0.026], "plain", 6, (0.26, 0.15, 0.08), vtile=0.2)
            else:
                b.tube([top - V((0, 0, 0.1)), top + V((0.0, 0, 0.2))], [0.012, 0.03, 0.006], "plain", 5, (0.5, 0.42, 0.36), vtile=0.2)
    return b.finish(col)


BUILDERS = [
    build_cabin, build_cookfire, build_seat_log, build_jetty, build_boat, build_paddle,
    lambda c: build_reeds(c, "ruoko_a", 161, 20, 1.2, 2.0, True),
    lambda c: build_reeds(c, "ruoko_b", 171, 14, 1.0, 1.6, True),
    lambda c: build_reeds(c, "kaisla", 181, 10, 1.2, 1.7, True),
]


def build_lakeside(export=True):
    col = bpy.data.collections.get("GAME")
    if not col:
        col = bpy.data.collections.new("GAME")
        bpy.context.scene.collection.children.link(col)
    for o in list(col.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    make_lake_materials()
    obs = [f(col) for f in BUILDERS]
    bpy.context.view_layer.update()
    out = {o.name: {"tris": sum(len(p.vertices) - 2 for p in o.data.polygons), "dim": [round(d, 2) for d in o.dimensions]} for o in obs}
    if export:
        out["glb_mb"] = export_lakeside()
    return out


def export_lakeside():
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
    path = os.path.join(OUT, "lakeside.glb")
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
    """Esikatselu: maa, järvi, mallit paikoillaan ja muutama kuva."""
    sc = bpy.context.scene
    obs = {o.name: o for o in bpy.data.collections["GAME"].objects}
    obs["mokki"].location = (0, 0, 0)
    obs["keittopaikka"].location = (3.9, -3.2, 0)
    obs["istuinhirsi"].location = (5.4, -3.2, 0)
    obs["istuinhirsi"].rotation_euler = (0, 0, math.radians(75))
    obs["laituri"].location = (-1.5, -8.2, 0)
    obs["vene"].location = (2.4, -8.6, -0.1)
    obs["vene"].rotation_euler = (0, 0, math.radians(8))
    obs["mela"].location = (2.4, -8.6, 0.28)
    obs["ruoko_a"].location = (-4.5, -8.4, -0.2)
    obs["ruoko_b"].location = (-3.4, -9.4, -0.2)
    obs["kaisla"].location = (4.6, -9.6, -0.2)
    for nm, loc in (("ruoko_a", (5.7, -8.1, -0.2)), ("ruoko_b", (7.0, -10.0, -0.2))):
        pass
    ground = bpy.data.meshes.new("pv_ground")
    bm = bmesh.new()
    for (x0, y0, x1, y1, z) in ((-14, -7.6, 14, 14, 0.0), (-14, -25, 14, -7.6, -0.7)):
        vs = [bm.verts.new(p) for p in ((x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z))]
        bm.faces.new(vs)
    bm.to_mesh(ground)
    g = bpy.data.objects.new("pv_ground", ground)
    sc.collection.objects.link(g)
    gm = bpy.data.materials.new("pv_g")
    gm.diffuse_color = (0.18, 0.24, 0.1, 1)
    ground.materials.append(gm)
    # veden pinta
    wm = bpy.data.meshes.new("pv_water")
    bm = bmesh.new()
    bm.faces.new([bm.verts.new(p) for p in ((-30, -30, -0.15), (30, -30, -0.15), (30, -7.4, -0.15), (-30, -7.4, -0.15))])
    bm.to_mesh(wm)
    w = bpy.data.objects.new("pv_water", wm)
    sc.collection.objects.link(w)
    wmat = bpy.data.materials.new("pv_w")
    wmat.use_nodes = True
    wmat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.05, 0.14, 0.2, 1)
    wmat.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.1
    wm.materials.append(wmat)
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
        ("a", (0.5, -4.8, 1.2), (9.5, -15.5, 3.4), 32),
        ("b", (0.0, 0.0, 1.5), (-3.2, -7.8, 2.4), 40),
        ("c", (3.9, -3.2, 0.9), (6.2, -5.5, 1.5), 40),
        ("d", (-0.3, -8.2, 0.2), (3.0, -12.5, 1.6), 40),
        ("e", (2.4, -8.6, 0.3), (4.4, -10.4, 1.4), 40),
        ("f", (0.5, 0.0, 1.5), (0.5, -9.5, 1.6), 40),
        ("g", (0.0, 0.5, 2.2), (-6.5, 7.5, 4.5), 38),
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
    res = build_lakeside(export=os.environ.get("KALEVALA_NO_EXPORT") is None)
    pv = os.environ.get("KALEVALA_PREVIEW")
    if pv:
        preview_scene(pv)
    print("RESULT_JSON " + json.dumps(res))
