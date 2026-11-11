"""Hahmoputki alusta loppuun. Aja Blenderissä tiedostossa characters.blend,
jonka SRC-kokoelmassa on GEO-body_male_realistic silmineen
(Human Base Meshes -paketista):

    exec(open(r"...\\assets-src\\blender\\char_all.py", encoding="utf-8").read())
    result = run_chars()
"""
import os, io, contextlib, traceback, math

_B = r"C:\Data\3D Kalevala\assets-src\blender"
for _f in ("cards.py", "char_preview.py", "trees.py", "char_rig.py", "char_build.py", "char_export.py"):
    _p = os.path.join(_B, _f)
    if os.path.exists(_p):
        exec(open(_p, encoding="utf-8").read())


def run_chars(base=False, preview_dir=None, export=True):
    out = {}
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            if base or "BODY" not in bpy.data.objects or "RIG" not in bpy.data.objects:
                out["base"] = build_base()["weights"]
            out["tris"] = {k: v["tris"] for k, v in {**build_characters(), **build_equipment()}.items()}
            bpy.context.view_layer.update()
            if preview_dir:
                for n in ("char_hero", "char_urho", "char_pohja"):
                    sheet([n], os.path.join(preview_dir, n + ".png"), yaws=(0, math.pi / 2, math.pi), w=380, h=760)
                sheet(["sword", "spear", "shield_hero", "shield_urho", "shield_pohja"], os.path.join(preview_dir, "equip.png"), yaws=(0, math.pi), w=700, h=560)
            bpy.ops.wm.save_mainfile()
            if export and "export_characters" in globals():
                out["glb"] = export_characters()
    except Exception:
        out["err"] = traceback.format_exc()[-1800:]
    return out
