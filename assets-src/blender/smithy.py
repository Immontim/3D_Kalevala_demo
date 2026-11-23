"""Sepän paja: avokatos, ahjo, hiillos ja palkeet. Vie tiedoston assets/smithy.glb; peli
sijoittelee mallit nimen mukaan. Sepän asuintalo `talo_seppa` on homestead.py:ssä (homestead.glb),
jotta se jakaa tekstuurit pihapiirin kanssa.

Käyttää homestead.py:n rakentajaa (HB), household.py:n apuja (HH) ja cairnfield.py:n kiven
muotoa (rock_pt). Aja taustalla:

    blender --background --factory-startup --python assets-src/blender/smithy.py

Vientikansio: KALEVALA_ASSETS_OUT. Esikatselukuvat: KALEVALA_PREVIEW=<polku ilman päätettä>.

Koordinaatit: Z ylös, avoin etusivu -Y (pelissä +Z), mitat metreinä. **Kaikilla tämän tiedoston
solmuilla on sama origo: pajan lattian keskikohta maan tasossa.** Peli sijoittaa ne siis yhdellä
ja samalla muunnoksella.

- paja: kuusi paalua (x = ±3,0; y = -2, 0, +2), kolme vaakaorttä x-suunnassa, takana
  savilaastilla ladottu kiviseinä (y 1,73..2,27, korkeus noin 1,05 m) ja nokinen lattialaikku.
  Pulpettikaton vaakaortten yläpinta: z = 3,0 + (2,1 - 3,0) * (y + 2) / 4 + 0,18, eli etureuna
  noin 3,2 m ja takareuna noin 2,3 m. Törmäys: paalut ympyröinä (säde 0,11) ja seinä laatikkona
  x -3,2..3,2, y 1,7..2,3.
- paja_katto: ruoteet, laudoitus, tuohi ja turve omana solmunaan, jotta peli voi häivyttää katon
  kameran tieltä. Alapinta noin 0,3 m vaakaortten yläpuolella, räystäät y -2,5 ja +2,35, x ±3,35.
- ahjo: savilaastilla sidotuista luonnonkivistä ladottu korotettu tulisija, keskipiste
  (-0,9; 0,9), noin 1,3 x 1,1 m, yläpinta 0,55 m. Hiilipesä (säde 0,32, syvyys 0,14) keskellä
  hieman vasemmalla, savinen henkari (suutin) vasemmalta ja suojakivi palkeiden edessä.
  Tyhjät pisteet `mount_ahjo` (hiilipesän pohja; liekki ja pistevalo) ja `mount_kipinat`
  (0,2 m pesän yläpuolella; kipinät ja savu). Törmäys: laatikko x -1,85..-0,1, y 0,2..1,6.
- ahjo_hiillos: puuhiilikasa kummuksi pesässä (laki noin 0,1 m yläpinnan yläpuolella, jotta hehku
  näkyy pelikameralle). Kuumat palat ja hehkupohja ovat materiaalia `M_Embers` (emissio
  voimakkuudella 3, jotta pelin bloom tarttuu; peli voi välkyttää `emissiveIntensity`ä), reunojen ja
  ahjon päällä olevat hiilet `M_Charcoal`. Sävy on tarkistettava pelin sävykartoituksella.
- palkeet: kaksi lautapaljetta rinnakkain (y = 0,65 ja 1,15), päät x -2,02:ssa, takapäät noin
  x -2,97:ssä, kahden pölkyn päällä. Kahvat nousevat takapäästä noin 1,1 m:iin (x noin -2,85).
  Pumppaaja seisoo palkeiden takana (x noin -3,3, y 0,9) ja ylettää molempiin kahvoihin.
  Muotoavaimet (glTF morph target) `palje_a` (+Y-puolen palje painuu kiinni) ja `palje_b`
  (-Y-puoli). Lepoasennossa molemmat ovat auki; vuorotteleva pumppaus = painot
  0..1 vastakkaisessa vaiheessa. Törmäys: laatikko x -3,0..-1,8, y 0,4..1,4.
- Lattialaikku on 1,2–1,8 cm maan yläpuolella: maaston pitää olla pajan alla tasainen.
"""
import bpy, bmesh, math, os, random, json
import numpy as np
from mathutils import Vector, Matrix

_HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else r"C:\Data\3D Kalevala\assets-src\blender"
# cairnfield.py ilman pääohjelmaa; se lukee itse homestead.py:n ja household.py:n
exec(open(os.path.join(_HERE, "cairnfield.py"), encoding="utf-8").read().rsplit('\nif __name__ == "__main__":', 1)[0])

OUT = os.environ.get("KALEVALA_ASSETS_OUT", OUT)

# pajan mitat
PX, PY = 3.0, 2.0                 # paalujen puolivälit x- ja y-suunnassa
HF, HBK = 3.0, 2.1                # etu- ja takapaalun korkeus
FX, FY = -0.9, 0.9                # ahjon keskipiste
AX, AY, AH = 0.65, 0.55, 0.55     # ahjon puolimitat ja yläpinnan korkeus
PC = V((FX - 0.08, FY, AH))       # hiilipesän keskipiste yläpinnan tasossa
T0 = V((FX - 0.95, FY, 0.45))     # henkarin ulkopää (palkeiden suuttimet tähän)
T1 = V((PC.x - 0.24, FY, 0.45))   # henkarin sisäpää pesän reunassa
BELLOWS_X = -2.02                 # palkeiden etupää
BELLOWS_Y = (FY + 0.25, FY - 0.25)   # väli riittää kiinni painetun palkeen pullistumalle
TH_OPEN, TH_SHUT = 0.30, 0.04     # palkeen kannen kulma auki ja kiinni (rad)


def roof_z(y):
    """Paalun yläpää: etupaalut 3,0 m, takapaalut 2,1 m."""
    return HF + (HBK - HF) * (y + PY) / (2 * PY)


# ---------- materiaalit ----------
def embers_px(size=256, seed=31):
    """Hehkuvat hiilet: oranssi-punainen hehku, keltaiset raot ja tummia tuhkalaikkuja."""
    rs = np.random.RandomState(seed)
    heat = tile_noise(rs, size, size, 5, 5, 12)
    heat = (heat - heat.min()) / (heat.max() - heat.min())
    crack = np.clip(1 - np.abs(tile_noise(rs, size, size, 9, 9, 10)) * 9, 0, 1)
    ash = np.clip((tile_noise(rs, size, size, 7, 7, 10) - 0.25) * 4, 0, 1)
    red = np.array([0.55, 0.07, 0.01], dtype=np.float32)
    orange = np.array([1.0, 0.36, 0.05], dtype=np.float32)
    yellow = np.array([1.0, 0.78, 0.35], dtype=np.float32)
    glow = red + (orange - red) * heat[..., None]
    glow = glow + (yellow - glow) * (crack * heat)[..., None]
    glow = glow * (1 - 0.85 * ash[..., None])
    base = glow * 0.25 + np.array([0.06, 0.055, 0.05], dtype=np.float32) * ash[..., None]
    return glow.astype(np.float32), base.astype(np.float32)


def embers_mat(strength=3.0):
    g, bcol = embers_px()
    gi, bi = save_px(g, "sm_embers_emit"), save_px(bcol, "sm_embers_diff")
    m = pbr("M_Embers", bi, rough=0.9, twosided=False)
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    te = nt.nodes.new("ShaderNodeTexImage")
    te.image = gi
    nt.links.new(te.outputs["Color"], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = strength
    return m


def make_smithy_materials():
    make_materials()                  # homestead: wood, bark, turf, birch, daub, dark, thatch, wattle
    plain = save_px(np.ones((8, 8, 3), dtype=np.float32), "sm_plain")
    # kivi kuten kalmistossa: sammalet pois, pelkkä kiven rakenne
    d = load_px(os.path.join(DL, "tex_mossy_rock", "mossy_rock_Diffuse_1k.jpg"), 512)
    lum = np.clip(0.42 + 0.58 * d.mean(axis=-1, keepdims=True), 0, 1)
    rd = np.repeat(lum, 3, axis=-1)
    rn = load_px(os.path.join(DL, "tex_mossy_rock", "mossy_rock_nor_gl_1k.jpg"), 512)
    # ladottu kiviseinä: punertava liuske harmaaksi, laastisaumat saven sävyyn
    sd = load_px(os.path.join(DL, "tex_stacked_stone_wall", "stacked_stone_wall_Diffuse_1k.jpg"), 512)
    sl = sd.mean(axis=-1, keepdims=True)
    sd = np.clip((sl * 0.85 + sd * 0.15) * np.array([1.55, 1.5, 1.42], dtype=np.float32), 0, 1)
    sn = load_px(os.path.join(DL, "tex_stacked_stone_wall", "stacked_stone_wall_nor_gl_1k.jpg"), 512)
    fd = load_px(os.path.join(DL, "tex_burned_ground_01", "burned_ground_01_Diffuse_1k.jpg"), 512)
    fn_ = load_px(os.path.join(DL, "tex_burned_ground_01", "burned_ground_01_nor_gl_1k.jpg"), 512)
    ld = load_px(os.path.join(DL, "tex_brown_leather", "brown_leather_diff_1k.jpg"), 512)
    ln = load_px(os.path.join(DL, "tex_brown_leather", "brown_leather_nor_1k.jpg"), 512)
    MATS.update({
        "rock": pbr("M_SM_Rock", save_px(rd, "sm_rock_diff"), save_px(rn, "sm_rock_nor", "Non-Color"), rough=1.0, twosided=False),
        "stonewall": pbr("M_SM_StoneWall", save_px(sd, "sm_wall_diff"), save_px(sn, "sm_wall_nor", "Non-Color"), rough=1.0, twosided=True),
        "floor": pbr("M_SM_Floor", save_px(fd, "sm_floor_diff"), save_px(fn_, "sm_floor_nor", "Non-Color"), rough=1.0, twosided=False),
        "leather": pbr("M_SM_Leather", save_px(ld, "sm_leather_diff"), save_px(ln, "sm_leather_nor", "Non-Color"), rough=0.75),
        "iron": pbr("M_Iron", plain, rough=0.55),
        "charcoal": pbr("M_Charcoal", plain, rough=0.85, twosided=False),
        "embers": embers_mat(),
    })
    MATS["iron"].node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = 0.3


# ---------- apurit ----------
def mount(col, ob, name, loc):
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = 'PLAIN_AXES'
    e.empty_display_size = 0.12
    col.objects.link(e)
    e.parent = ob
    e.location = loc
    return e


def rock(b, c, t, n, rx, ry, rz, seed, color, e=0.75, nu=7, nv=4, uvo=(0.0, 0.0)):
    """Kivi: rx tangentin t, ry normaalin n ja rz pystyakselin suuntaan."""
    c, t, n = V(c), V(t).normalized(), V(n).normalized()
    up = t.cross(n).normalized()
    if up.z < 0:                       # pidä kanta oikeakätisenä, muuten pinnat kääntyvät sisäänpäin
        up, t = -up, -t

    def fn(u, v):
        p = rock_pt(rx, ry, rz, e, seed, u, v)
        return c + t * p.x + n * p.y + up * p.z
    b.grid(fn, nu, nv, "rock", color, uvfn=lambda u, v: (uvo[0] + u * 1.4 * (rx + ry), uvo[1] + v * 1.2 * rz * 2))


def stone_wall(b, x0, x1, yc, th, h, seed):
    """Savilaastilla ladottu kiviseinä x-suunnassa: hieman kalteva, epätasainen yläreuna."""
    L = x1 - x0

    def top(x):
        return h + 0.06 * nz((x * 1.7, yc, 0), 1.0, seed) + 0.03 * nz((x * 5.1, yc, 1), 1.0, seed)

    def col(p):
        k = 0.88 + 0.12 * nz(p, 1.3, seed + 4)
        return (k, k * 0.98, k * 0.95)
    for side in (-1, 1):
        def face(u, v, side=side):
            x = x0 + L * u
            z = (top(x) + 0.0) * v - 0.08 * (1 - v)
            y = yc + side * (th / 2 - 0.07 * v) + 0.025 * nz((x * 2.3, side, z * 2.0), 1.0, seed)
            return V((x, y, z))
        b.grid(face, 18, 3, "stonewall", col, uvfn=lambda u, v, side=side: (side * u * L / 1.3, v * h / 1.3))

    def topf(u, v):
        x = x0 + L * u
        y = yc + (v - 0.5) * (th - 0.14)
        return V((x, y, top(x) + 0.03 * math.sin(v * math.pi)))
    b.grid(topf, 18, 2, "stonewall", col, uvfn=lambda u, v: (u * L / 1.3, v * th / 1.3 + 0.4))
    for x in (x0, x1):
        def end(u, v, x=x):
            y = yc + (u - 0.5) * (th - 0.14 * v)
            return V((x, y, top(x) * v - 0.08 * (1 - v)))
        b.grid(end, 3, 3, "stonewall", col, uvfn=lambda u, v: (u * th / 1.3, v * h / 1.3))


# ---------- paja ----------
def build_paja(col):
    b = HH("paja", 81)
    rng = b.rng
    # paalut ja vaakaorret
    for y in (-PY, 0.0, PY):
        zt = roof_z(y)
        for x in (-PX, PX):
            k = rng.uniform(0.85, 1.0)
            b.pole(V((x + rng.uniform(-0.02, 0.02), y, -0.25)), V((x, y, zt)), 0.11, "bark", 7, (k, k * 0.96, k * 0.92), taper=0.85)
        b.pole(V((-PX - 0.35, y, zt + 0.08)), V((PX + 0.35, y, zt + 0.08)), 0.1, "bark", 7, (0.82, 0.78, 0.74), taper=0.9, vtile=1.2)
    # vinotuet etupaaluista orteen (pitävät avoimen etusivun jäykkänä)
    for x in (-PX, PX):
        s = 1 if x < 0 else -1
        b.pole(V((x, -PY, HF - 0.75)), V((x + s * 0.75, -PY, HF + 0.02)), 0.05, "bark", 5, (0.8, 0.76, 0.72))
    # takaseinä
    stone_wall(b, -PX - 0.2, PX + 0.2, PY, 0.54, 1.05, 3.0)
    # nokinen, tallattu lattia; reuna rosoinen
    x0, x1, y0, y1 = -PX - 0.35, PX + 0.35, -PY - 0.6, PY + 0.2      # takareuna jää seinän alle

    def floor(u, v):
        x, y = x0 + (x1 - x0) * u, y0 + (y1 - y0) * v
        edge = min(u, 1 - u, v, 1 - v)
        if edge < 1e-6:
            ix = 0.35 * (0.5 + 0.5 * nz((x * 1.3, y * 1.3, 2), 1.0, 7.0))
            cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
            d = V((x - cx, y - cy, 0))
            x, y = x - d.x / max(1e-3, d.length) * ix, y - d.y / max(1e-3, d.length) * ix
        return V((x, y, 0.012 + 0.006 * nz((x * 3, y * 3, 0), 1.0, 2.0)))

    def floor_col(p):
        dist = math.hypot(p[0] - FX, p[1] - FY)
        k = (0.62 + 0.12 * nz(p, 2.0, 9.0)) * (0.55 + 0.45 * min(1.0, dist / 2.2))
        return (k, k * 0.95, k * 0.9)
    b.grid(floor, 24, 16, "floor", floor_col, uvfn=lambda u, v: (u * (x1 - x0) / 1.6, v * (y1 - y0) / 1.6))
    return b.finish(col)


def build_paja_katto(col):
    """Pulpettikatto: ruoteet, halkolaudoitus, tuohi ja turve; malka etu- ja takaräystäällä."""
    b = HH("paja_katto", 82)
    rng = b.rng
    ye0, ye1, xe = -PY - 0.5, PY + 0.35, PX + 0.35

    def zr(y):          # ruoteiden keskilinja
        return roof_z(y) + 0.08 + 0.1 + 0.06
    for i in range(11):
        x = -xe + 0.15 + i * (2 * xe - 0.3) / 10 + rng.uniform(-0.04, 0.04)
        b.pole(V((x, ye0, zr(ye0))), V((x, ye1, zr(ye1))), 0.06, "bark", 5, (0.75, 0.72, 0.7), taper=0.85)

    def soot(p, base):
        d = math.hypot(p[0] - FX, p[1] - FY)
        k = base * (0.45 + 0.4 * min(1.0, d / 3.0)) * (0.9 + 0.1 * nz(p, 2.0, 3.0))
        return (k, k * 0.8, k * 0.62)

    def layer(u, v, dz, inset=0.0, lump=0.0):
        x = -xe - 0.05 + inset + (2 * xe + 0.1 - 2 * inset) * u
        y = ye0 - 0.05 + inset + (ye1 - ye0 + 0.1 - 2 * inset) * v
        z = roof_z(y) + dz + lump * (nz((x * 1.4, y * 1.4, 0), 1.0, 5.0) + 0.4 * nz((x * 4, y * 4, 1), 1.0, 2.0))
        return V((x, y, z))
    # halkolaudoitus (näkyy alta) ja tuohi sen päällä
    b.grid(lambda u, v: layer(u, v, 0.31), 14, 10, "wood", lambda p: soot(p, 0.8), uvfn=lambda u, v: (u * 6.8 / 0.9, v * 4.9 / 1.2))
    b.grid(lambda u, v: layer(u, v, 0.335, 0.02), 14, 10, "birch", (0.55, 0.5, 0.45), uvfn=lambda u, v: (u * 6.9 / 1.5, v * 5.0 / 1.5))
    # turve: lohkareinen yläpinta ja reunat tuohen päälle

    def turf_col(p):
        k = 0.85 + 0.15 * nz(p, 1.1, 6.0)
        dry = max(0.0, nz(p, 0.6, 8.0))
        return (k * (0.85 + 0.3 * dry), k * (0.9 + 0.05 * dry), k * 0.7)
    tz, ti = 0.5, 0.06
    b.grid(lambda u, v: layer(u, v, tz, ti, 0.03), 18, 12, "turf", turf_col, uvfn=lambda u, v: (u * 6.8 / 1.4, v * 4.9 / 1.4))
    n = 18
    for (u0, v0, u1, v1) in ((0, 0, 1, 0), (1, 1, 0, 1), (0, 1, 0, 0), (1, 0, 1, 1)):
        for i in range(n):
            a0, a1 = i / n, (i + 1) / n
            pa = layer(u0 + (u1 - u0) * a0, v0 + (v1 - v0) * a0, tz, ti, 0.03)
            pb = layer(u0 + (u1 - u0) * a1, v0 + (v1 - v0) * a1, tz, ti, 0.03)
            qa = layer(u0 + (u1 - u0) * a0, v0 + (v1 - v0) * a0, 0.345, ti - 0.02)
            qb = layer(u0 + (u1 - u0) * a1, v0 + (v1 - v0) * a1, 0.345, ti - 0.02)
            b.face([qa, qb, pb, pa], "turf", lambda p: tuple(x * 0.6 for x in turf_col(p)), tile=0.6)
    # malka (turpeen tukipuu) räystäillä
    for y, dz in ((ye0 - 0.03, 0.42), (ye1 + 0.03, 0.42)):
        b.pole(V((-xe, y, roof_z(y) + dz)), V((xe, y, roof_z(y) + dz)), 0.075, "bark", 6, (0.78, 0.75, 0.72), taper=0.9, vtile=1.2)
    return b.finish(col)


# ---------- ahjo ----------
def sg(w, e):
    return math.copysign(abs(w) ** e, w)


def ahjo_outline(a, z):
    """Ahjon ulkoreuna kulmassa a korkeudella z: pyöristetty suorakaide, seinät hieman kaltevat."""
    s = 1.04 - 0.07 * (z / AH)
    return V((FX + AX * s * sg(math.cos(a), 0.3), FY + AY * s * sg(math.sin(a), 0.3), z))


def bowl_z(r):
    """Hiilipesän pinta etäisyydellä r pesän keskeltä."""
    pts = [(0.0, AH - 0.14), (0.04, AH - 0.14), (0.14, AH - 0.12), (0.24, AH - 0.07), (0.32, AH + 0.005)]
    for (r0, z0), (r1, z1) in zip(pts, pts[1:]):
        if r <= r1:
            return z0 + (z1 - z0) * (r - r0) / (r1 - r0)
    return AH


def build_ahjo(col):
    b = HH("ahjo", 83)
    rng = b.rng
    na = 32

    def clay_col(p):
        z = p[2]
        d = math.hypot(p[0] - PC.x, p[1] - PC.y)
        soot = min(1.0, max(0.0, (z - 0.25) / 0.3)) * 0.55
        k = (0.5 + 0.07 * nz(p, 6.0, 2.0)) * (1 - soot)
        c = (k * 0.74, k * 0.69, k * 0.63)
        if z > AH - 0.16 and d < 0.42:           # palanut punertava reunus ja musta pesä
            f = max(0.0, 1 - d / 0.42)
            c = (c[0] * (1 - f) + 0.42 * f, c[1] * (1 - f) + 0.2 * f, c[2] * (1 - f) + 0.12 * f)
            if d < 0.26:
                c = tuple(x * (0.25 + 0.75 * d / 0.26) for x in c)
        return c
    # savinen runko: kyljet ja yläpinta pesineen
    b.grid(lambda u, v: ahjo_outline(u * math.tau, AH * v - 0.04 * (1 - v)), na, 3, "daub", clay_col,
           uvfn=lambda u, v: (u * 4.6 / 1.2, v * AH / 1.2))
    rows = [(0.0, None), (0.5, None), (1.0, 0.32), (None, 0.24), (None, 0.14), (None, 0.04)]

    def top(u, v):
        a = u * math.tau
        j = min(len(rows) - 2, int(v * (len(rows) - 1) + 1e-6))
        f = v * (len(rows) - 1) - j

        def row_pt(k):
            t, r = rows[k]
            rim = PC + V((math.cos(a) * 0.32, math.sin(a) * 0.32, 0))
            if r is None or t is not None:
                o = ahjo_outline(a, AH)
                p = o.lerp(rim, t)
                p.z = AH + (0.01 if 0 < t < 1 else 0.0)
                return p
            return V((PC.x + math.cos(a) * r, PC.y + math.sin(a) * r, bowl_z(r)))
        return row_pt(j).lerp(row_pt(j + 1), f)
    b.grid(top, na, len(rows) - 1, "daub", clay_col, uvfn=lambda u, v: (u * 3.0, v * 0.9))

    # kiviä kolmessa kerroksessa kyljissä
    dense = [ahjo_outline(i / 400 * math.tau, 0) for i in range(401)]
    cum = [0.0]
    for p, q in zip(dense, dense[1:]):
        cum.append(cum[-1] + (q - p).length)
    per = cum[-1]

    def at(s, z):
        s %= per
        i = max(0, min(399, next(k for k in range(400) if cum[k + 1] >= s)))
        a = (i + (s - cum[i]) / max(1e-6, cum[i + 1] - cum[i])) / 400 * math.tau
        p = ahjo_outline(a, z)
        q = ahjo_outline(a + 0.01, z)
        t = (q - p).normalized()
        n = t.cross(V((0, 0, 1))).normalized()
        if n.dot(V((p.x - FX, p.y - FY, 0))) < 0:
            n = -n
        return p, t, n

    def stone_col(seed):
        r = random.Random(seed)
        g = r.uniform(0.48, 0.72)
        tint = r.choice([(1.0, 0.96, 0.9), (1.05, 0.95, 0.85), (0.96, 0.94, 0.9)])

        def fn(p):
            soot = min(1.0, max(0.0, (p[2] - 0.2) / 0.4)) * 0.45
            k = g * (1 - soot) * (0.92 + 0.08 * nz(p, 9.0, seed))
            return (k * tint[0], k * tint[1], k * tint[2])
        return fn
    seed = 100
    for zc, off in ((0.07, 0.0), (0.2, 0.13), (0.33, 0.05), (0.46, 0.17)):
        s = off
        while s < per - 0.1 + off:
            rx = rng.uniform(0.1, 0.15)
            p, t, n = at(s + rx, zc)
            s += 2 * rx + rng.uniform(-0.01, 0.02)
            if zc > 0.3 and (p - V((T0.x + 0.3, FY, zc))).length < 0.2:
                continue                                 # henkarin aukko
            seed += 1
            rock(b, p + n * rng.uniform(0.03, 0.06) + V((0, 0, rng.uniform(-0.012, 0.012))), t, n,
                 rx, rng.uniform(0.09, 0.12), rng.uniform(0.06, 0.072), seed, stone_col(seed),
                 uvo=(rng.random(), rng.random()))
    # yläreunan isommat laakakivet (ei pesän ja henkarin kohdalla)
    for i in range(9):
        p, t, n = at(per * (i + 0.5) / 9, AH)
        if (p - V((T0.x + 0.3, FY, AH))).length < 0.3:
            continue
        seed += 1
        rock(b, p - n * 0.08 + V((0, 0, 0.01)), t, n, rng.uniform(0.15, 0.2), rng.uniform(0.11, 0.14), 0.045, seed,
             stone_col(seed), e=0.6, uvo=(rng.random(), rng.random()))

    # henkari: savinen suutinputki, sisäpää palanut mustaksi
    def tuy_col(p):
        f = min(1.0, max(0.0, (p[0] - T0.x) / (T1.x - T0.x)))
        return (0.46 - 0.38 * f, 0.4 - 0.34 * f, 0.35 - 0.3 * f)
    b.tube([T0, T0.lerp(T1, 0.5), T1], [0.07, 0.066, 0.058], "daub", 9, tuy_col, vtile=0.3)
    b.tube([T0 + V((0.12, 0, -0.03)), T0 + V((0.34, 0, -0.04))], [0.1, 0.11], "daub", 9,
           lambda p: tuple(x * (0.55 + 0.45 * min(1.0, max(0.0, (T0.x + 0.34 - p[0]) / 0.22))) for x in (0.44, 0.38, 0.33)), vtile=0.3)
    # suojakivi palkeiden ja tulen välissä
    seed += 1
    rock(b, V((T0.x + 0.18, FY, 0.33)), V((0, 1, 0)), V((-1, 0, 0)), 0.32, 0.07, 0.36, seed,
         stone_col(seed), e=0.55, nu=9, nv=6)
    ob = b.finish(col)
    mount(col, ob, "mount_ahjo", (PC.x, PC.y, AH - 0.1))
    mount(col, ob, "mount_kipinat", (PC.x, PC.y, AH + 0.2))
    return ob


def build_hiillos(col):
    b = HH("ahjo_hiillos", 84)
    rng = b.rng

    def bed(u, v):
        r = 0.27 * v
        a = -u * math.tau               # normaali ylöspäin (M_Embers on yksipuolinen)
        return V((PC.x + math.cos(a) * r, PC.y + math.sin(a) * r, bowl_z(r) + 0.035 + 0.15 * (1 - v * v)))
    b.grid(bed, 12, 3, "embers", (1, 1, 1), uvfn=lambda u, v: (u * 1.5, v * 0.6))

    def lump(c, hot, s=1.0):
        R = Matrix.Rotation(rng.uniform(0, math.tau), 3, 'Z') @ Matrix.Rotation(rng.uniform(-0.5, 0.5), 3, 'X')
        size = (rng.uniform(0.045, 0.075) * s, rng.uniform(0.03, 0.055) * s, rng.uniform(0.025, 0.045) * s)
        if hot:
            b.box(c, size, "embers", (1, 1, 1), tile=0.15, rot=R)
        else:
            k = rng.uniform(0.09, 0.14)
            b.box(c, size, "charcoal", (k, k * 0.97, k * 0.95), tile=0.15, rot=R)
    # hiilet kummuksi noin 9 cm yläpinnan yläpuolelle, jotta hehku näkyy pelikameralle reunakivien yli
    for i in range(72):
        r = 0.29 * math.sqrt(rng.random())
        a = rng.uniform(0, math.tau)
        z = bowl_z(r) + 0.03 + 0.2 * (1 - (r / 0.3) ** 2) + rng.uniform(-0.01, 0.015)
        lump(V((PC.x + math.cos(a) * r, PC.y + math.sin(a) * r, z)), r < 0.2 and rng.random() < 0.85)
    # polttoainekasa ahjon takaosassa
    for i in range(14):
        c = V((FX + 0.28 + rng.uniform(-0.12, 0.12), FY + 0.3 + rng.uniform(-0.08, 0.1), AH + 0.03 + rng.uniform(0, 0.05)))
        lump(c, False, 1.1)
    return b.finish(col)


# ---------- palkeet ----------
def bellows_geo(b, th_a, th_b):
    """Kaksi lautapaljetta. Kansi saranoituu etupään päätypalaan; th = kannen kulma."""
    rng = b.rng
    N = 9
    side = []
    for i in range(N):
        s = i / (N - 1)
        d = 0.10 + 0.85 * s
        if s <= 0.75:
            w = 0.07 + 0.12 * math.sin(min(1.0, s / 0.7) * math.pi / 2)
        else:
            w = 0.19 * math.sqrt(max(0.0, 1 - ((s - 0.75) / 0.25) ** 2))
        side.append((d, w))
    ring = [(d, w) for d, w in side] + [(d, -w) for d, w in reversed(side[:-1])]   # vasen eteen->taakse, oikea takaisin

    # pölkyt palkeiden alla
    for x in (BELLOWS_X - 0.27, BELLOWS_X - 0.8):
        b.tube([V((x, FY - 0.5, 0.165)), V((x, FY + 0.5, 0.165))], [0.165, 0.155], "bark", 9, (0.82, 0.78, 0.74), vtile=0.8, urep=2.0)
    for yb, th in zip(BELLOWS_Y, (th_a, th_b)):
        X0 = BELLOWS_X

        def bot(d, w, z):
            return V((X0 - d, yb + w, z))

        def topp(d, w, dz=0.0):
            dd = d - 0.10
            return V((X0 - (0.10 + dd * math.cos(th)) + dz * math.sin(th), yb + w, 0.44 + dd * math.sin(th) + dz * math.cos(th)))
        # pohjalauta (paksuus 3 cm) ja kansi
        for mk, z0, z1 in (("bot", 0.33, 0.36), ("top", 0.0, 0.03)):
            P0 = [bot(d, w, z0) if mk == "bot" else topp(d, w, z0) for d, w in ring]
            P1 = [bot(d, w, z1) if mk == "bot" else topp(d, w, z1) for d, w in ring]
            kk = rng.uniform(0.85, 1.0)
            b.face(list(reversed(P0)), "wood", (kk, kk * 0.95, kk * 0.88), tile=0.5)
            b.face(P1, "wood", (kk, kk * 0.95, kk * 0.88), tile=0.5)
            for i in range(len(ring)):
                j = (i + 1) % len(ring)
                b.face([P0[i], P0[j], P1[j], P1[i]], "wood", (kk * 0.8, kk * 0.76, kk * 0.7), tile=0.3)
        # nahkapalje laudan välissä: pullistuu sitä enemmän, mitä enemmän se on painettu kiinni
        K = 4
        shut = (TH_OPEN - th) / (TH_OPEN - TH_SHUT)
        n2 = []
        for i, (d, w) in enumerate(ring):
            pd, pw = ring[i - 1]
            qd, qw = ring[(i + 1) % len(ring)]
            t = V((qd - pd, qw - pw, 0)).normalized()
            nn = V((t.y, -t.x, 0))
            if nn.y * w < 0 or (abs(w) < 1e-6 and nn.x < 0):
                nn = -nn
            n2.append(nn)
        rows = []
        for k in range(K + 1):
            f = k / K
            row = []
            for (d, w), nn in zip(ring, n2):
                pb, pt = bot(d, w, 0.36), topp(d, w, 0.0)
                gap = (d - 0.1) / 0.85
                bulge = (0.025 + 0.06 * shut) * gap * math.sin(math.pi * f) + 0.006 * math.sin(f * math.pi * 3) * shut * gap
                row.append(pb.lerp(pt, f) + V((-nn.x, nn.y, 0)) * bulge)
            rows.append(row)
        for k in range(K):
            for i in range(len(ring)):
                j = (i + 1) % len(ring)
                b.face([rows[k][i], rows[k][j], rows[k + 1][j], rows[k + 1][i]], "leather", (0.85, 0.78, 0.7), tile=0.35)
        # etupään päätypala, johon kansi saranoituu
        b.box((X0 - 0.05, yb, 0.385), (0.1, 0.15, 0.11), "wood", (0.75, 0.7, 0.64), tile=0.3, grain=0)
        # kahva kannen takapäässä
        h0 = topp(0.82, 0.0, 0.03)
        h1 = topp(0.86, 0.0, 0.5)
        b.pole(h0, h1, 0.022, "wood", 6, (0.85, 0.8, 0.72), taper=0.9)
        b.tube([h1 + V((0, -0.09, 0)), h1 + V((0, 0.09, 0))], 0.024, "wood", 6, (0.82, 0.77, 0.7), vtile=0.3)
        # rautasuutin henkariin
        b.tube([V((X0 - 0.04, yb, 0.39)), V((T0.x + 0.04, FY + (yb - FY) * 0.1, T0.z))], [0.032, 0.024], "iron", 7, (0.22, 0.21, 0.2), vtile=0.3)


def build_palkeet(col):
    def make(name, ta, tb):
        b = HH(name, 85)
        bellows_geo(b, ta, tb)
        return b.finish(col)
    ob = make("palkeet", TH_OPEN, TH_OPEN)
    ob.shape_key_add(name="Basis", from_mix=False)
    for key, ta, tb in (("palje_a", TH_SHUT, TH_OPEN), ("palje_b", TH_OPEN, TH_SHUT)):
        tmp = make("_tmp_" + key, ta, tb)
        assert len(tmp.data.vertices) == len(ob.data.vertices)
        sk = ob.shape_key_add(name=key, from_mix=False)
        for i, v in enumerate(tmp.data.vertices):
            sk.data[i].co = v.co
        me = tmp.data
        bpy.data.objects.remove(tmp, do_unlink=True)
        bpy.data.meshes.remove(me)
    return ob


BUILDERS = [build_paja, build_paja_katto, build_ahjo, build_hiillos, build_palkeet]


def build_smithy(export=True):
    col = bpy.data.collections.get("GAME")
    if not col:
        col = bpy.data.collections.new("GAME")
        bpy.context.scene.collection.children.link(col)
    for o in list(col.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    make_smithy_materials()
    obs = [f(col) for f in BUILDERS]
    bpy.context.view_layer.update()
    out = {}
    for o in obs:
        xs = [v.co for v in o.data.vertices]
        out[o.name] = {"tris": sum(len(p.vertices) - 2 for p in o.data.polygons),
                       "min": [round(min(c[i] for c in xs), 2) for i in range(3)],
                       "max": [round(max(c[i] for c in xs), 2) for i in range(3)]}
    out["tris_total"] = sum(v["tris"] for v in out.values())
    if export:
        out["glb_mb"] = export_smithy()
    return out


def export_smithy():
    col = bpy.data.collections["GAME"]
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    objs = list(col.objects)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    path = os.path.join(OUT, "smithy.glb")
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True,
        export_image_format='WEBP', export_image_quality=82,
        export_vertex_color='NAME', export_vertex_color_name='Col', export_all_vertex_colors=False,
        export_apply=False, export_animations=False, export_morph=True, export_morph_normal=False, export_yup=True,
        export_cameras=False, export_lights=False,
    )
    return round(os.path.getsize(path) / 1e6, 2)


def preview_scene(prefix):
    """Esikatselu: maa, 1,8 m:n mittakaavapylväs sepän paikalla, talo sivussa ja kuvat."""
    sc = bpy.context.scene
    gm = bpy.data.materials.new("pv_g")
    gm.diffuse_color = (0.2, 0.25, 0.12, 1)
    ground = bpy.data.meshes.new("pv_ground")
    bm = bmesh.new()
    bm.faces.new([bm.verts.new(p) for p in ((-40, -30, 0.0), (40, -30, 0.0), (40, 40, 0.0), (-40, 40, 0.0))])
    bm.to_mesh(ground)
    ground.materials.append(gm)
    sc.collection.objects.link(bpy.data.objects.new("pv_ground", ground))
    # mittakaava: 1,8 m:n hahmo ahjon edessä ja palkeiden vieressä
    rm = bpy.data.materials.new("pv_ref")
    rm.diffuse_color = (0.25, 0.3, 0.55, 1)
    for nm, (x, y) in (("pv_seppa", (-0.75, 0.05)), ("pv_salli", (-3.3, 0.9))):
        bpy.ops.mesh.primitive_cylinder_add(radius=0.2, depth=1.8, location=(x, y, 0.9))
        o = bpy.context.active_object
        o.name = nm
        o.data.materials.append(rm)
    # sepän talo vertailuksi 9 m sivuun
    hc = bpy.data.collections.new("PV")
    sc.collection.children.link(hc)
    t = build_smith_house(hc)
    t.location = (11.5, 3.0, 0)
    sun = bpy.data.objects.new("pv_sun", bpy.data.lights.new("pv_sun", 'SUN'))
    sun.data.energy = 4
    sun.rotation_euler = (0.9, 0.2, 0.6)
    sc.collection.objects.link(sun)
    wd = bpy.data.worlds.new("pv_world")
    wd.use_nodes = True
    bg = wd.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.7, 0.78, 0.85, 1)
    sc.world = wd
    cam = bpy.data.objects.new("pv_cam", bpy.data.cameras.new("pv_cam"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = 1280, 720
    pk = bpy.data.objects["palkeet"].data.shape_keys.key_blocks
    shots = [
        ("a", (0.0, 0.0, 1.3), (3.0, -9.0, 3.4), 30, None),           # edestä viistosti
        ("b", (0.0, 0.5, 1.2), (-8.0, 5.5, 3.8), 30, None),          # takaa vasemmalta
        ("c", (-1.0, 0.9, 0.45), (0.2, -0.9, 1.75), 40, None),       # ahjo ja hiillos
        ("d", (-2.4, 0.9, 0.45), (-2.2, -1.1, 1.3), 38, None),       # palkeet auki
        ("e", (-2.4, 0.9, 0.45), (-2.2, -1.1, 1.3), 38, "palje_a"),  # +Y-palje kiinni
        ("f", (-0.7, -0.6, 1.1), (-0.7, -5.4, 2.3), 45, None),        # pelikamera: sankari ahjon edessä, 4,4 m takana, 2,3 m
        ("g", (11.5, 3.0, 2.0), (16.0, -7.5, 3.5), 32, None),        # sepän talo
        ("h", (-1.0, 0.9, 0.5), (0.4, -1.4, 2.0), 35, "night"),      # hämärässä: hehku
    ]
    refs = [bpy.data.objects["pv_seppa"], bpy.data.objects["pv_salli"]]
    for name, tgt, pos, lens, mode in shots:
        for r in refs:
            r.hide_render = name in ("c", "d", "e", "h")
        for k in pk[1:]:
            k.value = 0.0
        sun.data.energy, bg.inputs[1].default_value = 4, 1.0
        if mode == "night":
            sun.data.energy, bg.inputs[1].default_value = 0.05, 0.03
        elif mode:
            pk[mode].value = 1.0
        cam.location = V(pos)
        cam.rotation_euler = (V(tgt) - V(pos)).to_track_quat('-Z', 'Y').to_euler()
        cam.data.lens = lens
        sc.render.filepath = prefix + "_" + name + ".png"
        bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    res = build_smithy(export=os.environ.get("KALEVALA_NO_EXPORT") is None)
    pv = os.environ.get("KALEVALA_PREVIEW")
    if pv:
        preview_scene(pv)
    print("RESULT_JSON " + json.dumps(res))
