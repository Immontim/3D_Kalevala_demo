"""Varhaisrautakautinen pihapiiri: paalurunkoinen punosseinätalo, kuoppatalo,
patsasaitta, katos, punosaita ja pihan pienesineet. Vie tiedoston
assets/homestead.glb; peli (src/world.ts) sijoittelee mallit nimen mukaan.

Lähdetekstuurit: tools/fetch-homestead.ps1 ja tools/fetch-polyhaven.ps1.
Aja Blenderissä tyhjässä tiedostossa:

    exec(open(r"...\\assets-src\\blender\\homestead.py", encoding="utf-8").read())
    result = build_homestead()

Koordinaatit: Z ylös, rakennuksen etusivu (ovi) osoittaa suuntaan -Y, joka on
pelissä +Z. Origo on rakennuksen keskellä maan tasossa.
"""
import bpy, bmesh, math, os, random
import numpy as np
from mathutils import Vector, Matrix, noise

ROOT = r"C:\Data\3D Kalevala"
OUT = os.path.join(ROOT, "assets")
DL = os.path.join(ROOT, "assets-src", "_downloads")
TEXDIR = os.path.join(ROOT, "assets-src", "textures")
BLEND = os.path.join(ROOT, "assets-src", "homestead.blend")
V = Vector
UP = Vector((0, 0, 1))
MATS = {}


# ---------- tekstuurit ----------
def save_px(px, name, colorspace="sRGB"):
    """numpy-kuva (h, w, 3) levylle PNG:nä ja takaisin pakattuna kuvana."""
    os.makedirs(TEXDIR, exist_ok=True)
    h, w = px.shape[:2]
    old = bpy.data.images.get(name)
    if old:
        bpy.data.images.remove(old)
    tmp = bpy.data.images.new(name + "_tmp", w, h, alpha=False)
    full = np.ones((h, w, 4), dtype=np.float32)
    full[..., :3] = np.clip(px, 0, 1)
    tmp.pixels.foreach_set(full.ravel())
    out = os.path.join(TEXDIR, name + ".png")
    tmp.filepath_raw = out
    tmp.file_format = 'PNG'
    tmp.save()
    bpy.data.images.remove(tmp)
    im = bpy.data.images.load(out)
    im.name = name
    im.colorspace_settings.name = colorspace
    im.pack()
    return im


def load_px(path, size):
    im = bpy.data.images.load(path)
    if im.size[0] != size:
        im.scale(size, size)
    px = np.empty(size * size * 4, dtype=np.float32)
    im.pixels.foreach_get(px)
    bpy.data.images.remove(im)
    return px.reshape(size, size, 4)[..., :3]


def scan(folder, tid, size, name, gain=(1, 1, 1), lift=0.0, res="1k"):
    """Poly Haven -tekstuuri: väri sävytettynä ja normaalikartta."""
    d = load_px(os.path.join(DL, folder, "%s_Diffuse_%s.jpg" % (tid, res)), size)
    d = d * np.array(gain, dtype=np.float32) + lift
    n = load_px(os.path.join(DL, folder, "%s_nor_gl_%s.jpg" % (tid, res)), size)
    return save_px(d, name + "_diff"), save_px(n, name + "_nor", "Non-Color")


def height_to_normal(hgt, strength):
    dx = (np.roll(hgt, -1, axis=1) - np.roll(hgt, 1, axis=1)) * strength
    dy = (np.roll(hgt, -1, axis=0) - np.roll(hgt, 1, axis=0)) * strength
    n = np.stack([-dx, -dy, np.ones_like(hgt)], axis=-1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n * 0.5 + 0.5


def tile_noise(rs, w, h, fx, fy, octaves=10):
    """Saumaton pehmeä kohina sinien summana."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    out = np.zeros((h, w), dtype=np.float32)
    for _ in range(octaves):
        a, b = rs.randint(1, fx + 1), rs.randint(0, fy + 1)
        out += np.sin(2 * np.pi * (a * xx / w + b * yy / h) + rs.uniform(0, 6.28)) * rs.uniform(0.4, 1)
    return out / octaves


def wattle_px(size=512, stakes=4, rows=22, seed=11):
    """Oksapunos: vaakavitsat kiertävät pystyseipäät vuorotellen edestä ja takaa."""
    rs = np.random.RandomState(seed)
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    row_h = size / rows
    row = np.floor(yy / row_h).astype(np.int32)
    fy = (yy / row_h) % 1.0                                   # 0..1 vitsan poikki
    wob = tile_noise(rs, size, size, 3, 2, 6) * 0.25
    prof = np.clip(1 - ((fy - 0.5 + wob * 0.3) / 0.47) ** 2, 0, 1) ** 0.5    # pyöreä vitsa
    phase = np.pi * stakes * xx / size + row * np.pi          # joka toinen rivi vastakkain
    wave = np.sin(phase)                                      # +1 = seipään edessä
    withy = prof * (0.55 + 0.45 * wave)
    sx = (xx / (size / stakes)) % 1.0
    stake = np.clip(1 - (np.abs(sx - 0.5) / 0.16) ** 2, 0, 1) ** 0.5 * 0.62
    hgt = np.maximum(withy, stake)
    is_stake = stake > withy
    tint = rs.uniform(0.75, 1.1, rows)[row % rows]            # jokainen vitsa hieman eri sävyä
    grain = tile_noise(rs, size, size, 40, 2, 14) * 0.5 + rs.normal(0, 0.03, (size, size))
    col = np.stack([0.42 * tint, 0.33 * tint, 0.24 * tint], axis=-1) * (1 + grain[..., None] * 0.5)
    col = np.where(is_stake[..., None], np.array([0.40, 0.34, 0.27], dtype=np.float32) * (1 + grain[..., None] * 0.4), col)
    col *= (0.25 + 0.75 * np.clip(hgt * 1.25, 0, 1))[..., None]   # raot ja takana kulkevat osat varjossa
    return col.astype(np.float32), height_to_normal(hgt.astype(np.float32), 5.0)


def wood_px(size=512, seed=3):
    """Kuorittu, harmaantunut puu: pystysuorat syyt, halkeamia ja oksankohtia."""
    rs = np.random.RandomState(seed)
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    warp = tile_noise(rs, size, size, 2, 3, 6) * 14
    g = np.zeros((size, size), dtype=np.float32)
    for f, a in ((9, 0.5), (23, 0.3), (61, 0.2), (130, 0.12)):
        g += a * np.sin(2 * np.pi * f * (xx + warp) / size + rs.uniform(0, 6.28) + tile_noise(rs, size, size, 1, 4, 4) * 3)
    g = g / 1.1
    crack = np.clip(1 - np.abs(np.sin(2 * np.pi * 7 * (xx + warp * 1.5) / size + 1.3)) * 14, 0, 1) * \
        np.clip(tile_noise(rs, size, size, 1, 5, 6) * 3 + 0.2, 0, 1)
    base = 0.47 + 0.11 * g + tile_noise(rs, size, size, 3, 3, 8) * 0.12 + rs.normal(0, 0.015, (size, size))
    base = base * (1 - 0.7 * crack)
    col = np.stack([base * 1.0, base * 0.9, base * 0.78], axis=-1)
    hgt = (0.5 + 0.25 * g - 0.6 * crack).astype(np.float32)
    return col.astype(np.float32), height_to_normal(hgt, 3.0)


def pbr(name, diff=None, nor=None, rough=0.95, twosided=True, color=(1, 1, 1, 1)):
    # Kaikki pinnat ovat kaksipuolisia: seinät ja katot ovat ohuita levyjä, jotka näkyvät molemmilta puolilta.
    m = bpy.data.materials.get(name)
    if m:
        bpy.data.materials.remove(m)
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Base Color"].default_value = color
    if diff:
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = diff
        vc = nt.nodes.new("ShaderNodeVertexColor")
        vc.layer_name = "Col"
        mul = nt.nodes.new("ShaderNodeMix")
        mul.data_type = 'RGBA'
        mul.blend_type = 'MULTIPLY'
        mul.inputs[0].default_value = 1.0
        nt.links.new(tex.outputs["Color"], mul.inputs[6])
        nt.links.new(vc.outputs["Color"], mul.inputs[7])
        nt.links.new(mul.outputs[2], bsdf.inputs["Base Color"])
    if nor:
        tn = nt.nodes.new("ShaderNodeTexImage")
        tn.image = nor
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(tn.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    m.use_backface_culling = not twosided
    return m


def make_materials():
    th_d, th_n = scan("tex_thatch_roof_angled", "thatch_roof_angled", 1024, "hs_thatch", gain=(2.05, 1.8, 1.3), lift=0.02)
    cl_d, cl_n = scan("tex_clay_plaster", "clay_plaster", 512, "hs_daub", gain=(1.5, 1.42, 1.3), lift=0.0)
    tu_d, tu_n = scan("tex_forest_leaves_02", "forest_leaves_02", 512, "hs_turf", gain=(0.74, 0.78, 0.6), res="2k")
    bk_d, bk_n = scan("tex_pine_bark", "pine_bark", 512, "hs_bark", gain=(1.0, 0.95, 0.88))
    w_d, w_n = wattle_px()
    wd_d, wd_n = wood_px()
    birch = bpy.data.images.load(os.path.join(TEXDIR, "birch_bark_diff.png"))
    birch.name = "hs_birch_diff"
    birch.pack()
    MATS.update({
        "thatch": pbr("M_Thatch", th_d, th_n, rough=1.0, twosided=True),
        "daub": pbr("M_Daub", cl_d, cl_n, rough=1.0),
        "turf": pbr("M_Turf", tu_d, tu_n, rough=1.0, twosided=True),
        "bark": pbr("M_PoleBark", bk_d, bk_n, rough=0.95),
        "wattle": pbr("M_Wattle", save_px(w_d, "hs_wattle_diff"), save_px(w_n, "hs_wattle_nor", "Non-Color"), rough=0.95, twosided=True),
        "wood": pbr("M_Wood", save_px(wd_d, "hs_wood_diff"), save_px(wd_n, "hs_wood_nor", "Non-Color"), rough=0.9, twosided=True),
        "birch": pbr("M_BirchBark", birch, rough=0.8, twosided=True),
        "dark": pbr("M_Dark", rough=1.0, color=(0.012, 0.01, 0.008, 1), twosided=True),
    })


# ---------- geometria ----------
class HB:
    """Verkon rakentaja: tasopinnat maailmakoordinaateista laskettavilla UV:illä,
    putket (hirret, seipäät) ja parametripinnat (katot)."""

    def __init__(self, name, seed=1):
        self.name = name
        self.rng = random.Random(seed)
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new("UVMap")
        self.col = self.bm.loops.layers.float_color.new("Col")
        self.mats = []

    def mi(self, m):
        if m not in self.mats:
            self.mats.append(m)
        return self.mats.index(m)

    def _c(self, color, p):
        c = color(p) if callable(color) else color
        return (c[0], c[1], c[2], 1)

    def face(self, pts, mat, color=(1, 1, 1), tile=1.0, uvs=None, smooth=False, uaxis=None):
        pts = [V(p) for p in pts]
        vs = [self.bm.verts.new(p) for p in pts]
        try:
            f = self.bm.faces.new(vs)
        except ValueError:
            return None
        f.material_index = self.mi(mat)
        f.smooth = smooth
        if uvs is None:
            n = (pts[1] - pts[0]).cross(pts[-1] - pts[0]).normalized()
            u = V(uaxis) if uaxis else UP.cross(n)
            if u.length < 1e-3:
                u = V((1, 0, 0))
            u.normalize()
            v = n.cross(u)
            uvs = [(p.dot(u) / tile, p.dot(v) / tile) for p in pts]
        for l, uvv, p in zip(f.loops, uvs, pts):
            l[self.uv].uv = uvv
            l[self.col] = self._c(color, p)
        return f

    def box(self, c, size, mat, color=(1, 1, 1), tile=1.0, rot=None, grain=None):
        """Laatikko; grain = syiden suunta-akseli (0, 1 tai 2), jolloin tekstuurin v kulkee sitä pitkin."""
        c = V(c)
        hx, hy, hz = size[0] / 2, size[1] / 2, size[2] / 2
        R = rot if rot else Matrix.Identity(3)
        cs = [V((sx * hx, sy * hy, sz * hz)) for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)]
        P = [c + R @ p for p in cs]
        quads = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
        for q in quads:
            pts = [P[i] for i in q]
            if grain is None:
                self.face(pts, mat, color, tile)
            else:
                g = R @ V([1 if i == grain else 0 for i in range(3)])
                n = (pts[1] - pts[0]).cross(pts[3] - pts[0]).normalized()
                u = g.cross(n)
                if u.length < 1e-3:       # päätypinta: syyt kohtisuoraan, mikä tahansa suunta käy
                    self.face(pts, mat, color, tile)
                    continue
                u.normalize()
                self.face(pts, mat, color, tile, uvs=[(p.dot(u) / tile, p.dot(g) / tile) for p in pts])

    def tube(self, pts, radii, mat, sides=6, color=(1, 1, 1), vtile=0.8, urep=1.0, caps=True):
        pts = [V(p) for p in pts]
        if not isinstance(radii, (list, tuple)):
            radii = [radii] * len(pts)
        n = len(pts)
        rings, vs, vacc = [], [], 0.0
        for i, p in enumerate(pts):
            d = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
            a = d.orthogonal().normalized()
            b = d.cross(a)
            if i > 0:
                vacc += (p - pts[i - 1]).length
            vs.append(vacc / vtile)
            rings.append([p + (a * math.cos(k * math.tau / sides) + b * math.sin(k * math.tau / sides)) * radii[i] for k in range(sides)])
        bmr = [[self.bm.verts.new(p) for p in r] for r in rings]
        mi = self.mi(mat)
        for i in range(n - 1):
            for k in range(sides):
                k2 = (k + 1) % sides
                f = self.bm.faces.new([bmr[i][k], bmr[i][k2], bmr[i + 1][k2], bmr[i + 1][k]])
                f.material_index = mi
                f.smooth = True
                u0, u1 = k / sides * urep, (k + 1) / sides * urep
                for l, uvv, p in zip(f.loops, [(u0, vs[i]), (u1, vs[i]), (u1, vs[i + 1]), (u0, vs[i + 1])],
                                     [rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]]):
                    l[self.uv].uv = uvv
                    l[self.col] = self._c(color, p)
        if caps:
            # katkaisupinta: vaaleampi puu
            for ring, flip in ((rings[0], True), (rings[-1], False)):
                r = list(reversed(ring)) if flip else ring
                cc = color(r[0]) if callable(color) else color
                self.face(r, mat, tuple(min(1, x * 1.15) for x in cc), tile=0.5)

    def pole(self, a, b, r, mat="bark", sides=6, color=(1, 1, 1), taper=0.8, **kw):
        self.tube([a, b], [r, r * taper], mat, sides, color, **kw)

    def grid(self, fn, nu, nv, mat, color=(1, 1, 1), uvfn=None, smooth=True):
        """Parametripinta p = fn(u, v), u ja v välillä 0..1; jaetut verteksit pehmeää varjostusta varten."""
        P = [[V(fn(i / nu, j / nv)) for i in range(nu + 1)] for j in range(nv + 1)]
        B = [[self.bm.verts.new(p) for p in row] for row in P]
        mi = self.mi(mat)
        for j in range(nv):
            for i in range(nu):
                f = self.bm.faces.new([B[j][i], B[j][i + 1], B[j + 1][i + 1], B[j + 1][i]])
                f.material_index = mi
                f.smooth = smooth
                idx = [(i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)]
                for l, (a, b) in zip(f.loops, idx):
                    l[self.uv].uv = uvfn(a / nu, b / nv) if uvfn else (a / nu, b / nv)
                    l[self.col] = self._c(color, P[b][a])

    def finish(self, collection):
        me = bpy.data.meshes.new(self.name)
        self.bm.to_mesh(me)
        self.bm.free()
        old = bpy.data.objects.get(self.name)
        if old:
            bpy.data.objects.remove(old, do_unlink=True)
        ob = bpy.data.objects.new(self.name, me)
        for m in self.mats:
            me.materials.append(MATS[m])
        ca = me.color_attributes.get("Col")
        if ca:
            me.color_attributes.active_color = ca
            me.color_attributes.render_color_index = list(me.color_attributes).index(ca)
        collection.objects.link(ob)
        return ob


def nz(p, f=1.0, seed=0.0):
    return noise.noise(V((p[0] * f + seed, p[1] * f - seed, p[2] * f + seed * 0.3)))


def wall_tint(zlo, zhi, base=(1, 1, 1)):
    """Seinän sävy: kostea tumma tyvi, räystään alla nokea, laikkuja."""
    def fn(p):
        t = (p[2] - zlo) / max(1e-3, zhi - zlo)
        damp = 1 - 0.38 * max(0.0, 1 - t / 0.22)
        soot = 1 - 0.22 * max(0.0, (t - 0.8) / 0.2)
        k = damp * soot * (0.86 + 0.14 * nz(p, 0.9, 4.0) + 0.07 * nz(p, 3.1, 8.0))
        return (base[0] * k, base[1] * k, base[2] * k)
    return fn


def thatch_tint(seed, zlo, zhi, base=(1, 1, 1)):
    """Olkikaton sävy: harmaantuneita ja sammaloituneita laikkuja, räystäs tummempi."""
    def fn(p):
        t = (p[2] - zlo) / max(1e-3, zhi - zlo)
        k = 0.82 + 0.14 * nz(p, 0.55, seed) + 0.06 * nz(p, 2.1, seed + 3)
        k *= 0.85 + 0.15 * min(1.0, t * 2.5)
        moss = max(0.0, nz(p, 0.35, seed + 9) - 0.25) * (1 - t) * 1.2
        return (base[0] * k * (1 - 0.3 * moss), base[1] * k * (1 - 0.05 * moss), base[2] * k * (1 - 0.4 * moss))
    return fn


def thatch_roof(b, length, half, eave_z, ridge_z, over_end, seed, mat="thatch", courses=4, thick=0.22, nu=14, tint=(1, 1, 1), sag=0.05, y0=0.0):
    """Harjakatto pitkin X-akselia. Kate limittäisinä kerroksina, joiden alareuna on koholla.
    half = räystään etäisyys harjasta vaakasuunnassa, y0 = harjan y-paikka."""
    L = length / 2 + over_end
    col = thatch_tint(seed, eave_z, ridge_z, tint)
    slope = math.hypot(half, ridge_z - eave_z)
    for side in (-1, 1):
        nrm = V((0, side * (ridge_z - eave_z), half)).normalized()
        for c in range(courses):
            t0, t1 = c / courses, min(1.0, (c + 1) / courses + 0.06)

            def fn(u, v, t0=t0, t1=t1, side=side, nrm=nrm, c=c):
                t = t0 + (t1 - t0) * v
                x = -L + 2 * L * u
                y = y0 + side * half * (1 - t)
                z = eave_z + (ridge_z - eave_z) * t
                p = V((x, y, z))
                lift = thick * (0.35 + 0.65 * (1 - v)) + 0.03 * nz((x, side * 3.0, c * 2.0), 0.7, seed)
                p += nrm * lift
                p.z -= sag * math.sin(math.pi * u) * (1 - t)            # vanha katto notkahtaa keskeltä
                if v == 0:
                    p.z -= 0.035 * (1 + nz((x * 3, c, side), 1.0, seed))  # repaleinen alareuna
                return p
            b.grid(fn, nu, 2, mat, col, uvfn=lambda u, v, t0=t0, t1=t1: (u * 2 * L / 1.6, (t0 + (t1 - t0) * v) * slope / 1.6))
            # kerroksen alareunan paksuus
            def edge(u, v, t0=t0, side=side, nrm=nrm, c=c):
                x = -L + 2 * L * u
                p = V((x, y0 + side * half * (1 - t0), eave_z + (ridge_z - eave_z) * t0))
                top = p + nrm * (thick + 0.03 * nz((x, side * 3.0, c * 2.0), 0.7, seed))
                top.z -= 0.035 * (1 + nz((x * 3, c, side), 1.0, seed))
                q = p.lerp(top, v)
                q.z -= sag * math.sin(math.pi * u) * (1 - t0)
                return q
            dark = lambda p, col=col: tuple(x * 0.5 for x in col(p))
            b.grid(edge, nu, 1, mat, dark, uvfn=lambda u, v: (u * 2 * L / 1.6, v * 0.12))
        # päätyräystään paksuus
        for xs in (-1, 1):
            p0 = V((xs * L, y0 + side * half, eave_z))
            p1 = V((xs * L, y0, ridge_z))
            b.face([p0, p1, p1 + nrm * thick, p0 + nrm * thick], mat, lambda p, col=col: tuple(x * 0.55 for x in col(p)), tile=0.5)
    # harjan olkimakkara
    rz = ridge_z + thick * 0.9
    b.tube([V((-L, y0, rz)), V((-L / 2, y0, rz - sag * 0.5)), V((0, y0, rz - sag)), V((L / 2, y0, rz - sag * 0.5)), V((L, y0, rz))],
           0.2, mat, 8, lambda p: tuple(x * 0.9 for x in col(p)), vtile=1.6, urep=0.6)


def ridge_crooks(b, length, ridge_z, n, seed, y0=0.0, size=0.75, sag=0.05):
    """Harjan ristipuut (harakat), jotka pitävät harjaoljet paikallaan."""
    rng = random.Random(seed)
    for i in range(n):
        x = -length / 2 + (i + 0.5) * length / n + rng.uniform(-0.1, 0.1)
        z = ridge_z + 0.35 - sag * math.sin(math.pi * (i + 0.5) / n)
        for s in (-1, 1):
            a = V((x + 0.04 * s, y0 - s * size * 0.75, z - size * 0.75))
            c = V((x + 0.04 * s, y0 + s * size * 0.32, z + size * 0.32))
            b.pole(a, c, 0.035, "bark", 5, (0.75, 0.72, 0.7))


def plank_door(b, hinge, width, height, angle, thick=0.05):
    """Lankkuovi saranapuolelta käännettynä; ovi aukeaa ulos (-Y)."""
    R = Matrix.Rotation(angle, 3, 'Z')
    n = max(2, round(width / 0.22))
    for i in range(n):
        w = width / n
        c = V(hinge) + R @ V(((i + 0.5) * w, 0, height / 2))
        k = 0.8 + 0.2 * b.rng.random()
        b.box(c, (w - 0.012, thick, height), "wood", (k, k * 0.97, k * 0.93), tile=0.9, rot=R, grain=2)
    for z in (0.25, height - 0.25):     # poikkipienat
        c = V(hinge) + R @ V((width / 2, -thick * 0.9, z))
        b.box(c, (width * 0.94, thick * 0.8, 0.11), "wood", (0.7, 0.68, 0.64), tile=0.9, rot=R, grain=0)


# ---------- päätalo ----------
def build_house(col):
    """Kolmilaivainen paalurunkoinen asuintalo: savella silattu oksapunosseinä, olkikatto,
    savuaukot päätykolmioiden huipulla. Ovi pitkällä sivulla (-Y)."""
    b = HB("talo", 21)
    L, W, HW = 10.4, 5.4, 1.75           # pituus, leveys, seinän korkeus
    RZ, OVER, EAVE = 4.9, 0.7, 0.45      # harjan korkeus, päätyräystäs, sivuräystäs
    hx, hy = L / 2, W / 2
    wt = wall_tint(0, HW)
    door_x0, door_x1, door_h = -0.2, 0.85, 1.62
    wins = [(-3.1, 0.82, 0.36, 0.3), (3.0, 0.82, 0.36, 0.3)]   # luukulliset valoaukot: x, z, leveys, korkeus

    # pitkät seinät: savirappaus paalujen väleissä
    nposts = 9
    xs = [-hx + i * L / (nposts - 1) for i in range(nposts)]
    for side in (-1, 1):
        y = side * hy
        for i in range(nposts - 1):
            x0, x1 = xs[i], xs[i + 1]
            segs = [(x0, x1, 0, HW)]
            if side == -1:
                out = []
                for (a, c, z0, z1) in segs:
                    cut = None
                    if a < door_x1 and c > door_x0:
                        cut = (max(a, door_x0), min(c, door_x1), 0, door_h)
                    for (wx, wz, ww, wh) in wins:
                        if a < wx + ww / 2 and c > wx - ww / 2:
                            cut = (wx - ww / 2, wx + ww / 2, wz, wz + wh)
                    if not cut:
                        out.append((a, c, z0, z1))
                        continue
                    ca, cc, cz0, cz1 = cut
                    if ca > a: out.append((a, ca, z0, z1))
                    if cc < c: out.append((cc, c, z0, z1))
                    if cz0 > z0: out.append((ca, cc, z0, cz0))
                    if cz1 < z1: out.append((ca, cc, cz1, z1))
                    # aukon pielet (seinän paksuus)
                    d = 0.16
                    for (px, sgn) in ((ca, 1), (cc, -1)):
                        q = [V((px, y, cz0)), V((px, y + d, cz0)), V((px, y + d, cz1)), V((px, y, cz1))]
                        b.face(q if sgn > 0 else list(reversed(q)), "daub", (0.5, 0.48, 0.45), tile=1.2)
                    if cz0 > 0:
                        b.face([V((ca, y, cz0)), V((cc, y, cz0)), V((cc, y + d, cz0)), V((ca, y + d, cz0))], "daub", (0.55, 0.52, 0.5), tile=1.2)
                    b.face([V((ca, y + d, cz1)), V((cc, y + d, cz1)), V((cc, y, cz1)), V((ca, y, cz1))], "daub", (0.35, 0.33, 0.3), tile=1.2)
                segs = out
            for (a, c, z0, z1) in segs:
                bulge = 0.0
                q = [V((a, y + side * bulge, z0)), V((c, y + side * bulge, z0)), V((c, y, z1)), V((a, y, z1))]
                b.face(q if side == -1 else list(reversed(q)), "daub", wt, tile=1.3)
        # seinäpaalut hieman rappauksen ulkopuolella ja seinähirsi niiden päällä
        for x in xs:
            k = 0.78 + 0.15 * b.rng.random()
            b.pole(V((x, y + side * 0.05, -0.15)), V((x, y + side * 0.05, HW + 0.05)), 0.1, "wood", 7, (k, k * 0.96, k * 0.9), taper=0.92)
        b.pole(V((-hx - 0.35, y + side * 0.05, HW + 0.12)), V((hx + 0.35, y + side * 0.05, HW + 0.12)), 0.095, "wood", 7, (0.72, 0.68, 0.62), taper=0.9, vtile=1.2)

    # päädyt: alaosa rapattu, kolmio paljasta punosta, huipulla savuaukko
    GZ = RZ - 1.05                                  # punos päättyy tähän; yläpuoli on avoin savuaukko
    yg = hy * (RZ - GZ) / (RZ - HW)                  # aukon puolileveys punoksen yläreunassa
    for sx in (-1, 1):
        x = sx * hx
        lo = [V((x, -hy, 0)), V((x, hy, 0)), V((x, hy, HW)), V((x, -hy, HW))]
        b.face(lo if sx == 1 else list(reversed(lo)), "daub", wt, tile=1.3)
        tri = [V((x, -hy, HW)), V((x, hy, HW)), V((x, yg, GZ)), V((x, -yg, GZ))]
        b.face(tri if sx == 1 else list(reversed(tri)), "wattle", wall_tint(HW, GZ + 1.5, (0.95, 0.92, 0.88)), tile=1.6, uaxis=(0, 1, 0))
        # savuaukon takana musta: noen mustaama sisäkatto
        sm = [V((x - sx * 0.3, -yg, GZ)), V((x - sx * 0.3, yg, GZ)), V((x - sx * 0.3, 0, RZ))]
        b.face(sm, "dark")
        for y in (-hy, 0, hy):                        # päätypaalut; keskimmäinen kantaa harjahirttä
            top = HW + 0.05 if y else GZ + 0.1
            b.pole(V((x + sx * 0.05, y, -0.15)), V((x + sx * 0.05, y, top)), 0.1, "wood", 7, (0.74, 0.7, 0.64), taper=0.9)
        b.pole(V((x + sx * 0.06, -hy - 0.2, HW + 0.02)), V((x + sx * 0.06, hy + 0.2, HW + 0.02)), 0.08, "wood", 6, (0.7, 0.66, 0.6))
        b.pole(V((x + sx * 0.06, -yg - 0.25, GZ + 0.02)), V((x + sx * 0.06, yg + 0.25, GZ + 0.02)), 0.06, "wood", 6, (0.6, 0.56, 0.5))
    # harjahirsi pilkistää päädyistä
    b.pole(V((-hx - OVER - 0.25, 0, RZ - 0.12)), V((hx + OVER + 0.25, 0, RZ - 0.12)), 0.1, "wood", 7, (0.6, 0.56, 0.5), taper=0.92, vtile=1.2)

    # kattoruoteet räystään alla
    for side in (-1, 1):
        for i in range(13):
            x = -hx - OVER + 0.25 + i * (L + 2 * OVER - 0.5) / 12
            top = V((x, 0, RZ - 0.02))
            # ruode kulkee harjalta seinähirren yli räystäälle
            ez = HW + 0.2 - (RZ - HW - 0.2) / hy * EAVE
            bot = V((x, side * (hy + EAVE + 0.02), ez))
            b.pole(top, bot, 0.05, "bark", 5, (0.6, 0.57, 0.55), taper=0.8, caps=False)

    eave_z = HW + 0.2 - (RZ - HW - 0.2) / hy * EAVE + 0.06
    thatch_roof(b, L, hy + EAVE + 0.1, eave_z, RZ, OVER, seed=5.0, courses=5, nu=16)
    ridge_crooks(b, L + 2 * OVER, RZ + 0.05, 9, 3)

    # sisätila: tumma laatikko, jotta oviaukosta ja luukuista näkyy hämärä tupa eikä tyhjää
    ix, iy = hx - 0.17, hy - 0.17
    b.face([V((-ix, -iy, 0.02)), V((ix, -iy, 0.02)), V((ix, iy, 0.02)), V((-ix, iy, 0.02))], "dark")
    for (p, q) in (((-ix, -iy), (-ix, iy)), ((-ix, iy), (ix, iy)), ((ix, iy), (ix, -iy)), ((ix, -iy), (-ix, -iy))):
        b.face([V((p[0], p[1], 0)), V((q[0], q[1], 0)), V((q[0], q[1], HW + 0.1)), V((p[0], p[1], HW + 0.1))], "dark")
    b.face([V((-ix, -iy, HW + 0.1)), V((ix, -iy, HW + 0.1)), V((ix, iy, HW + 0.1)), V((-ix, iy, HW + 0.1))], "dark")

    # ovi: pielipuut, kamana, kynnys ja raollaan oleva lankkuovi
    y = -hy
    for x in (door_x0, door_x1):
        b.box((x, y - 0.03, door_h / 2), (0.13, 0.2, door_h), "wood", (0.72, 0.68, 0.62), tile=0.9, grain=2)
    b.box(((door_x0 + door_x1) / 2, y - 0.03, door_h + 0.04), (door_x1 - door_x0 + 0.5, 0.22, 0.15), "wood", (0.66, 0.62, 0.56), tile=0.9, grain=0)
    b.box(((door_x0 + door_x1) / 2, y - 0.03, 0.05), (door_x1 - door_x0, 0.24, 0.12), "wood", (0.55, 0.52, 0.48), tile=0.9, grain=0)
    plank_door(b, (door_x0 + 0.07, y - 0.12, 0.1), door_x1 - door_x0 - 0.14, door_h - 0.14, math.radians(-108))
    # luukut: vasen kiinni, oikea työnnetty sivuun
    for i, (wx, wz, ww, wh) in enumerate(wins):
        b.box((wx, y - 0.02, wz - 0.045), (ww + 0.24, 0.16, 0.07), "wood", (0.62, 0.58, 0.52), tile=0.6, grain=0)
        b.box((wx, y - 0.02, wz + wh + 0.045), (ww + 0.24, 0.16, 0.07), "wood", (0.62, 0.58, 0.52), tile=0.6, grain=0)
        off = 0.0 if i == 0 else ww * 0.85
        b.box((wx + off, y - 0.085, wz + wh / 2), (ww + 0.06, 0.035, wh + 0.02), "wood", (0.74, 0.7, 0.64), tile=0.6, grain=0)
    # kivijalkaa ei ole: seinän tyvellä turvepenkka pitää vedon poissa
    for side in (-1, 1):
        def bank(u, v, side=side):
            x = -hx - 0.2 + (L + 0.4) * u
            if side == -1 and door_x0 - 0.25 < x < door_x1 + 0.25:
                return V((x, side * (hy + 0.02), 0.0))
            w = 0.55 * (1 + 0.25 * nz((x, side, 0), 0.8, 2.0))
            return V((x, side * (hy + 0.02 + w * v), 0.34 * (1 - v) ** 1.5 * (1 + 0.3 * nz((x, side, 1), 1.3, 7.0)) - 0.04 * v))
        b.grid(bank, 22, 3, "turf", lambda p: (0.7 + 0.2 * nz(p, 1.5), 0.72 + 0.2 * nz(p, 1.5), 0.6), uvfn=lambda u, v: (u * (L + 0.4) / 1.4, v * 0.5))
    return b.finish(col)


# ---------- kuoppatalo ----------
PIT = 0.85    # lattian syvyys maanpinnasta
RAMP = 1.9    # kulkuluiskan pituus oven edessä


def build_pithouse(col):
    """Osittain maahan kaivettu talousrakennus: turvekatto ulottuu maahan, päädyssä
    pystypuin tuettu punosseinä ja ovi. Etupääty (ovi) suuntaan -Y."""
    b = HB("kuoppatalo", 33)
    L, HWID, RZ = 4.6, 2.05, 2.25       # pituus (Y), puolileveys maan tasossa, harjan korkeus
    y0, y1 = -L / 2, L / 2
    # katto: A-malli maahan asti, turve tuohen päällä
    tcol = lambda p: (0.62 + 0.22 * nz(p, 1.2, 1.0), 0.7 + 0.22 * nz(p, 0.9, 5.0), 0.5 + 0.15 * nz(p, 1.6, 2.0))
    for side in (-1, 1):
        def fn(u, v, side=side):
            y = y0 - 0.35 + (L + 0.7) * u
            t = v
            x = side * (HWID + 0.25) * (1 - t)
            z = -0.12 + (RZ + 0.12) * t
            bump = 0.07 * nz((x * 1.3, y * 1.3, 0), 1.0, 3.0) + 0.05 * math.sin(math.pi * t)
            nrm = V((side * RZ, 0, HWID)).normalized()
            p = V((x, y, z)) + nrm * (0.12 + bump)
            p.z -= 0.06 * math.sin(math.pi * u) * t
            return p
        b.grid(fn, 10, 6, "turf", tcol, uvfn=lambda u, v: (u * (L + 0.7) / 1.5, v * 3.0 / 1.5))
        # tuohikerros pilkistää turpeen alta päädyissä
        for ys, yy in ((-1, y0 - 0.42), (1, y1 + 0.42)):
            p0, p1 = V((side * (HWID + 0.2), yy, -0.1)), V((0, yy, RZ + 0.06))
            nrm = V((side * RZ, 0, HWID)).normalized()
            b.face([p0, p1, p1 + nrm * 0.2, p0 + nrm * 0.2], "birch", (0.85, 0.8, 0.7), tile=0.8)
    # harjan painopuut ja ristikkäiset kattopuut päädyissä
    b.pole(V((0, y0 - 0.6, RZ + 0.2)), V((0, y1 + 0.6, RZ + 0.2)), 0.07, "bark", 6, (0.7, 0.68, 0.66), vtile=1.0)
    for yy in (y0 - 0.3, y1 + 0.3):
        for s in (-1, 1):
            b.pole(V((s * (HWID + 0.1), yy, -0.15)), V((-s * 0.42, yy, RZ + 0.5)), 0.065, "bark", 6, (0.72, 0.7, 0.68), vtile=1.0)
    # päädyt: punosseinä kuopan pohjalta harjalle, pystypaalut tukena
    wt = wall_tint(-PIT, RZ, (0.95, 0.93, 0.9))
    dw, dh = 0.42, 0.62                 # oven puolileveys ja yläreunan korkeus maasta
    for ys, y in ((-1, y0), (1, y1)):
        xw = HWID * 0.96
        if ys == -1:
            parts = [
                [V((-xw, y, -PIT)), V((-dw, y, -PIT)), V((-dw, y, dh)), V((-xw * (1 - dh / RZ), y, dh)), V((-xw, y, 0))],
                [V((dw, y, -PIT)), V((xw, y, -PIT)), V((xw, y, 0)), V((xw * (1 - dh / RZ), y, dh)), V((dw, y, dh))],
                [V((-xw * (1 - dh / RZ), y, dh)), V((xw * (1 - dh / RZ), y, dh)), V((0, y, RZ))],
            ]
        else:
            parts = [[V((-xw, y, -PIT)), V((xw, y, -PIT)), V((xw, y, 0)), V((0, y, RZ)), V((-xw, y, 0))]]
        for q in parts:
            b.face(q if ys == -1 else list(reversed(q)), "wattle", wt, tile=1.6, uaxis=(1, 0, 0))
        for x in (-1.25, -dw - 0.08, dw + 0.08, 1.25):
            top = RZ * (1 - abs(x) / HWID) - 0.05
            b.pole(V((x, y + ys * 0.07, -PIT - 0.1)), V((x, y + ys * 0.07, top)), 0.07, "wood", 6, (0.7, 0.66, 0.6), taper=0.9)
    b.box((0, y0 - 0.07, dh + 0.05), (2 * dw + 0.5, 0.16, 0.13), "wood", (0.62, 0.58, 0.52), tile=0.8, grain=0)
    plank_door(b, (-dw + 0.02, y0 - 0.14, -PIT + 0.04), 2 * dw - 0.06, dh + PIT - 0.08, math.radians(-100))
    # sisus tummana; pelin maastoon leikataan kulkukuilun kohdalle aukko (PIT_HOLE, world.ts)
    hw = dw + 0.34
    earth = lambda p: (0.42 + 0.08 * nz(p, 3.0), 0.38 + 0.07 * nz(p, 3.0), 0.33)
    b.face([V((-hw, y0 - RAMP, 0.0)), V((hw, y0 - RAMP, 0.0)), V((hw, y0 - 0.3, -PIT)), V((-hw, y0 - 0.3, -PIT))], "daub", earth, tile=1.2)
    b.face([V((-hw, y0 - 0.3, -PIT)), V((hw, y0 - 0.3, -PIT)), V((hw, y0 + 0.25, -PIT)), V((-hw, y0 + 0.25, -PIT))], "daub", earth, tile=1.2)
    b.face([V((-dw - 0.3, y0 + 0.25, -PIT)), V((dw + 0.3, y0 + 0.25, -PIT)), V((dw + 0.3, y0 + 0.25, dh + 0.2)), V((-dw - 0.3, y0 + 0.25, dh + 0.2))], "dark")
    # kulkukuilun reunat: pystypaalut ja punos pitävät maan paikallaan
    for s in (-1, 1):
        x = s * (dw + 0.34)
        q = [V((x, y0 - RAMP, -PIT)), V((x, y0 + 0.25, -PIT)), V((x, y0 + 0.25, 0.12)), V((x, y0 - RAMP, 0.05))]
        b.face(q if s == 1 else list(reversed(q)), "wattle", wall_tint(-PIT, 0.5, (0.85, 0.82, 0.78)), tile=1.6, uaxis=(0, 1, 0))
        for yy in (y0 - 0.15, y0 - 0.85, y0 - 1.55):
            b.pole(V((x - s * 0.05, yy, -PIT - 0.1)), V((x - s * 0.05, yy, 0.3)), 0.06, "wood", 6, (0.68, 0.64, 0.58))
    return b.finish(col)


# ---------- patsasaitta ----------
def build_storehouse(col):
    """Neljän patsaan varaan nostettu vilja-aitta: punosseinät, tuohi-malkakatto. Ovi -Y."""
    b = HB("aitta", 44)
    S, FZ, HW, RZ = 2.5, 1.05, 1.35, 3.25      # sivu, lattian korkeus, seinän korkeus, harja
    h = S / 2
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.pole(V((sx * (h - 0.2), sy * (h - 0.2), -0.2)), V((sx * (h - 0.2), sy * (h - 0.2), FZ + 0.02)), 0.15, "wood", 8, (0.66, 0.62, 0.56), taper=0.85)
            b.pole(V((sx * (h - 0.05), sy * (h - 0.05), FZ)), V((sx * (h - 0.05), sy * (h - 0.05), FZ + HW + 0.05)), 0.075, "wood", 6, (0.74, 0.7, 0.64))
    # lattiahirret ja lankkulattia
    for sy in (-1, 1):
        b.pole(V((-h - 0.35, sy * (h - 0.2), FZ + 0.1)), V((h + 0.35, sy * (h - 0.2), FZ + 0.1)), 0.11, "wood", 7, (0.68, 0.64, 0.58), vtile=1.0)
    for i in range(9):
        x = -h + (i + 0.5) * S / 9
        b.box((x, 0, FZ + 0.23), (S / 9 - 0.015, S + 0.5, 0.07), "wood", (0.6 + 0.1 * b.rng.random(),) * 3, tile=0.9, grain=1)
    z0, z1 = FZ + 0.26, FZ + 0.26 + HW
    wt = wall_tint(z0, z1 + 0.6, (0.95, 0.93, 0.9))
    dw, dh = 0.36, 1.05
    walls = [((-h, -h), (h, -h)), ((h, -h), (h, h)), ((h, h), (-h, h)), ((-h, h), (-h, -h))]
    for i, (p, q) in enumerate(walls):
        if i == 0:
            for (a, c, zb, zt) in ((-h, -dw, z0, z1), (dw, h, z0, z1), (-dw, dw, z0 + dh, z1)):
                b.face([V((a, -h, zb)), V((c, -h, zb)), V((c, -h, zt)), V((a, -h, zt))], "wattle", wt, tile=1.6, uaxis=(1, 0, 0))
        else:
            ua = (1, 0, 0) if p[1] == q[1] else (0, 1, 0)
            b.face([V((p[0], p[1], z0)), V((q[0], q[1], z0)), V((q[0], q[1], z1)), V((p[0], p[1], z1))], "wattle", wt, tile=1.6, uaxis=ua)
    # päätykolmiot (päädyt ±Y) ja sisus
    for sy in (-1, 1):
        tri = [V((-h, sy * h, z1)), V((h, sy * h, z1)), V((0, sy * h, RZ - 0.05))]
        b.face(tri if sy == -1 else list(reversed(tri)), "wattle", wt, tile=1.6, uaxis=(1, 0, 0))
        b.pole(V((-h - 0.3, sy * h, z1 + 0.02)), V((h + 0.3, sy * h, z1 + 0.02)), 0.07, "wood", 6, (0.7, 0.66, 0.6))
    b.face([V((-dw - 0.2, -h + 0.25, z0)), V((dw + 0.2, -h + 0.25, z0)), V((dw + 0.2, -h + 0.25, z0 + dh + 0.1)), V((-dw - 0.2, -h + 0.25, z0 + dh + 0.1))], "dark")
    for x in (-dw, dw):
        b.box((x, -h - 0.02, z0 + dh / 2), (0.1, 0.14, dh), "wood", (0.72, 0.68, 0.62), tile=0.8, grain=2)
    b.box((0, -h - 0.02, z0 + dh + 0.04), (2 * dw + 0.3, 0.16, 0.1), "wood", (0.66, 0.62, 0.56), tile=0.8, grain=0)
    plank_door(b, (-dw + 0.05, -h - 0.1, z0 + 0.02), 2 * dw - 0.1, dh - 0.04, math.radians(-4))
    # malkakatto: tuohilevyt ja niiden päällä painopuut (malat), harja pitkin Y-akselia
    half, over = h + 0.55, 0.5
    ez = z1 - 0.28
    for side in (-1, 1):
        nrm = V((side * (RZ - ez), 0, half)).normalized()
        def fn(u, v, side=side, nrm=nrm):
            y = -h - over + (S + 2 * over) * u
            p = V((side * half * (1 - v), y, ez + (RZ - ez) * v)) + nrm * (0.05 + 0.015 * nz((y * 4, v * 5, side), 1.0, 2.0))
            return p
        b.grid(fn, 8, 3, "birch", lambda p: (0.82 + 0.12 * nz(p, 2.0, 1.0), 0.78 + 0.12 * nz(p, 2.0, 1.0), 0.68 + 0.1 * nz(p, 2.0, 1.0)),
               uvfn=lambda u, v: (v * 1.2, u * 2.2), smooth=False)
        for i in range(9):
            y = -h - over + 0.12 + i * (S + 2 * over - 0.24) / 8
            top = V((-side * 0.25, y, RZ + 0.28))
            bot = V((side * (half + 0.12), y, ez - 0.1)) + nrm * 0.1
            b.pole(bot, top, 0.045, "bark", 5, (0.72, 0.7, 0.68), taper=0.7)
    b.pole(V((0, -h - over - 0.15, RZ - 0.06)), V((0, h + over + 0.15, RZ - 0.06)), 0.08, "wood", 6, (0.62, 0.58, 0.52))
    # lovettu hirsi portaana ovelle
    a, c = V((0.1, -h - 1.55, 0.0)), V((0.0, -h - 0.28, FZ + 0.22))
    b.pole(a, c, 0.13, "wood", 7, (0.7, 0.66, 0.6), taper=0.9)
    d = (c - a).normalized()
    for i in range(4):
        p = a.lerp(c, 0.2 + i * 0.2)
        b.box(p + V((0, 0, 0.1)), (0.3, 0.16, 0.05), "wood", (0.78, 0.74, 0.66), tile=0.5, grain=0)
    return b.finish(col)


# ---------- katos ----------
def build_shed(col):
    """Avoin pulpettikatos neljällä haarukkapaalulla; alla polttopuita. Avoin sivu -Y."""
    b = HB("katos", 55)
    W, D, HF, HB_ = 3.6, 2.4, 2.25, 1.45
    posts = [(-W / 2, -D / 2, HF), (W / 2, -D / 2, HF), (-W / 2, D / 2, HB_), (W / 2, D / 2, HB_)]
    for (x, y, z) in posts:
        b.pole(V((x, y, -0.2)), V((x, y, z)), 0.09, "bark", 6, (0.75, 0.72, 0.7), taper=0.85)
        for s in (-1, 1):   # haarukka
            b.pole(V((x, y, z - 0.05)), V((x, y + s * 0.11, z + 0.22)), 0.045, "bark", 5, (0.75, 0.72, 0.7))
    for y, z in ((-D / 2, HF + 0.07), (D / 2, HB_ + 0.07)):
        b.pole(V((-W / 2 - 0.4, y, z)), V((W / 2 + 0.4, y, z)), 0.07, "bark", 6, (0.72, 0.7, 0.68), vtile=1.0)
    sl = (HB_ - HF) / D
    for i in range(8):
        x = -W / 2 - 0.25 + i * (W + 0.5) / 7
        b.pole(V((x, -D / 2 - 0.45, HF + 0.14 - sl * 0.45)), V((x, D / 2 + 0.4, HB_ + 0.14 + sl * 0.4)), 0.04, "bark", 5, (0.68, 0.66, 0.64))
    col_t = thatch_tint(8.0, HB_, HF + 0.4, (0.95, 0.92, 0.85))
    def roof(u, v):
        x = -W / 2 - 0.45 + (W + 0.9) * u
        y = D / 2 + 0.55 - (D + 1.15) * v
        z = HB_ + 0.2 + (HF - HB_) * ((D / 2 - y) / D) + 0.03 * nz((x * 2, y * 2, 0), 1.0, 6.0)
        return V((x, y, z))
    b.grid(roof, 8, 4, "thatch", col_t, uvfn=lambda u, v: (u * (W + 0.9) / 1.6, v * (D + 1.15) / 1.6))
    def roof2(u, v):
        p = roof(u, v)
        p.z += 0.16
        return p
    b.grid(lambda u, v: roof2(u, v), 8, 4, "thatch", col_t, uvfn=lambda u, v: (u * (W + 0.9) / 1.6 + 0.3, v * (D + 1.15) / 1.6))
    for (u0, v0, u1, v1) in ((0, 0, 1, 0), (0, 1, 1, 1), (0, 0, 0, 1), (1, 0, 1, 1)):
        n = 8
        for i in range(n):
            a0, a1 = i / n, (i + 1) / n
            pa = roof(u0 + (u1 - u0) * a0, v0 + (v1 - v0) * a0)
            pb = roof(u0 + (u1 - u0) * a1, v0 + (v1 - v0) * a1)
            b.face([pa, pb, pb + V((0, 0, 0.16)), pa + V((0, 0, 0.16))], "thatch", lambda p: tuple(x * 0.55 for x in col_t(p)), tile=0.6)
    # takaseinänä harva riukuaita
    for i in range(12):
        x = -W / 2 + 0.1 + i * (W - 0.2) / 11
        b.pole(V((x, D / 2 - 0.02, -0.05)), V((x + b.rng.uniform(-0.04, 0.04), D / 2 - 0.02, HB_ - 0.02)), 0.03, "bark", 5, (0.66, 0.64, 0.62))
    woodpile(b, V((0.1, D / 2 - 0.55, 0)), 2.8, 0.95, 0.55)
    return b.finish(col)


def woodpile(b, c, length, height, depth):
    """Halkopino: halot pinottuna päät näkyvissä (-Y), kaksi tukiseivästä päissä."""
    rng = b.rng
    r = 0.075
    rows = int(height / (r * 1.75))
    for j in range(rows):
        n = int(length / (r * 2.05))
        for i in range(n):
            x = -length / 2 + (i + 0.5 + (0.5 if j % 2 else 0)) * (length / n) + rng.uniform(-0.01, 0.01)
            if abs(x) > length / 2 - r:
                continue
            z = r + j * r * 1.75 + rng.uniform(-0.008, 0.008)
            rr = r * rng.uniform(0.75, 1.1)
            k = rng.uniform(0.7, 1.0)
            dy = rng.uniform(-0.05, 0.05)
            b.tube([c + V((x, -depth / 2 + dy, z)), c + V((x, depth / 2 + dy, z))], rr, "bark" if rng.random() < 0.7 else "wood", 5,
                   (k, k * 0.95, k * 0.9), vtile=0.6)
    for s in (-1, 1):
        b.pole(c + V((s * (length / 2 + 0.03), 0, -0.1)), c + V((s * (length / 2 + 0.03), 0, height + 0.3)), 0.04, "bark", 5, (0.7, 0.68, 0.66))


# ---------- aita ja pienesineet ----------
def build_fence(col):
    """Punosaidan pätkä, 2 m: seipäät ja punosverkko. Pituus X-akselilla, origo keskellä."""
    b = HB("aita", 66)
    Lf, Hf = 2.0, 1.15
    def panel(u, v):
        x = -Lf / 2 + Lf * u
        return V((x, 0.035 * math.sin(u * math.pi * 5), 0.06 + Hf * v + 0.03 * math.sin(u * 7 + 1.0) * v))
    b.grid(panel, 10, 2, "wattle", wall_tint(0, Hf, (0.95, 0.93, 0.9)), uvfn=lambda u, v: (u * Lf / 1.6 * 1.0, v * Hf / 1.6), smooth=True)
    for i in range(5):
        x = -Lf / 2 + i * Lf / 4
        h = Hf + b.rng.uniform(0.12, 0.3)
        b.pole(V((x, 0, -0.25)), V((x + b.rng.uniform(-0.03, 0.03), b.rng.uniform(-0.02, 0.02), h)), 0.035, "bark", 5, (0.74, 0.72, 0.7), taper=0.6)
    return b.finish(col)


def build_gatepost(col):
    b = HB("portinpieli", 67)
    b.pole(V((0, 0, -0.3)), V((0.03, 0.0, 2.1)), 0.11, "wood", 7, (0.72, 0.68, 0.62), taper=0.8)
    return b.finish(col)


def build_woodpile(col):
    b = HB("pino", 71)
    woodpile(b, V((0, 0, 0)), 2.2, 0.8, 0.5)
    return b.finish(col)


def build_block(col):
    """Hakkuupölkky ja pari halkoa."""
    b = HB("polkky", 72)
    b.tube([V((0, 0, -0.05)), V((0, 0, 0.5))], [0.27, 0.24], "bark", 10, (0.8, 0.77, 0.74), vtile=0.8, urep=2.0)
    b.face([V((math.cos(i / 10 * math.tau) * 0.24, math.sin(i / 10 * math.tau) * 0.24, 0.501)) for i in range(10)], "wood", (0.95, 0.9, 0.8), tile=0.4)
    for (x, y, a) in ((0.5, 0.15, 0.4), (0.42, -0.3, 1.9), (-0.45, 0.35, 2.7)):
        d = V((math.cos(a), math.sin(a), 0)) * 0.22
        b.tube([V((x, y, 0.05)) - d, V((x, y, 0.05)) + d], 0.055, "wood", 5, (0.9, 0.85, 0.75), vtile=0.5)
    return b.finish(col)


def build_rack(col):
    """Kuivausteline (haasia): kaksi pukkia, orret ja niille ripustetut heinät."""
    b = HB("haasia", 73)
    Lr, Hr = 3.2, 1.9
    for sx in (-1, 1):
        x = sx * Lr / 2
        for s in (-1, 1):
            b.pole(V((x, s * 0.55, -0.15)), V((x, -s * 0.12, Hr + 0.25)), 0.05, "bark", 5, (0.74, 0.72, 0.7), taper=0.7)
    hay = thatch_tint(4.0, 0, Hr, (1.0, 0.98, 0.8))
    for j, z in enumerate((0.75, 1.3, Hr)):
        yo = 0.36 * (1 - z / Hr)
        for s in ((-1, 1) if j < 2 else (0,)):
            y = s * yo
            b.pole(V((-Lr / 2 - 0.3, y, z)), V((Lr / 2 + 0.3, y, z)), 0.035, "bark", 5, (0.72, 0.7, 0.68), vtile=1.0)
            # heinä roikkuu orren molemmin puolin
            def drape(u, v, y=y, z=z, s=s, j=j):
                x = -Lr / 2 + 0.15 + (Lr - 0.3) * u
                t = v * 2 - 1
                hang = 0.42 + 0.1 * nz((x * 2.5, j, s), 1.0, 5.0)
                return V((x, y + t * 0.1 + 0.03 * nz((x * 4, t, j), 1.0, 1.0), z + 0.06 - abs(t) ** 1.4 * hang))
            b.grid(drape, 12, 4, "thatch", hay, uvfn=lambda u, v: (u * 2.0, abs(v * 2 - 1) * 0.35))
    return b.finish(col)


def build_pot(col):
    """Karkea saviruukku (käsin muovattu, tasapohjainen)."""
    b = HB("ruukku", 74)
    prof = [(0.0, 0.0), (0.1, 0.0), (0.15, 0.06), (0.185, 0.16), (0.18, 0.25), (0.15, 0.31), (0.16, 0.345), (0.14, 0.345), (0.13, 0.31), (0.0, 0.31)]
    n = 12
    def fn(u, v):
        i = min(len(prof) - 2, int(v * (len(prof) - 1)))
        f = v * (len(prof) - 1) - i
        r = prof[i][0] + (prof[i + 1][0] - prof[i][0]) * f
        z = prof[i][1] + (prof[i + 1][1] - prof[i][1]) * f
        a = u * math.tau
        return V((math.cos(a) * r, math.sin(a) * r, z))
    def colr(p):
        k = 0.5 + 0.12 * nz(p, 9.0) - (0.25 if p[2] < 0.12 else 0)      # pohja nokinen
        return (k * 1.1, k * 0.86, k * 0.66)
    b.grid(fn, n, len(prof) - 1, "daub", colr, uvfn=lambda u, v: (u * 1.2, v * 0.6))
    return b.finish(col)


BUILDERS = [build_house, build_pithouse, build_storehouse, build_shed, build_fence, build_gatepost,
            build_woodpile, build_block, build_rack, build_pot]


def build_homestead(export=True, save=True):
    col = bpy.data.collections.get("GAME")
    if not col:
        col = bpy.data.collections.new("GAME")
        bpy.context.scene.collection.children.link(col)
    for o in list(col.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    make_materials()
    obs = [f(col) for f in BUILDERS]
    out = {}
    x = 0.0
    for o in obs:
        me = o.data
        for p in me.polygons:
            pass
        out[o.name] = {"tris": sum(len(p.vertices) - 2 for p in me.polygons), "dim": [round(d, 2) for d in o.dimensions]}
        o.location = (x, 0, 0)          # rivissä esikatselua varten; vienti nollaa paikat
        x += o.dimensions.x / 2 + 4
    if save:
        bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    if export:
        out["glb_mb"] = export_homestead()
    return out


def export_homestead():
    col = bpy.data.collections["GAME"]
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    objs = list(col.objects)
    locs = {o.name: o.location.copy() for o in objs}
    for o in objs:
        o.location = (0, 0, 0)
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    path = os.path.join(OUT, "homestead.glb")
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
