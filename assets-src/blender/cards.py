"""Oksakorttien renderöinti: korkearesoluutioisesta kasvista tehdään
läpinäkyvä kuva (albedo + alpha), jota pelipuut käyttävät oksatasoina.

Ajetaan Blenderissä:  exec(open(path).read()); render_card(...)
"""
import bpy, os, math
import numpy as np
from mathutils import Vector

ROOT = r"C:\Data\3D Kalevala\assets-src"
CARDS = os.path.join(ROOT, "cards")
os.makedirs(CARDS, exist_ok=True)


def _setup_scene(w, h):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.film_transparent = True
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    if sc.world is None:
        sc.world = bpy.data.worlds.new("CardWorld")
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes.get("Background")
    bg.inputs[0].default_value = (1, 1, 1, 1)
    bg.inputs[1].default_value = 1.0
    return sc


def render_card(obj_names, name, view="side", w=1024, h=1024, margin=0.03, yaw=0.0, extra_visible=()):
    """Renderöi objektit ortokameralla. view: 'side' (katsotaan -Y suuntaan,
    kuvan alareuna = objektin tyvi) tai 'top'."""
    sc = _setup_scene(w, h)
    targets = [bpy.data.objects[n] for n in obj_names]
    hidden = {}
    for o in bpy.data.objects:
        hidden[o.name] = o.hide_render
        o.hide_render = o not in targets and o.name not in extra_visible
    pts = [o.matrix_world @ Vector(c) for o in targets for c in o.bound_box]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    ctr = (mn + mx) / 2
    size = mx - mn
    cam_data = bpy.data.cameras.new("CardCam")
    cam_data.type = 'ORTHO'
    cam = bpy.data.objects.new("CardCam", cam_data)
    sc.collection.objects.link(cam)
    aspect = w / h
    if view == "side":
        r = max(size.x, size.y)
        cw, ch = r, size.z
        d = Vector((math.sin(yaw), -math.cos(yaw), 0))
        cam.location = ctr + d * (r + 5)
        cam.rotation_euler = (math.pi / 2, 0, yaw)
    else:
        cw, ch = size.x, size.y
        cam.location = ctr + Vector((0, 0, size.z + 5))
        cam.rotation_euler = (0, 0, 0)
    cw *= 1 + margin * 2
    ch *= 1 + margin * 2
    # ortho_scale on leveämmän sivun mitta
    if cw / ch > aspect:
        scale_w = cw
    else:
        scale_w = ch * aspect
    cam_data.ortho_scale = scale_w if aspect >= 1 else scale_w / aspect
    cam_data.clip_end = 100
    sc.camera = cam
    path = os.path.join(CARDS, name + ".png")
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam, do_unlink=True)
    for o in bpy.data.objects:
        if o.name in hidden:
            o.hide_render = hidden[o.name]
    world_w = scale_w
    return {"path": path, "world_w": round(world_w, 4), "world_h": round(world_w / aspect, 4)}


def dilate_rgba(px, iters=24, cut=0.02):
    """Levittää reunavärit läpinäkyviin pikseleihin, ettei mipmap tummenna reunoja."""
    rgb = px[..., :3].copy()
    a = px[..., 3]
    known = a > cut
    rgb[~known] = 0
    for _ in range(iters):
        acc = np.zeros_like(rgb)
        cnt = np.zeros(a.shape, dtype=np.float32)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            k = np.roll(known, (dy, dx), axis=(0, 1))
            acc += np.roll(rgb, (dy, dx), axis=(0, 1)) * k[..., None]
            cnt += k
        new = (~known) & (cnt > 0)
        rgb[new] = acc[new] / cnt[new][..., None]
        known = known | new
    # loput: keskiväri
    if known.any():
        rgb[~known] = rgb[known].mean(axis=0)
    out = px.copy()
    out[..., :3] = rgb
    return out


def load_px(path):
    img = bpy.data.images.load(path, check_existing=False)
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    return px.reshape(h, w, 4)


def save_px(px, path, name):
    h, w = px.shape[:2]
    img = bpy.data.images.get(name) or bpy.data.images.new(name, w, h, alpha=True)
    if tuple(img.size) != (w, h):
        img.scale(w, h)
    img.alpha_mode = 'STRAIGHT'
    img.pixels.foreach_set(px.astype(np.float32).ravel())
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    return img
