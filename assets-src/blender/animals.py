"""Pihan eläimet rauhalliseen kohtaukseen: koira, kana, possu sekä liikkumaton
kukko ja toinen kana. Lähteet ovat Sketchfabin CC-BY-malleja (assets/CREDITS.md),
jotka omistaja lataa glTF-muodossa kansioon assets-src/_downloads/animals/<nimi>/.

Skripti keventää mallit, pienentää ja sävyttää tekstuurit, asettaa eläimen
luonnolliseen kokoon (origo jalkojen välissä maassa, nokka suuntaan -Y) ja vie
jokaisen omaksi tiedostokseen kansioon assets/animals/. Eläimet ovat omissa
tiedostoissaan, koska lähdemallien luiden nimet menevät päällekkäin. Aja taustalla:

    blender --background --factory-startup --python assets-src/blender/animals.py

Ympäristömuuttujat: KALEVALA_DOWNLOADS (latauskansio, jos se on toisessa
työpuussa), KALEVALA_ASSETS_OUT (vientikansio), KALEVALA_PREVIEW (kansio
tarkistuskuville), KALEVALA_ONLY (pilkuin erotetut nimet, esim. "koira,possu").

Toisin kuin ihmishahmoilla, eläimillä on mukana lähdemallin animaatioleikkeet:
koira `seisoo`, `istuu`, `tassu` (antaa tassua); kana `olo`; possu `kavely`.
"""
import bpy, math, os
import numpy as np
from mathutils import Matrix, Vector

_HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else r"C:\Data\3D Kalevala\assets-src\blender"
ROOT = os.path.dirname(os.path.dirname(_HERE))
SRC = os.environ.get("KALEVALA_DOWNLOADS", os.path.join(ROOT, "assets-src", "_downloads"))
SRC = os.path.join(SRC, "animals")
OUT = os.path.join(os.environ.get("KALEVALA_ASSETS_OUT", os.path.join(ROOT, "assets")), "animals")
PREVIEW = os.environ.get("KALEVALA_PREVIEW")
ONLY = [s for s in os.environ.get("KALEVALA_ONLY", "").split(",") if s]

# height = korkeus metreinä valitussa asennossa, yaw = kierto (astetta), jolla nokka
# kääntyy suuntaan -Y, tris = kolmiotavoite, tex = tekstuurin sivu, tint = sävytys,
# clips = lähdeleikkeen nimen osa -> pelin leikkeen nimi (ensimmäinen on mitta-asento).
ANIMALS = {
    "koira": dict(dir="animated_dog_shiba_inu", height=0.56, yaw=0, tris=8000, tex=1024,
                  tint=dict(sat=0.9, mul=(0.92, 0.88, 0.84)),
                  clips=[("standing", "seisoo"), ("sitting", "istuu"), ("shake", "tassu")]),
    "kana": dict(dir="halva_the_chicken", height=0.37, yaw=180, tris=0, tex=1024,
                 tint=dict(sat=0.85, mul=(0.9, 0.88, 0.85)),
                 clips=[("Chicken_Animation", "olo")]),
    "possu": dict(dir="piglet", height=0.50, yaw=180, tris=7000, tex=1024,
                  tint=dict(sat=0.45, mul=(0.40, 0.32, 0.27)),
                  clips=[("PigletWalk", "kavely")]),
}
STATIC = dict(dir="handpainted_rooster_and_hen", file="kukko_kana", tex=1024,
              tint=dict(sat=0.7, mul=(0.82, 0.8, 0.78)), rooster_h=0.50, yaw=0)


def clean_import(d):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, d, "scene.gltf"))
    arm = next((o for o in bpy.data.objects if o.type == "ARMATURE"), None)
    meshes = [o for o in bpy.data.objects if o.type == "MESH" and o.data.materials]
    keep = set(meshes) | ({arm} if arm else set())
    tops = [arm] if arm else meshes
    mats = {o: o.matrix_world.copy() for o in tops}
    for o in tops:
        o.parent = None
        o.matrix_world = mats[o]
    for o in list(bpy.data.objects):
        if o not in keep:
            bpy.data.objects.remove(o, do_unlink=True)
    return arm, meshes


def simple_material(me, tex, tint):
    """Yksi Principled-materiaali, jossa on vain pienennetty ja sävytetty värikartta."""
    old = me.materials[0]
    img = None
    for n in old.node_tree.nodes:
        if n.type == "TEX_IMAGE" and n.image and ("basecolor" in n.image.name.lower() or "diffuse" in n.image.name.lower()):
            img = n.image
    assert img, "värikartta puuttuu: " + old.name
    if img.size[0] > tex:
        img.scale(tex, tex)
    px = np.array(img.pixels[:], dtype=np.float32).reshape(-1, 4)
    drop_transparent(me, px[:, 3].reshape(img.size[1], img.size[0]))
    lum = px[:, :3] @ np.array([0.3, 0.59, 0.11], dtype=np.float32)
    rgb = lum[:, None] + (px[:, :3] - lum[:, None]) * tint["sat"]
    px[:, :3] = np.clip(rgb * np.array(tint["mul"], dtype=np.float32), 0, 1)
    px[:, 3] = 1.0
    img.pixels.foreach_set(px.ravel())
    img.pack()
    m = bpy.data.materials.new("M_AN_" + me.name)
    m.use_nodes = True
    nt = m.node_tree
    bs = nt.nodes["Principled BSDF"]
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = img
    nt.links.new(t.outputs["Color"], bs.inputs["Base Color"])
    bs.inputs["Roughness"].default_value = 0.9
    bs.inputs["Metallic"].default_value = 0.0
    me.materials.clear()
    me.materials.append(m)
    for im in list(bpy.data.images):
        if im is not img and im.users == 0:
            bpy.data.images.remove(im)
    return m


def drop_transparent(me, alpha):
    """Poista pinnat, jotka lähdemallissa ovat tekstuurin läpinäkyvällä alueella, jotta
    peli ei tarvitse läpinäkyvää materiaalia."""
    if alpha.min() > 0.5:
        return 0
    import bmesh
    h, w = alpha.shape
    bm = bmesh.new(); bm.from_mesh(me)
    uv = bm.loops.layers.uv.active
    kill = []
    for f in bm.faces:
        u = sum(l[uv].uv.x for l in f.loops) / len(f.loops)
        v = sum(l[uv].uv.y for l in f.loops) / len(f.loops)
        if alpha[int((v % 1.0) * (h - 1)), int((u % 1.0) * (w - 1))] < 0.5:
            kill.append(f)
    n = len(kill)
    bmesh.ops.delete(bm, geom=kill, context="FACES")
    bm.to_mesh(me); bm.free()
    print("TRANSPARENT", me.name, n)
    return n


def decimate(ob, tris):
    ob.data.calc_loop_triangles()
    n = len(ob.data.loop_triangles)
    if not tris or n <= tris:
        return n
    md = ob.modifiers.new("dec", "DECIMATE")
    md.ratio = tris / n
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    while ob.modifiers[0] != md:
        bpy.ops.object.modifier_move_up(modifier=md.name)
    bpy.ops.object.modifier_apply(modifier=md.name)
    ob.data.calc_loop_triangles()
    return len(ob.data.loop_triangles)


def drop_stretched(ob, limit=4.0):
    """Poista pinnat, joiden reuna venyy asennossa moninkertaiseksi (lähdemallin painovirheet)."""
    dg = bpy.context.evaluated_depsgraph_get()
    e = ob.evaluated_get(dg)
    me2 = e.to_mesh()
    n = len(ob.data.vertices)
    a = np.empty(n * 3, dtype=np.float32); b = np.empty(n * 3, dtype=np.float32)
    ob.data.vertices.foreach_get("co", a); me2.vertices.foreach_get("co", b)
    e.to_mesh_clear()
    a = a.reshape(-1, 3); b = b.reshape(-1, 3)
    ed = np.empty(len(ob.data.edges) * 2, dtype=np.int32)
    ob.data.edges.foreach_get("vertices", ed)
    ed = ed.reshape(-1, 2)
    la = np.linalg.norm(a[ed[:, 0]] - a[ed[:, 1]], axis=1)
    lb = np.linalg.norm(b[ed[:, 0]] - b[ed[:, 1]], axis=1)
    ratio = lb / np.maximum(la, 1e-9)
    bad = np.nonzero(ratio > limit * np.median(ratio))[0]
    if not len(bad):
        return 0
    import bmesh
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bm.edges.ensure_lookup_table()
    faces = set()
    for k in bad:
        faces.update(bm.edges[int(k)].link_faces)
    if len(faces) > 0.05 * len(bm.faces):
        bm.free()
        raise RuntimeError("venyviä pintoja on liikaa: %d" % len(faces))
    bmesh.ops.delete(bm, geom=list(faces), context="FACES")
    bm.to_mesh(ob.data); bm.free()
    return len(faces)


def world_bounds(obs):
    dg = bpy.context.evaluated_depsgraph_get()
    pts = []
    for o in obs:
        e = o.evaluated_get(dg)
        me = e.to_mesh()
        co = np.empty(len(me.vertices) * 3, dtype=np.float32)
        me.vertices.foreach_get("co", co)
        co = co.reshape(-1, 3)
        mw = np.array(e.matrix_world)
        pts.append(co @ mw[:3, :3].T + mw[:3, 3])
        e.to_mesh_clear()
    p = np.concatenate(pts)
    return p.min(0), p.max(0)


def place(top, obs, height, yaw):
    """Kierrä, skaalaa korkeuteen ja siirrä: origo pohjan keskelle maahan."""
    top.matrix_world = Matrix.Rotation(math.radians(yaw), 4, "Z") @ top.matrix_world
    bpy.context.view_layer.update()
    lo, hi = world_bounds(obs)
    s = height / (hi[2] - lo[2])
    top.matrix_world = Matrix.Scale(s, 4) @ top.matrix_world
    bpy.context.view_layer.update()
    lo, hi = world_bounds(obs)
    c = Vector(((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, lo[2]))
    top.matrix_world = Matrix.Translation(-c) @ top.matrix_world
    bpy.context.view_layer.update()
    lo, hi = world_bounds(obs)
    return [round(float(x), 3) for x in (hi - lo)]


def set_action(arm, act):
    arm.animation_data_create()
    arm.animation_data.action = act
    try:
        if act and act.slots:
            arm.animation_data.action_slot = act.slots[0]
    except Exception:
        pass


def action_fcurves(act):
    try:
        return [fc for layer in act.layers for strip in layer.strips
                for cb in strip.channelbags for fc in cb.fcurves]
    except AttributeError:
        return list(act.fcurves)


def key_static_channels(arm, actions):
    """Lähdemallin leikkeet avaimistavat vain osan luiden kanavista; loput saavat arvonsa
    mallin oletusasennosta, joka ei säily viennissä (viikset ja varpaat siirtyisivät).
    Kirjoita puuttuvat kanavat vakioavaimina jokaiseen leikkeeseen."""
    n = 0
    for act in actions:
        set_action(arm, act)
        have = set(fc.data_path for fc in action_fcurves(act))
        f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])
        for pb in arm.pose.bones:
            for prop in ("location", "rotation_quaternion", "scale"):
                path = 'pose.bones["%s"].%s' % (pb.name, prop)
                if path in have:
                    continue
                for f in (f0, f1):
                    pb.keyframe_insert(prop, frame=f)
                n += 1
    return n


def export(path, obs, anim):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in obs:
        o.select_set(True)
    kw = dict(filepath=path, export_format="GLB", use_selection=True,
              export_image_format="WEBP", export_image_quality=82,
              export_apply=False, export_yup=True, export_cameras=False, export_lights=False,
              export_animations=anim)
    if anim:
        kw.update(export_animation_mode="ACTIONS", export_force_sampling=True,
                  export_optimize_animation_size=True, export_anim_single_armature=True,
                  export_skins=True, export_def_bones=False)
    bpy.ops.export_scene.gltf(**kw)
    return round(os.path.getsize(path) / 1e6, 2)


def preview(path, size, frame=None):
    sc = bpy.context.scene
    if frame is not None:
        sc.frame_set(frame)
    sun = bpy.data.objects.new("pv_sun", bpy.data.lights.new("pv_sun", "SUN"))
    sun.data.energy = 3.5
    sun.rotation_euler = (math.radians(50), 0, math.radians(-35))
    sc.collection.objects.link(sun)
    w = bpy.data.worlds.new("pv_w")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.55, 0.6, 0.65, 1)
    sc.world = w
    cam = bpy.data.objects.new("pv_cam", bpy.data.cameras.new("pv_cam"))
    sc.collection.objects.link(cam)
    d = max(size) * 2.6
    cam.location = (d * 0.75, -d * 0.75, size[2] * 0.9)
    tgt = Vector((0, 0, size[2] * 0.45))
    cam.rotation_euler = (tgt - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.camera = cam
    pl = bpy.data.meshes.new("pv_g")
    pl.from_pydata([(-3, -3, 0), (3, -3, 0), (3, 3, 0), (-3, 3, 0)], [], [(0, 1, 2, 3)])
    g = bpy.data.objects.new("pv_g", pl)
    sc.collection.objects.link(g)
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.resolution_x, sc.render.resolution_y = 900, 700
    sc.render.filepath = path
    sc.view_settings.view_transform = "Standard"
    bpy.ops.render.render(write_still=True)
    for o in (sun, cam, g):
        bpy.data.objects.remove(o, do_unlink=True)


def build_animal(name, cfg):
    arm, meshes = clean_import(cfg["dir"])
    ob = meshes[0]
    simple_material(ob.data, cfg["tex"], cfg["tint"])
    keep = []
    for part, new in cfg["clips"]:
        a = next(a for a in bpy.data.actions if part in a.name)
        a.name = new
        keep.append(a)
    static = key_static_channels(arm, keep)
    set_action(arm, keep[0])
    for a in list(bpy.data.actions):
        if a not in keep:
            bpy.data.actions.remove(a)
    bpy.context.scene.frame_set(int(keep[0].frame_range[0]))
    dropped = drop_stretched(ob)
    tris = decimate(ob, cfg["tris"])
    size = place(arm, [ob], cfg["height"], cfg["yaw"])
    arm.name = name
    ob.name = name + "_malli"
    ob.data.name = name
    mb = export(os.path.join(OUT, name + ".glb"), [arm, ob], True)
    if PREVIEW:
        preview(os.path.join(PREVIEW, name + ".png"), size)
    return dict(tris=tris, dropped=dropped, static=static, size=size, mb=mb, bones=len(arm.data.bones),
                clips={a.name: int(a.frame_range[1] - a.frame_range[0]) for a in keep})


def build_static(cfg):
    arm, meshes = clean_import(cfg["dir"])
    ob = meshes[0]
    simple_material(ob.data, cfg["tex"], cfg["tint"])
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.mesh.separate(type="LOOSE")
    parts = [o for o in bpy.data.objects if o.type == "MESH"]
    xs = {o: sum((v.co.x for v in o.data.vertices)) / len(o.data.vertices) for o in parts}
    lo, hi = world_bounds(parts)
    # kukko on kahdesta linnusta korkeampi: jaa osat sen puolen mukaan
    tall = max(parts, key=lambda o: max(v.co.z for v in o.data.vertices))
    mid = (lo[0] + hi[0]) / 2
    side = xs[tall] > mid
    out = {}
    groups = {"kukko": [o for o in parts if (xs[o] > mid) == side],
              "kana_b": [o for o in parts if (xs[o] > mid) != side]}
    for nm, grp in groups.items():
        bpy.ops.object.select_all(action="DESELECT")
        for o in grp:
            o.select_set(True)
        bpy.context.view_layer.objects.active = grp[0]
        if len(grp) > 1:
            bpy.ops.object.join()
        o = bpy.context.view_layer.objects.active
        o.name = nm
        o.data.name = nm
        out[nm] = o
    lo, hi = world_bounds([out["kukko"]])
    s = cfg["rooster_h"] / (hi[2] - lo[2])
    res = {}
    for nm, o in out.items():
        l2, h2 = world_bounds([o])
        size = place(o, [o], (h2[2] - l2[2]) * s, cfg["yaw"])
        bpy.ops.object.select_all(action="DESELECT")
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        o.data.calc_loop_triangles()
        res[nm] = dict(tris=len(o.data.loop_triangles), size=size)
    out["kana_b"].location.x = 0.45
    if PREVIEW:
        preview(os.path.join(PREVIEW, cfg["file"] + ".png"), [0.9, 0.5, cfg["rooster_h"]])
    out["kana_b"].location.x = 0
    res["mb"] = export(os.path.join(OUT, cfg["file"] + ".glb"), list(out.values()), False)
    return res


def run_animals():
    rep = {}
    for name, cfg in ANIMALS.items():
        if not ONLY or name in ONLY:
            rep[name] = build_animal(name, cfg)
    if not ONLY or STATIC["file"] in ONLY:
        rep[STATIC["file"]] = build_static(STATIC)
    return rep


if __name__ == "__main__":
    for k, v in run_animals().items():
        print("ANIMAL", k, v)
