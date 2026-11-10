"""Esikatselurenderöinti GAME-kokoelman malleista (ei vaikuta vientiin)."""
import bpy, math
from mathutils import Vector


def preview(path, cam_loc, look_at, lens=35, w=1280, h=720, show=("GAME",)):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.film_transparent = False
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.view_settings.view_transform = 'Filmic' if 'Filmic' in [i.identifier for i in type(sc.view_settings).bl_rna.properties['view_transform'].enum_items] else 'AgX'
    sc.world.node_tree.nodes["Background"].inputs[0].default_value = (0.55, 0.68, 0.85, 1)
    sc.world.node_tree.nodes["Background"].inputs[1].default_value = 0.9
    keep = set()
    for cn in show:
        keep |= set(bpy.data.collections[cn].all_objects)
    prev = bpy.data.collections.get("PREVIEW")
    if not prev:
        prev = bpy.data.collections.new("PREVIEW")
        sc.collection.children.link(prev)
        sun = bpy.data.objects.new("PV_Sun", bpy.data.lights.new("PV_Sun", 'SUN'))
        sun.data.energy = 4.0
        sun.data.color = (1.0, 0.9, 0.75)
        sun.rotation_euler = (math.radians(58), 0, math.radians(-40))
        prev.objects.link(sun)
        me = bpy.data.meshes.new("PV_Ground")
        me.from_pydata([(-200, -200, 0), (200, -200, 0), (200, 200, 0), (-200, 200, 0)], [], [(0, 1, 2, 3)])
        g = bpy.data.objects.new("PV_Ground", me)
        m = bpy.data.materials.new("PV_GroundMat")
        m.use_nodes = True
        m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.12, 0.13, 0.06, 1)
        me.materials.append(m)
        prev.objects.link(g)
        cam = bpy.data.objects.new("PV_Cam", bpy.data.cameras.new("PV_Cam"))
        prev.objects.link(cam)
    keep |= set(prev.all_objects)
    hidden = {}
    for o in bpy.data.objects:
        hidden[o.name] = o.hide_render
        o.hide_render = o not in keep
    cam = bpy.data.objects["PV_Cam"]
    cam.data.lens = lens
    cam.data.clip_end = 500
    cam.location = cam_loc
    d = Vector(look_at) - Vector(cam_loc)
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    for o in bpy.data.objects:
        if o.name in hidden:
            o.hide_render = hidden[o.name]
    return path
