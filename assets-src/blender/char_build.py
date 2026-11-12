"""Kolme pelihahmoa (sankari, nuori urho, pohjan soturi) ja varusteet.

Edellyttää samassa nimiavaruudessa: trees.py (pbr, load_img, img_from_px, get_px),
char_rig.py (BONES, landmarks, build_base). Vartalo BODY ja luuranko RIG pitää olla
rakennettu (build_base()).

Vaatteet tehdään vartalon pinnasta: valitaan alue, silotetaan lihakset pois ja
pullistetaan ulospäin. Näin vaate istuu ja perii vartalon painot. Helmat, vyöt,
kypärät, hiukset ja aseet rakennetaan erikseen.
"""
import bpy, bmesh, math, random, os
import numpy as np
from mathutils import Vector, Matrix, kdtree

V = Vector
GROUPS = [b[0] for b in BONES]
ARM = {"upper_arm", "forearm", "hand"}
LEG = {"thigh", "shin", "foot"}


# ---------- tekstuurit ----------
def chainmail_px(n=256, rings=8):
    """Laatoittuva rengaspanssari: väri ja normaalikartta."""
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    h = np.zeros((n, n), dtype=np.float32)
    step = n / rings
    for row in range(rings * 2):
        cy = (row + 0.5) * step / 2
        for col in range(rings + 1):
            cx = (col + (0.5 if row % 2 else 0.0)) * step
            dx = np.minimum(np.abs(xx - cx), n - np.abs(xx - cx))
            dy = np.minimum(np.abs(yy - cy), n - np.abs(yy - cy))
            d = np.sqrt(dx * dx + (dy * 1.25) ** 2)
            ring = np.clip(1 - np.abs(d - step * 0.36) / (step * 0.13), 0, 1)
            h = np.maximum(h, ring * (0.75 + 0.25 * (row % 2)))
    gy, gx = np.gradient(h)
    nrm = np.stack([-gx * 3.0, -gy * 3.0, np.ones_like(h)], axis=-1)
    nrm /= np.linalg.norm(nrm, axis=-1, keepdims=True)
    col = (0.10 + 0.46 * h)[..., None] * np.array([1.0, 0.98, 0.95], dtype=np.float32)
    return np.clip(col, 0, 1), nrm * 0.5 + 0.5


def trim_px(kind, w=256, h=64):
    """Punainen kudottu nauha valkoisella kuviolla. kind: diamond | zigzag | tri."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    u = (xx / w * 8) % 1.0
    v = yy / h
    if kind == "diamond":
        m = (np.abs(u - 0.5) + np.abs(v - 0.5) < 0.34) & ~(np.abs(u - 0.5) + np.abs(v - 0.5) < 0.16)
    elif kind == "zigzag":
        m = np.abs(v - (0.3 + 0.4 * np.abs(u - 0.5) * 2)) < 0.11
    else:
        m = (v > 0.25) & (v < 0.8) & (np.abs(u - 0.5) * 1.3 < (0.8 - v))
    red = np.array([0.42, 0.06, 0.05], dtype=np.float32)
    white = np.array([0.72, 0.66, 0.52], dtype=np.float32)
    px = np.where(m[..., None], white, red)
    edge = (v < 0.1) | (v > 0.9)
    px = np.where(edge[..., None], np.array([0.10, 0.09, 0.12], dtype=np.float32), px)
    weave = 0.9 + 0.1 * np.sin(xx * 2.2) * np.sin(yy * 2.2)
    return np.clip(px * weave[..., None], 0, 1)


def shield_px(kind, wood, n=512):
    """Maalattu lankkukilpi. wood = lankkutekstuurin pikselit (h,w,3)."""
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    x, y = xx / n - 0.5, yy / n - 0.5
    ang = np.arctan2(y, x)
    red, white, blue, black, tan = ([0.40, 0.07, 0.05], [0.72, 0.68, 0.58], [0.10, 0.15, 0.27], [0.05, 0.05, 0.055], [0.50, 0.38, 0.24])
    col = np.zeros((n, n, 3), dtype=np.float32)
    if kind == "hero":           # 12 sädettä: valkoinen, punainen, valkoinen, sininen
        k = np.floor((ang + np.pi) / (2 * np.pi) * 12).astype(int) % 4
        for i, c in enumerate([white, red, white, blue]):
            col[k == i] = c
    elif kind == "urho":         # neljännekset punainen / puunvärinen
        q = (x > 0) ^ (y > 0)
        col[q] = red
        col[~q] = tan
    else:                        # pohja: ylhäällä musta, sivuilla valkoinen, alhaalla punainen
        top = (y > np.abs(x))
        bot = (-y > np.abs(x))
        col[:] = white
        col[top] = black
        col[bot] = red
    wl = wood.mean(axis=-1)
    wl = wl / max(1e-4, wl.mean())
    rs = np.random.RandomState(7)
    wear = np.clip(rs.normal(0, 1, (n // 8, n // 8)), -1.5, 2.5)
    wear = np.kron(wear, np.ones((8, 8))).astype(np.float32)
    worn = np.clip((wear - 1.1) * 2.0, 0, 1)[..., None] * 0.7           # kulunut maali paljastaa puun
    planks = (np.abs(((xx / n * 7) % 1.0) - 0.5) > 0.47)[..., None]     # lankkujen saumat
    out = (col * (1 - worn) + wood * 0.85 * worn) * (0.82 + 0.18 * wl[..., None])
    out = np.where(planks, out * 0.62, out)
    return np.clip(out, 0, 1)


def make_char_materials():
    t = lambda *a: os.path.join(DL, *a)
    def tex(tid, name, nor=True):
        d = load_img(t("tex_" + tid, tid + "_diff_1k.jpg"), name + "_diff", 512)
        n = load_img(t("tex_" + tid, tid + "_nor_1k.jpg"), name + "_nor", 512, "Non-Color") if nor else None
        return d, n
    white = img_from_px(np.ones((8, 8, 3), dtype=np.float32), "white8")
    md, mn = chainmail_px()
    mail_d, mail_n = img_from_px(md, "mail_diff"), img_from_px(mn, "mail_nor", "Non-Color")
    wood_d, wood_n = tex("medieval_wood", "wood")
    wpx = get_px(wood_d)[..., :3]
    M = {}
    def add(key, name, d, n=None, metal=0.0, rough=0.9, two=False):
        m = pbr(name, d, n, rough=rough, twosided=two)
        m.node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = metal
        M[key] = m
    add("skin", "C_Skin", white, rough=0.65)
    add("hair", "C_Hair", white, rough=0.8, two=True)
    add("plain", "C_Plain", white, rough=0.95, two=True)
    add("metal", "C_Metal", white, metal=1.0, rough=0.52)
    add("mail", "C_Mail", mail_d, mail_n, metal=0.5, rough=0.6, two=True)
    add("linen", "C_Linen", *tex("rough_linen", "linen"), two=True)
    add("hessian", "C_Hessian", *tex("hessian_230", "hessian"), two=True)
    add("wool", "C_Wool", *tex("poly_wool_herringbone", "wool"), two=True)
    add("jersey", "C_Jersey", *tex("cotton_jersey", "jersey"), two=True)
    ld, ln = tex("brown_leather", "leather")
    lpx = get_px(ld)[..., :3]
    lum = lpx.mean(axis=-1, keepdims=True)
    lpx = lum / max(1e-4, float(lum.mean())) * np.array([0.34, 0.215, 0.125], dtype=np.float32)
    add("leather", "C_Leather", img_from_px(np.clip(lpx, 0, 1), "leather_warm"), ln, rough=0.7, two=True)
    add("wood", "C_Wood", wood_d, wood_n, rough=0.85)
    for k in ("diamond", "zigzag", "tri"):
        add("trim_" + k, "C_Trim_" + k, img_from_px(trim_px(k), "trim_" + k), two=True)
    for k in ("hero", "urho", "pohja"):
        add("shield_" + k, "C_Shield_" + k, img_from_px(shield_px(k, wpx), "shield_" + k), wood_n, rough=0.8)
    return M


# ---------- osien kokoaminen ----------
class Part:
    def __init__(self):
        self.co, self.w, self.faces = [], [], []

    def v(self, co, w):
        self.co.append(V(co))
        self.w.append(w)
        return len(self.co) - 1

    def f(self, idx, mat, uvs=None, col=(1, 1, 1), smooth=True):
        self.faces.append((tuple(idx), mat, uvs or [(0, 0)] * len(idx), col, smooth))

    def extend(self, other):
        o = len(self.co)
        self.co += other.co
        self.w += other.w
        for idx, mat, uvs, col, sm in other.faces:
            self.faces.append((tuple(i + o for i in idx), mat, uvs, col, sm))


class Ctx:
    """Vartalon geometria, painot ja haut osien rakentamista varten."""
    def __init__(self):
        self.body = bpy.data.objects["BODY"]
        me = self.body.data
        names = [g.name for g in self.body.vertex_groups]
        self.co = [v.co.copy() for v in me.vertices]
        self.w = [{names[g.group]: g.weight for g in v.groups if g.weight > 0.01} for v in me.vertices]
        for d in self.w:
            s = sum(d.values()) or 1.0
            for k in d:
                d[k] /= s
        self.kd = kdtree.KDTree(len(self.co))
        for i, c in enumerate(self.co):
            self.kd.insert(c, i)
        self.kd.balance()
        self.L = landmarks(bpy.data.objects["GEO-body_male_realistic"])
        self.arm_frac = [self._frac(i, ARM) for i in range(len(self.co))]
        self.leg_frac = [self._frac(i, LEG) for i in range(len(self.co))]

    def _frac(self, i, fam):
        return sum(w for k, w in self.w[i].items() if k.rsplit("_", 1)[0] in fam)

    def arm_t(self, p):
        """0 = olkapää, 1 = ranne (kummallekin puolelle)."""
        s = 1 if p.x >= 0 else -1
        sh = V((self.L["shoulder"].x * s, self.L["shoulder"].y, self.L["shoulder"].z))
        wr = V((self.L["wrist"].x * s, self.L["wrist"].y, self.L["wrist"].z))
        a = wr - sh
        return (p - sh).dot(a) / a.length_squared

    def near_w(self, p, k=3, blend=None):
        out = {}
        for _, i, _ in self.kd.find_n(p, k):
            for g, w in self.w[i].items():
                out[g] = out.get(g, 0) + w / k
        if blend:
            g, amt = blend
            out = {kk: vv * (1 - amt) for kk, vv in out.items()}
            out[g] = out.get(g, 0) + amt
        return out

    def seg_frame(self, w, p):
        """UV-projektion akseli osan mukaan: (origo, akseli, vertailusuunta, säde)."""
        fam = max(w, key=w.get).rsplit("_", 1)[0] if w else "chest"
        s = 1 if p.x >= 0 else -1
        m = lambda q: V((q.x * s, q.y, q.z))
        if fam in ARM:
            o, e = m(self.L["shoulder"]), m(self.L["wrist"])
            return o, (e - o).normalized(), V((0, -1, 0)), 0.05
        if fam in LEG:
            o, e = m(self.L["hip"]), m(self.L["ankle"])
            return o, (e - o).normalized(), V((0, -1, 0)), 0.08
        return V((0, 0.02, 0)), V((0, 0, 1)), V((0, -1, 0)), 0.17


def cyl_uvs(pts, frame, tile):
    o, a, ref, r = frame
    e1 = (ref - a * ref.dot(a)).normalized()
    e2 = a.cross(e1)
    ang = []
    for p in pts:
        d = p - o
        ang.append(math.atan2(d.dot(e2), d.dot(e1)))
    if max(ang) - min(ang) > math.pi:
        ang = [x + 2 * math.pi if x < 0 else x for x in ang]
    return [(x * r / tile, (p - o).dot(a) / tile) for x, p in zip(ang, pts)]


def shell(C, select, inflate, mat, tile=0.25, smooth=3, col=(1, 1, 1), colfn=None, matfn=None):
    """Vaate vartalon pinnasta. select(i, co) -> bool vertekseille; inflate(co) -> metriä."""
    bm = bmesh.new()
    bm.from_mesh(C.body.data)
    orig = bm.verts.layers.int.new("orig")
    for v in bm.verts:
        v[orig] = v.index
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not select(v.index, C.co[v.index])], context='VERTS')
    for _ in range(smooth):
        bmesh.ops.smooth_vert(bm, verts=bm.verts, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * inflate(C.co[v[orig]])
    p = Part()
    idx = {}
    for v in bm.verts:
        idx[v] = p.v(v.co, dict(C.w[v[orig]]))
    for f in bm.faces:
        pts = [v.co for v in f.verts]
        w0 = C.w[f.verts[0][orig]]
        c = sum(pts, V()) / len(pts)
        uvs = cyl_uvs(pts, C.seg_frame(w0, c), tile)
        p.f([idx[v] for v in f.verts], matfn(c) if matfn else mat, uvs, colfn(c) if colfn else col)
    bm.free()
    return p


def ring_profile(C, center, axis, ref, n=24, slab=0.025, keep=None):
    """Vartalon poikkileikkauksen säde kulman funktiona tason ympärillä."""
    e1 = (ref - axis * ref.dot(axis)).normalized()
    e2 = axis.cross(e1)
    rad = [0.0] * n
    for i, c in enumerate(C.co):
        d = c - center
        if abs(d.dot(axis)) > slab or (keep and not keep(i, c)):
            continue
        x, y = d.dot(e1), d.dot(e2)
        r = math.hypot(x, y)
        if r > 0.3:
            continue
        k = int(((math.atan2(y, x) + 2 * math.pi) % (2 * math.pi)) / (2 * math.pi) * n) % n
        rad[k] = max(rad[k], r)
    mean = sum(r for r in rad if r > 0) / max(1, sum(1 for r in rad if r > 0))
    rad = [r if r > 0 else mean for r in rad]
    rad = [(rad[(k - 1) % n] + 2 * rad[k] + rad[(k + 1) % n]) / 4 for k in range(n)]
    return rad, e1, e2


def band(C, center, axis, ref, width, offset, mat, tile=0.2, n=24, keep=None, col=(1, 1, 1), flare=0.0, rows=1, vspan=None):
    """Rengas (vyö, hihansuu, helmanauha) vartalon ympärille."""
    rad, e1, e2 = ring_profile(C, center, axis, ref, n, keep=keep)
    p = Part()
    rings = []
    for j in range(rows + 1):
        s = j / rows
        ring = []
        for k in range(n):
            a = (k + 0.5) / n * 2 * math.pi
            r = rad[k] + offset + flare * s
            pt = center + axis * (width * (s - 0.5)) + (e1 * math.cos(a) + e2 * math.sin(a)) * r
            ring.append(p.v(pt, C.near_w(pt)))
        rings.append(ring)
    circ = 2 * math.pi * (sum(rad) / n + offset)
    for j in range(rows):
        for k in range(n):
            k2 = (k + 1) % n
            u0, u1 = k / n * circ / tile, (k + 1) / n * circ / tile
            v0, v1 = (j / rows, (j + 1) / rows) if vspan is None else (vspan[0] + (vspan[1] - vspan[0]) * j / rows, vspan[0] + (vspan[1] - vspan[0]) * (j + 1) / rows)
            if vspan is None:
                v0, v1 = v0 * width / tile, v1 * width / tile
            p.f([rings[j][k], rings[j][k2], rings[j + 1][k2], rings[j + 1][k]], mat, [(u0, v0), (u1, v0), (u1, v1), (u0, v1)], col)
    return p


def skirt(C, z_top, z_bot, off, hem, mat, tile=0.25, n=28, rows=5, col=(1, 1, 1), trim=None, trim_h=0.035):
    """Helma: vyötäröltä alas levenevä putki. hem = (rx, ry) helman ellipsi."""
    ctr = V((0, 0.02, z_top))
    rad, e1, e2 = ring_profile(C, ctr, V((0, 0, 1)), V((0, -1, 0)), n, keep=lambda i, c: abs(c.x) < 0.2)
    p = Part()
    zs = [z_top + (z_bot - z_top) * (j / rows) for j in range(rows + 1)]
    if trim:
        zs.append(z_bot - trim_h)
    rings = []
    for j, z in enumerate(zs):
        s = min(1.0, (z_top - z) / (z_top - z_bot)) ** 0.8
        ring = []
        for k in range(n):
            a = (k + 0.5) / n * 2 * math.pi
            r_h = 1.0 / math.sqrt((math.cos(a) / hem[1]) ** 2 + (math.sin(a) / hem[0]) ** 2)
            r = (rad[k] + off) * (1 - s) + r_h * s
            wav = 1 + 0.035 * math.sin(a * 7) * s            # laskokset
            pt = V((0, 0.02, z)) + (e1 * math.cos(a) + e2 * math.sin(a)) * (r * wav)
            ring.append(p.v(pt, C.near_w(V((pt.x * 0.6, pt.y * 0.6 + 0.01, z)), 4, blend=("hips", 0.45))))
        rings.append(ring)
    circ = 2 * math.pi * 0.2
    for j in range(len(zs) - 1):
        is_trim = trim and j == len(zs) - 2
        for k in range(n):
            k2 = (k + 1) % n
            if is_trim:
                u0, u1 = k / n * 6, (k + 1) / n * 6
                uv = [(u0, 1), (u1, 1), (u1, 0), (u0, 0)]
            else:
                u0, u1 = k / n * circ / tile, (k + 1) / n * circ / tile
                uv = [(u0, zs[j] / tile), (u1, zs[j] / tile), (u1, zs[j + 1] / tile), (u0, zs[j + 1] / tile)]
            p.f([rings[j][k], rings[j][k2], rings[j + 1][k2], rings[j + 1][k]], trim if is_trim else mat, uv, (1, 1, 1) if is_trim else col)
    return p


def tube_part(pts, radii, sides, mat, w, col=(1, 1, 1), tile=0.2, smooth=True, cap=True):
    p = Part()
    rings, vs, acc = [], [], 0.0
    n = len(pts)
    for i, c in enumerate(pts):
        d = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        a = d.orthogonal().normalized()
        b = d.cross(a)
        if i:
            acc += (c - pts[i - 1]).length
        vs.append(acc / tile)
        rings.append([p.v(c + (a * math.cos(k * 2 * math.pi / sides) + b * math.sin(k * 2 * math.pi / sides)) * radii[i], dict(w)) for k in range(sides)])
    for i in range(n - 1):
        for k in range(sides):
            k2 = (k + 1) % sides
            p.f([rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]], mat,
                [(k / sides, vs[i]), ((k + 1) / sides, vs[i]), ((k + 1) / sides, vs[i + 1]), (k / sides, vs[i + 1])], col, smooth)
    if cap:
        p.f(list(reversed(rings[0])), mat, None, col, False)
        p.f(rings[-1], mat, None, col, False)
    return p


def lathe(center, profile, n, mat, w, col=(1, 1, 1), sx=1.0, sy=1.0, tile=0.15, arc=(0, 2 * math.pi), close_top=True):
    """Pyörähdyskappale z-akselin ympäri. profile = [(säde, z), ...]. arc rajaa kulman."""
    p = Part()
    full = abs(arc[1] - arc[0] - 2 * math.pi) < 1e-4
    cols = n if full else n + 1
    rings = []
    for r, z in profile:
        ring = []
        for k in range(cols):
            a = arc[0] + (arc[1] - arc[0]) * k / n
            ring.append(p.v(center + V((math.sin(a) * r * sx, math.cos(a) * r * sy, z)), dict(w)))
        rings.append(ring)
    for j in range(len(profile) - 1):
        for k in range(n):
            k2 = (k + 1) % cols
            p.f([rings[j][k], rings[j][k2], rings[j + 1][k2], rings[j + 1][k]], mat,
                [(k / n * 3, profile[j][1] / tile), ((k + 1) / n * 3, profile[j][1] / tile), ((k + 1) / n * 3, profile[j + 1][1] / tile), (k / n * 3, profile[j + 1][1] / tile)], col)
    return p


def box_part(center, size, mat, w, col=(1, 1, 1), rot=None):
    p = Part()
    hx, hy, hz = size[0] / 2, size[1] / 2, size[2] / 2
    R = rot or Matrix.Identity(3)
    ids = [p.v(center + R @ V((sx * hx, sy * hy, sz * hz)), dict(w)) for sz in (-1, 1) for sy in (-1, 1) for sx in (-1, 1)]
    for q in ((0, 2, 3, 1), (4, 5, 7, 6), (0, 1, 5, 4), (2, 6, 7, 3), (0, 4, 6, 2), (1, 3, 7, 5)):
        p.f([ids[i] for i in q], mat, [(0, 0), (1, 0), (1, 1), (0, 1)], col, False)
    return p


def assemble(name, parts, col_name="GAME", rig=True):
    """Kokoaa osat yhdeksi mesh-objektiksi (materiaalit, UV, verteksivärit, painot)."""
    allp = Part()
    for p in parts:
        allp.extend(p)
    remove_obj(name)
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    cl = bm.loops.layers.float_color.new("Col")
    verts = [bm.verts.new(c) for c in allp.co]
    mats = []
    for idx, mat, uvs, col, sm in allp.faces:
        if len(set(idx)) < 3:
            continue
        try:
            f = bm.faces.new([verts[i] for i in idx])
        except ValueError:
            continue
        if mat not in mats:
            mats.append(mat)
        f.material_index = mats.index(mat)
        f.smooth = sm
        for l, uv in zip(f.loops, uvs):
            l[uvl].uv = uv
            l[cl] = (*col, 1)
    bm.verts.index_update()
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(CM[m])
    ca = me.color_attributes.get("Col")
    me.color_attributes.active_color = ca
    me.color_attributes.render_color_index = list(me.color_attributes).index(ca)
    ob = bpy.data.objects.new(name, me)
    get_col(col_name).objects.link(ob)
    if rig:
        groups = {g: ob.vertex_groups.new(name=g) for g in GROUPS}
        for i, w in enumerate(allp.w):
            s = sum(w.values()) or 1.0
            top = sorted(w.items(), key=lambda kv: -kv[1])[:4]
            s = sum(v for _, v in top) or 1.0
            for g, v in top:
                if g in groups and v > 0:
                    groups[g].add([i], v / s, 'REPLACE')
        r = bpy.data.objects["RIG"]
        ob.parent = r
        mod = ob.modifiers.new("Armature", 'ARMATURE')
        mod.object = r
    return ob, {"tris": sum(len(p.vertices) - 2 for p in me.polygons), "mats": len(mats)}


# ---------- hahmon osat ----------
def skin_parts(C, hands_from=0.45, hair=(0.62, 0.45, 0.2), skin=(0.72, 0.47, 0.33)):
    L = C.L
    def colfn(c):
        if c.y < -0.128 and abs(c.x) < 0.026 and 1.492 < c.z < 1.503:
            return (0.50, 0.30, 0.26)                    # huulet
        if c.y < -0.105 and 0.010 < abs(c.x) < 0.055 and 1.590 < c.z < 1.604:
            return tuple(x * 0.55 for x in hair)         # kulmakarvat
        return skin
    head = shell(C, lambda i, c: c.z > 1.37 and C.arm_frac[i] < 0.3, lambda c: 0.0, "skin", smooth=0, colfn=colfn)
    hands = shell(C, lambda i, c: C.arm_frac[i] > 0.5 and C.arm_t(c) > hands_from, lambda c: 0.0, "skin", smooth=0, col=skin)
    eyes = Part()
    for nm in ("GEO-body_male_realistic.eye.L", "GEO-body_male_realistic.eye.R"):
        eo = bpy.data.objects[nm]
        mw = eo.matrix_world
        ctr = mw.translation
        base = len(eyes.co)
        for v in eo.data.vertices:
            eyes.v(mw @ v.co, {"head": 1.0})
        for f in eo.data.polygons:
            c = sum(((mw @ eo.data.vertices[i].co) for i in f.vertices), V()) / len(f.vertices)
            ang = (c - ctr).normalized().angle(V((0, -1, 0)))
            col = (0.02, 0.02, 0.02) if ang < 0.24 else (0.14, 0.24, 0.34) if ang < 0.62 else (0.55, 0.53, 0.50)
            eyes.f([base + i for i in f.vertices], "skin", None, col)
    return [head, hands, eyes]


def hair_parts(C, color, length=1.40, beard=0.014, beard_long=0.03, cap=True, moustache=True, cap_max_z=9.0):
    """Hiukset: päälakikuori + niskaan laskeutuva verho + parta."""
    rng = random.Random(3)
    parts = []
    dark = tuple(x * 0.7 for x in color)
    is_scalp = lambda i, c: 1.455 < c.z < cap_max_z and C.arm_frac[i] < 0.2 and (c.z > 1.612 or (c.y > -0.035 and c.z > 1.50) or (c.y > 0.0))
    if cap:
        parts.append(shell(C, is_scalp, lambda c: 0.012, "hair", smooth=1, colfn=lambda c: tuple(x * rng.uniform(0.8, 1.0) for x in color)))
    # verho: pään takaa ja sivuilta alas
    p = Part()
    n, rows = 26, 6
    z0 = 1.605
    ctr = V((0, -0.035, 0))
    grid = []
    for k in range(n + 1):
        a = math.radians(-100 + 200 * k / n)             # 0 = takana (+Y)
        shade = rng.uniform(0.6, 1.0)
        wav = rng.uniform(-0.008, 0.008)
        ln = length + rng.uniform(0.0, 0.05)             # epätasainen latva
        colm = []
        for j in range(rows + 1):
            s = j / rows
            z = z0 + (ln - z0) * s
            r = 0.099 + 0.02 * s + wav * s * 3 + 0.008 * math.sin(s * 6 + k * 1.7)
            pt = ctr + V((math.sin(a) * r * 0.92, math.cos(a) * r * 1.08, z))
            colm.append((p.v(pt, {"head": 1.0} if z > 1.46 else {"head": 0.6, "neck": 0.4}), shade))
        grid.append(colm)
    for k in range(n):
        for j in range(rows):
            sh = grid[k][j][1] * (1 - 0.25 * j / rows)
            p.f([grid[k][j][0], grid[k + 1][j][0], grid[k + 1][j + 1][0], grid[k][j + 1][0]], "hair",
                None, tuple(x * sh for x in color))
    parts.append(p)
    if beard > 0:
        def sel(i, c):
            if C.arm_frac[i] > 0.1 or c.y > -0.03 or not (1.435 < c.z < 1.522):
                return False
            if abs(c.x) < 0.03 and c.y < -0.125 and 1.489 < c.z < 1.506:
                return False                               # suu jää näkyviin
            if c.z > 1.508 and not (moustache and abs(c.x) < 0.04 and c.y < -0.12):
                return abs(c.x) > 0.045 and c.z < 1.522 and c.y < -0.06   # poskiparta
            return True
        def infl(c):
            chin = smoothstep(1.50, 1.45, c.z)
            return beard + beard_long * chin + rng.uniform(0, 0.004)
        parts.append(shell(C, sel, infl, "hair", smooth=1, colfn=lambda c: tuple(x * rng.uniform(0.75, 1.0) for x in dark)))
    return parts


def helmet_parts(C, tall=0.15, col=(0.20, 0.205, 0.215)):
    """Nenäsuojakypärä omana kappaleenaan: pyöreähkö suippo kupu, joka ulottuu otsalle ja
    niskassa hieman alemmas, otsavanne, neljä kiskoa ja vanteeseen kiinnitetty nenäsuoja."""
    ctr = V((0, -0.044, 1.585))
    rx, ry, n = 0.106, 0.128, 24
    w = {"head": 1.0}
    k = tall / 0.145
    prof = [(1.0, 0.0), (1.0, 0.025), (0.975, 0.05), (0.91, 0.075), (0.78, 0.1), (0.58, 0.122), (0.33, 0.137), (0.12, 0.144)]
    dark = tuple(x * 0.72 for x in col)

    def pt(a, rf, h, off=0.0):
        back = (math.cos(a) + 1) / 2                      # a = 0 on takana (+Y), pi edessä
        drop = 0.03 * smoothstep(0.35, 0.9, back) * (1 - smoothstep(0.0, 0.06, max(h, 0.0)))
        return ctr + V((math.sin(a) * (rx * rf + off), math.cos(a) * (ry * rf + off), h * k - drop))

    def uv(a, h):
        return (a / (2 * math.pi) * 9, h / 0.05)

    def quad(p, a0, a1, r0, h0, o0, r1, h1, o1, c):
        p.f([p.v(pt(a0, r0, h0, o0), dict(w)), p.v(pt(a1, r0, h0, o0), dict(w)), p.v(pt(a1, r1, h1, o1), dict(w)), p.v(pt(a0, r1, h1, o1), dict(w))],
            "metal", [uv(a0, h0), uv(a1, h0), uv(a1, h1), uv(a0, h1)], c)

    # kupu
    dome = Part()
    rings = [[dome.v(pt(2 * math.pi * i / n, rf, h), dict(w)) for i in range(n)] for rf, h in prof]
    for j in range(len(prof) - 1):
        for i in range(n):
            i2 = (i + 1) % n
            a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
            dome.f([rings[j][i], rings[j][i2], rings[j + 1][i2], rings[j + 1][i]], "metal",
                   [uv(a0, prof[j][1]), uv(a1, prof[j][1]), uv(a1, prof[j + 1][1]), uv(a0, prof[j + 1][1])], col)
    apex = dome.v(ctr + V((0, 0, 0.1475 * k)), dict(w))
    for i in range(n):
        dome.f([rings[-1][i], rings[-1][(i + 1) % n], apex], "metal", [(0, 0.95), (0.1, 0.95), (0.05, 1.0)], col)
    # sisäpinta, jotta päästä lentänyt kypärä ei näytä ontolta kuorelta
    inner = (0.05, 0.05, 0.055)
    for j in range(len(prof) - 1):
        for i in range(n):
            a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
            (r0, h0), (r1, h1) = prof[j], prof[j + 1]
            quad(dome, a1, a0, r0, h0, -0.004, r1, h1, -0.004, inner)

    # otsavanne ja kiskot
    trim = Part()
    band = [(-0.004, 0.0), (-0.004, 0.006), (0.024, 0.006), (0.028, 0.0)]
    for i in range(n):
        a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        for (h0, o0), (h1, o1) in zip(band, band[1:]):
            quad(trim, a0, a1, 1.0, h0, o0, 1.0, h1, o1, dark)
    for a in (0.0, math.pi / 2, math.pi, 3 * math.pi / 2):
        for (r0, h0), (r1, h1) in zip(prof, prof[1:]):
            da0, da1 = 0.1 / max(r0, 0.3), 0.1 / max(r1, 0.3)
            trim.f([trim.v(pt(a - da0, r0, h0, 0.004), dict(w)), trim.v(pt(a + da0, r0, h0, 0.004), dict(w)),
                    trim.v(pt(a + da1, r1, h1, 0.004), dict(w)), trim.v(pt(a - da1, r1, h1, 0.004), dict(w))], "metal", None, dark)
    knob = lathe(ctr + V((0, 0, 0.140 * k)), [(0.016, 0.0), (0.014, 0.01), (0.006, 0.02), (0.001, 0.024)], 8, "metal", w, dark)

    # nenäsuoja: vanteen etureunasta nenänpäähän, hieman kapeneva
    nasal = Part()
    y0 = ctr.y - ry - 0.006
    secs = [(1.612, 0.017, 0.0), (1.578, 0.015, 0.0), (1.548, 0.013, -0.002), (1.527, 0.010, -0.003)]
    rows = []
    for z, hw, dy in secs:
        rows.append([nasal.v(V((-hw, y0 + dy - 0.004, z)), dict(w)), nasal.v(V((hw, y0 + dy - 0.004, z)), dict(w)),
                     nasal.v(V((hw, y0 + dy + 0.004, z)), dict(w)), nasal.v(V((-hw, y0 + dy + 0.004, z)), dict(w))])
    for a, b in zip(rows, rows[1:]):
        for q in range(4):
            q2 = (q + 1) % 4
            nasal.f([a[q2], a[q], b[q], b[q2]], "metal", None, dark, False)
    nasal.f([rows[-1][0], rows[-1][1], rows[-1][2], rows[-1][3]], "metal", None, dark, False)
    return [dome, trim, knob, nasal]


def cap_parts(C, col=(0.75, 0.68, 0.6)):
    is_cap = lambda i, c: c.z > 1.585 and C.arm_frac[i] < 0.2 and not (c.y < -0.09 and c.z < 1.615)
    return [shell(C, is_cap, lambda c: 0.022, "hessian", tile=0.12, smooth=3, col=col)]


def legs_parts(C, trousers_mat, trousers_col, wrap_col, greaves=False, baggy=0.04):
    L = C.L
    is_leg = lambda i, c: (C.leg_frac[i] > 0.5 or (c.z < 1.03 and C.arm_frac[i] < 0.2))
    parts = [shell(C, lambda i, c: is_leg(i, c) and 0.40 < c.z < 1.03,
                   lambda c: 0.012 + baggy * smoothstep(0.41, 0.47, c.z) * (1 - smoothstep(0.60, 0.70, c.z)), trousers_mat, smooth=4, col=trousers_col)]
    # säärikääreet: vaakaraidat jäljittelevät kierrettyä nauhaa
    wrap = lambda c: tuple(x * (0.7 + 0.3 * (0.5 + 0.5 * math.sin(c.z * 130 + math.atan2(c.y - 0.03, abs(c.x) - 0.15) * 3))) for x in wrap_col)
    parts.append(shell(C, lambda i, c: is_leg(i, c) and 0.085 < c.z < 0.46, lambda c: 0.017, "jersey", tile=0.1, smooth=3, colfn=wrap))
    shoe = shell(C, lambda i, c: is_leg(i, c) and c.z < 0.125, lambda c: 0.014, "leather", tile=0.2, smooth=4, col=(1.0, 0.92, 0.85))
    zmin = min(c.z for c in shoe.co)
    for c in shoe.co:
        if c.z < 0.07:
            c.z -= (zmin + 0.004) * (1 - c.z / 0.07)
    parts.append(shoe)
    if greaves:
        # säärisuojat: kaareva rautalevy säären edessä, kaksi nahkahihnaa
        for s in (1, -1):
            kn = V((L["knee"].x * s, L["knee"].y, L["knee"].z))
            an = V((L["ankle"].x * s, L["ankle"].y, L["ankle"].z))
            w = {"shin_" + ("L" if s > 0 else "R"): 1.0}
            g = Part()
            rows, n = 5, 8
            grid = []
            for j in range(rows + 1):
                t = 0.14 + 0.66 * j / rows
                ctr = kn.lerp(an, t)
                r = 0.074 - 0.014 * (j / rows) + (0.006 if j in (0, rows) else 0)
                ring = []
                for k in range(n + 1):
                    a = math.pi - 1.25 + 2.5 * k / n
                    ring.append(g.v(ctr + V((math.sin(a) * r, math.cos(a) * r * 1.05 - 0.004, 0)), w))
                grid.append(ring)
            for j in range(rows):
                for k in range(n):
                    g.f([grid[j][k], grid[j][k + 1], grid[j + 1][k + 1], grid[j + 1][k]], "metal", None, (0.19, 0.195, 0.205))
            parts.append(g)
            for t in (0.3, 0.62):
                ctr = kn.lerp(an, t)
                parts.append(band(C, ctr, (an - kn).normalized(), V((0, -1, 0)), 0.022, 0.03, "leather", n=12,
                                  keep=lambda i, c, s=s: c.x * s > 0.02 and C.leg_frac[i] > 0.5, col=(0.9, 0.8, 0.7)))
    return parts


def belt_parts(C, z=1.005, off=0.034, scabbard=False, knife=False):
    keep = lambda i, c: abs(c.x) < 0.2 and C.arm_frac[i] < 0.3
    parts = [band(C, V((0, 0.02, z)), V((0, 0, 1)), V((0, -1, 0)), 0.05, off, "leather", keep=keep, col=(1.0, 0.92, 0.85))]
    hw = {"hips": 0.7, "spine": 0.3}
    parts.append(box_part(V((0.0, -0.155, z)), (0.045, 0.012, 0.05), "metal", hw, (0.62, 0.42, 0.14)))        # pronssisolki
    if scabbard:
        top = V((0.19, -0.03, z - 0.02))
        d = V((0.10, 0.35, -0.93)).normalized()
        R = d.to_track_quat('Z', 'Y').to_matrix()
        w = {"hips": 0.8, "thigh_L": 0.2}
        parts.append(box_part(top + d * 0.29, (0.062, 0.02, 0.58), "leather", w, (0.95, 0.85, 0.75), R))
        parts.append(box_part(top + d * 0.575, (0.066, 0.024, 0.05), "metal", w, (0.62, 0.42, 0.14), R))
        parts.append(box_part(top + d * 0.02, (0.068, 0.026, 0.04), "metal", w, (0.62, 0.42, 0.14), R))
    if knife:
        top = V((-0.10, -0.15, z - 0.02))
        w = {"hips": 0.8, "thigh_R": 0.2}
        R = Matrix.Rotation(0.12, 3, 'Y')
        parts.append(box_part(top + V((0, 0, -0.10)), (0.034, 0.018, 0.17), "leather", w, (0.95, 0.85, 0.75), R))
        parts.append(tube_part([top + V((0, 0, 0.0)), top + V((0.008, 0, 0.09))], [0.012, 0.014], 6, "wood", w, (1.0, 0.9, 0.7)))
    return parts


def torso_parts(C, mat, col, sleeve_to, inflate=0.016, tile=0.25, smooth=3, sleeve_from=-9, torso=True, collar=None, baggy=0.0):
    def sel(i, c):
        if c.z < 0.95 or c.z > 1.435:
            return False
        if C.arm_frac[i] > 0.5:
            return sleeve_from < C.arm_t(c) < sleeve_to
        if C.leg_frac[i] > 0.6:
            return False
        nk = C.w[i].get("neck", 0) + C.w[i].get("head", 0)
        return torso and nk < 0.55
    def colfn(c):
        if collar and c.z > 1.405 and abs(c.x) < 0.09:
            return collar
        return col
    return [shell(C, sel, lambda c: inflate + baggy * smoothstep(1.3, 1.1, c.z), mat, tile=tile, smooth=smooth, colfn=colfn)]


def cuff_parts(C, t, mat, off, width=0.035):
    parts = []
    L = C.L
    for s in (1, -1):
        m = lambda q: V((q.x * s, q.y, q.z))
        sh, wr = m(L["shoulder"]), m(L["wrist"])
        a = (wr - sh).normalized()
        ctr = sh + (wr - sh) * t
        keep = lambda i, c, s=s: c.x * s > 0.15 and C.arm_frac[i] > 0.5
        parts.append(band(C, ctr, a, V((0, -1, 0)), width, off, mat, n=14, keep=keep, vspan=(0, 1), tile=0.06))
    return parts


def cloak_parts(C, col=(0.42, 0.06, 0.05)):
    """Pohjan soturin olkaviitta: laskostettu punainen villakangas vasemmalla olalla."""
    parts = []
    rng = random.Random(5)
    w = {"chest": 0.8, "upper_arm_L": 0.2}
    for k in range(11):
        x = 0.07 + k * 0.014
        zt = 1.455 - (x - 0.07) * 0.33
        back = V((x + 0.012, 0.135, 1.06 + rng.uniform(-0.025, 0.025)))
        top_b = V((x, 0.065, zt))
        top_f = V((x, -0.055, zt - 0.005))
        front = V((x + 0.014, -0.16, 1.10 + rng.uniform(-0.025, 0.025)))
        sh = rng.uniform(0.8, 1.0)
        parts.append(tube_part([back, back.lerp(top_b, 0.55) + V((0, 0.02, 0)), top_b, top_f, top_f.lerp(front, 0.5) + V((0, -0.022, 0)), front],
                               [0.014, 0.016, 0.014, 0.014, 0.016, 0.014], 5, "plain", w, tuple(c * sh for c in col)))
    parts.append(tube_part([V((0.10, -0.085, 1.40)), V((0.10, -0.10, 1.40))], [0.018, 0.018], 8, "metal", w, (0.62, 0.42, 0.14)))   # solki
    return parts


def build_characters():
    global CM
    CM = make_char_materials()
    C = Ctx()
    stats = {}
    blond, ginger, straw = (0.62, 0.45, 0.20), (0.46, 0.33, 0.17), (0.55, 0.42, 0.22)

    # --- Kalevalan sankari: rengaspanssari, sininen alustunika, kypärä, säärisuojat
    P = skin_parts(C, 0.62, blond)
    P += hair_parts(C, blond, length=1.39, cap=True)
    P += torso_parts(C, "mail", (1, 1, 1), 0.47, inflate=0.03, tile=0.11, smooth=9, collar=(0.9, 0.35, 0.3))
    P += [skirt(C, 1.0, 0.57, 0.034, (0.27, 0.215), "mail", tile=0.11)]
    P += torso_parts(C, "linen", (0.26, 0.31, 0.52), 0.78, inflate=0.013, sleeve_from=0.36, torso=False)
    P += cuff_parts(C, 0.775, "trim_diamond", 0.02) + cuff_parts(C, 0.47, "trim_diamond", 0.034)
    P += [skirt(C, 0.70, 0.50, 0.0, (0.268, 0.212), "linen", col=(0.26, 0.31, 0.52), rows=2, trim="trim_diamond")]
    P += legs_parts(C, "linen", (0.22, 0.27, 0.46), (0.9, 0.86, 0.75), greaves=True)
    P += belt_parts(C, off=0.04, scabbard=True)
    _, stats["char_hero"] = assemble("char_hero", P)
    # Kypärät ovat omia kappaleitaan (ei luurankoa): peli kiinnittää ne pääluuhun ja voi irrottaa.
    _, stats["helmet_hero"] = assemble("helmet_hero", helmet_parts(C, 0.152), rig=False)

    # --- Nuori urho: villatunika, myssy, puukko
    P = skin_parts(C, 0.9, straw)
    P += hair_parts(C, straw, length=1.47, beard=0.008, beard_long=0.012, cap=True)
    P += cap_parts(C)
    P += torso_parts(C, "hessian", (0.82, 0.76, 0.68), 0.97, inflate=0.026, tile=0.14, smooth=9, collar=(0.75, 0.25, 0.2), baggy=0.012)
    P += [skirt(C, 1.0, 0.60, 0.026, (0.26, 0.21), "hessian", tile=0.14, col=(0.82, 0.76, 0.68))]
    P += cuff_parts(C, 0.96, "trim_tri", 0.026)
    P += legs_parts(C, "wool", (1.0, 0.93, 0.78), (0.62, 0.58, 0.5))
    P += belt_parts(C, off=0.034, knife=True)
    _, stats["char_urho"] = assemble("char_urho", P)

    # --- Pohjan soturi: rengaspanssari tumman villatunikan päällä, olkaviitta
    P = skin_parts(C, 0.9, ginger)
    P += hair_parts(C, ginger, length=1.46, beard=0.012, beard_long=0.02, cap=True)
    P += torso_parts(C, "mail", (0.85, 0.85, 0.9), 0.44, inflate=0.03, tile=0.11, smooth=9, collar=(0.8, 0.3, 0.25))
    P += [skirt(C, 1.0, 0.63, 0.034, (0.265, 0.21), "mail", tile=0.11, col=(0.85, 0.85, 0.9))]
    P += torso_parts(C, "wool", (0.5, 0.5, 0.52), 0.97, inflate=0.014, sleeve_from=0.34, torso=False)
    P += cuff_parts(C, 0.96, "trim_zigzag", 0.022)
    P += [skirt(C, 0.74, 0.55, 0.0, (0.262, 0.207), "wool", col=(0.5, 0.5, 0.52), rows=2, trim="trim_zigzag")]
    P += legs_parts(C, "wool", (1.0, 0.95, 0.84), (0.45, 0.43, 0.41))
    P += belt_parts(C, off=0.04, scabbard=True)
    P += cloak_parts(C)
    _, stats["char_pohja"] = assemble("char_pohja", P)
    _, stats["helmet_pohja"] = assemble("helmet_pohja", helmet_parts(C, 0.142, (0.19, 0.195, 0.205)), rig=False)
    return stats


# ---------- varusteet (ei luurankoa; terä/kärki osoittaa -Y:hen = pelissä eteenpäin) ----------
def build_equipment():
    stats = {}
    W = {}
    steel, bronze, iron = (0.62, 0.63, 0.66), (0.62, 0.42, 0.14), (0.30, 0.31, 0.33)
    fwd = V((0, -1, 0))

    def blade(p, y0, length, width, thick, col):
        """Kaksiteräinen terä: vinoneliöpoikkileikkaus, suippeneva kärki."""
        secs = [(0.0, 1.0), (0.55, 0.9), (0.85, 0.7), (0.96, 0.4), (1.0, 0.02)]
        rings = []
        for t, k in secs:
            y = -(y0 + length * t)
            rings.append([p.v(V((x * width / 2 * k, y, z * thick / 2 * k)), W) for x, z in ((1, 0), (0, 1), (-1, 0), (0, -1))])
        for a, b in zip(rings, rings[1:]):
            for k in range(4):
                p.f([a[k], a[(k + 1) % 4], b[(k + 1) % 4], b[k]], "metal", None, col, False)

    # miekka: ote origossa
    p = Part()
    blade(p, 0.065, 0.74, 0.052, 0.008, steel)
    p.extend(box_part(V((0, -0.058, 0)), (0.115, 0.018, 0.022), "metal", W, bronze))
    p.extend(tube_part([V((0, -0.05, 0)), V((0, 0.055, 0))], [0.014, 0.013], 8, "leather", W, (0.35, 0.25, 0.2), tile=0.05))
    pommel = lathe(V((0, 0, 0)), [(0.004, -0.012), (0.026, -0.004), (0.028, 0.006), (0.004, 0.016)], 8, "metal", W, bronze)
    for i, c in enumerate(pommel.co):      # pyörähdysakseli z:lta y:lle (kahvan jatkeeksi)
        pommel.co[i] = V((c.x, 0.066 + c.z, c.y))
    p.extend(pommel)
    stats["sword"] = assemble("sword", [p], rig=False)[1]

    # keihäs: ote origossa, kärki -Y
    p = Part()
    p.extend(tube_part([V((0, 0.85, 0)), V((0, -1.05, 0))], [0.014, 0.0125], 8, "wood", W, (1.0, 0.92, 0.8), tile=0.3))
    p.extend(tube_part([V((0, -1.0, 0)), V((0, -1.12, 0))], [0.016, 0.012], 8, "metal", W, iron))
    q = Part()
    secs = [(0.0, 0.25), (0.25, 1.0), (0.7, 0.55), (1.0, 0.03)]
    rings = []
    for t, k in secs:
        rings.append([q.v(V((x * 0.027 * k, -(1.12 + 0.24 * t), z * 0.006 * max(k, 0.3))), W) for x, z in ((1, 0), (0, 1), (-1, 0), (0, -1))])
    for a, b in zip(rings, rings[1:]):
        for k in range(4):
            q.f([a[k], a[(k + 1) % 4], b[(k + 1) % 4], b[k]], "metal", None, steel, False)
    p.extend(q)
    stats["spear"] = assemble("spear", [p], rig=False)[1]

    # kilvet: soikea lankkukilpi, kupura, nahkareunus, kädensija takana. Etupinta -Y.
    for kind in ("hero", "urho", "pohja"):
        p = Part()
        rx, rz, n = 0.30, 0.39, 28
        front_c = p.v(V((0, -0.045, 0)), W)
        back_c = p.v(V((0, -0.03, 0)), W)
        fr, bk = [], []
        for k in range(n):
            a = k / n * 2 * math.pi
            x, z = math.sin(a) * rx, math.cos(a) * rz
            fr.append(p.v(V((x, -0.012, z)), W))
            bk.append(p.v(V((x, 0.0, z)), W))
        for k in range(n):
            k2 = (k + 1) % n
            uv = lambda i: (0.5 + p.co[i].x / (2 * rx) * 0.96, 0.5 + p.co[i].z / (2 * rz) * 0.96)
            p.f([front_c, fr[k2], fr[k]], "shield_" + kind, [uv(front_c), uv(fr[k2]), uv(fr[k])])
            p.f([back_c, bk[k], bk[k2]], "wood", [(0.5, 0.5), (0.5 + p.co[bk[k]].x * 2, 0.5 + p.co[bk[k]].z), (0.5 + p.co[bk[k2]].x * 2, 0.5 + p.co[bk[k2]].z)], (0.7, 0.6, 0.5))
        rim = [V((math.sin(k / n * 2 * math.pi) * rx, -0.006, math.cos(k / n * 2 * math.pi) * rz)) for k in range(n + 1)]
        p.extend(tube_part(rim, [0.018] * (n + 1), 6, "leather", W, (1.0, 0.85, 0.6), cap=False))
        boss = lathe(V((0, 0, 0)), [(0.095, 0.0), (0.09, 0.014), (0.07, 0.045), (0.04, 0.066), (0.003, 0.074)], 12, "metal", W, (0.2, 0.205, 0.215))
        for i, c in enumerate(boss.co):            # käännetään kupura osoittamaan -Y:hen
            boss.co[i] = V((c.x, -0.04 - c.z, c.y))
        p.extend(boss)
        p.extend(tube_part([V((-0.12, 0.03, 0)), V((0.12, 0.03, 0))], [0.014, 0.014], 6, "wood", W, (0.8, 0.7, 0.55)))
        p.extend(box_part(V((-0.12, 0.015, 0)), (0.03, 0.035, 0.03), "wood", W, (0.7, 0.6, 0.5)))
        p.extend(box_part(V((0.12, 0.015, 0)), (0.03, 0.035, 0.03), "wood", W, (0.7, 0.6, 0.5)))
        stats["shield_" + kind] = assemble("shield_" + kind, [p], rig=False)[1]
    return stats
