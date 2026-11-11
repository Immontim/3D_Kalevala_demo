"""Vie hahmot ja varusteet peliin: assets/characters.glb."""
import bpy, os


def export_characters():
    out = r"C:\Data\3D Kalevala\assets"
    os.makedirs(out, exist_ok=True)
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    objs = list(bpy.data.collections["GAME"].objects)
    for o in objs:
        o.hide_set(False)
        o.select_set(True)
    bpy.context.view_layer.objects.active = bpy.data.objects["RIG"]
    path = os.path.join(out, "characters.glb")
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True,
        export_image_format='WEBP', export_image_quality=85,
        export_vertex_color='NAME', export_vertex_color_name='Col', export_all_vertex_colors=False,
        export_apply=False, export_skins=True, export_animations=False, export_yup=True,
        export_cameras=False, export_lights=False,
    )
    return {"glb_mb": round(os.path.getsize(path) / 1e6, 2), "objects": len(objs)}
