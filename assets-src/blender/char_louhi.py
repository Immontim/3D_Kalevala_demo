"""Louhi, Pohjolan emäntä: musta pitkä mekko, sininen esiliina kirjontanauhalla, kultaiset
olkasoljet ja ketjut, helmikaulakoru, rengasvyö sekä peuran kallo ja sulat päässä.
Samaa naisvartaloa (BODY_F) ja luurankoa (RIG_F) kuin jousineidolla ja emännällä, joten
peli voi animoida hänet samalla koodilla. Viittaa ei ole (omistajan päätös: hankala).

Käyttää char_folk.py:n apuja (Drape, strap_brooch_parts, shoes_parts, ...), joten se
luetaan ensin. Aja Blenderissä characters.blend-tiedostossa:

    FOLK_DIR = r"...\\assets-src\\blender"      # vain jos ajat toisesta työpuusta
    exec(open(r"...\\assets-src\\blender\\char_louhi.py", encoding="utf-8").read())
    result = run_louhi(preview_dir=r"...", out_dir=r"...\\assets")

Tulos: kokoelma LOUHI (char_louhi) ja tiedosto assets/louhi.glb luurankoineen (RIG).
Kallo, sarvet ja sulat ovat samaa verkkoa kuin hahmo ja painotettu pään luuhun.
"""
import os, math, random

_LB = globals().get("FOLK_DIR") or (os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else r"C:\Data\3D Kalevala\assets-src\blender")
FOLK_DIR = _LB
exec(open(os.path.join(_LB, "char_folk.py"), encoding="utf-8").read())

HEAD = {"head": 1.0}


# ---------- apurit ----------
def ellipsoid(c, r, mat, w, col, n=8, m=5, R=None):
    """Ellipsoidi (pallo tai litistetty): helmet, silmäkuopat."""
    c = V(c)
    R = R or Matrix.Identity(3)
    p = Part()
    top = p.v(c + R @ V((0, 0, r[2])), dict(w))
    bot = p.v(c + R @ V((0, 0, -r[2])), dict(w))
    rings = []
    for j in range(1, m):
        t = math.pi * j / m
        rings.append([p.v(c + R @ V((r[0] * math.sin(t) * math.cos(2 * math.pi * k / n),
                                      r[1] * math.sin(t) * math.sin(2 * math.pi * k / n), r[2] * math.cos(t))), dict(w)) for k in range(n)])
    for k in range(n):
        k2 = (k + 1) % n
        p.f([top, rings[0][k], rings[0][k2]], mat, None, col)
        p.f([bot, rings[-1][k2], rings[-1][k]], mat, None, col)
        for j in range(len(rings) - 1):
            p.f([rings[j][k], rings[j + 1][k], rings[j + 1][k2], rings[j][k2]], mat, None, col)
    return p


def loft(pts, rx, rz, sides, mat, w, col=(1, 1, 1), tile=0.2, up=V((0, 0, 1))):
    """Putki, jonka poikkileikkaus on ellipsi (leveys rx, korkeus rz)."""
    p = Part()
    rings, vs, acc = [], [], 0.0
    n = len(pts)
    for i, c in enumerate(pts):
        d = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        a = d.cross(up).normalized()
        b = a.cross(d).normalized()
        if i:
            acc += (c - pts[i - 1]).length
        vs.append(acc / tile)
        rings.append([p.v(c + a * math.cos(k * 2 * math.pi / sides) * rx[i] + b * math.sin(k * 2 * math.pi / sides) * rz[i], dict(w)) for k in range(sides)])
    for i in range(n - 1):
        for k in range(sides):
            k2 = (k + 1) % sides
            p.f([rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]], mat,
                [(k / sides, vs[i]), ((k + 1) / sides, vs[i]), ((k + 1) / sides, vs[i + 1]), (k / sides, vs[i + 1])], col)
    p.f(list(reversed(rings[0])), mat, None, col, False)
    p.f(rings[-1], mat, None, col, False)
    return p


def trim_louhi_px(w=256, h=96):
    """Sininen villanauha: kaksi riviä tummia vinoneliöitä ja pieni piste kunkin keskellä."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    u = (xx / w * 8) % 1.0
    v = (yy / h * 2) % 1.0
    d = np.abs(u - 0.5) + np.abs(v - 0.5)
    m = ((d < 0.40) & ~(d < 0.27)) | (d < 0.09)
    base = np.array([0.21, 0.31, 0.52], dtype=np.float32)
    dark = np.array([0.05, 0.06, 0.10], dtype=np.float32)
    px = np.where(m[..., None], dark, base)
    edge = (yy / h < 0.05) | (yy / h > 0.95) | (np.abs((yy / h) - 0.5) < 0.012)
    px = np.where(edge[..., None], dark, px)
    weave = 0.9 + 0.1 * np.sin(xx * 2.2) * np.sin(yy * 2.2)
    return np.clip(px * weave[..., None], 0, 1)


def louhi_materials():
    folk_materials()
    CM["trim_louhi"] = pbr("C_Trim_louhi", img_from_px(trim_louhi_px(), "trim_louhi"), None, rough=0.9, twosided=True)
    return CM


# ---------- keho ----------
def paint_eyes(C, head, dark=(0.035, 0.03, 0.04)):
    """Mustat silmämaalit: leveä juova silmien yli ohimoille, reunat häviävät ihoon."""
    zs = []
    for nm in (C.src + ".eye.L", C.src + ".eye.R"):
        eo = bpy.data.objects[nm]
        mw = (C.xf @ eo.matrix_local) if C.xf else eo.matrix_world
        zs.append(mw.translation.z)
    ez = sum(zs) / len(zs)
    new = []
    for idx, mat, uvs, col, sm in head.faces:
        c = sum((head.co[i] for i in idx), V()) / len(idx)
        t = 0.0
        if c.y < -0.05 and abs(c.x) < 0.09:
            e = (abs(c.x) / 0.085) ** 2 + ((c.z - ez - 0.002) / 0.0165) ** 2
            t = max(0.0, min(1.0, (1.25 - e) / 0.9)) ** 0.8
        if t > 0:
            col = tuple(col[k] * (1 - t) + dark[k] * t for k in range(3))
        new.append((idx, mat, uvs, col, sm))
    head.faces = new


def chest_skin(C, skin):
    """Paljas rinnan yläosa ja solisluut mekon yläreunan yläpuolella (pään kuori alkaa vasta z 1,37)."""
    def sel(i, c):
        if not (1.285 < c.z < 1.42) or abs(c.x) > 0.27 or C.leg_frac[i] > 0.6:
            return False
        return C.w[i].get("neck", 0) + C.w[i].get("head", 0) < 0.55
    return [shell(C, sel, lambda c: 0.0012, "skin", smooth=1, col=skin)]


def bodice_parts(C, col, z_top=1.315):
    def sel(i, c):
        if c.z < 0.95 or c.z > z_top or C.arm_frac[i] > 0.3 or C.leg_frac[i] > 0.6:
            return False
        return True
    return [shell(C, sel, lambda c: 0.016 + 0.012 * smoothstep(1.28, 1.1, c.z), "wool", tile=0.14, smooth=6, col=col)]


def louhi_apron(D, col, edge, z_top, z_bot, extra=0.024, trim_h=0.15):
    """Sininen esiliina vain edessä: paneeli vyöltä helmaan, alareunassa kirjontanauha."""
    zs = [z_top, D.z_top, 0.95, 0.86, 0.77, 0.68, 0.59, 0.50, 0.41, 0.32, z_bot, z_bot - trim_h]
    us = [-1, -0.93, -0.6, -0.3, 0, 0.3, 0.6, 0.93, 1]

    def hw(z):
        if z >= D.z_top:
            return 0.11
        return 0.12 + 0.11 * (D.z_top - z) / (D.z_top - z_bot)
    p = Part()
    grid = []
    for z in zs:
        row = []
        for u in us:
            pt = D.surf(u * hw(max(z, z_bot)), z, extra, False)
            row.append(p.v(pt, D.weight(pt)))
        grid.append(row)
    for j in range(len(zs) - 1):
        is_trim = j == len(zs) - 2
        for k in range(len(us) - 1):
            q = [grid[j][k], grid[j][k + 1], grid[j + 1][k + 1], grid[j + 1][k]]
            if is_trim:
                u0, u1 = (us[k] + 1) * 2.0, (us[k + 1] + 1) * 2.0
                p.f(q, "trim_louhi", [(u0, 1), (u1, 1), (u1, 0), (u0, 0)])
            else:
                uv = [(us[k] * 1.2, zs[j] / 0.14), (us[k + 1] * 1.2, zs[j] / 0.14), (us[k + 1] * 1.2, zs[j + 1] / 0.14), (us[k] * 1.2, zs[j + 1] / 0.14)]
                is_edge = k in (0, len(us) - 2)
                p.f(q, "plain" if is_edge else "wool", uv, edge if is_edge else col)
    return [p]


def louhi_belt(C, D, z=1.04):
    """Tumma nahkavyö, iso hopearengas edessä ja puukko tupessa kyljellä."""
    keep = lambda i, c: abs(c.x) < 0.2 and C.arm_frac[i] < 0.3
    hip = {"hips": 1.0}
    parts = [band(C, V((0, 0.02, z)), V((0, 0, 1)), V((0, -1, 0)), 0.05, 0.062, "leather", keep=keep, col=(0.45, 0.4, 0.38))]
    c0 = D.surf(0.0, z, 0.075)
    ring = [c0 + V((math.cos(i / 14 * 2 * math.pi) * 0.034, 0, math.sin(i / 14 * 2 * math.pi) * 0.034)) for i in range(15)]
    parts.append(tube_part(ring, [0.0065] * 15, 6, "metal", hip, (0.78, 0.78, 0.8), cap=False))
    parts.append(box_part(c0 + V((0.0, 0.004, 0.036)), (0.016, 0.012, 0.012), "metal", hip, (0.75, 0.75, 0.78)))
    top = D.surf(0.125, z - 0.03, 0.05)
    R = Matrix.Rotation(-0.1, 3, 'Y')
    parts.append(box_part(top + V((0, 0, -0.10)), (0.034, 0.018, 0.17), "leather", hip, (0.95, 0.85, 0.75), R))
    parts.append(tube_part([top, top + V((-0.007, 0, 0.085))], [0.012, 0.014], 6, "wood", hip, (0.6, 0.5, 0.4)))
    return parts


def necklace(C):
    """Kaksi helmirivistöä: punaisia ja mustia helmiä kaulan ja rinnan ympärillä."""
    parts = []
    rng = random.Random(9)
    for strand, (z0, rx, ry, dip, n) in enumerate(((1.405, 0.062, 0.062, 0.035, 22), (1.395, 0.066, 0.068, 0.065, 24))):
        for k in range(n):
            a = 2 * math.pi * (k + 0.5) / n
            front = max(0.0, -math.sin(a))                    # a = -90° on edessä
            pt = V((math.cos(a) * rx * (1 + 0.5 * front), math.sin(a) * ry * (1 + 0.9 * front) - 0.005, z0 - dip * front ** 1.5))
            red = (k + strand) % 3 != 0
            col = (0.55, 0.07, 0.05) if red else (0.05, 0.045, 0.05)
            r = 0.0075 if red else 0.0065
            parts.append(ellipsoid(pt, (r, r, r), "plain", {"chest": 1.0}, col, n=5, m=3))
    return parts


# ---------- päähine ----------
BONE = (0.90, 0.80, 0.62)


def skull_parts():
    parts = []
    path = [V((0, 0.035, 1.712)), V((0, -0.005, 1.722)), V((0, -0.06, 1.716)), V((0, -0.115, 1.69)), V((0, -0.165, 1.662)), V((0, -0.205, 1.64))]
    rx = [0.030, 0.050, 0.048, 0.034, 0.025, 0.019]
    rz = [0.028, 0.044, 0.040, 0.030, 0.022, 0.016]
    parts.append(loft(path, rx, rz, 9, "plain", HEAD, BONE, tile=0.1))
    # kulmaluut ja poskiluut: kaksi tummaa silmäkuoppaa ja sieraimet
    for s in (-1, 1):
        parts.append(ellipsoid(V((s * 0.036, -0.075, 1.714)), (0.014, 0.019, 0.014), "plain", HEAD, (0.12, 0.09, 0.07)))
        parts.append(ellipsoid(V((s * 0.011, -0.2, 1.646)), (0.006, 0.009, 0.006), "plain", HEAD, (0.12, 0.09, 0.07)))
    parts.append(ellipsoid(V((0, 0.01, 1.744)), (0.045, 0.05, 0.012), "plain", HEAD, tuple(x * 0.95 for x in BONE)))     # otsa/päälaki
    return parts


def antler_parts(seed=4):
    """Kaksi sarvea: kaareva pääharkko ja haarat. Vasen on oikean peili, pienin eroin."""
    parts = []
    k = 0.58
    beam = [V((0.036, 0.012, 1.738)), V((0.07, 0.01, 1.738 + 0.057 * k / 0.58)), V((0.115, 0.0, 1.738 + 0.132 * k)), V((0.158, -0.018, 1.738 + 0.212 * k)),
            V((0.195, -0.045, 1.738 + 0.292 * k)), V((0.222, -0.075, 1.738 + 0.362 * k)), V((0.238, -0.105, 1.738 + 0.432 * k))]
    radii = [0.021, 0.018, 0.015, 0.0125, 0.010, 0.008, 0.005]
    for s in (1, -1):
        rng = random.Random(seed + (0 if s == 1 else 7))
        bb = [V((p.x * s, p.y + rng.uniform(-0.004, 0.004), p.z + rng.uniform(-0.004, 0.004))) for p in beam]
        # tasaisempi käyrä
        parts.append(tube_part(bb, radii, 6, "plain", HEAD, tuple(x * rng.uniform(0.93, 1.0) for x in BONE), tile=0.1))
        for i, ln in ((1, 0.07), (2, 0.09), (3, 0.10), (4, 0.085), (5, 0.06)):
            b0 = bb[i]
            d = V((0.35 * s, -0.55 - 0.2 * rng.random(), 0.55)).normalized()
            pts = [b0, b0 + d * (ln * 0.5) + V((0, -0.004, 0.012)), b0 + d * ln + V((0.02 * s, -0.01, 0.045))]
            parts.append(tube_part(pts, [radii[i] * 0.62, radii[i] * 0.45, 0.003], 5, "plain", HEAD, BONE, tile=0.1))
        tip = bb[-1]                                                             # latvan haarukka
        for dx, dy, dz, ln in ((0.4, -0.5, 0.75, 0.07), (-0.25, 0.55, 0.65, 0.06), (0.15, 0.1, 1.0, 0.06)):
            d = V((dx * s, dy, dz)).normalized()
            parts.append(tube_part([tip, tip + d * (ln * 0.5), tip + d * ln + V((0, 0, 0.012))], [0.0045, 0.0035, 0.0018], 5, "plain", HEAD, BONE, tile=0.1))
        parts.append(ellipsoid(V((0.036 * s, 0.012, 1.74)), (0.024, 0.024, 0.016), "plain", HEAD, tuple(x * 0.82 for x in BONE)))   # ruusuke
    return parts


def feather_parts(seed=11):
    """Mustat sulat kallon sivuilla: kolme kummallakin puolella, viuhkana ylös ja ulos."""
    parts = []
    rng = random.Random(seed)
    bases = [(0.078, 0.025, 1.70, 0.30, 55), (0.088, 0.045, 1.67, 0.26, 78), (0.068, 0.058, 1.695, 0.22, 35)]
    for s in (1, -1):
        for bx, by, bz, ln, ang in bases:
            a = math.radians(ang + rng.uniform(-6, 6))
            d = V((math.sin(a) * s * 0.9, 0.18 + rng.uniform(-0.08, 0.08), math.cos(a) * 0.7 + 0.15)).normalized()
            base = V((bx * s, by, bz))
            n = 7
            side = d.cross(V((0, -1, 0)))
            side = (side.normalized() if side.length > 1e-3 else V((1, 0, 0)))
            pts = [base + d * (ln * i / (n - 1)) + V((0.0, 0.0, -0.05 * ln * (i / (n - 1)) ** 2)) + V((s * 0.04 * ln * (i / (n - 1)) ** 2, 0, 0)) for i in range(n)]
            p = Part()
            for i in range(n - 1):
                t0, t1 = i / (n - 1), (i + 1) / (n - 1)
                w0 = 0.016 * math.sin(math.pi * (0.1 + 0.85 * t0)) ** 0.8
                w1 = 0.016 * math.sin(math.pi * (0.1 + 0.85 * t1)) ** 0.8
                tone = lambda t: tuple(x * (0.8 + 0.4 * t) for x in (0.02, 0.022, 0.032))
                a0, a1 = p.v(pts[i] - side * w0, HEAD), p.v(pts[i] + side * w0, HEAD)
                b0, b1 = p.v(pts[i + 1] - side * w1, HEAD), p.v(pts[i + 1] + side * w1, HEAD)
                p.f([a0, a1, b1, b0], "plain", [(0, t0), (1, t0), (1, t1), (0, t1)], tone(t0))
                p.f([b0, b1, a1, a0], "plain", [(0, t1), (1, t1), (1, t0), (0, t0)], tone(t0))
            parts.append(p)
            parts.append(tube_part([base - d * 0.02, pts[-1] - d * 0.01], [0.0022, 0.0012], 4, "plain", HEAD, (0.08, 0.07, 0.07), cap=False))
    return parts


def headgear_parts():
    return skull_parts() + antler_parts() + feather_parts()


# ---------- kokoaminen ----------
def build_louhi():
    C = Ctx(FEM["body"], FEM["src"], FEM["rig"], FEM_P, fem_xf())
    black = (0.075, 0.075, 0.09)
    hair = (0.05, 0.045, 0.055)
    skin = (0.80, 0.65, 0.59)
    blue = (0.22, 0.35, 0.65)
    blue_edge = (0.05, 0.06, 0.11)
    D = Drape(C, 1.04, 0.05, 0.012, (0.30, 0.27), z_max=1.31)
    P = skin_parts(C, 0.06, hair, skin=skin, lips=(0.36, 0.13, 0.17), face=(-0.008, 0.002), carve=False)
    paint_eyes(C, P[0])
    P += chest_skin(C, skin)
    P += hair_parts(C, hair, length=1.38, beard=0, cap=True)
    P += bodice_parts(C, black)
    P += [drape_skirt(D, "wool", black)]
    P += [skirt(C, 0.30, 0.12, 0.0, (0.25, 0.22), "jersey", tile=0.14, col=black, rows=2)]
    P += shoes_parts(C, (0.08, 0.08, 0.09))
    P += louhi_apron(D, blue, blue_edge, 1.075, 0.30)
    P += strap_brooch_parts(C, D, black)
    P += louhi_belt(C, D)
    P += necklace(C)
    P += headgear_parts()
    return assemble("char_louhi", P, col_name="LOUHI", rig_name=FEM["rig"])[1]


def run_louhi(preview_dir=None, out_dir=None, save=True):
    out = {}
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            louhi_materials()
            if FEM["body"] not in bpy.data.objects or FEM["rig"] not in bpy.data.objects:
                out["base_f"] = build_base_f()["weights"]
            pose_arms(False, FEM["rig"])
            out["louhi"] = build_louhi()
            bpy.context.view_layer.update()
            if preview_dir:
                sheet(["char_louhi"], os.path.join(preview_dir, "louhi_rest.png"), yaws=(0, math.pi / 2, math.pi, -math.pi / 2), w=380, h=760)
                pose_arms(True, FEM["rig"])
                sheet(["char_louhi"], os.path.join(preview_dir, "louhi_pose.png"), yaws=(0, math.pi / 2, math.pi, -math.pi / 2), w=380, h=760)
                pose_arms(False, FEM["rig"])
            if save:
                bpy.ops.wm.save_mainfile()
            if out_dir:
                out["glb"] = export_folk(out_dir, "LOUHI", FEM["rig"], "louhi.glb")
    except Exception:
        out["err"] = traceback.format_exc()[-1800:]
    return out
