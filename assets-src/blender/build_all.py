"""Koko putki alusta loppuun: oksakorttiatlas -> puut ja varvut -> kivet ja
rakennelmat -> vienti peliin. Aja Blenderissä tiedostossa forest_clearing.blend,
jossa SRC-kokoelman Poly Haven -mallit on tuotu:

    exec(open(r"...\\assets-src\\blender\\build_all.py", encoding="utf-8").read())
"""
import os, io, contextlib, traceback

_B = r"C:\Data\3D Kalevala\assets-src\blender"
for _f in ("cards.py", "sprigs.py", "atlas.py", "trees.py", "props.py", "export.py"):
    exec(open(os.path.join(_B, _f), encoding="utf-8").read())


def run(atlas=True):
    out = {}
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            if atlas:
                build_atlas()
            # edellisen ajon kuvat pois, jotta muuttuneet tekstuurit latautuvat uudelleen
            for n in ("pine_bark_diff", "pine_bark_nor", "spruce_bark_diff", "spruce_bark_nor",
                      "pine_bark_warm_diff", "birch_bark_diff"):
                im = bpy.data.images.get(n)
                if im:
                    bpy.data.images.remove(im)
            out["trees"] = build_all()
            out["props"] = {k: v[0] for k, v in build_props().items()}
            bpy.ops.wm.save_mainfile()
            out["glb"] = export_glb()
            out["ground"] = export_ground()
    except Exception:
        out["err"] = traceback.format_exc()[-1800:]
    return out
