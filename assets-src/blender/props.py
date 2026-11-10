"""Kivet, kelot, risut, heinät, saniaiset, nuotio ja kota GAME-kokoelmaan.
Skannatut Poly Haven -mallit kevennetään (Decimate) pelikäyttöön.
Edellyttää trees.py:n (Builder, pbr, MATS) samassa nimiavaruudessa.
"""
import bpy, bmesh, math, random
from mathutils import Vector, Matrix


def src_images(mat_name):
    m = bpy.data.materials[mat_name]
    diff = nor = None
    for n in m.node_tree.nodes:
        if n.type == 'TEX_IMAGE' and n.image:
            for o in n.outputs:
                for l in o.links:
                    if l.to_socket.name == "Base Color":
                        diff = n.image
                    if l.to_node.type == 'NORMAL_MAP':
                        nor = n.image
    return diff, nor


def game_mat(name, src_mat, alpha=False, twosided=False, rough=0.9, use_nor=True):
    diff, nor = src_images(src_mat)
    return pbr(name, diff, nor if use_nor else None, alpha=alpha, rough=rough, twosided=twosided, vcol=False)


def lowpoly(src, name, tris, col, mat, sink=0.08, scale=1.0):
    """Kevennetty kopio: transformit sovellettu, origo pohjan keskellä."""
    so = bpy.data.objects[src]
    old = bpy.data.objects.get(name)
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    tmp = so.copy()
    tmp.data = so.data.copy()
    bpy.context.scene.collection.objects.link(tmp)
    # skannatuissa malleissa on hitsaamattomia saumoja, jotka estävät kevennyksen
    wb = bmesh.new()
    wb.from_mesh(tmp.data)
    bmesh.ops.remove_doubles(wb, verts=wb.verts, dist=1e-5)
    wb.to_mesh(tmp.data)
    wb.free()
    cur = sum(len(p.vertices) - 2 for p in tmp.data.polygons)
    if tris and cur > tris:
        mod = tmp.modifiers.new("dec", 'DECIMATE')
        mod.ratio = tris / cur
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    me.transform(so.matrix_world.to_3x3().to_4x4() @ Matrix.Scale(scale, 4))
    bpy.data.objects.remove(tmp, do_unlink=True)
    xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
    off = Vector(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, min(zs) + (max(zs) - min(zs)) * sink))
    me.transform(Matrix.Translation(-off))
    me.name = name
    me.materials.clear()
    me.materials.append(mat)
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    col.objects.link(ob)
    return ob


def soft_up_normals(ob, up=0.75):
    me = ob.data
    nrms = []
    for v in me.vertices:
        n = Vector((v.co.x, v.co.y, 0))
        n = n.normalized() * (1 - up) if n.length > 1e-5 else Vector((0, 0, 0))
        nrms.append(tuple((n + Vector((0, 0, up))).normalized()))
    me.normals_split_custom_set_from_vertices(nrms)


def join(objs, name, col):
    old = bpy.data.objects.get(name)
    if old and old not in objs:
        bpy.data.objects.remove(old, do_unlink=True)
    bm = bmesh.new()
    mats = []
    for o in objs:
        me = o.data.copy()
        me.transform(o.matrix_world)
        remap = []
        for m in me.materials:
            if m not in mats:
                mats.append(m)
            remap.append(mats.index(m))
        start = len(bm.faces)
        bm.from_mesh(me)
        bm.faces.ensure_lookup_table()
        for f in bm.faces[start:]:
            f.material_index = remap[f.material_index] if remap else 0
        bpy.data.meshes.remove(me)
    out = bpy.data.meshes.new(name)
    bm.to_mesh(out)
    bm.free()
    for m in mats:
        out.materials.append(m)
    for p in out.polygons:
        p.use_smooth = True
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)
    ob = bpy.data.objects.new(name, out)
    col.objects.link(ob)
    return ob


def build_kota(col):
    MATS["kota"] = pbr("M_KotaCover", bpy.data.images["pine_bark_diff"], bpy.data.images["pine_bark_nor"], rough=0.95, twosided=True)
    b = Builder("kota", 77, ["spruce", "kota"])
    rng = b.rng
    R, H, N = 2.3, 3.3, 16
    apex = Vector((0, 0, H))
    mi = b.mi("kota")
    # kaarnalevykate kolmessa limittäisessä kerroksessa; oviaukko jää auki
    for tier in range(3):
        t0, t1 = tier / 3, (tier + 1) / 3 + 0.05
        for k in range(N):
            if k in (0,) and tier < 2:
                continue    # oviaukko
            a0, a1 = k * 2 * math.pi / N, (k + 1) * 2 * math.pi / N
            lift = 0.03 * (2 - tier) + rng.uniform(0, 0.02)
            def pt(a, t):
                r = (R + lift) * (1 - t * 0.93)
                return Vector((math.cos(a) * r, math.sin(a) * r, H * t * 0.93))
            vs = [b.bm.verts.new(pt(a0, t0)), b.bm.verts.new(pt(a1, t0)), b.bm.verts.new(pt(a1, t1)), b.bm.verts.new(pt(a0, t1))]
            f = b.bm.faces.new(vs)
            f.material_index = mi
            f.smooth = False
            sh = rng.uniform(0.75, 1.0)
            u = rng.random()
            for l, uvv in zip(f.loops, [(u, t0 * 2), (u + 0.5, t0 * 2), (u + 0.5, t1 * 2), (u, t1 * 2)]):
                l[b.uv].uv = uvv
                l[b.col] = (sh, sh * 0.95, sh * 0.9, 1)
    # seipäät, jotka risteävät huipulla
    for k in range(N):
        a = (k + 0.5) * 2 * math.pi / N + rng.uniform(-0.05, 0.05)
        foot = Vector((math.cos(a) * (R + 0.12), math.sin(a) * (R + 0.12), -0.1))
        top = apex + Vector((rng.uniform(-0.08, 0.08), rng.uniform(-0.08, 0.08), -0.25))
        d = (top - foot).normalized()
        b.tube([foot, top, top + d * rng.uniform(0.5, 1.0)], [0.075, 0.055, 0.035], 5, "spruce", vtile=0.9, color=(0.8, 0.75, 0.7))
    return b.finish(col)


def build_props():
    game = bpy.data.collections["GAME"]
    M = {
        "rock1": game_mat("M_Rock1", "rock_moss_set_01"),
        "rock2": game_mat("M_Rock2", "rock_moss_set_02"),
        "log": game_mat("M_Log", "dead_tree_trunk"),
        "twigs": game_mat("M_Twigs", "dry_branches_medium_01", use_nor=False),
        "grass": game_mat("M_Grass", "grass_medium_01", alpha=True, twosided=True, use_nor=False, rough=0.8),
        "fern": game_mat("M_Fern", "fern_02", alpha=True, twosided=True, use_nor=False, rough=0.8),
    }
    out = []
    rocks = [("rock_moss_set_01_rock01", "rock1", 1400), ("rock_moss_set_01_rock03", "rock1", 1000),
             ("rock_moss_set_01_rock04", "rock1", 1400), ("rock_moss_set_02_rock08", "rock2", 800),
             ("rock_moss_set_02_rock11", "rock2", 1200), ("rock_moss_set_02_rock13", "rock2", 1000)]
    for i, (src, m, tris) in enumerate(rocks):
        out.append(lowpoly(src, "rock_%d" % (i + 1), tris, game, M[m], sink=0.12))
    old = bpy.data.objects.get("boulder")
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    out.append(lowpoly("dead_tree_trunk", "log", 2400, game, M["log"], sink=0.15, scale=1.6))
    for n, s in (("a", "twig_a"), ("b", "twig_b"), ("c", "twig_c")):
        out.append(lowpoly("dry_branches_medium_01_" + n, s, 450, game, M["twigs"], sink=0.1))
    for src, n in (("grass_medium_01_tall_a_LOD0", "grass_a"), ("grass_medium_01_tall_b_LOD0", "grass_b"),
                   ("grass_medium_01_small_b_LOD0", "grass_c"), ("grass_medium_01_tiny_a_LOD0", "grass_d")):
        o = lowpoly(src, n, 320, game, M["grass"], sink=0.02, scale=1.6)
        soft_up_normals(o)
        out.append(o)
    for src, n in (("fern_02_a", "fern_a"), ("fern_02_d", "fern_b")):
        o = lowpoly(src, n, 500, game, M["fern"], sink=0.02, scale=1.1)
        soft_up_normals(o, 0.6)
        out.append(o)

    # nuotio: kivikehä ja kekoon nostetut kalikat
    rng = random.Random(5)
    parts = []
    for i in range(10):
        a = i / 10 * 6.283 + rng.uniform(-0.1, 0.1)
        st = lowpoly("rock_moss_set_02_rock08" if i % 2 else "rock_moss_set_02_rock13", "tmp_stone_%d" % i, 140, game, M["rock2"],
                     sink=0.2, scale=rng.uniform(0.17, 0.25))
        st.location = (math.cos(a) * 0.62, math.sin(a) * 0.62, 0)
        st.rotation_euler = (rng.uniform(-0.3, 0.3), rng.uniform(-0.3, 0.3), rng.uniform(0, 6.28))
        parts.append(st)
    for i in range(6):
        a = i / 6 * 6.283 + rng.uniform(-0.2, 0.2)
        lg = lowpoly("dead_tree_trunk", "tmp_log_%d" % i, 220, game, M["log"], sink=0.5, scale=0.3)
        lg.scale = (1, 1.7, 1.7)
        tilt = 0.75 if i < 4 else 0.12
        lg.rotation_euler = (0, -tilt, a)
        r = 0.2 if i < 4 else 0.3
        lg.location = (math.cos(a) * r, math.sin(a) * r, 0.3 if i < 4 else 0.07)
        parts.append(lg)
    bpy.context.view_layer.update()
    out.append(join(parts, "campfire", game))
    out.append(build_kota(game))

    stats = {}
    for i, ob in enumerate(out):
        ob.location = (i * 3.0, -12, 0)
        stats[ob.name] = [sum(len(p.vertices) - 2 for p in ob.data.polygons), [round(d, 2) for d in ob.dimensions]]
    return stats
