"""Suo, johon vihollinen lauletaan: mutalampare, turvereunus ja kuplan malli.
Vie tiedoston assets/bog.glb. Malleissa ei ole tekstuureja: peli käyttää maaston
tekstuureja ja liikuttaa mutaa ja kuplia koodilla (src/bog.ts).

Aja Blenderissä tyhjässä tiedostossa:

    exec(open(r"...\\assets-src\\blender\\bog.py", encoding="utf-8").read())
    result = build_bog()
"""
import bpy, bmesh, math, os, random
from mathutils import Vector, noise

OUT = r"C:\Data\3D Kalevala\assets"
BLEND = r"C:\Data\3D Kalevala\assets-src\bog.blend"

MUD_RINGS = 11      # mudan renkaat keskeltä reunaan
SEGS = 48           # kehän jako (sama mudassa ja reunuksessa, jotta rantaviiva osuu kohdakkain)


def shore(a):
    """Rantaviivan säde suunnassa a: epäsäännöllinen lampare, ei ympyrä."""
    return 1.22 + 0.11 * math.sin(2 * a + 0.6) + 0.07 * math.sin(3 * a + 2.1) + 0.045 * math.sin(5 * a + 4.0)


def lump(x, y, f=1.0, seed=0.0):
    return noise.noise(Vector((x * f + seed, y * f - seed, seed * 0.37)))  # -1..1


def mesh_from(name, verts, faces, cols, uvs, col):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    ca = me.color_attributes.new("Col", 'FLOAT_COLOR', 'POINT')
    for i, c in enumerate(cols):
        ca.data[i].color = (c[0], c[1], c[2], 1.0)
    uv = me.uv_layers.new(name="UVMap")
    for loop in me.loops:
        uv.data[loop.index].uv = uvs[loop.vertex_index]
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    col.objects.link(ob)
    mat = bpy.data.materials.new(name + "_mat")
    me.materials.append(mat)
    return ob


def build_mud(col):
    """Tasainen mutapinta tiheänä verkkona: koodi aaltoiluttaa verteksejä."""
    verts, cols, uvs, faces = [(0, 0, 0)], [(0.045, 0.036, 0.026)], [(0, 0)], []
    for r in range(1, MUD_RINGS + 1):
        t = r / MUD_RINGS
        for s in range(SEGS):
            a = s / SEGS * math.tau
            rad = (shore(a) + 0.07) * t           # ulottuu hieman reunuksen alle
            x, y = math.cos(a) * rad, math.sin(a) * rad
            verts.append((x, y, 0))
            # keskeltä lähes musta, rannassa ruskeaa liejua; laikut rikkovat tasaisuuden
            k = t ** 2.2
            n = 0.5 + 0.5 * lump(x, y, 2.3, 3.0)
            base = (0.045 + 0.10 * k + 0.03 * n, 0.036 + 0.075 * k + 0.025 * n, 0.026 + 0.04 * k + 0.012 * n)
            cols.append(base)
            uvs.append((x, y))
    for s in range(SEGS):
        faces.append((0, 1 + s, 1 + (s + 1) % SEGS))
    for r in range(1, MUD_RINGS):
        a0, b0 = 1 + (r - 1) * SEGS, 1 + r * SEGS
        for s in range(SEGS):
            s1 = (s + 1) % SEGS
            faces.append((a0 + s, b0 + s, b0 + s1, a0 + s1))
    return mesh_from("bog_mud", verts, faces, cols, uvs, col)


def build_rim(col):
    """Turvereunus: märkä tumma ranta, sammalmättäitä, ulkoreuna painuu maan alle."""
    # (etäisyys rantaviivasta, korkeus, mättäisyys 0..1)
    rows = [(-0.14, -0.07, 0.0), (0.03, 0.035, 0.25), (0.2, 0.1, 1.0), (0.36, 0.08, 0.9), (0.52, 0.02, 0.4), (0.7, -0.07, 0.0)]
    verts, cols, uvs, faces = [], [], [], []
    for ri, (d, h, bump) in enumerate(rows):
        for s in range(SEGS):
            a = s / SEGS * math.tau
            # ulkoreuna mutkittelee enemmän kuin ranta
            rad = shore(a) + d * (1 + 0.28 * lump(math.cos(a) * 2, math.sin(a) * 2, 1.0, 9.0) * min(1, max(0, d) * 3))
            x, y = math.cos(a) * rad, math.sin(a) * rad
            m = 0.5 + 0.5 * lump(x, y, 2.6, 5.0)              # mättäät
            m2 = 0.5 + 0.5 * lump(x, y, 6.5, 1.0)
            z = h + bump * (0.075 * m + 0.02 * m2 - 0.03)
            verts.append((x, y, z))
            wet = max(0.0, min(1.0, 1 - (d + 0.05) / 0.3))    # 1 rannassa, 0 mättäällä
            dry = (0.62 + 0.25 * m, 0.78 + 0.2 * m2, 0.5 + 0.2 * m)        # sammal (kertoo tekstuurin)
            wetc = (0.2, 0.17, 0.12)
            # ulkoreuna taittuu tallatun maan ruskeaan, jotta raja ei ole jyrkkä
            out = max(0.0, min(1.0, (d - 0.36) / 0.34))
            earth = (0.6, 0.43, 0.3)
            dry = tuple(dry[i] * (1 - out) + earth[i] * out for i in range(3))
            cols.append(tuple(dry[i] * (1 - wet) + wetc[i] * wet for i in range(3)))
            uvs.append((x * 0.9, y * 0.9))
    for ri in range(len(rows) - 1):
        a0, b0 = ri * SEGS, (ri + 1) * SEGS
        for s in range(SEGS):
            s1 = (s + 1) % SEGS
            faces.append((a0 + s, b0 + s, b0 + s1, a0 + s1))
    ob = mesh_from("bog_rim", verts, faces, cols, uvs, col)
    # pehmennys: yksi jakokierros tekee mättäistä pyöreitä
    mod = ob.modifiers.new("sub", 'SUBSURF')
    mod.levels = 1
    return ob


def build_bubble(col):
    """Mutakupla: puolipallo, jonka koodi kasvattaa ja puhkaisee."""
    seg, rings = 12, 5
    verts, cols, uvs, faces = [], [], [], []
    for r in range(rings):
        el = r / rings * math.pi / 2
        for s in range(seg):
            a = s / seg * math.tau
            verts.append((math.cos(a) * math.cos(el), math.sin(a) * math.cos(el), math.sin(el)))
            cols.append((0.1, 0.08, 0.055))
            uvs.append((math.cos(a) * math.cos(el) * 0.2, math.sin(a) * math.cos(el) * 0.2))
    verts.append((0, 0, 1)); cols.append((0.12, 0.095, 0.065)); uvs.append((0, 0))
    top = len(verts) - 1
    for r in range(rings - 1):
        for s in range(seg):
            s1 = (s + 1) % seg
            faces.append((r * seg + s, r * seg + s1, (r + 1) * seg + s1, (r + 1) * seg + s))
    for s in range(seg):
        faces.append(((rings - 1) * seg + s, (rings - 1) * seg + (s + 1) % seg, top))
    return mesh_from("bog_bubble", verts, faces, cols, uvs, col)


def build_bog(export=True):
    col = bpy.data.collections.get("GAME")
    if not col:
        col = bpy.data.collections.new("GAME")
        bpy.context.scene.collection.children.link(col)
    for o in list(col.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    obs = [build_mud(col), build_rim(col), build_bubble(col)]
    out = {o.name: len(o.data.vertices) for o in obs}
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    if export:
        for o in bpy.context.view_layer.objects:
            o.select_set(False)
        for o in obs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = obs[0]
        path = os.path.join(OUT, "bog.glb")
        bpy.ops.export_scene.gltf(
            filepath=path, export_format='GLB', use_selection=True,
            export_vertex_color='NAME', export_vertex_color_name='Col', export_all_vertex_colors=False,
            export_apply=True, export_animations=False, export_yup=True,
            export_cameras=False, export_lights=False, export_materials='PLACEHOLDER',
        )
        out["glb_kb"] = round(os.path.getsize(path) / 1e3, 1)
    return out
