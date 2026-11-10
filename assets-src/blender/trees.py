"""Pelipuiden ja aluskasvillisuuden rakentaja (matalapolygoniset mallit,
skannatut kaarnat + oksakorttiatlas). Ajetaan Blenderissä exec():llä
cards.py:n jälkeen. Kaikki mallit menevät kokoelmaan GAME.
"""
import bpy, bmesh, math, random, json, os
import numpy as np
from mathutils import Vector, Matrix

ROOT = r"C:\Data\3D Kalevala\assets-src"
DL = os.path.join(ROOT, "_downloads")
TEXDIR = os.path.join(ROOT, "textures")
os.makedirs(TEXDIR, exist_ok=True)
V = Vector
UP = Vector((0, 0, 1))


# ---------- tekstuurit ja materiaalit ----------
def load_img(path, name, size=None, colorspace="sRGB"):
    im = bpy.data.images.get(name)
    if im:
        return im
    im = bpy.data.images.load(path)
    if size and im.size[0] > size:
        # pienennetty kopio levylle, jotta pakkaus ja vienti käyttävät oikeaa kokoa
        im.scale(size, int(size * im.size[1] / im.size[0]))
        out = os.path.join(TEXDIR, name + ".png")
        im.filepath_raw = out
        im.file_format = 'PNG'
        im.save()
        bpy.data.images.remove(im)
        im = bpy.data.images.load(out)
    im.name = name
    im.colorspace_settings.name = colorspace
    im.pack()
    return im


def img_from_px(px, name, colorspace="sRGB"):
    h, w = px.shape[:2]
    im = bpy.data.images.get(name)
    if im:
        bpy.data.images.remove(im)
    tmp = bpy.data.images.new(name + "_tmp", w, h, alpha=px.shape[2] == 4)
    full = np.ones((h, w, 4), dtype=np.float32)
    full[..., :px.shape[2]] = px
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


def get_px(im):
    w, h = im.size
    px = np.empty(w * h * 4, dtype=np.float32)
    im.pixels.foreach_get(px)
    return px.reshape(h, w, 4)


def pbr(name, diff, nor=None, alpha=False, rough=0.9, twosided=False, vcol=True):
    m = bpy.data.materials.get(name)
    if m:
        bpy.data.materials.remove(m)
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = rough
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = diff
    if vcol:
        vc = nt.nodes.new("ShaderNodeVertexColor")
        vc.layer_name = "Col"
        mul = nt.nodes.new("ShaderNodeMix")
        mul.data_type = 'RGBA'
        mul.blend_type = 'MULTIPLY'
        mul.inputs[0].default_value = 1.0
        nt.links.new(tex.outputs["Color"], mul.inputs[6])
        nt.links.new(vc.outputs["Color"], mul.inputs[7])
        nt.links.new(mul.outputs[2], bsdf.inputs["Base Color"])
    else:
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    if alpha:
        nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
    if nor:
        nt_n = nt.nodes.new("ShaderNodeTexImage")
        nt_n.image = nor
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(nt_n.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    m.use_backface_culling = not twosided
    return m


def birch_bark_px(w=512, h=1024, seed=4):
    rs = np.random.RandomState(seed)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    base = np.full((h, w), 0.66, dtype=np.float32)
    for _ in range(14):   # pehmeä laikukkuus, saumaton
        fx, fy = rs.randint(1, 5), rs.randint(1, 9)
        base += 0.018 * np.sin(2 * np.pi * (fx * xx / w + fy * yy / h) + rs.uniform(0, 6.28))
    base += rs.normal(0, 0.02, (h, w)).astype(np.float32)
    dark = np.zeros((h, w), dtype=np.float32)
    for _ in range(800):  # vaakasuorat korkkihuokoset
        cx, cy = rs.randint(0, w), rs.randint(0, h)
        ln, th = rs.randint(8, 90), rs.uniform(1.0, 3.5)
        dx = np.minimum(np.abs(xx - cx), w - np.abs(xx - cx))
        dy = np.minimum(np.abs(yy - cy), h - np.abs(yy - cy))
        dark = np.maximum(dark, np.clip(1 - (dx / ln) ** 2 - (dy / th) ** 2, 0, 1) * rs.uniform(0.5, 1))
    for _ in range(18):    # mustat rosoiset oksanarvet
        cx, cy = rs.randint(0, w), rs.randint(0, h)
        rx, ry = rs.randint(18, 50), rs.randint(14, 40)
        dx = np.minimum(np.abs(xx - cx), w - np.abs(xx - cx))
        dy = np.minimum(np.abs(yy - cy), h - np.abs(yy - cy))
        blob = np.clip(1.15 - (dx / rx) ** 2 - (dy / ry) ** 1.3 + rs.normal(0, 0.12, (h, w)), 0, 1)
        dark = np.maximum(dark, blob)
    v = base * (1 - 0.86 * dark)
    px = np.stack([v * 1.0, v * 0.985, v * 0.94], axis=-1)
    return np.clip(px, 0, 1)


def make_materials():
    t = lambda *a: os.path.join(DL, *a)
    atlas = load_img(os.path.join(ROOT, "cards", "foliage_atlas.png"), "foliage_atlas")
    atlas.reload()
    atlas.pack()
    pine_d = load_img(t("tex_pine_bark", "pine_bark_Diffuse_1k.jpg"), "pine_bark_diff", 1024)
    pine_n = load_img(t("tex_pine_bark", "pine_bark_nor_gl_1k.jpg"), "pine_bark_nor", 1024, "Non-Color")
    spr_d = load_img(t("tex_fir_tree_01", "fir_tree_01_bark_diff_2k.jpg"), "spruce_bark_diff", 1024)
    spr_n = load_img(t("tex_fir_tree_01", "fir_tree_01_bark_nor_gl_2k.jpg"), "spruce_bark_nor", 1024, "Non-Color")
    # Männyn kaarna vaaleana punaruskeana; rungon alaosa tummennetaan harmaaksi verteksiväreillä.
    px = get_px(pine_d)[..., :3]
    lum = px.mean(axis=-1, keepdims=True)
    up = np.clip(lum * 1.7 * np.array([1.0, 0.78, 0.60], dtype=np.float32) + 0.04, 0, 1)
    pine_u = img_from_px(up, "pine_bark_warm_diff")
    birch = img_from_px(birch_bark_px(), "birch_bark_diff")
    # Kuusen kaarna on skannissa hyvin tumma; vaalennetaan, ettei runko näytä varjossa mustalta.
    spr_d = img_from_px(np.clip(get_px(spr_d)[..., :3] * 1.9 + 0.03, 0, 1), "spruce_bark_light_diff")
    return {
        "foliage": pbr("M_Foliage", atlas, alpha=True, rough=0.75, twosided=True),
        "pine": pbr("M_BarkPine", pine_u, pine_n, rough=0.9),
        "spruce": pbr("M_BarkSpruce", spr_d, spr_n, rough=0.95),
        "birch": pbr("M_BarkBirch", birch, rough=0.7),
    }


# ---------- geometrian rakentaja ----------
class Builder:
    def __init__(self, name, seed, mats):
        self.name = name
        self.rng = random.Random(seed)
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new("UVMap")
        self.col = self.bm.loops.layers.float_color.new("Col")   # lineaarinen, viedään glTF:n COLOR_0:ksi
        self.mats = mats
        self.fol = {}      # BMVert -> normaali (lehvästön pehmeä valaistus)

    def mi(self, m):
        return self.mats.index(m)

    def tube(self, pts, radii, sides, mat, vtile=1.2, urep=1.0, color=(1, 1, 1), colors=None):
        rings, vs, vacc = [], [], 0.0
        n = len(pts)
        for i, p in enumerate(pts):
            d = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
            a = V((1, 0, 0)) - d * d.x
            if a.length < 1e-3:
                a = V((0, 1, 0)) - d * d.y
            a.normalize()
            b = d.cross(a)
            if i > 0:
                vacc += (p - pts[i - 1]).length
            vs.append(vacc / vtile)
            rings.append([self.bm.verts.new(p + (a * math.cos(k * 2 * math.pi / sides) + b * math.sin(k * 2 * math.pi / sides)) * radii[i])
                          for k in range(sides)])
        mi = self.mi(mat)
        for i in range(n - 1):
            for k in range(sides):
                k2 = (k + 1) % sides
                f = self.bm.faces.new([rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]])
                f.material_index = mi
                f.smooth = True
                u0, u1 = k / sides * urep, (k + 1) / sides * urep
                ca = colors[i] if colors else color
                cb = colors[i + 1] if colors else color
                for l, uvv, cc in zip(f.loops, [(u0, vs[i]), (u1, vs[i]), (u1, vs[i + 1]), (u0, vs[i + 1])], [ca, ca, cb, cb]):
                    l[self.uv].uv = uvv
                    l[self.col] = (*cc, 1)

    def card(self, origin, direction, normal_hint, length, width, cell, segs=3, bend=None,
             flip_v=False, tint=1.0, shade_root=0.6, nrm=None, center=None):
        d = direction.normalized()
        side = d.cross(normal_hint)
        if side.length < 1e-4:
            side = d.cross(V((1, 0, 0)))
        side.normalize()
        u0, v0, u1, v1 = cell
        rows = []
        for i in range(segs + 1):
            t = i / segs
            c = origin + d * (length * t) + (bend(t) if bend else V((0, 0, 0)))
            L = self.bm.verts.new(c - side * (width / 2))
            R = self.bm.verts.new(c + side * (width / 2))
            for vtx in (L, R):
                if nrm is not None:
                    self.fol[vtx] = nrm
                else:
                    ctr = center if center is not None else V((0, 0, vtx.co.z))
                    rad = vtx.co - ctr
                    if center is None:
                        rad.z = 0
                    rad = rad.normalized() if rad.length > 1e-4 else V((0, 0, 1))
                    self.fol[vtx] = (rad * 0.8 + UP * 0.6).normalized()
            rows.append((L, R, t))
        mi = self.mi("foliage")
        vv = (lambda t: v1 - (v1 - v0) * t) if flip_v else (lambda t: v0 + (v1 - v0) * t)
        for i in range(segs):
            L0, R0, t0 = rows[i]
            L1, R1, t1 = rows[i + 1]
            f = self.bm.faces.new([L0, R0, R1, L1])
            f.material_index = mi
            f.smooth = True
            c0 = tint * (shade_root + (1 - shade_root) * t0)
            c1 = tint * (shade_root + (1 - shade_root) * t1)
            for l, uvv, c in zip(f.loops, [(u0, vv(t0)), (u1, vv(t0)), (u1, vv(t1)), (u0, vv(t1))], [c0, c0, c1, c1]):
                l[self.uv].uv = uvv
                l[self.col] = (c, c, c, 1)

    def cross(self, origin, direction, normal_hint, length, width, cell, **kw):
        """Kaksi ristikkäistä korttia saman akselin ympärillä."""
        d = direction.normalized()
        n1 = normal_hint - d * normal_hint.dot(d)
        if n1.length < 1e-4:
            n1 = d.orthogonal()
        n1.normalize()
        self.card(origin, d, n1, length, width, cell, **kw)
        self.card(origin, d, d.cross(n1), length, width, cell, **kw)

    def finish(self, collection, location=(0, 0, 0)):
        self.bm.verts.index_update()
        fol = {v.index: n for v, n in self.fol.items()}
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
        if fol:
            nrms = [tuple(fol[i]) if i in fol else tuple(v.normal) for i, v in enumerate(me.vertices)]
            me.normals_split_custom_set_from_vertices(nrms)
        collection.objects.link(ob)
        ob.location = location
        return ob


def spine(rng, height, lean=0.03, wobble=0.05, step=1.0, z0=-0.4):
    pts = [V((0, 0, z0))]
    d = V((rng.uniform(-lean, lean), rng.uniform(-lean, lean), 1)).normalized()
    z = z0
    p = pts[0].copy()
    while p.z < height:
        d = (d + V((rng.uniform(-wobble, wobble), rng.uniform(-wobble, wobble), 0.02))).normalized()
        p = p + d * step
        pts.append(p.copy())
    return pts


def at_height(pts, z):
    for a, b in zip(pts, pts[1:]):
        if a.z <= z <= b.z:
            t = (z - a.z) / max(1e-6, b.z - a.z)
            return a.lerp(b, t)
    return pts[-1].copy()


def trunk_radii(pts, r0, height, power=0.9, flare=0.5, tip=0.02):
    out = []
    for p in pts:
        t = min(1, max(0, p.z / height))
        r = tip + (r0 - tip) * (1 - t) ** power
        r *= 1 + flare * math.exp(-max(0, p.z + 0.1) / 0.35)
        out.append(r)
    return out


# ---------- puut ----------
def build_spruce(name, seed, col, height=16.0, r0=0.2, first=1.8, spread=3.0):
    b = Builder(name, seed, ["spruce", "foliage"])
    rng = b.rng
    pts = spine(rng, height - 0.6, lean=0.015, wobble=0.012, step=1.0)
    b.tube(pts, trunk_radii(pts, r0, height, 1.0, 0.45), 8, "spruce", vtile=1.3, urep=1.0)
    A = ATLAS
    z = first
    k = 0
    while z < height - 0.9:
        t = (z - first) / (height - first)
        L = spread * (1 - t) ** 0.85 + 0.35
        n = 7 if t < 0.75 else 5
        a0 = rng.uniform(0, 6.28)
        c = at_height(pts, z)
        for i in range(n):
            ang = a0 + i * 6.283 / n + rng.uniform(-0.3, 0.3)
            Li = L * rng.uniform(0.8, 1.12)
            droop = (0.55 - 0.45 * t) * rng.uniform(0.8, 1.2)      # alaoksat riippuvat enemmän
            out = V((math.cos(ang), math.sin(ang), 0))
            d = (out - UP * droop * 0.45).normalized()
            bend = (lambda Li, droop: (lambda s: V((0, 0, -droop * Li * 0.5 * s + 0.42 * droop * Li * s * s))))(Li, droop)
            cell = A["fir_side"]["uv"] if rng.random() < 0.7 else A["fir_side2"]["uv"]
            tint = rng.uniform(0.72, 1.0) * (0.82 + 0.18 * t)
            origin = c + out * 0.2 + V((0, 0, rng.uniform(-0.12, 0.12)))
            # vaakataso (havuviuhka) ja pystytaso (riippuvat havut)
            b.card(origin, d, UP, Li, Li * 0.8, cell, segs=3, bend=bend, tint=tint, shade_root=0.5)
            b.card(origin - UP * 0.1, d, d.cross(UP), Li * 0.95, Li * 0.62, cell, segs=3, bend=bend, tint=tint * 0.9, shade_root=0.5)
        z += (0.56 - 0.2 * t) * rng.uniform(0.85, 1.15) * (height / 16) ** 0.4
        k += 1
    top = at_height(pts, height - 1.5)
    b.cross(top, UP, V((1, 0, 0)), 1.7, 1.1, A["fir_side"]["uv"], segs=2, tint=0.85, shade_root=0.7)
    return b.finish(col)


def build_pine(name, seed, col, height=18.0, r0=0.21, crown=0.58):
    b = Builder(name, seed, ["pine", "foliage"])
    rng = b.rng
    A = ATLAS
    pts = spine(rng, height - 0.8, lean=0.03, wobble=0.035, step=1.0)
    radii = trunk_radii(pts, r0, height, 0.75, 0.4, tip=0.035)
    # alaosa harmaanruskeaa kilpikaarnaa, yläosa punaruskeaa: liukuma verteksiväreillä
    low, warm = V((0.66, 0.72, 0.78)), V((1, 1, 1))
    cols = []
    for p in pts:
        k = min(1, max(0, (p.z - height * 0.30) / (height * 0.30)))
        k = k * k * (3 - 2 * k)
        cols.append(tuple(low.lerp(warm, k)))
    b.tube(pts, radii, 9, "pine", vtile=1.4, colors=cols)
    zc = height * crown
    nb = rng.randint(11, 14)
    ctr = V((0, 0, height * (crown + 1) / 2 + 0.5))
    for i in range(nb):
        t = (i + rng.random() * 0.6) / nb
        z = zc + (height - 1.2 - zc) * t
        ang = i * 2.4 + rng.uniform(-0.4, 0.4)
        L = (3.6 - 2.2 * t) * rng.uniform(0.75, 1.15)
        rise = 0.15 + 0.7 * t + rng.uniform(-0.1, 0.15)
        out = V((math.cos(ang), math.sin(ang), 0))
        base = at_height(pts, z)
        bp = [base]
        d = (out + UP * rise * 0.5).normalized()
        segs = 4
        for s in range(segs):
            d = (d + UP * 0.16 + V((rng.uniform(-0.12, 0.12), rng.uniform(-0.12, 0.12), 0))).normalized()
            bp.append(bp[-1] + d * (L / segs))
        rb = max(0.03, radii[min(len(radii) - 1, int(z + 0.4))] * 0.55)
        b.tube(bp, [rb * (1 - 0.8 * s / segs) for s in range(segs + 1)], 5, "pine", vtile=0.8)
        # neulastupsut oksan ulkopuoliskolle
        for s in range(2, segs + 1):
            for _ in range(5 if s < segs else 6):
                p = bp[s - 1].lerp(bp[s], rng.random())
                td = (d * 0.5 + V((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(0.2, 1.0)))).normalized()
                cell = A[rng.choice(["pine_side", "pine_side2"])]["uv"]
                sz = rng.uniform(1.3, 2.0)
                b.cross(p, td, d, sz, sz * 0.67, cell, segs=2, tint=rng.uniform(0.8, 1.0), shade_root=0.65, center=ctr)
        tip = bp[-1]
        b.card(tip - V((0.9, 0, 0.1)), V((1, 0, 0)), UP, 1.8, 1.8, A["pine_top"]["uv"], segs=1, tint=0.75, shade_root=1.0, center=ctr)
    # latva
    top = pts[-1]
    for _ in range(5):
        td = V((rng.uniform(-0.6, 0.6), rng.uniform(-0.6, 0.6), 1)).normalized()
        b.cross(top - UP * 0.4, td, V((1, 0, 0)), 1.6, 1.1, A["pine_side"]["uv"], segs=2, tint=0.95, shade_root=0.6, center=ctr)
    # kuivia oksantynkiä rungossa latvuksen alla
    for _ in range(5):
        z = rng.uniform(height * 0.25, zc)
        ang = rng.uniform(0, 6.28)
        base = at_height(pts, z)
        d = V((math.cos(ang), math.sin(ang), rng.uniform(-0.25, 0.1))).normalized()
        L = rng.uniform(0.4, 1.3)
        b.tube([base, base + d * L * 0.5, base + d * L + V((0, 0, -0.08 * L))], [0.03, 0.02, 0.006], 4, "pine", vtile=0.6, color=(0.6, 0.66, 0.72))
    return b.finish(col)


def build_birch(name, seed, col, height=13.0, r0=0.13):
    b = Builder(name, seed, ["birch", "foliage"])
    rng = b.rng
    A = ATLAS
    pts = spine(rng, height - 1.0, lean=0.05, wobble=0.045, step=1.0)
    radii = trunk_radii(pts, r0, height, 0.9, 0.35, tip=0.02)
    b.tube(pts, radii, 8, "birch", vtile=1.6)
    ctr = V((0, 0, height * 0.68))
    nb = rng.randint(13, 16)
    for i in range(nb):
        t = (i + rng.random() * 0.5) / nb
        z = height * 0.36 + (height * 0.6) * t
        ang = i * 2.4 + rng.uniform(-0.5, 0.5)
        L = (3.4 - 2.0 * t) * rng.uniform(0.75, 1.1)
        out = V((math.cos(ang), math.sin(ang), 0))
        d = (out * 0.75 + UP * 0.8).normalized()      # koivun oksat nousevat jyrkästi
        bp = [at_height(pts, z)]
        segs = 4
        for s in range(segs):
            d = (d + out * 0.12 - UP * 0.10 + V((rng.uniform(-0.1, 0.1), rng.uniform(-0.1, 0.1), 0))).normalized()
            bp.append(bp[-1] + d * (L / segs))
        b.tube(bp, [0.045 * (1 - 0.85 * s / segs) * (1 - 0.5 * t) + 0.004 for s in range(segs + 1)], 4, "birch",
               vtile=0.8, color=(0.45, 0.4, 0.37))
        for s in range(1, segs + 1):
            for _ in range(2):
                p = bp[s - 1].lerp(bp[s], rng.random()) + V((0, 0, 0.1))
                yaw = rng.uniform(0, 6.28)
                hint = V((math.cos(yaw), math.sin(yaw), 0))
                key = rng.choice(["birch", "birch2"])
                sz = rng.uniform(1.25, 1.9)
                dd = (V((0, 0, -1)) + out * 0.15).normalized()
                b.card(p - hint.cross(dd) * 0.0, dd, hint, sz, sz, A[key]["uv"], segs=2, flip_v=True,
                       tint=rng.uniform(0.85, 1.0), shade_root=0.85, center=ctr)
    top = pts[-1]
    for _ in range(4):
        yaw = rng.uniform(0, 6.28)
        hint = V((math.cos(yaw), math.sin(yaw), 0))
        b.card(top + UP * 0.6, V((0, 0, -1)), hint, 1.7, 1.7, A["birch"]["uv"], segs=2, flip_v=True, tint=1.05, shade_root=0.9, center=ctr)
    return b.finish(col)


# ---------- aluskasvillisuus ----------
def build_patch(name, seed, col, key, count=6, radius=0.45, scale=1.0, lean=0.25):
    """Varpulaikku: joukko pystykortteja satunnaisissa asennoissa. Normaalit ylös."""
    b = Builder(name, seed, ["foliage"])
    rng = b.rng
    cellinfo = ATLAS[key]
    for i in range(count):
        a, r = rng.uniform(0, 6.28), radius * math.sqrt(rng.random())
        yaw = rng.uniform(0, 6.28)
        hint = V((math.cos(yaw), math.sin(yaw), 0))
        d = (UP + V((rng.uniform(-lean, lean), rng.uniform(-lean, lean), 0))).normalized()
        s = scale * rng.uniform(0.8, 1.2)
        o = V((math.cos(a) * r, math.sin(a) * r, -0.02))
        b.card(o, d, hint, cellinfo["h"] * s, cellinfo["w"] * s, cellinfo["uv"], segs=1,
               tint=rng.uniform(0.88, 1.0), shade_root=0.8, nrm=(UP + hint * 0.25).normalized())
    return b.finish(col)


def build_all():
    global MATS, ATLAS
    with open(os.path.join(ROOT, "cards", "atlas.json")) as f:
        ATLAS = json.load(f)
    MATS = make_materials()
    game = bpy.data.collections.get("GAME")
    if not game:
        game = bpy.data.collections.new("GAME")
        bpy.context.scene.collection.children.link(game)
    objs = [
        (build_pine("pine_a", 11, game, 18.5, 0.22, 0.58), (0, 0)),
        (build_pine("pine_b", 23, game, 15.0, 0.18, 0.52), (9, 0)),
        (build_pine("pine_c", 37, game, 21.0, 0.25, 0.64), (18, 0)),
        (build_spruce("spruce_a", 5, game, 16.0, 0.20, 1.6, 3.0), (27, 0)),
        (build_spruce("spruce_b", 8, game, 11.0, 0.15, 0.9, 2.3), (35, 0)),
        (build_spruce("spruce_young", 9, game, 4.2, 0.06, 0.25, 1.25), (41, 0)),
        (build_birch("birch_a", 3, game, 13.5, 0.13), (47, 0)),
        (build_birch("birch_b", 6, game, 10.0, 0.10), (54, 0)),
        (build_patch("bilberry_patch", 1, game, "bilberry", 7, 0.5, 0.62), (0, -6)),
        (build_patch("bilberry_patch2", 2, game, "bilberry2", 7, 0.5, 0.55), (2, -6)),
        (build_patch("lingon_patch", 3, game, "lingon", 8, 0.45, 0.75), (4, -6)),
        (build_patch("heather_patch", 4, game, "heather", 6, 0.4, 0.6), (6, -6)),
    ]
    stats = {}
    for ob, (x, y) in objs:
        ob.location = (x, y, 0)
        stats[ob.name] = {"tris": sum(len(p.vertices) - 2 for p in ob.data.polygons), "h": round(ob.dimensions.z, 1)}
    return stats
