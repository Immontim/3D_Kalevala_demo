"""Metsän kaukopuut, horisonttimetsä ja reunan juurakko: assets/forest_lod.glb.

Lukee valmiin assets/forest.glb:n, joten metsäputkea (forest_clearing.blend) ei tarvita.
Ajetaan taustalla tyhjässä tiedostossa:

    blender --background --factory-startup --python assets-src/blender/forest_lod.py

Ympäristö: KALEVALA_ASSETS_OUT vaihtaa vientikansion (oletus <repo>/assets),
KALEVALA_PREVIEW=1 renderöi vertailukuvat kansioon assets-src/cards/lod_preview/.

Solmut (Blenderissä Z ylös, origo rungon tyvellä maan tasolla; pelissä Y ylös):
  <puu>_lod1   kahdeksalle puulle (pine_a..c, spruce_a/b/young, birch_a/b): kevennetty runko
               (M_BarkLOD, verteksivärit, ei tekstuuria) + kolme pystysuoraa kuvakorttia 60 asteen
               välein rungon läpi (M_FoliageLOD). Kortit ovat puun ortokuvia samasta suunnasta,
               joten ne näyttävät täydeltä puulta 35-80 m:n päästä. Mittakaava = forest.glb:n puu.
  metsaseina   horisonttimetsän suikale 80 x 20 m, origo alareunan keskellä, kuvapuoli -Y:hen
               (pelissä +Z). Laatoittuu vaakasuunnassa: suikaleita voi asettaa vierekkäin kehäksi.
  juurakko     kaatuneen puun pystyyn noussut juurilevy (halkaisija noin 2,6 m, korkeus noin 2,3 m) ja
               1,4 m:n runkotynkä +Y-suuntaan; sopii forest.glb:n kelon (log) tyveen reunaesteeksi.
               Törmäysehdotus: laatikko 2,7 x 0,9 m (x, y) origossa + tynkä. Levyn keskikohta 0,9 m.
Materiaalien nimet sisältävät sanan Foliage, joten pelin prepareMaterials tekee korteista
alfaleikattuja ja kaksipuolisia kuten muustakin lehvästöstä.
"""
import bpy, bmesh, os, math, random
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(REPO, "assets", "forest.glb")
SOIL_TEX = os.path.join(REPO, "assets", "ground", "dirt_diff.webp")
OUT = os.environ.get("KALEVALA_ASSETS_OUT", os.path.join(REPO, "assets"))
CARDS = os.path.join(REPO, "assets-src", "cards")
TMP = os.path.join(CARDS, "lod_tmp")
PREVIEW = os.environ.get("KALEVALA_PREVIEW")

TREES = ["pine_a", "pine_b", "pine_c", "spruce_a", "spruce_b", "spruce_young", "birch_a", "birch_b"]
VIEWS = 3                    # kortteja puuta kohti, 180/VIEWS asteen välein
CW, CH = 256, 512            # yhden kortin kuva atlaksessa
AW, AH = 2048, 2048          # atlas: rivit 0-2 puiden kortit (8 x 3), rivi 3 horisonttimetsä
TRUNK_TRIS = {"spruce_young": 24}
TRUNK_DEFAULT = 56
ALPHA_CUT = 0.42             # sama raja kuin pelin alphaTest
WALL_W, WALL_H = 80.0, 20.0
UP = Vector((0, 0, 1))


# ---------- apurit ----------
def reset():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    sc = bpy.context.scene
    w = bpy.data.worlds.new("W")
    sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes.get("Background")
    bg.inputs[0].default_value = (0, 0, 0, 1)
    bg.inputs[1].default_value = 0.0


def collection(name):
    c = bpy.data.collections.get(name)
    if not c:
        c = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(c)
    return c


def tris(me):
    return sum(len(p.vertices) - 2 for p in me.polygons)


def srgb_to_lin(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def img_px(im):
    w, h = im.size
    px = np.empty(w * h * 4, dtype=np.float32)
    im.pixels.foreach_get(px)
    return px.reshape(h, w, 4)


def diff_image(mat):
    for n in mat.node_tree.nodes:
        if n.type == 'TEX_IMAGE' and n.image and "nor" not in n.image.name.lower():
            return n.image
    return None


def col_name(me):
    return me.color_attributes[0].name if len(me.color_attributes) else None


def link(nt, a, b):
    nt.links.new(a, b)


# ---------- materiaalit ----------
def bake_material(src, colname, clip):
    """Valaisematon (emissio) versio: kuva tallentaa albedon, peli valaisee kortin itse."""
    m = bpy.data.materials.new("BAKE_" + src.name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = diff_image(src)
    em = nt.nodes.new("ShaderNodeEmission")
    if colname:
        vc = nt.nodes.new("ShaderNodeVertexColor")
        vc.layer_name = colname
        mul = nt.nodes.new("ShaderNodeMix")
        mul.data_type = 'RGBA'
        mul.blend_type = 'MULTIPLY'
        mul.inputs[0].default_value = 1.0
        link(nt, tex.outputs["Color"], mul.inputs[6])
        link(nt, vc.outputs["Color"], mul.inputs[7])
        link(nt, mul.outputs[2], em.inputs["Color"])
    else:
        link(nt, tex.outputs["Color"], em.inputs["Color"])
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    if clip:
        gt = nt.nodes.new("ShaderNodeMath")
        gt.operation = 'GREATER_THAN'
        gt.inputs[1].default_value = ALPHA_CUT
        link(nt, tex.outputs["Alpha"], gt.inputs[0])
        link(nt, gt.outputs[0], mix.inputs[0])
    else:
        mix.inputs[0].default_value = 1.0
    link(nt, tr.outputs[0], mix.inputs[1])
    link(nt, em.outputs[0], mix.inputs[2])
    link(nt, mix.outputs[0], out.inputs["Surface"])
    return m


def foliage_lod_material(atlas):
    m = bpy.data.materials.new("M_FoliageLOD")
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.8
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = atlas
    link(nt, tex.outputs["Color"], bsdf.inputs["Base Color"])
    rnd = nt.nodes.new("ShaderNodeMath")          # Round -> glTF:n alphaMode MASK
    rnd.operation = 'ROUND'
    link(nt, tex.outputs["Alpha"], rnd.inputs[0])
    link(nt, rnd.outputs[0], bsdf.inputs["Alpha"])
    m.use_backface_culling = False
    return m


def vcol_material(name, rough=0.95):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = rough
    vc = nt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "Col"
    link(nt, vc.outputs["Color"], bsdf.inputs["Base Color"])
    m.use_backface_culling = True
    return m


def tex_material(name, path, rough=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = rough
    tex = nt.nodes.new("ShaderNodeTexImage")
    im = bpy.data.images.load(path)
    im.pack()
    tex.image = im
    vc = nt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "Col"
    mul = nt.nodes.new("ShaderNodeMix")
    mul.data_type = 'RGBA'
    mul.blend_type = 'MULTIPLY'
    mul.inputs[0].default_value = 1.0
    link(nt, tex.outputs["Color"], mul.inputs[6])
    link(nt, vc.outputs["Color"], mul.inputs[7])
    link(nt, mul.outputs[2], bsdf.inputs["Base Color"])
    m.use_backface_culling = True
    return m


# ---------- renderöinti ----------
def setup_render(w, h, samples=16):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.cycles.use_denoising = False
    sc.cycles.transparent_max_bounces = 256
    sc.cycles.max_bounces = 0
    sc.render.film_transparent = True
    sc.render.filter_size = 1.0
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.render.image_settings.color_depth = '8'


def ortho_camera():
    cam = bpy.data.cameras.new("BakeCam")
    cam.type = 'ORTHO'
    cam.clip_start, cam.clip_end = 0.1, 400
    ob = bpy.data.objects.new("BakeCam", cam)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.scene.camera = ob
    return ob


def aim(camob, direction, center, dist=150):
    """Kamera katsoo suuntaan `direction` (vaakasuora) pisteeseen `center`."""
    camob.location = center - direction * dist
    camob.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    bpy.context.view_layer.update()
    return camob.matrix_world.col[0].xyz.normalized()     # kuvan oikea reuna


def render_to(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    im = bpy.data.images.load(path)
    px = img_px(im).copy()
    bpy.data.images.remove(im)
    return px


def bleed(px, iters=24):
    """Läpinäkyvät pikselit saavat viereisten näkyvien värin, ettei mipmap tuo reunoille tummaa sauraa."""
    rgb, a = px[..., :3].copy(), px[..., 3]
    known = a > 0.5
    rgb[~known] = 0
    for _ in range(iters):
        acc = np.zeros_like(rgb)
        cnt = np.zeros(a.shape, dtype=np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            k = np.roll(known, (dy, dx), axis=(0, 1))
            acc += np.roll(rgb, (dy, dx), axis=(0, 1)) * k[..., None]
            cnt += k
        grow = (~known) & (cnt > 0)
        rgb[grow] = acc[grow] / cnt[grow][:, None]
        known = known | grow
    if (~known).any() and known.any():
        rgb[~known] = rgb[known].mean(axis=0)
    out = px.copy()
    out[..., :3] = np.where((a > 0.5)[..., None], px[..., :3], rgb)
    return out


# ---------- geometria ----------
def crown_copy(src):
    """Puu ilman päärunkoa kuvausta varten: kalteva runko ei saa näkyä korteissa toisena runkona."""
    bark_slot = next(i for i, s in enumerate(src.material_slots) if "Foliage" not in s.material.name)
    bm = bmesh.new()
    bm.from_mesh(src.data)
    trunk = trunk_island(bm, bark_slot)
    bmesh.ops.delete(bm, geom=list(trunk), context='FACES')
    me = bpy.data.meshes.new(src.name + "_crown")
    bm.to_mesh(me)
    bm.free()
    for m in src.data.materials:
        me.materials.append(m)
    ob = bpy.data.objects.new(me.name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def trunk_island(bm, bark_slot):
    bark = {f for f in bm.faces if f.material_index == bark_slot}
    seen, best, best_h = set(), None, -1
    for f in bark:
        if f in seen:
            continue
        island, stack = [], [f]
        seen.add(f)
        while stack:
            g = stack.pop()
            island.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h in bark and h not in seen:
                        seen.add(h)
                        stack.append(h)
        zs = [v.co.z for g in island for v in g.verts]
        if max(zs) - min(zs) > best_h:
            best, best_h = island, max(zs) - min(zs)
    return set(best)


def main_trunk(src, bark_slot, target):
    """Pisin kaarnasaari (päärunko) erilleen, kevennettynä ja verteksivärein."""
    bm = bmesh.new()
    bm.from_mesh(src.data)
    keep = trunk_island(bm, bark_slot)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f not in keep], context='FACES')
    me = bpy.data.meshes.new(src.name + "_trunk")
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(me.name, me)
    bpy.context.scene.collection.objects.link(ob)
    return decimate(ob, target)


def decimate(ob, target):
    me = ob.data
    cur = tris(me)
    if cur > target:
        mod = ob.modifiers.new("dec", 'DECIMATE')
        mod.ratio = target / cur
        mod.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = ob
        ob.select_set(True)
        bpy.ops.object.modifier_apply(modifier="dec")
        ob.select_set(False)
    return ob


def bark_color(src, bark_slot):
    im = diff_image(src.material_slots[bark_slot].material)
    px = img_px(im)[..., :3]
    return srgb_to_lin(px.reshape(-1, 3).mean(axis=0))


def set_corner_colors(me, fn):
    ca = me.color_attributes.get("Col") or me.color_attributes.new("Col", 'FLOAT_COLOR', 'CORNER')
    for li, loop in enumerate(me.loops):
        ca.data[li].color = fn(li, loop)
    me.color_attributes.active_color = ca
    me.color_attributes.render_color_index = list(me.color_attributes).index(ca)


def recolor_trunk(ob, base):
    """Verteksivärit = kaarnan keskiväri x alkuperäinen sävy (männyn harmaa tyvi säilyy)."""
    me = ob.data
    old = me.color_attributes[0] if len(me.color_attributes) else None
    vals = None
    if old:
        vals = [tuple(old.data[i].color)[:3] for i in range(len(old.data))]
        dom = old.domain
    for a in list(me.color_attributes):
        me.color_attributes.remove(a)

    def fn(li, loop):
        if vals is None:
            c = (1, 1, 1)
        else:
            c = vals[li] if dom == 'CORNER' else vals[loop.vertex_index]
        return (base[0] * c[0], base[1] * c[1], base[2] * c[2], 1.0)
    set_corner_colors(me, fn)
    for uv in list(me.uv_layers):
        me.uv_layers.remove(uv)
    me.materials.clear()


def add_cards(bm, uvl, cards, normals):
    """cards: lista (right, zmin, S, uv-solu). Kortti = 2 x 3 ruudukko, normaali ulos ja ylös."""
    for right, zmin, S, (u0, v0, u1, v1) in cards:
        hw = S / 4
        cols = [-hw, 0.0, hw]
        rows = [zmin + S * t for t in (0, 1 / 3, 2 / 3, 1)]
        grid = []
        for z in rows:
            line = []
            for u in cols:
                v = bm.verts.new(right * u + UP * z)
                side = right * (1 if u > 0 else -1) if u != 0 else Vector((0, 0, 0))
                normals[v] = (side * 0.8 + UP * 0.6).normalized()
                line.append((v, u, z))
            grid.append(line)
        for i in range(3):
            for j in range(2):
                quad = [grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]]
                f = bm.faces.new([q[0] for q in quad])
                for loop, (_, u, z) in zip(f.loops, quad):
                    loop[uvl].uv = (u0 + (u + hw) / (2 * hw) * (u1 - u0), v0 + (z - zmin) / S * (v1 - v0))


def cell_uv(col, row, w=CW, h=CH):
    """Solu atlaksessa; rivi 0 ylimpänä. Blenderin UV:n origo on vasemmassa alakulmassa."""
    return (col * w / AW, 1 - (row * h + h) / AH, (col * w + w) / AW, 1 - row * h / AH)


def put_cell(atlas, px, col, row):
    h, w = px.shape[:2]
    y0 = AH - (row * CH + h)          # numpy-taulukon rivi 0 on kuvan alareuna
    atlas[y0:y0 + h, col * w if w == CW else 0:(col * w if w == CW else 0) + w] = px


# ---------- puut ----------
def swap_bake(src):
    """Vaihtaa puun materiaalit valaisemattomiin; palauttaa alkuperäiset."""
    colname = col_name(src.data)
    saved = [s.material for s in src.material_slots]
    for s in src.material_slots:
        s.material = bake_material(s.material, colname, "Foliage" in s.material.name)
    return saved


def restore(src, saved):
    for s, m in zip(src.material_slots, saved):
        s.material = m


def bake_tree(src, index, camob):
    me = src.data
    crown = crown_copy(src)
    swap_bake(crown)
    zs = [v.co.z for v in me.vertices]
    zmin, H = min(zs), max(zs) - min(zs)
    cards = []
    for k in range(VIEWS):
        ang = k * math.pi / VIEWS
        d = Vector((math.cos(ang), math.sin(ang), 0))
        perp = Vector((-d.y, d.x, 0))
        W = 2 * max(abs(v.co.dot(perp)) for v in me.vertices)
        S = max(H, 2 * W) * 1.03
        camob.data.ortho_scale = S
        right = aim(camob, d, Vector((0, 0, zmin + S / 2)))
        px = render_to(os.path.join(TMP, "%s_%d.png" % (src.name, k)))
        col, row = index, k
        cards.append((right, zmin, S, cell_uv(col, row), px, col, row))
    bpy.data.objects.remove(crown, do_unlink=True)
    return cards


def build_lod(src, cards, mats):
    bark_slot = next(i for i, s in enumerate(src.material_slots) if "Foliage" not in s.material.name)
    base = bark_color(src, bark_slot)
    trunk = main_trunk(src, bark_slot, TRUNK_TRIS.get(src.name, TRUNK_DEFAULT))
    recolor_trunk(trunk, base)
    me = trunk.data
    me.materials.append(mats["bark"])
    me.materials.append(mats["foliage"])
    bm = bmesh.new()
    bm.from_mesh(me)
    uvl = bm.loops.layers.uv.new("UVMap")
    col = bm.loops.layers.float_color.get("Col")
    n_before = len(bm.verts)
    normals = {}
    add_cards(bm, uvl, [(c[0], c[1], c[2], c[3]) for c in cards], normals)
    for f in bm.faces:
        if any(v in normals for v in f.verts):
            f.material_index = 1
            for l in f.loops:
                l[col] = (1, 1, 1, 1)
        else:
            f.material_index = 0
    bm.verts.index_update()
    nmap = {v.index: n for v, n in normals.items()}
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    me.update()
    nrms = [tuple(nmap[i]) if i in nmap else tuple(v.normal) for i, v in enumerate(me.vertices)]
    me.normals_split_custom_set_from_vertices(nrms)
    trunk.name = src.name + "_lod1"
    me.name = trunk.name
    return trunk


# ---------- horisonttimetsä ----------
def bake_wall(trees, camob):
    """Kolme syvyysriviä puita 80 m:n matkalla; reunan ylittävät puut toistuvat toisella reunalla."""
    rng = random.Random(4)
    tmp = collection("WALL_TMP")
    pool = ["spruce_a", "spruce_a", "spruce_b", "spruce_b", "pine_a", "pine_b", "pine_c", "birch_a", "spruce_young"]
    placed = []
    for depth, n in ((0.0, 15), (6.0, 18), (12.0, 22)):
        for i in range(n):
            x = -WALL_W / 2 + (i + rng.uniform(0.1, 0.9)) * WALL_W / n
            placed.append((rng.choice(pool), x, depth + rng.uniform(-2, 2), rng.uniform(0.8, 1.2), rng.uniform(0, 6.28)))
    objs = []
    saved = {n: swap_bake(trees[n]) for n in set(pool)}
    for name, x, y, s, rot in placed:
        for shift in (-WALL_W, 0.0, WALL_W):
            if abs(x + shift) > WALL_W / 2 + 6:
                continue
            o = bpy.data.objects.new("wall_" + name, trees[name].data)
            o.location = (x + shift, y, 0)
            o.scale = (s, s, s)
            o.rotation_euler = (0, 0, rot)
            tmp.objects.link(o)
            objs.append(o)
    camob.data.ortho_scale = WALL_W
    setup_render(AW, int(AW * WALL_H / WALL_W), 16)
    aim(camob, Vector((0, 1, 0)), Vector((0, 0, WALL_H / 2 - 0.4)))
    px = render_to(os.path.join(TMP, "wall.png"))
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)
    for n, s in saved.items():
        restore(trees[n], s)
    return px


def build_wall(mat):
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    col = bm.loops.layers.float_color.new("Col")
    u0, v0, u1, v1 = cell_uv(0, 3, AW, int(AW * WALL_H / WALL_W))
    v0 = 1 - (3 * CH + int(AW * WALL_H / WALL_W)) / AH
    xs = [-WALL_W / 2 + WALL_W * t / 4 for t in range(5)]
    zs = [-0.4 + WALL_H * t / 2 for t in range(3)]
    grid = [[bm.verts.new((x, 0, z)) for x in xs] for z in zs]
    for i in range(2):
        for j in range(4):
            q = [grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]]
            f = bm.faces.new(q)
            for l in f.loops:
                x, z = l.vert.co.x, l.vert.co.z
                l[uvl].uv = (u0 + (x + WALL_W / 2) / WALL_W * (u1 - u0), v0 + (z + 0.4) / WALL_H * (v1 - v0))
                l[col] = (1, 1, 1, 1)
    me = bpy.data.meshes.new("metsaseina")
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    n = Vector((0, -0.8, 0.6)).normalized()
    for p in me.polygons:
        p.use_smooth = True
    me.normals_split_custom_set_from_vertices([tuple(n)] * len(me.vertices))
    ob = bpy.data.objects.new("metsaseina", me)
    return ob


# ---------- juurakko ----------
def tube(bm, uvl, col, pts, radii, sides, color=(1, 1, 1), vtile=1.0):
    rings, acc = [], 0.0
    for i, p in enumerate(pts):
        d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        a = Vector((1, 0, 0)) - d * d.x
        if a.length < 1e-3:
            a = Vector((0, 1, 0)) - d * d.y
        a.normalize()
        b = d.cross(a)
        if i:
            acc += (p - pts[i - 1]).length
        rings.append(([bm.verts.new(p + (a * math.cos(k * 6.2832 / sides) + b * math.sin(k * 6.2832 / sides)) * radii[i])
                       for k in range(sides)], acc / vtile))
    faces = []
    for i in range(len(pts) - 1):
        for k in range(sides):
            k2 = (k + 1) % sides
            (r0, v0), (r1, v1) = rings[i], rings[i + 1]
            f = bm.faces.new([r0[k], r0[k2], r1[k2], r1[k]])
            for l, uv in zip(f.loops, [(k / sides, v0), ((k + 1) / sides, v0), ((k + 1) / sides, v1), (k / sides, v1)]):
                l[uvl].uv = uv
                l[col] = (*color, 1)
            faces.append(f)
    # tylpät päät kiinni
    for r, _ in (rings[0], rings[-1]):
        f = bm.faces.new(r if r is rings[-1][0] else list(reversed(r)))
        for l in f.loops:
            l[uvl].uv = (0.5 + 0.5 * math.cos(l.vert.co.x * 3), 0.5)
            l[col] = (*color, 1)
        faces.append(f)
    return faces


def build_root_plate(mats):
    rng = random.Random(17)
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    col = bm.loops.layers.float_color.new("Col")
    # Maalevy: litistetty, kuhmurainen kiekko pystyssä XZ-tasossa, alareuna 0,3 m maan alla.
    R, T, cz = 1.3, 0.32, 0.9
    seg, ring = 28, 14
    verts = []
    for j in range(ring + 1):
        th = math.pi * j / ring
        line = []
        for i in range(seg):
            ph = 2 * math.pi * i / seg
            n = 1 + 0.12 * math.sin(3 * ph + 1.3) + 0.07 * math.sin(7 * ph) + rng.uniform(-0.05, 0.05)
            x = R * math.sin(th) * math.cos(ph) * n
            z = cz + R * 0.95 * math.sin(th) * math.sin(ph) * n
            y = T * math.cos(th) * (1 + rng.uniform(-0.15, 0.25))
            line.append(bm.verts.new((x, y, max(z, -0.3))))
        verts.append(line)
    soil = []
    for j in range(ring):
        for i in range(seg):
            i2 = (i + 1) % seg
            q = [verts[j][i], verts[j][i2], verts[j + 1][i2], verts[j + 1][i]]
            if len({v.index for v in q}) < 4 and j in (0, ring - 1):
                pass
            try:
                f = bm.faces.new(q)
            except ValueError:
                continue
            soil.append(f)
            for l in f.loops:
                c = l.vert.co
                l[uvl].uv = (c.x * 0.45, c.z * 0.45 + c.y * 0.3)
                d = 0.42 + 0.3 * max(0.0, min(1.0, (c.z - 0.2) / 2.0)) + rng.uniform(-0.05, 0.05)   # tyvi tummempaa, kostea multa
                l[col] = (d, d * 0.92, d * 0.85, 1)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    root_faces = []
    def root(p0, dirv, L, r0, pull_y, droop, wander, segs=5):
        pts, d = [p0], dirv.copy()
        turn = Vector((rng.uniform(-1, 1), 0, rng.uniform(-1, 1))) * wander    # jokainen juuri kaartuu omaan suuntaansa
        for s in range(segs):
            d = (d + turn + Vector((rng.uniform(-0.3, 0.3), pull_y + rng.uniform(-0.1, 0.1), -droop + rng.uniform(-0.2, 0.2)))).normalized()
            pts.append(pts[-1] + d * (L / segs))
        for p in pts:
            p.z = max(p.z, -0.05)
        return tube(bm, uvl, col, pts, [r0 * (1 - 0.75 * t / segs) + 0.008 for t in range(segs + 1)], 6, (0.8, 0.76, 0.7), 0.7)

    # Paljastuneen alapinnan (-Y) paksut juuret: lähtevät eri kohdista lähellä tyveä, kaartuvat ja katkeavat.
    for k in range(9):
        ph = rng.uniform(0, 2 * math.pi)
        dirv = Vector((math.cos(ph), 0, math.sin(ph) * 0.95))
        start = Vector((rng.uniform(-0.45, 0.45), -T * 0.8, cz + rng.uniform(-0.45, 0.45)))
        root_faces += root(start, dirv, rng.uniform(0.6, 1.1), rng.uniform(0.08, 0.14), -0.06, 0.1, 0.35, 4)
    # Ohuempia juuria pinnalla ja reunoilla: lyhyitä, mutkaisia, osa roikkuu.
    for k in range(16):
        ph = rng.uniform(0, 2 * math.pi)
        dirv = Vector((math.cos(ph), rng.uniform(-0.3, 0.1), math.sin(ph) * 0.95)).normalized()
        start = Vector((0, rng.uniform(-0.3, 0.1), cz)) + Vector((math.cos(ph), 0, math.sin(ph) * 0.95)) * R * rng.uniform(0.45, 0.9)
        root_faces += root(start, dirv, rng.uniform(0.25, 0.7), rng.uniform(0.025, 0.055), -0.15, 0.3, 0.5, 4)
    # Runkotynkä +Y:hen (kelo jatkuu tästä).
    stub = [Vector((0, 0.05, cz)), Vector((0, 0.8, cz - 0.12)), Vector((0, 1.45, cz - 0.25))]
    root_faces += tube(bm, uvl, col, stub, [0.24, 0.19, 0.17], 9, (1, 1, 1), 1.4)
    for f in bm.faces:
        f.material_index = 1 if f in set(root_faces) else 0
        f.smooth = True
    me = bpy.data.meshes.new("juurakko")
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mats["soil"])
    me.materials.append(mats["log"])
    ob = bpy.data.objects.new("juurakko", me)
    return ob


# ---------- esikatselu ----------
def preview(trees, lods, wall, plate):
    """Täysi puu ja LOD vierekkäin 40 m:n päästä auringossa, sekä horisonttimetsä ja juurakko lähempää."""
    pdir = os.path.join(CARDS, "lod_preview")
    os.makedirs(pdir, exist_ok=True)
    sc = bpy.context.scene
    sc.world.node_tree.nodes["Background"].inputs[0].default_value = (0.55, 0.62, 0.7, 1)
    sc.world.node_tree.nodes["Background"].inputs[1].default_value = 1.0
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", 'SUN'))
    sun.data.energy = 3.5
    sun.rotation_euler = (math.radians(50), 0, math.radians(-40))
    sc.collection.objects.link(sun)
    for o in bpy.context.scene.objects:
        o.hide_render = True
    sun.hide_render = False
    show = collection("SHOW")
    cam = bpy.data.objects.new("PCam", bpy.data.cameras.new("PCam"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.lens = 35
    setup_render(1600, 500, 32)
    sc.render.film_transparent = False
    sc.cycles.max_bounces = 4
    for kind, src in (("full", trees), ("lod", lods)):
        objs = []
        for i, name in enumerate(TREES):
            o = bpy.data.objects.new(kind + "_" + name, src[name].data)
            o.location = (i * 9, 0, 0)
            o.rotation_euler = (0, 0, 0.4 * i)
            show.objects.link(o)
            objs.append(o)
        for tag, ang in (("a", 0), ("b", 35)):
            target = Vector((31.5, 0, 6))
            d = Vector((math.sin(math.radians(ang)), 1, 0)).normalized()
            cam.location = target - d * 70 + Vector((0, 0, -4.3))
            cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
            sc.render.filepath = os.path.join(pdir, "%s_%s.png" % (kind, tag))
            bpy.ops.render.render(write_still=True)
        for o in objs:
            bpy.data.objects.remove(o, do_unlink=True)
    w = bpy.data.objects.new("wall_show", wall.data)
    p = bpy.data.objects.new("plate_show", plate.data)
    w.location = (0, 30, 0)
    p.location = (-1.5, 4, 0)
    p.rotation_euler = (0, 0, 0.6)
    show.objects.link(w)
    show.objects.link(p)
    lg = bpy.data.objects.new("log_show", bpy.data.objects["log"].data)
    lg.location = (1.0, 6.5, 0)
    lg.rotation_euler = (0, 0, 0.6)
    show.objects.link(lg)
    gm = bpy.data.materials.new("PGround")
    gm.use_nodes = True
    gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.16, 0.14, 0.09, 1)
    bpy.ops.mesh.primitive_plane_add(size=120, location=(0, 20, 0))
    bpy.context.active_object.data.materials.append(gm)
    cam.location = (0, -6, 1.7)
    cam.rotation_euler = (math.radians(86), 0, 0)
    cam.data.lens = 24
    sc.render.filepath = os.path.join(pdir, "edge.png")
    bpy.ops.render.render(write_still=True)


# ---------- pää ----------
def run():
    os.makedirs(TMP, exist_ok=True)
    reset()
    bpy.ops.import_scene.gltf(filepath=SRC)
    trees = {n: bpy.data.objects[n] for n in TREES}
    for o in list(bpy.context.scene.objects):
        if o.name not in TREES:
            o.hide_render = True
    for n, o in trees.items():
        o.location = (0, 0, 0)
        o.hide_render = False
    log_mat = bpy.data.objects["log"].material_slots[0].material

    camob = ortho_camera()
    atlas = np.zeros((AH, AW, 4), dtype=np.float32)
    setup_render(CW, CH, 16)
    baked = {}
    for i, n in enumerate(TREES):
        for m in TREES:
            trees[m].hide_render = True
        cards = bake_tree(trees[n], i, camob)
        for c in cards:
            put_cell(atlas, bleed(c[4]), c[5], c[6])
        baked[n] = cards
    for m in TREES:
        trees[m].hide_render = False
    for o in bpy.context.scene.objects:
        if o.name in TREES:
            o.hide_render = True
    wall_px = bleed(bake_wall(trees, camob))
    atlas[AH - 3 * CH - wall_px.shape[0]:AH - 3 * CH, :] = wall_px

    atlas_path = os.path.join(CARDS, "forest_lod_atlas.png")
    im = bpy.data.images.new("forest_lod_atlas", AW, AH, alpha=True)
    im.pixels.foreach_set(atlas.ravel())
    im.filepath_raw = atlas_path
    im.file_format = 'PNG'
    im.save()
    bpy.data.images.remove(im)
    im = bpy.data.images.load(atlas_path)
    im.name = "forest_lod_atlas"
    im.pack()

    mats = {
        "foliage": foliage_lod_material(im),
        "bark": vcol_material("M_BarkLOD", 0.95),
        "soil": tex_material("M_Soil", SOIL_TEX, 1.0),
        "log": log_mat,
    }
    game = collection("GAME")
    lods = {}
    for n in TREES:
        ob = build_lod(trees[n], baked[n], mats)
        for c in list(ob.users_collection):
            c.objects.unlink(ob)
        game.objects.link(ob)
        lods[n] = ob
    wall = build_wall(mats["foliage"])
    game.objects.link(wall)
    plate = build_root_plate(mats)
    game.objects.link(plate)

    stats = {o.name: tris(o.data) for o in game.objects}
    stats["full"] = {n: tris(trees[n].data) for n in TREES}

    if PREVIEW:
        preview(trees, lods, wall, plate)

    # vienti: vain GAME-kokoelma, prototyypit origossa
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in game.objects:
        o.location = (0, 0, 0)
        o.select_set(True)
    bpy.context.view_layer.objects.active = wall
    path = os.path.join(OUT, "forest_lod.glb")
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True,
        export_image_format='WEBP', export_image_quality=82,
        export_vertex_color='NAME', export_vertex_color_name='Col', export_all_vertex_colors=False,
        export_apply=True, export_animations=False, export_yup=True,
        export_cameras=False, export_lights=False,
    )
    stats["glb_mb"] = round(os.path.getsize(path) / 1e6, 2)
    print("FOREST_LOD", stats)


run()
