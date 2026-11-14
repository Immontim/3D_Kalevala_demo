"""Rauhallisen kohtauksen hahmot (ei taistelijoita). Ensimmäisenä Kalevalan tietäjä.

Käyttää samaa vartaloa (BODY), luurankoa (RIG) ja osafunktioita kuin taistelijat
(char_rig.py, char_build.py), joten peli voi animoida hahmot samalla koodilla.
Aja Blenderissä tiedostossa characters.blend (SRC-kokoelmassa Human Base Meshes
-vartalo, BODY ja RIG rakennettuna):

    exec(open(r"...\\assets-src\\blender\\char_folk.py", encoding="utf-8").read())
    result = run_folk(preview_dir=r"...", out_dir=r"...\\assets")

Tulos: kokoelma FOLK (char_tietaja, sauva) ja tiedosto assets/villagers.glb, jossa
on myös luuranko RIG. Punostekstuuri (hh_weave_*) syntyy household.py:n ajosta.
"""
import os, io, contextlib, traceback, math, random

_FB = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else r"C:\Data\3D Kalevala\assets-src\blender"
for _f in ("cards.py", "char_preview.py", "trees.py", "char_rig.py", "char_build.py"):
    exec(open(os.path.join(_FB, _f), encoding="utf-8").read())

_CM_NAMES = {"skin": "C_Skin", "hair": "C_Hair", "plain": "C_Plain", "metal": "C_Metal", "mail": "C_Mail", "linen": "C_Linen",
             "hessian": "C_Hessian", "wool": "C_Wool", "jersey": "C_Jersey", "leather": "C_Leather", "wood": "C_Wood",
             "trim_diamond": "C_Trim_diamond", "trim_zigzag": "C_Trim_zigzag", "trim_tri": "C_Trim_tri"}


def folk_materials():
    """Taistelijoiden materiaalit sellaisinaan (ei luoda uudelleen, jos ne ovat jo tiedostossa) ja tuohipunos."""
    global CM
    if all(bpy.data.materials.get(n) for n in _CM_NAMES.values()):
        CM = {k: bpy.data.materials[n] for k, n in _CM_NAMES.items()}
    else:
        CM = make_char_materials()
    d = load_img(os.path.join(TEXDIR, "hh_weave_diff.png"), "f_weave_diff")
    n = load_img(os.path.join(TEXDIR, "hh_weave_nor.png"), "f_weave_nor", colorspace="Non-Color")
    CM["weave"] = pbr("F_Weave", d, n, rough=0.75, twosided=True)
    return CM


def _zw(z):
    """Riippuvan vaatteen painot korkeuden mukaan: ei seuraa käsiä."""
    if z > 1.30:
        return {"chest": 1.0}
    if z > 1.05:
        t = (1.30 - z) / 0.25
        return {"chest": 1 - t, "spine": t}
    t = min(1.0, (1.05 - z) / 0.3)
    return {"spine": 1 - 0.5 * t, "hips": 0.5 * t}


# ---------- tietäjän osat ----------
def mantle_parts(C, col=(0.6, 0.57, 0.55), edge=(0.15, 0.012, 0.008), z_hem=0.6):
    """Viitta: harmaa villakangas molemmilla olkapäillä, kiinni soljella oikealla rinnalla ja
    auki oikealta, jolloin oikea käsi jää vapaaksi. Vasen käsi jää viitan alle."""
    prof = [(1.475, 0.085, 0.085), (1.468, 0.15, 0.115), (1.445, 0.215, 0.14), (1.37, 0.262, 0.155), (1.28, 0.285, 0.175), (1.15, 0.31, 0.195),
            (0.95, 0.34, 0.22), (0.75, 0.365, 0.245), (z_hem, 0.38, 0.26)]
    n = 40
    a_open = math.radians(-58)                 # aukon keskikohta: 0 = edessä (-Y), negatiivinen = hahmon oikea (-X)
    ctr = V((0, 0.02, 0))
    keep = lambda i, c: C.arm_frac[i] < 0.3
    p = Part()
    rings = []
    rng = random.Random(11)
    fold = [rng.uniform(0.6, 1.0) for _ in range(n + 1)]
    for j, (z, rx, ry) in enumerate(prof):
        rad, e1, e2 = ring_profile(C, V((0, 0.02, min(z, 1.40))), V((0, 0, 1)), V((0, -1, 0)), 24, slab=0.03, keep=keep)
        s = j / (len(prof) - 1)
        gap = math.radians(60) * smoothstep(1.43, 1.24, z) + math.radians(8) * s
        ring = []
        for k in range(n + 1):
            a = a_open + gap + (2 * math.pi - 2 * gap) * k / n
            re = 1.0 / math.sqrt((math.cos(a) / ry) ** 2 + (math.sin(a) / rx) ** 2)
            kb = int(((a % (2 * math.pi)) / (2 * math.pi)) * 24) % 24
            body = rad[kb] + 0.05 if z > 0.95 else 0.0
            r = max(re, body) * (1 + 0.045 * math.sin(a * 9 + 1.0) * s * fold[k])
            pt = ctr + (e1 * math.cos(a) + e2 * math.sin(a)) * r + V((0, 0, z + 0.012 * math.sin(a * 5) * s))
            ring.append(p.v(pt, _zw(z)))
        rings.append(ring)
    for j in range(len(prof) - 1):
        last = j == len(prof) - 2
        for k in range(n):
            is_edge = k in (0, n - 1)
            c = edge if is_edge else tuple(x * (0.85 + 0.15 * fold[k]) for x in col)
            u0, u1 = k / n * 9, (k + 1) / n * 9
            v0, v1 = prof[j][0] / 0.2, prof[j + 1][0] / 0.2
            p.f([rings[j][k], rings[j][k + 1], rings[j + 1][k + 1], rings[j + 1][k]], "plain" if is_edge else "wool", [(u0, v0), (u1, v0), (u1, v1), (u0, v1)], c)
    # helmanauha
    hem = []
    for k in range(n + 1):
        c = p.co[rings[-1][k]]
        hem.append(p.v(V((c.x * 1.01, (c.y - 0.02) * 1.01 + 0.02, c.z - 0.04)), _zw(z_hem)))
    for k in range(n):
        u0, u1 = k / n * 10, (k + 1) / n * 10
        p.f([rings[-1][k], rings[-1][k + 1], hem[k + 1], hem[k]], "trim_diamond", [(u0, 1), (u1, 1), (u1, 0), (u0, 0)])
    parts = [p]
    # kaulus: kangas rypyssä kaulan ympärillä
    cowl = [V((math.sin(i / 14 * 2 * math.pi) * 0.105, 0.012 - math.cos(i / 14 * 2 * math.pi) * 0.10, 1.47 + 0.012 * math.cos(i / 14 * 2 * math.pi))) for i in range(15)]
    parts.append(tube_part(cowl, [0.032] * 15, 7, "wool", {"chest": 0.8, "neck": 0.2}, tuple(x * 0.9 for x in col), tile=0.2, cap=False))
    # rengassolki aukon yläpäässä
    b0 = p.co[rings[3][0]].lerp(p.co[rings[3][n]], 0.5)
    out = V((b0.x, b0.y - 0.02, 0)).normalized()
    side = V((0, 0, 1)).cross(out)
    ring_pts = [b0 + out * 0.012 + (side * math.cos(i / 10 * 2 * math.pi) + V((0, 0, 1)) * math.sin(i / 10 * 2 * math.pi)) * 0.024 for i in range(11)]
    parts.append(tube_part(ring_pts, [0.005] * 11, 5, "metal", {"chest": 1.0}, (0.62, 0.42, 0.14), cap=False))
    parts.append(tube_part([b0 + out * 0.014 - side * 0.03, b0 + out * 0.014 + side * 0.03], [0.003, 0.003], 4, "metal", {"chest": 1.0}, (0.62, 0.42, 0.14)))
    return parts


def long_beard(C, color, z_top=1.478, z_bot=1.21):
    """Pitkä parta leuasta rinnalle: puoliputki, joka kapenee kärkeen."""
    rng = random.Random(7)
    p = Part()
    cols, rows = 8, 7
    grid = []
    shade = [rng.uniform(0.62, 1.0) for _ in range(cols + 1)]
    tip = [rng.uniform(0.0, 0.05) for _ in range(cols + 1)]
    for j in range(rows + 1):
        s = j / rows
        z = z_top + (z_bot - z_top) * s
        w = 0.05 * (1 - 0.85 * s ** 1.4) + 0.004
        depth = 0.04 * (1 - 0.7 * s)
        y = -0.105 - 0.085 * math.sin(min(1.0, s * 2.2) * math.pi / 2)
        row = []
        for k in range(cols + 1):
            th = math.radians(-88 + 176 * k / cols)
            wav = 0.004 * math.sin(k * 2.3 + j * 1.1)
            pt = V((math.sin(th) * w, y - math.cos(th) * depth + wav, z - 0.012 * abs(math.sin(th)) * (1 - s) + tip[k] * s * s))
            row.append(p.v(pt, {"head": 1.0} if s < 0.2 else {"head": 0.55, "chest": 0.45}))
        grid.append(row)
    for j in range(rows):
        for k in range(cols):
            sh = (shade[k] + shade[k + 1]) / 2 * (1 - 0.12 * j / rows)
            p.f([grid[j][k], grid[j][k + 1], grid[j + 1][k + 1], grid[j + 1][k]], "hair", None, tuple(x * sh for x in color))
    return [p]


def woven_belt(C, z=1.0, off=0.036):
    """Kudottu punainen vyö, jonka kaksi tupsupäätä riippuvat edessä vasemmalla, ja puukko tupessa."""
    keep = lambda i, c: abs(c.x) < 0.2 and C.arm_frac[i] < 0.3
    parts = [band(C, V((0, 0.02, z)), V((0, 0, 1)), V((0, -1, 0)), 0.05, off, "trim_diamond", keep=keep, vspan=(0, 1), tile=0.2)]
    for x0, zb, dy in ((0.035, 0.66, 0.0), (0.085, 0.71, 0.006)):
        p = Part()
        w = 0.042
        zs = [z + 0.01, z - 0.06, 0.5 * (z + zb), zb]
        ys = [-0.176 - dy, -0.192 - dy, -0.212 - dy, -0.222 - dy]
        ids = []
        for zz, yy in zip(zs, ys):
            wt = {"hips": 1.0} if zz > 0.9 else {"hips": 0.6, "thigh_L": 0.4}
            ids.append((p.v(V((x0, yy, zz)), wt), p.v(V((x0 + w, yy, zz)), wt)))
        for (a0, a1), (b0, b1), za, zc in zip(ids, ids[1:], zs, zs[1:]):
            p.f([a0, a1, b1, b0], "trim_diamond", [(za / 0.2, 0), (za / 0.2, 1), (zc / 0.2, 1), (zc / 0.2, 0)])
        wt = {"hips": 0.6, "thigh_L": 0.4}
        t0, t1 = p.v(V((x0 - 0.004, ys[-1], zb - 0.07)), wt), p.v(V((x0 + w + 0.004, ys[-1], zb - 0.07)), wt)
        p.f([ids[-1][0], ids[-1][1], t1, t0], "plain", None, (0.15, 0.012, 0.008))          # tupsu
        parts.append(p)
    top = V((-0.11, -0.165, z - 0.02))
    w = {"hips": 0.8, "thigh_R": 0.2}
    R = Matrix.Rotation(0.12, 3, 'Y')
    parts.append(box_part(top + V((0, 0, -0.10)), (0.034, 0.018, 0.17), "leather", w, (0.95, 0.85, 0.75), R))
    parts.append(tube_part([top + V((0, 0, 0.0)), top + V((0.008, 0, 0.09))], [0.012, 0.014], 6, "wood", w, (1.0, 0.9, 0.7)))
    return parts


def kantele_case(C):
    """Kanteleen tuohikotelo selässä viistosti oikealta olalta vasemmalle lanteelle ja kantohihna."""
    p0, p1 = V((-0.15, 0.255, 1.40)), V((0.21, 0.30, 0.93))
    d = (p1 - p0).normalized()
    yv = V((0, 1, 0))
    side = d.cross(yv).normalized()
    wt = {"chest": 0.7, "spine": 0.3}
    p = Part()
    n = 14
    secs = [(0.0, 0.25), (0.03, 0.55), (0.2, 0.72), (0.8, 1.0), (0.96, 0.85), (1.0, 0.3)]
    ln = (p1 - p0).length
    rings = []
    for t, k in secs:
        ring = []
        for i in range(n):
            a = i / n * 2 * math.pi
            ca, sa = math.cos(a), math.sin(a)
            x = 0.105 * k * math.copysign(abs(ca) ** 0.5, ca)
            y = 0.042 * (0.6 + 0.4 * k) * math.copysign(abs(sa) ** 0.5, sa)
            ring.append(p.v(p0 + d * (t * ln) + side * x + yv * y, wt))
        rings.append(ring)
    per = 0.6
    for (ra, (ta, _)), (rb, (tb, _)) in zip(zip(rings, secs), zip(rings[1:], secs[1:])):
        for i in range(n):
            i2 = (i + 1) % n
            u0, u1 = i / n * per / 0.2, (i + 1) / n * per / 0.2
            p.f([ra[i], ra[i2], rb[i2], rb[i]], "weave", [(u0, ta * ln / 0.2), (u1, ta * ln / 0.2), (u1, tb * ln / 0.2), (u0, tb * ln / 0.2)], (0.95, 0.9, 0.82))
    p.f(list(reversed(rings[0])), "weave", None, (0.7, 0.65, 0.55))
    p.f(rings[-1], "weave", None, (0.7, 0.65, 0.55))
    parts = [p]
    for t in (0.18, 0.5, 0.82):                               # sidosvitsat kotelon ympäri
        k = 0.72 + 0.28 * min(1.0, (t - 0.2) / 0.6) if t > 0.2 else 0.72
        pts = []
        for i in range(n + 1):
            a = i / n * 2 * math.pi
            ca, sa = math.cos(a), math.sin(a)
            pts.append(p0 + d * (t * ln) + side * (0.108 * k * math.copysign(abs(ca) ** 0.5, ca)) + yv * (0.045 * (0.6 + 0.4 * k) * math.copysign(abs(sa) ** 0.5, sa)))
        parts.append(tube_part(pts, [0.005] * len(pts), 4, "leather", wt, (0.8, 0.6, 0.4), cap=False))
    # hihna kotelon yläpäästä oikean olan yli soljen viereen; loppu jää viitan ja parran alle
    strap = [V((-0.15, 0.235, 1.37)), V((-0.152, 0.17, 1.42)), V((-0.155, 0.05, 1.478)), V((-0.135, -0.07, 1.462)), V((-0.07, -0.15, 1.40))]
    parts.append(tube_part(strap, [0.011] * len(strap), 5, "leather", {"chest": 0.6, "spine": 0.4}, (0.95, 0.85, 0.75), cap=False))
    return parts


def cap_band(C):
    keep = lambda i, c: c.z > 1.5 and C.arm_frac[i] < 0.2
    return [band(C, V((0, -0.035, 1.612)), V((0, 0.12, 1)).normalized(), V((0, -1, 0)), 0.04, 0.026, "trim_diamond", n=20, keep=keep, vspan=(0, 1), tile=0.16)]


def build_tietaja():
    C = Ctx()
    white = (0.85, 0.83, 0.78)
    tunic = (0.5, 0.47, 0.28)
    P = skin_parts(C, 0.9, white, skin=(0.70, 0.49, 0.38))
    P += hair_parts(C, white, length=1.36, beard=0.016, beard_long=0.03, cap=True)
    P += long_beard(C, white)
    P += cap_parts(C, col=(0.5, 0.42, 0.33)) + cap_band(C)
    P += torso_parts(C, "hessian", tunic, 0.97, inflate=0.026, tile=0.14, smooth=9, collar=(0.15, 0.012, 0.008), baggy=0.012)
    P += [skirt(C, 1.0, 0.56, 0.026, (0.275, 0.225), "hessian", tile=0.14, col=tunic, trim="trim_diamond")]
    P += [skirt(C, 0.66, 0.47, 0.0, (0.27, 0.22), "hessian", tile=0.14, col=(1.0, 0.96, 0.86), rows=2)]
    P += cuff_parts(C, 0.96, "trim_diamond", 0.026)
    P += legs_parts(C, "wool", (0.75, 0.68, 0.58), (0.9, 0.86, 0.75), baggy=0.05)
    P += woven_belt(C)
    P += kantele_case(C)
    P += mantle_parts(C)
    return assemble("char_tietaja", P, col_name="FOLK")[1]


def build_staff():
    """Sauva: ote origossa, linnunpää -Y:n päässä (kuten keihään kärki), nokka +Z:aan."""
    W = {}
    p = Part()
    wood = (0.95, 0.85, 0.7)
    pts = [V((0.004 * math.sin(i * 1.7), 1.05 - i * 0.17, 0.004 * math.cos(i * 2.3))) for i in range(11)]
    p.extend(tube_part(pts, [0.016 + 0.0004 * i for i in range(11)], 7, "wood", W, wood, tile=0.3))
    for y, c in ((-0.60, 0.55), (-0.56, 0.55), (-0.50, 0.6)):                   # veistetyt renkaat
        p.extend(tube_part([V((0, y, 0)), V((0, y - 0.012, 0))], [0.0235, 0.0235], 8, "wood", W, tuple(x * c for x in wood)))
    head = [V((0, -0.65, 0)), V((0, -0.72, 0.004)), V((0, -0.775, 0.022)), V((0, -0.805, 0.06)), V((0, -0.80, 0.10)), V((0, -0.782, 0.14)), V((0, -0.765, 0.165))]
    p.extend(tube_part(head, [0.021, 0.024, 0.029, 0.03, 0.018, 0.009, 0.002], 8, "wood", W, tuple(x * 0.92 for x in wood), tile=0.2))
    for s in (-1, 1):                                                           # silmät
        p.extend(tube_part([V((s * 0.024, -0.80, 0.066)), V((s * 0.031, -0.80, 0.066))], [0.006, 0.004], 5, "wood", W, (0.2, 0.15, 0.1)))
    return assemble("sauva", [p], col_name="FOLK", rig=False)[1]


# ---------- asento tarkistuskuvia varten ----------
def pose_arms(down=True):
    """Laskee käsivarret sivuille (tai palauttaa lepoasennon), jotta viitan ja hihojen
    käytös näkyy siinä asennossa, jossa peli hahmoa pitää."""
    rig = bpy.data.objects["RIG"]
    for sfx, sx in (("L", 1), ("R", -1)):
        pb = rig.pose.bones["upper_arm_" + sfx]
        pb.rotation_mode = 'QUATERNION'
        if not down:
            pb.rotation_quaternion = (1, 0, 0, 0)
            continue
        b = pb.bone
        d = (b.tail_local - b.head_local).normalized()
        q = d.rotation_difference(V((sx * 0.16, -0.03, -1)).normalized())
        m = b.matrix_local.to_quaternion()
        pb.rotation_quaternion = m.inverted() @ q @ m
    bpy.context.view_layer.update()


def export_folk(out_dir):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    objs = list(bpy.data.collections["FOLK"].objects) + [bpy.data.objects["RIG"]]
    for o in objs:
        o.hide_set(False)
        o.select_set(True)
    bpy.context.view_layer.objects.active = bpy.data.objects["RIG"]
    path = os.path.join(out_dir, "villagers.glb")
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True,
        export_image_format='WEBP', export_image_quality=85,
        export_vertex_color='NAME', export_vertex_color_name='Col', export_all_vertex_colors=False,
        export_apply=False, export_skins=True, export_animations=False, export_yup=True,
        export_cameras=False, export_lights=False,
    )
    return {"glb_mb": round(os.path.getsize(path) / 1e6, 2), "objects": len(objs)}


def run_folk(preview_dir=None, out_dir=None, save=True):
    out = {}
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            folk_materials()
            pose_arms(False)
            out["tris"] = {"char_tietaja": build_tietaja()["tris"], "sauva": build_staff()["tris"]}
            bpy.context.view_layer.update()
            if preview_dir:
                sheet(["char_tietaja"], os.path.join(preview_dir, "tietaja_rest.png"), yaws=(0, math.pi / 2, math.pi), w=380, h=760)
                pose_arms(True)
                sheet(["char_tietaja"], os.path.join(preview_dir, "tietaja_pose.png"), yaws=(0, math.pi / 2, math.pi, -math.pi / 2), w=380, h=760)
                pose_arms(False)
                sheet(["sauva"], os.path.join(preview_dir, "sauva.png"), yaws=(math.pi / 2,), w=300, h=900)
            if save:
                bpy.ops.wm.save_mainfile()
            if out_dir:
                out["glb"] = export_folk(out_dir)
    except Exception:
        out["err"] = traceback.format_exc()[-1800:]
    return out
