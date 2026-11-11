"""Hahmojen tarkistuskuvat: sama kohde usealta suunnalta yhdeksi kuvaksi.
Edellyttää cards.py:n (render_card, load_px, save_px) samassa nimiavaruudessa.
"""
import bpy, math, os
import numpy as np


def _sun():
    sun = bpy.data.objects.get("TMP_Sun")
    if not sun:
        sun = bpy.data.objects.new("TMP_Sun", bpy.data.lights.new("TMP_Sun", 'SUN'))
        bpy.context.scene.collection.objects.link(sun)
    sun.data.energy = 3.0
    sun.rotation_euler = (math.radians(55), 0, math.radians(35))
    sun.hide_render = False
    return sun


def sheet(obj_names, out_path, yaws=(0, math.pi / 2, math.pi, -math.pi / 2), w=360, h=720, bg=(0.55, 0.57, 0.6)):
    """Renderöi objektit ortokuvina annetuista suunnista ja liittää ne vierekkäin."""
    global CARDS
    sun = _sun()
    tmpdir = os.path.dirname(out_path)
    old = CARDS
    CARDS = tmpdir
    tiles = []
    try:
        for i, yaw in enumerate(yaws):
            sun.rotation_euler = (math.radians(55), 0, yaw + math.radians(35))
            keep = sun.hide_render
            r = render_card(list(obj_names), "_tile%d" % i, "side", w, h, yaw=yaw, extra_visible=[sun.name])
            px = load_px(r["path"])
            os.remove(r["path"])
            a = px[..., 3:4]
            rgb = px[..., :3] * a + np.array(bg, dtype=np.float32) * (1 - a)
            tiles.append(np.concatenate([rgb, np.ones_like(a)], axis=-1))
    finally:
        CARDS = old
    img = np.concatenate(tiles, axis=1)
    old_img = bpy.data.images.get("_sheet")
    if old_img:
        bpy.data.images.remove(old_img)
    save_px(img, out_path, "_sheet")
    return out_path
