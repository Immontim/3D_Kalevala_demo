"""Vie GAME-kokoelman peliin: assets/forest.glb + maaston tekstuurit."""
import bpy, os

OUT = r"C:\Data\3D Kalevala\assets"
DLX = r"C:\Data\3D Kalevala\assets-src\_downloads"


def export_glb():
    os.makedirs(OUT, exist_ok=True)
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    objs = list(bpy.data.collections["GAME"].objects)
    locs = {}
    for o in objs:
        locs[o.name] = o.location.copy()
        o.location = (0, 0, 0)      # prototyypit origoon; peli sijoittelee instanssit
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    path = os.path.join(OUT, "forest.glb")
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True,
        export_image_format='WEBP', export_image_quality=82,
        export_vertex_color='NAME', export_vertex_color_name='Col', export_all_vertex_colors=False,
        export_apply=True, export_animations=False, export_yup=True,
        export_cameras=False, export_lights=False,
    )
    for o in objs:
        o.location = locs[o.name]
    return {"glb_mb": round(os.path.getsize(path) / 1e6, 2), "objects": len(objs)}


def export_ground(size=1024):
    """Maaston laatoittuvat tekstuurit WebP:nä (väri + normaali)."""
    gdir = os.path.join(OUT, "ground")
    os.makedirs(gdir, exist_ok=True)
    sets = {"needles": "forrest_ground_03", "moss": "forest_leaves_02", "dirt": "forest_ground_04"}
    out = {}
    sc = bpy.context.scene
    for key, tid in sets.items():
        for suffix, m in (("diff", "Diffuse"), ("nor", "nor_gl")):
            src = os.path.join(DLX, "tex_" + tid, "%s_%s_2k.jpg" % (tid, m))
            im = bpy.data.images.load(src)
            im.scale(size, size)
            dst = os.path.join(gdir, "%s_%s.webp" % (key, suffix))
            im.filepath_raw = dst
            im.file_format = 'WEBP'
            im.save(quality=85)
            bpy.data.images.remove(im)
            out[key + "_" + suffix] = round(os.path.getsize(dst) / 1e6, 2)
    return out
