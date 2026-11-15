"""Rauhallisen pihan omat rakennelmat: sikolätti aitauksineen ja kanakoppi.
Vie tiedoston assets/yard.glb; peli sijoittelee mallit nimen mukaan.

Käyttää homestead.py:n rakentajaa (HB), materiaaleja ja kattoapuja, joten se luetaan
ensin samaan nimiavaruuteen. Aja taustalla:

    blender --background --factory-startup --python assets-src/blender/yard.py

Vientikansion voi vaihtaa ympäristömuuttujalla KALEVALA_ASSETS_OUT (esim. toinen
työpuu). Esikatselukuva: KALEVALA_PREVIEW=<polku ilman päätettä>.

Koordinaatit: Z ylös, etusivu suuntaan -Y, origo pohjan keskellä.
- sikolatti: matala olkikatos takana (+Y), riukuaitaus edessä (sisämitat noin
  2,9 x 2,4 m, keskipiste y = -0,75) ja kaukalo aitauksen etulaidalla. Pelin
  törmäyslaatikko: puolileveys 1,65, y välillä -2,05 .. 1,95.
- kanakoppi: paaluilla seisova lautakoppi, olkikatto, kulkulauta ja orsi.
  Törmäyslaatikko: puolileveys 0,8, puolisyvyys 0,65.
"""
import bpy, bmesh, math, os, random
from mathutils import Vector, Matrix

_HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else r"C:\Data\3D Kalevala\assets-src\blender"
exec(open(os.path.join(_HERE, "homestead.py"), encoding="utf-8").read())

OUT = os.environ.get("KALEVALA_ASSETS_OUT", OUT)
POLE = (0.74, 0.72, 0.7)


def slope_roof(b, x0, x1, y_hi, y_lo, z_hi, z_lo, seed, thick=0.14, nu=8, nv=4):
    """Yksilappeinen olkikatto: korkea reuna y_hi, matala y_lo. Kaksi kerrosta ja reunapinnat."""
    tint = thatch_tint(seed, min(z_hi, z_lo), max(z_hi, z_lo) + 0.3, (0.95, 0.92, 0.85))
    w, d = x1 - x0, abs(y_hi - y_lo)

    def roof(u, v, lift=0.0):
        x = x0 + w * u
        y = y_hi + (y_lo - y_hi) * v
        z = z_hi + (z_lo - z_hi) * v + 0.025 * nz((x * 2.5, y * 2.5, seed), 1.0, 6.0) + lift
        return V((x, y, z))

    for lift, off in ((0.0, 0.0), (thick, 0.3)):
        b.grid(lambda u, v, lift=lift: roof(u, v, lift), nu, nv, "thatch", tint,
               uvfn=lambda u, v, off=off: (u * w / 1.6 + off, v * d / 1.6))
    for (u0, v0, u1, v1) in ((0, 0, 1, 0), (0, 1, 1, 1), (0, 0, 0, 1), (1, 0, 1, 1)):
        for i in range(nu):
            a0, a1 = i / nu, (i + 1) / nu
            pa = roof(u0 + (u1 - u0) * a0, v0 + (v1 - v0) * a0)
            pb = roof(u0 + (u1 - u0) * a1, v0 + (v1 - v0) * a1)
            b.face([pa, pb, pb + V((0, 0, thick)), pa + V((0, 0, thick))], "thatch",
                   lambda p: tuple(x * 0.55 for x in tint(p)), tile=0.6)


def rail_fence(b, a, c, height=0.95, rails=3, gap_post=1.5):
    """Riukuaita pisteestä a pisteeseen c: pystytolpat ja vaakariu'ut."""
    a, c = V(a), V(c)
    n = max(1, round((c - a).length / gap_post))
    for i in range(n + 1):
        p = a.lerp(c, i / n)
        h = height + b.rng.uniform(0.08, 0.2)
        b.pole(p + V((0, 0, -0.25)), p + V((b.rng.uniform(-0.02, 0.02), b.rng.uniform(-0.02, 0.02), h)), 0.045, "bark", 6, POLE, taper=0.7)
    d = (c - a).normalized()
    side = V((-d.y, d.x, 0))
    for j in range(rails):
        z = 0.22 + j * (height - 0.3) / (rails - 1)
        s = 1 if j % 2 == 0 else -1
        k = b.rng.uniform(0.9, 1.05)
        b.pole(a - d * 0.18 + side * 0.05 * s + V((0, 0, z + b.rng.uniform(-0.03, 0.03))),
               c + d * 0.18 + side * 0.05 * s + V((0, 0, z + b.rng.uniform(-0.03, 0.03))),
               0.032, "bark", 5, (0.7 * k, 0.68 * k, 0.66 * k), taper=0.75, vtile=1.0)


def build_sty(col):
    b = HB("sikolatti", 81)
    W = 3.1                     # aitauksen ulkoleveys
    Y0, Y1, Y2 = -2.0, 0.45, 1.85    # aitauksen etulaita, katoksen etureuna, katoksen takaseinä
    HF, HBk = 1.15, 0.7         # katoksen etu- ja takakorkeus
    # katos: neljä paalua, takaseinä ja päädyt punosta, olkikatto
    for (x, y, z) in ((-W / 2, Y1, HF), (W / 2, Y1, HF), (-W / 2, Y2, HBk), (W / 2, Y2, HBk)):
        b.pole(V((x, y, -0.2)), V((x, y, z + 0.05)), 0.07, "bark", 6, POLE, taper=0.85)
    for y, z in ((Y1, HF), (Y2, HBk)):
        b.pole(V((-W / 2 - 0.2, y, z)), V((W / 2 + 0.2, y, z)), 0.05, "bark", 6, POLE, vtile=1.0)
    wt = wall_tint(0, HF, (0.95, 0.93, 0.9))
    b.grid(lambda u, v: V((-W / 2 + W * u, Y2 + 0.02 * math.sin(u * 9), 0.02 + (HBk - 0.05) * v)), 8, 2, "wattle", wt,
           uvfn=lambda u, v: (u * W / 1.6, v * HBk / 1.6))
    for sx in (-1, 1):
        def end(u, v, sx=sx):
            y = Y1 + (Y2 - Y1) * u
            top = HF + (HBk - HF) * u - 0.05
            return V((sx * W / 2 + 0.02 * math.sin(u * 7), y, 0.02 + top * v))
        b.grid(end, 5, 2, "wattle", wt, uvfn=lambda u, v: (u * (Y2 - Y1) / 1.6, v * HF / 1.6))
    slope_roof(b, -W / 2 - 0.3, W / 2 + 0.3, Y1 - 0.4, Y2 + 0.3, HF + 0.24, HBk + 0.0, 21.0)
    # olkikuivike katoksen lattialla
    hay = thatch_tint(5.0, 0, 0.3, (0.9, 0.85, 0.66))
    b.grid(lambda u, v: V((-W / 2 + 0.15 + (W - 0.3) * u, Y1 + 0.1 + (Y2 - Y1 - 0.2) * v,
                           0.03 + 0.05 * nz((u * 6, v * 5, 2.0), 1.0, 3.0))), 8, 4, "thatch", hay,
           uvfn=lambda u, v: (u * 2.2, v * 1.1))
    # aitaus: kolme sivua riukuaitaa, takana katos
    rail_fence(b, (-W / 2, Y1, 0), (-W / 2, Y0, 0))
    rail_fence(b, (-W / 2, Y0, 0), (W / 2, Y0, 0))
    rail_fence(b, (W / 2, Y0, 0), (W / 2, Y1, 0))
    # kaukalo: koverrettu puunrunko etulaidan sisäpuolella
    tx, ty, tl, tr = 0.55, Y0 + 0.42, 1.1, 0.16
    n = 8
    def trough(u, v):
        a = math.pi + math.pi * v                      # alapuoli: puolikaari
        return V((tx - tl / 2 + tl * u, ty + math.cos(a) * tr, 0.19 + math.sin(a) * tr * 0.95))
    b.grid(trough, 4, n, "wood", (0.6, 0.56, 0.5), uvfn=lambda u, v: (v * 0.6, u * tl / 0.8))
    def inner(u, v):
        a = math.pi + math.pi * v
        return V((tx - tl / 2 + 0.05 + (tl - 0.1) * u, ty + math.cos(a) * (tr - 0.04), 0.2 + math.sin(a) * (tr - 0.05) * 0.95))
    b.grid(inner, 4, n, "wood", (0.42, 0.38, 0.33), uvfn=lambda u, v: (v * 0.6 + 0.4, u * tl / 0.8))
    for sx in (-1, 1):
        x = tx + sx * tl / 2
        pts = [V((x, ty + math.cos(math.pi + math.pi * i / n) * tr, 0.19 + math.sin(math.pi + math.pi * i / n) * tr * 0.95)) for i in range(n + 1)]
        b.face(pts if sx > 0 else list(reversed(pts)), "wood", (0.7, 0.65, 0.56), tile=0.4)
    # reunat ja ruokaa pohjalla
    for s in (-1, 1):
        b.box((tx, ty + s * (tr - 0.02), 0.19), (tl, 0.04, 0.02), "wood", (0.66, 0.62, 0.54), tile=0.5, grain=0)
    b.face([V((tx - tl / 2 + 0.07, ty - 0.09, 0.1)), V((tx + tl / 2 - 0.07, ty - 0.09, 0.1)),
            V((tx + tl / 2 - 0.07, ty + 0.09, 0.1)), V((tx - tl / 2 + 0.07, ty + 0.09, 0.1))], "daub", (0.5, 0.42, 0.3), tile=0.4)
    return b.finish(col)


def build_coop(col):
    b = HB("kanakoppi", 82)
    W, D = 1.3, 1.0
    Z0, HF, HBk = 0.55, 0.85, 0.6       # lattian korkeus, seinän korkeus edessä ja takana
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.pole(V((sx * (W / 2 - 0.06), sy * (D / 2 - 0.06), -0.2)), V((sx * (W / 2 - 0.06), sy * (D / 2 - 0.06), Z0 + 0.02)),
                   0.055, "bark", 6, POLE, taper=0.9)
    b.box((0, 0, Z0), (W + 0.06, D + 0.06, 0.05), "wood", (0.66, 0.62, 0.56), tile=0.7, grain=0)
    wood = lambda k: (0.74 * k, 0.7 * k, 0.63 * k)
    # seinät pystylaudoista; etuseinässä kulkuaukko
    nb = 9
    for i in range(nb):
        x = -W / 2 + (i + 0.5) * W / nb
        k = b.rng.uniform(0.82, 1.05)
        if abs(x) < 0.17:                   # oviaukon yläpuoli
            b.box((x, -D / 2, Z0 + 0.36 + (HF - 0.36) / 2 + 0.02), (W / nb - 0.012, 0.03, HF - 0.36), "wood", wood(k), tile=0.6, grain=2)
        else:
            b.box((x, -D / 2, Z0 + HF / 2 + 0.02), (W / nb - 0.012, 0.03, HF), "wood", wood(k), tile=0.6, grain=2)
        b.box((x, D / 2, Z0 + HBk / 2 + 0.02), (W / nb - 0.012, 0.03, HBk), "wood", wood(k * 0.95), tile=0.6, grain=2)
    nd = 7
    for sx in (-1, 1):
        for i in range(nd):
            y = -D / 2 + (i + 0.5) * D / nd
            h = HF + (HBk - HF) * (i + 0.5) / nd
            k = b.rng.uniform(0.82, 1.05)
            b.box((sx * W / 2, y, Z0 + h / 2 + 0.02), (0.03, D / nd - 0.012, h), "wood", wood(k), tile=0.6, grain=2)
    b.face([V((-0.165, -D / 2 + 0.03, Z0 + 0.03)), V((0.165, -D / 2 + 0.03, Z0 + 0.03)),
            V((0.165, -D / 2 + 0.03, Z0 + 0.37)), V((-0.165, -D / 2 + 0.03, Z0 + 0.37))], "dark")
    slope_roof(b, -W / 2 - 0.22, W / 2 + 0.22, -D / 2 - 0.3, D / 2 + 0.22, Z0 + HF + 0.14, Z0 + HBk - 0.02, 31.0, thick=0.12, nu=6, nv=3)
    # kulkulauta poikkipuineen
    a0, a1 = V((0, -D / 2 - 0.02, Z0 + 0.02)), V((0, -D / 2 - 0.95, 0.03))
    d = (a1 - a0).normalized()
    ang = math.atan2(d.z, -d.y)
    R = Matrix.Rotation(-ang, 3, 'X')
    b.box((a0 + a1) / 2, (0.24, (a1 - a0).length, 0.025), "wood", (0.7, 0.66, 0.58), tile=0.6, rot=R, grain=1)
    for i in range(1, 6):
        p = a0.lerp(a1, i / 6) + (R @ V((0, 0, 0.022)))
        b.box(p, (0.24, 0.025, 0.02), "wood", (0.6, 0.56, 0.5), tile=0.4, rot=R, grain=0)
    # orsi kopin kyljessä
    for y in (-0.25, 0.3):
        b.pole(V((W / 2 + 0.5, y, -0.15)), V((W / 2 + 0.5, y, 0.62)), 0.035, "bark", 5, POLE, taper=0.8)
    b.pole(V((W / 2 + 0.5, -0.45, 0.58)), V((W / 2 + 0.5, 0.5, 0.6)), 0.028, "bark", 5, (0.7, 0.68, 0.66), vtile=1.0)
    return b.finish(col)


YARD_BUILDERS = [build_sty, build_coop]


def build_yard(export=True):
    col = bpy.data.collections.get("GAME")
    if not col:
        col = bpy.data.collections.new("GAME")
        bpy.context.scene.collection.children.link(col)
    for o in list(col.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    make_materials()
    obs = [f(col) for f in YARD_BUILDERS]
    bpy.context.view_layer.update()
    out = {o.name: {"tris": sum(len(p.vertices) - 2 for p in o.data.polygons), "dim": [round(d, 2) for d in o.dimensions]} for o in obs}
    if export:
        for o in bpy.context.view_layer.objects:
            o.select_set(False)
        for o in obs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = obs[0]
        path = os.path.join(OUT, "yard.glb")
        bpy.ops.export_scene.gltf(
            filepath=path, export_format='GLB', use_selection=True,
            export_image_format='WEBP', export_image_quality=82,
            export_vertex_color='NAME', export_vertex_color_name='Col', export_all_vertex_colors=False,
            export_apply=True, export_animations=False, export_yup=True,
            export_cameras=False, export_lights=False,
        )
        out["glb_mb"] = round(os.path.getsize(path) / 1e6, 2)
    return out


if __name__ == "__main__":
    import json
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    res = build_yard(export=os.environ.get("KALEVALA_NO_EXPORT") is None)
    pv = os.environ.get("KALEVALA_PREVIEW")
    if pv:
        exec(open(os.path.join(_HERE, "household.py"), encoding="utf-8").read().split("def preview_household")[1].join(["def preview_household", ""]).split('if __name__ == "__main__":')[0])
        obs = {o.name: o for o in bpy.data.collections["GAME"].objects}
        obs["kanakoppi"].location = (4.2, 0, 0)
        preview_household(pv + "_a.png", (0, 0, 0.5), 7.0, 3.0)
        preview_household(pv + "_b.png", (4.2, -0.2, 0.6), 4.0, 1.4)
    print("RESULT_JSON " + json.dumps(res))
