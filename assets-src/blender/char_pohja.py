"""Pohjan uudet soturit ja kaksi yksiteräistä kirvestä (vain assetit, ei vielä pelissä).

Hahmot (omat tiedostot, koska kummallakin on oma luurankonsa samoilla luiden nimillä ja kierroilla):
- assets/pohja_tanakka.glb: lyhyt (noin 1,58 m), tanakka ja parrakas soturi.
- assets/pohja_hoikka.glb: pitkä (noin 1,90 m), laiha ja parraton soturi.
Asu kootaan ensin vakiomiehen (BODY, RIG, 1,70 m) mittoihin samoilla osafunktioilla kuin muut
taistelijat, ja sitten verkko ja luut muunnetaan yhdessä hahmon mittasuhteisiin (reshape): jokaisella
luulla on oma kerroin pituussuunnassa (l) ja poikittain (g), kuten lapsisällillä (char_smith_child.py).
Luiden suunnat ja roll pysyvät, joten pelin luukierrot liikuttavat hahmoja samoin kuin muita.

Osat (sama luuranko, yksi skin; peli näyttää aina perusosan ja täsmälleen yhden nutun):
  char_<h>_base          iho, hiukset (tanakalla parta), housut, säärikääreet, kengät ja vyö
  char_<h>_nuttu_vaalea  luonnonvaalea villanuttu, pienet punaiset kirjailut kauluksessa,
                         rintahalkiossa, hihansuissa ja helmassa
  char_<h>_nuttu_tumma   musta villanuttu (Pohjan asun mukaelma): vaalea-punainen kirjailtu
                         päällekkäisliepeen reuna, leveämmät hihansuut ja helmanauha, pidempi helma
  char_<h>_mail          oma rengaspaita (vartalon mukaan), puolihihat ja rengashelma
  char_<h>_huotra        huotra vasemmalla kupeella; näytetään vain, jos hahmolla on miekka
  helmet_<h>             nenäsuojakypärä pään mittoihin (ei luurankoa, kuten helmet_pohja)
  mount_huotra           tyhjä lantioluun lapsena: miekka nollasijaintiin = huotrassa
  mount_kirves           tyhjä lantioluun lapsena: kirves vyöllä oikealla, terä ylhäällä
Miekka on characters.glb:n sword (ei kopioida).

Kirveet (assets/kirveet.glb, ei luurankoa; miekan kehyksessä: ote origossa, varsi -Y:hen kohti
kirveen päätä, terä +X:ään, lappeet ±Z):
  kirves_parta    parrakas kirves (alaterä roikkuu), kirkkaampi teräsreuna hitsisaumoineen,
                  vaalea suora varsi
  kirves_karjala  karjalainen leviävä kirves (Gromovon tapaan): kapea kaula, korvakkeet
                  silmän ylä- ja alapuolella, hopeaupotukset, tumma varsi ja nahkakääre otteessa

Aja taustalla characters.blendin KOPIOLLA (lähdetiedostoa ei muuteta):
    blender --background kopio.blend --python ajo.py
    ajo.py: FOLK_DIR = r"...\\assets-src\\blender"; exec(open(FOLK_DIR + r"\\char_pohja.py", encoding="utf-8").read())
            print(run_axes(preview_dir=..., out_dir=...)); print(run_pohja("tanakka", preview_dir=..., out_dir=...))
"""
import os, io, contextlib, traceback, math, random

_PB = globals().get("FOLK_DIR") or (os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else r"C:\Data\3D Kalevala\assets-src\blender")
FOLK_DIR = _PB
exec(open(os.path.join(_PB, "char_smith_child.py"), encoding="utf-8").read())

COL_AX = "POHJA_AXES"


# ---------- kirveet ----------
def _interp_x(poly, x):
    """Murtoviivan y annetulla x:llä (poly x-järjestyksessä)."""
    for (x0, y0), (x1, y1) in zip(poly, poly[1:]):
        if x <= x1:
            f = (x - x0) / max(1e-9, x1 - x0)
            return y0 + (y1 - y0) * min(1.0, max(0.0, f))
    return poly[-1][1]


def haft_part(secs, mat, colfn, n=10, tile=0.3):
    """Soikea varsi y-akselilla. secs = [(y, rx, rz), ...] tyvestä kärkeen (y pienenee)."""
    p = Part()
    rings = []
    for y, rx, rz in secs:
        rings.append([p.v(V((rx * math.cos(2 * math.pi * k / n), y, rz * math.sin(2 * math.pi * k / n))), {}) for k in range(n)])
    for i in range(len(secs) - 1):
        col = colfn((secs[i][0] + secs[i + 1][0]) / 2)
        for k in range(n):
            k2 = (k + 1) % n
            p.f([rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]], mat,
                [(k / n, secs[i][0] / tile), ((k + 1) / n, secs[i][0] / tile), ((k + 1) / n, secs[i + 1][0] / tile), (k / n, secs[i + 1][0] / tile)], col)
    p.f(list(reversed(rings[0])), mat, None, colfn(secs[0][0]), False)
    p.f(rings[-1], mat, None, colfn(secs[-1][0]), False)
    return p


def axe_head(top, bot, bulge, eye_x, h_eye, h_neck, colfn, ns=48, nv=20):
    """Kirveen pää: yläreuna top ja alareuna bot ovat (x, y)-murtoviivoja silmän takareunasta terään.
    Pinta = lerp(top(s), bot(s), v); terä pullistuu kuperaksi (bulge). Paksuus: silmä h_eye, kaula h_neck,
    ohenee terää kohti. colfn(x, y, s, v) -> väri pinnalle."""
    p = Part()
    x0 = max(top[0][0], bot[0][0])
    def pt(s, v):
        xt = top[0][0] + (top[-1][0] - top[0][0]) * s
        xb = bot[0][0] + (bot[-1][0] - bot[0][0]) * s
        yt, yb = _interp_x(top, xt), _interp_x(bot, xb)
        x = xt + (xb - xt) * v + bulge * math.sin(math.pi * v) * s ** 3
        y = yt + (yb - yt) * v
        eye = smoothstep(eye_x + 0.017, eye_x, x)
        blade = 0.0007 + (h_neck - 0.0007) * (1 - s) ** 1.5
        blade *= 0.6 + 0.4 * math.sin(math.pi * v) ** 0.3          # reunat viistetty
        blade *= smoothstep(1.0, 0.9, s) * 0.85 + 0.15               # teräviiste
        return x, y, blade * (1 - eye) + h_eye * eye
    S = [k / (ns - 1) for k in range(ns)]
    Vv = [j / (nv - 1) for j in range(nv)]
    F, B, XY = [], [], []
    for s in S:
        fr, br, xr = [], [], []
        for v in Vv:
            x, y, h = pt(s, v)
            fr.append(p.v(V((x, y, h)), {}))
            br.append(p.v(V((x, y, -h)), {}))
            xr.append((x, y))
        F.append(fr)
        B.append(br)
        XY.append(xr)
    for i in range(ns - 1):
        for j in range(nv - 1):
            cx = (XY[i][j][0] + XY[i + 1][j + 1][0]) / 2
            cy = (XY[i][j][1] + XY[i + 1][j + 1][1]) / 2
            col = colfn(cx, cy, (S[i] + S[i + 1]) / 2, (Vv[j] + Vv[j + 1]) / 2)
            p.f([F[i][j], F[i + 1][j], F[i + 1][j + 1], F[i][j + 1]], "metal", None, col)
            p.f([B[i][j], B[i][j + 1], B[i + 1][j + 1], B[i + 1][j]], "metal", None, col)
    L, J = ns - 1, nv - 1
    rim = lambda i, j: colfn(XY[i][j][0], XY[i][j][1], S[i], Vv[j])
    for i in range(ns - 1):
        p.f([F[i][0], B[i][0], B[i + 1][0], F[i + 1][0]], "metal", None, rim(i, 0), False)
        p.f([F[i][J], F[i + 1][J], B[i + 1][J], B[i][J]], "metal", None, rim(i, J), False)
    for j in range(nv - 1):
        p.f([F[0][j], F[0][j + 1], B[0][j + 1], B[0][j]], "metal", None, rim(0, j), False)
        p.f([F[L][j], B[L][j], B[L][j + 1], F[L][j + 1]], "metal", None, rim(L, j), False)
    return p


def wedge_part(ye, dy, zs, col, w=0.011, zi=0.0122, zo=0.0165):
    """Kolmiomainen korvake varren kyljessä (lappeen puolella zs): kanta silmän reunassa ye, kärki dy:n päässä."""
    p = Part()
    pts = [(-w, ye, zi), (w, ye, zi), (w, ye, zo), (-w, ye, zo), (0, ye + dy, zi), (0, ye + dy, zo * 0.92)]
    idx = [p.v(V((x, y, z * zs)), {}) for x, y, z in pts]
    ctr = sum((p.co[i] for i in idx), V()) / len(idx)
    for f in ((0, 1, 2, 3), (0, 1, 4), (3, 2, 5), (0, 3, 5, 4), (1, 2, 5, 4)):
        q = [idx[i] for i in f]
        a, b, c = p.co[q[0]], p.co[q[1]], p.co[q[2]]
        fc = sum((p.co[i] for i in q), V()) / len(q)
        if (b - a).cross(c - a).dot(fc - ctr) < 0:
            q.reverse()
        p.f(q, "metal", None, col, False)
    return p


def build_axes():
    """Kaksi yksiteräistä yhden käden kirvestä (ks. moduulin alku). Palauttaa kolmiomäärät."""
    stats = {}
    rng = random.Random(11)

    # --- kirves_parta: parrakas terä, alaterä roikkuu, kirkas teräsreuna hitsisaumalla (kuva 1)
    top = [(-0.028, -0.604), (0.03, -0.607), (0.09, -0.613), (0.15, -0.621), (0.172, -0.628)]
    bot = [(-0.028, -0.549), (0.018, -0.553), (0.045, -0.577), (0.07, -0.575), (0.095, -0.556), (0.12, -0.52),
           (0.143, -0.476), (0.158, -0.447)]
    def col_a(x, y, s, v):
        n = 0.94 + 0.06 * rng.random()
        if 0.8 < s < 0.83:
            return (0.06, 0.055, 0.05)                                   # hitsisauma
        if s >= 0.83:
            k = 0.27 + 0.02 * rng.random()
            return (k, k, k * 1.03)                                      # teräsreuna
        if s < 0.75 and rng.random() < 0.012:
            return (0.11, 0.08, 0.06)                                    # ruostepilkku
        return (0.13 * n, 0.12 * n, 0.11 * n)
    head = axe_head(top, bot, 0.016, 0.02, 0.0175, 0.0085, col_a, ns=36, nv=14)
    haft = haft_part([(0.085, 0.0185, 0.016), (0.078, 0.019, 0.0165), (0.066, 0.0155, 0.0135), (0.0, 0.0145, 0.0125),
                      (-0.25, 0.015, 0.0125), (-0.45, 0.0158, 0.0128), (-0.56, 0.0145, 0.0125), (-0.598, 0.0145, 0.0125)],
                     "wood", lambda y: (1.0, 0.8, 0.56))
    stats["kirves_parta"] = assemble("kirves_parta", [haft, head], col_name=COL_AX, rig=False)[1]

    # --- kirves_karjala: kapea kaula, leviävä terä, korvakkeet ja hopeaupotus (kuvat 2-3)
    top = [(-0.028, -0.611), (0.006, -0.623), (0.03, -0.598), (0.06, -0.595), (0.10, -0.605), (0.14, -0.629), (0.168, -0.658)]
    bot = [(-0.028, -0.536), (0.006, -0.524), (0.03, -0.552), (0.06, -0.556), (0.10, -0.546), (0.14, -0.522), (0.163, -0.496)]
    silver = (0.42, 0.42, 0.40)
    def col_b(x, y, s, v):
        n = 0.94 + 0.06 * rng.random()
        if s >= 0.86:
            k = 0.26 + 0.02 * rng.random()
            return (k, k, k * 1.04)
        if s < 0.13:                                                     # silmä: kaksi vaakanauhaa
            if 0.22 < v < 0.27 or 0.73 < v < 0.78:
                return silver
        elif s < 0.6:                                                    # kaula: kehys ja tikapuukuvio
            if 0.13 < v < 0.18 or 0.82 < v < 0.87:
                return silver
            if 0.13 < v < 0.87 and (0.13 <= s < 0.15 or 0.565 < s < 0.585):
                return silver
            if 0.3 < v < 0.7 and ((s - 0.17) / 0.065) % 1.0 < 0.28:
                return silver
        return (0.12 * n, 0.12 * n, 0.13 * n)
    head = axe_head(top, bot, 0.012, 0.018, 0.0175, 0.0075, col_b, ns=44, nv=18)
    for zs in (1, -1):                                                   # korvakkeet varren kyljissä silmän alapuolella
        head.extend(wedge_part(-0.529, 0.024, zs, (0.12, 0.12, 0.13), w=0.012, zi=0.0118, zo=0.0172))
    def col_hb(y):
        if -0.065 < y < 0.07:
            k = int((y + 0.065) / 0.0135) % 2
            return (0.22, 0.13, 0.09) if k == 0 else (0.33, 0.21, 0.13)  # nahkakääre
        return (0.58, 0.42, 0.28)
    ys = [0.083, 0.076, 0.07, 0.069] + [0.07 - 0.0135 * i for i in range(1, 11)] + [-0.066, -0.3, -0.5, -0.58, -0.6]
    secs = []
    for y in ys:
        wrap = 0.0018 if -0.066 < y < 0.07 else 0.0
        base = 0.0175 if y > 0.07 else 0.0145 if y > -0.3 else 0.0162
        secs.append((y, base + wrap, base * 0.86 + wrap))
    haft = haft_part(secs, "wood", col_hb)
    stats["kirves_karjala"] = assemble("kirves_karjala", [haft, head], col_name=COL_AX, rig=False)[1]
    return stats


def export_props(out_dir, col, fname):
    """Vie kokoelman esineet omasta väliaikaisesta kohtauksestaan, jotta tiedostoon ei tule muiden
    hahmojen luurankoja tyhjinä juurisolmuina."""
    objs = list(bpy.data.collections[col].objects)
    sc = bpy.data.scenes.new("_export_props")
    for o in objs:
        sc.collection.objects.link(o)
    path = os.path.join(out_dir, fname)
    try:
        vl = sc.view_layers[0]
        with bpy.context.temp_override(scene=sc, view_layer=vl):
            bpy.ops.export_scene.gltf(
                filepath=path, export_format='GLB', use_selection=False, use_active_scene=True,
                export_image_format='WEBP', export_image_quality=85,
                export_vertex_color='NAME', export_vertex_color_name='Col', export_all_vertex_colors=False,
                export_apply=False, export_skins=False, export_animations=False, export_yup=True,
                export_cameras=False, export_lights=False,
            )
    finally:
        bpy.data.scenes.remove(sc)
    return {"glb_mb": round(os.path.getsize(path) / 1e6, 3), "objects": len(objs)}


def run_axes(preview_dir=None, out_dir=None):
    out = {}
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            folk_materials()
            if COL_AX in bpy.data.collections:
                for o in list(bpy.data.collections[COL_AX].objects):
                    bpy.data.objects.remove(o, do_unlink=True)
            out["tris"] = build_axes()
            if preview_dir:
                names = ["kirves_parta", "kirves_karjala"]
                obs = [bpy.data.objects[n] for n in names]
                for i, o in enumerate(obs):            # esikatselussa varsi pystyyn, pää ylös
                    o.rotation_euler = (-math.pi / 2, 0, 0)
                    o.location = (i * 0.32, 0, 0)
                bpy.context.view_layer.update()
                sheet(names, os.path.join(preview_dir, "kirveet.png"), yaws=(0, math.pi / 2), w=600, h=900)
                p = os.path.join(preview_dir, "kirveet_paat.png")   # lähikuva päistä: yläosa isosta kuvasta
                sheet(names, p, yaws=(0,), w=1400, h=1400)
                px = load_px(p)
                save_px(px[int(px.shape[0] * 0.62):, :], p, "_crop")
                for o in obs:
                    o.rotation_euler = (0, 0, 0)
                    o.location = (0, 0, 0)
            if out_dir:
                out["glb"] = export_props(out_dir, COL_AX, "kirveet.glb")
    except Exception:
        out["err"] = traceback.format_exc()[-2500:]
    return out


# ---------- hahmot ----------
# Mittasuhteet: (pituus, poikittain) vakiomieheen (1,70 m) verrattuna, kuten CHILD_SCALE.
BUILDS = {
    "tanakka": {
        "scale": {
            "hips": (0.95, 1.22), "spine": (0.94, 1.28), "chest": (0.95, 1.22), "neck": (0.8, 1.3), "head": (0.98, 1.07),
            "upper_arm": (0.92, 1.25), "forearm": (0.92, 1.22), "hand": (0.98, 1.12),
            "finger1": (0.98, 1.12), "finger2": (0.98, 1.12), "finger3": (0.98, 1.12),
            "thigh": (0.91, 1.17), "shin": (0.90, 1.15), "foot": (0.98, 1.12),
        },
        "hair": (0.24, 0.12, 0.06), "skin": (0.70, 0.43, 0.30), "lips": (0.50, 0.28, 0.24),
        "hair_len": 1.44, "beard": True, "baggy": 0.0, "skirt_k": 1.05,
        "trousers": (0.42, 0.30, 0.2), "wraps": (0.55, 0.50, 0.42),
    },
    "hoikka": {
        "scale": {
            "hips": (1.06, 0.9), "spine": (1.08, 0.84), "chest": (1.06, 0.88), "neck": (1.2, 0.86), "head": (1.03, 0.94),
            "upper_arm": (1.1, 0.82), "forearm": (1.1, 0.8), "hand": (1.06, 0.9),
            "finger1": (1.06, 0.9), "finger2": (1.06, 0.9), "finger3": (1.06, 0.9),
            "thigh": (1.13, 0.84), "shin": (1.14, 0.82), "foot": (1.08, 0.92),
        },
        "hair": (0.52, 0.44, 0.30), "skin": (0.76, 0.53, 0.42), "lips": (0.58, 0.36, 0.32),
        "hair_len": 1.36, "beard": False, "baggy": 0.012, "skirt_k": 1.04,
        "trousers": (0.36, 0.36, 0.37), "wraps": (0.62, 0.58, 0.5),
    },
}
NUTTU_LIGHT = (1.0, 0.96, 0.84)        # värjäämätön harmaanbeige villa: erottuu ihosta myös rengaspaidan alla
NUTTU_DARK = (0.12, 0.11, 0.11)        # lähes musta villa
MAIL_COL = (0.85, 0.85, 0.9)
BELT_Z0 = 1.012                        # vyö vakiovartalolla: 7 mm sankaria ylempänä, jotta alareuna ei painu selässä rengashelman alle
BELT_Z = {}                            # hahmo -> vyön korkeus muunnoksen jälkeen (tarkistusta varten)


def trim_small_px(kind, w=256, h=64):
    """Kirjailunauhat. vaalea: luonnonvalkoinen pohja, pienet punaiset vinoneliöt ja ohuet reunaviivat.
    tumma: musta pohja, luonnonvaalea siksak ja punaiset reunaraidat ja pisteet."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    u = (xx / w * 8) % 1.0
    v = yy / h
    red = np.array([0.44, 0.06, 0.05], dtype=np.float32)
    light = np.array([0.74, 0.67, 0.53], dtype=np.float32)
    dark = np.array([0.05, 0.045, 0.05], dtype=np.float32)
    if kind == "vaalea":
        px = np.broadcast_to(light, (h, w, 3)).copy()
        d = np.abs(u - 0.5) + np.abs(v - 0.5) * 1.3
        m = ((d < 0.27) & (d > 0.06)) | (np.abs(v - 0.13) < 0.065) | (np.abs(v - 0.87) < 0.065)
        px[m] = red
    else:
        px = np.broadcast_to(dark, (h, w, 3)).copy()
        px[np.abs(v - (0.32 + 0.36 * np.abs(u - 0.5) * 2)) < 0.07] = light
        px[(np.abs(v - 0.1) < 0.05) | (np.abs(v - 0.9) < 0.05)] = red
        dot = (np.hypot((u - 0.5) * 1.6, v - 0.38) < 0.06) | (np.hypot(np.minimum(u, 1 - u) * 1.6, v - 0.62) < 0.06)
        px[dot] = red
    weave = 0.9 + 0.1 * np.sin(xx * 2.2) * np.sin(yy * 2.2)
    return np.clip(px * weave[..., None], 0, 1)


def pohja_materials():
    folk_materials()
    for k in ("vaalea", "tumma"):
        name = "C_Trim_pohja_" + k
        m = bpy.data.materials.get(name)
        if not m:
            m = pbr(name, img_from_px(trim_small_px(k), "trim_pohja_" + k), None, rough=0.9, twosided=True)
        CM["trim_p" + k[0]] = m          # trim_pv, trim_pt
    return CM


def collar_band(C, mat, off=0.02, width=0.03, z=1.418, tilt=-0.35):
    """Kauluksen kirjailtu nauha kaulan tyveen; edessä hieman alempana kuin takana."""
    keep = lambda i, c: C.arm_frac[i] < 0.2 and abs(c.x) < 0.13
    return [band(C, V((0, 0.0, z)), V((0, tilt, 1)).normalized(), V((0, -1, 0)), width, off, mat,
                 n=26, keep=keep, vspan=(0, 1), tile=0.09)]


def surface_strip(targets, path, width, mat, off=0.003, step=0.012, tile=0.1):
    """Kirjailtu nauha kankaan etupinnalla: path = [(x, z), ...] edestä katsottuna. Pisteet heitetään
    säteellä edestä (+Y) kankaaseen; painot lähimmistä kankaan vertekseistä, joten nauha liikkuu kankaan mukana."""
    co = [c for t in targets for c in t.co]
    ws = [w for t in targets for w in t.w]
    polys, base = [], 0
    for t in targets:
        polys += [tuple(i + base for i in f[0]) for f in t.faces]
        base += len(t.co)
    bvh = BVHTree.FromPolygons([tuple(c) for c in co], polys)
    kd = kdtree.KDTree(len(co))
    for i, c in enumerate(co):
        kd.insert(c, i)
    kd.balance()
    pts = []
    for (x0, z0), (x1, z1) in zip(path, path[1:]):
        n = max(1, int(math.hypot(x1 - x0, z1 - z0) / step))
        pts += [(x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n) for k in range(n)]
    pts.append(path[-1])
    hits = []
    for x, z in pts:
        h = bvh.ray_cast(V((x, -0.6, z)), V((0, 1, 0)), 2.0)
        if h[0] is not None:
            hits.append((h[0], h[1] if h[1].y < 0 else -h[1]))
    p = Part()
    L, R, us, acc = [], [], [], 0.0
    for i, (loc, _) in enumerate(hits):
        nrm = sum((hits[j][1] for j in range(max(0, i - 1), min(len(hits), i + 2))), V()).normalized()
        t = (hits[min(i + 1, len(hits) - 1)][0] - hits[max(i - 1, 0)][0]).normalized()
        side = nrm.cross(t).normalized()
        w = {}
        near = kd.find_n(loc, 3)
        for _, j, _ in near:
            for g, wt in ws[j].items():
                w[g] = w.get(g, 0.0) + wt / len(near)
        c = loc + nrm * off
        L.append(p.v(c + side * width / 2, w))
        R.append(p.v(c - side * width / 2, dict(w)))
        if i:
            acc += (loc - hits[i - 1][0]).length
        us.append(acc / tile)
    for i in range(len(hits) - 1):
        p.f([L[i], R[i], R[i + 1], L[i + 1]], mat, [(us[i], 0), (us[i], 1), (us[i + 1], 1), (us[i + 1], 0)])
    return p


def nuttu_parts(C, kind, k=1.0):
    """Vaihdettava nuttu (runko, hihat, helma, kirjailut). Paksuus sama kuin sankarin pellavatunikalla, joten
    perusosan vyö istuu kummankin päällä ja rengaspaita kummankin päälle."""
    if kind == "vaalea":
        trim = "trim_pv"
        torso = torso_parts(C, "wool", NUTTU_LIGHT, 0.78, inflate=0.013, tile=0.18)
        sk = skirt(C, 0.98, 0.50, 0.012, (0.268 * k, 0.212 * k), "wool", tile=0.18, col=NUTTU_LIGHT, rows=4, trim=trim, trim_h=0.04)
        P = torso + [sk]
        P += cuff_parts(C, 0.775, trim, 0.02, width=0.03)
        P += collar_band(C, trim, width=0.026)
        P.append(surface_strip(torso, [(0.0, 1.40), (0.0, 1.27)], 0.022, trim, tile=0.08))      # rintahalkio
    else:
        trim = "trim_pt"
        torso = torso_parts(C, "wool", NUTTU_DARK, 0.78, inflate=0.013, tile=0.18)
        sk = skirt(C, 0.98, 0.44, 0.012, (0.27 * k, 0.214 * k), "wool", tile=0.18, col=NUTTU_DARK, rows=5, trim=trim, trim_h=0.05)
        P = torso + [sk]
        P += cuff_parts(C, 0.775, trim, 0.021, width=0.05)
        P += collar_band(C, trim, width=0.042, z=1.424)
        # päällekkäisliepeen reuna: kauluksesta vinosti oikealle kupeelle ja helmaa pitkin alas
        P.append(surface_strip(torso, [(-0.03, 1.405), (0.03, 1.30), (0.085, 1.16), (0.10, 1.0)], 0.04, trim))
        P.append(surface_strip([sk], [(0.10, 0.99), (0.105, 0.80), (0.11, 0.49)], 0.04, trim))
    return P


def mail_parts(C, k=1.0):
    M = torso_parts(C, "mail", MAIL_COL, 0.47, inflate=0.03, tile=0.11, smooth=9)
    M += collar_band(C, "leather", off=0.036, width=0.03, z=1.42)          # nahkareunus peittää rosoisen kaula-aukon
    M += [skirt(C, 1.0, 0.57, 0.034, (0.272 * k, 0.217 * k), "mail", tile=0.11, col=MAIL_COL)]
    M += cuff_parts(C, 0.47, "trim_pt", 0.034)
    return M


def warrior_beard(C, color, z_top=1.47, z_bot=1.34, fwd=0.05, depth=0.034):
    """Täysi parta leuasta rinnan yläosaan (long_beard lyhyempänä ja rintaa myötäilevänä)."""
    rng = random.Random(9)
    p = Part()
    cols, rows = 8, 6
    grid = []
    shade = [rng.uniform(0.62, 1.0) for _ in range(cols + 1)]
    tip = [rng.uniform(0.0, 0.03) for _ in range(cols + 1)]
    for j in range(rows + 1):
        s = j / rows
        z = z_top + (z_bot - z_top) * s
        w = 0.058 * (1 - 0.6 * s ** 1.6) + 0.006
        dep = depth * (1 - 0.6 * s)
        y = -0.105 - fwd * math.sin(min(1.0, s * 2.0) * math.pi / 2)
        row = []
        for k in range(cols + 1):
            th = math.radians(-88 + 176 * k / cols)
            wav = 0.004 * math.sin(k * 2.3 + j * 1.1)
            pt = V((math.sin(th) * w, y - math.cos(th) * dep + wav, z - 0.012 * abs(math.sin(th)) * (1 - s) + tip[k] * s * s))
            row.append(p.v(pt, {"head": 1.0} if s < 0.25 else {"head": 0.5, "chest": 0.5}))
        grid.append(row)
    for j in range(rows):
        for k in range(cols):
            sh = (shade[k] + shade[k + 1]) / 2 * (1 - 0.12 * j / rows)
            p.f([grid[j][k], grid[j][k + 1], grid[j + 1][k + 1], grid[j + 1][k]], "hair", None, tuple(x * sh for x in color))
    return [p]


def base_parts(C, b):
    P = skin_parts(C, 0.62, b["hair"], skin=b["skin"], lips=b["lips"])
    thin_brows(P[0], b["skin"], b["hair"], mix=0.7)
    if b["beard"]:
        P += hair_parts(C, b["hair"], length=b["hair_len"], beard=0.017, beard_long=0.03, cap=True)
        P += warrior_beard(C, tuple(x * 0.8 for x in b["hair"]))
    else:
        P += hair_parts(C, b["hair"], length=b["hair_len"], beard=0.0, cap=True)
    P += legs_trousers_wraps(C, "wool", b["trousers"], b["wraps"], baggy=b["baggy"])
    P += legs_shoes(C)
    P += belt_parts(C, z=BELT_Z0, off=0.043, scabbard=False, flange=0.014)
    return P


def sheath_part(top, d, length=SHEATH_LEN, hw=0.031, ht=0.011, n=10, rows=8):
    """Litistetty, kärkeä kohti kapeneva nahkahuotra suuhelalla ja kärkihelalla; painot vain lantioon."""
    R = d.to_track_quat('Z', 'Y').to_matrix()
    w = {"hips": 1.0}
    p = Part()
    rings = []
    for j in range(rows + 1):
        s = j / rows
        c = top + d * (length * s)
        k = 1.0 - 0.3 * s ** 1.5
        rings.append([p.v(c + R @ V((math.cos(2 * math.pi * a / n) * hw * k, math.sin(2 * math.pi * a / n) * ht * k, 0)), w) for a in range(n)])
    bronze, leather = (0.62, 0.42, 0.14), (0.95, 0.85, 0.75)
    for j in range(rows):
        hela = j == 0 or j == rows - 1
        for a in range(n):
            a2 = (a + 1) % n
            p.f([rings[j][a], rings[j][a2], rings[j + 1][a2], rings[j + 1][a]], "metal" if hela else "leather",
                [(a / n, j / rows), ((a + 1) / n, j / rows), ((a + 1) / n, (j + 1) / rows), (a / n, (j + 1) / rows)], bronze if hela else leather)
    p.f(rings[-1], "metal", None, bronze, False)
    return p


def bone_transforms(rig, scale):
    """Luu -> 4x4-matriisi vakiovartalon lepoasennosta hahmon lepoasentoon (kuten child_transforms)."""
    T, heads, tails = {}, {}, {}
    for b in rig.data.bones:
        key = b.name.rsplit("_", 1)[0] if b.name.endswith(("_L", "_R")) else b.name
        l, g = scale[key]
        R = b.matrix_local.to_3x3()
        S = R @ Matrix.Diagonal((g, l, g)) @ R.transposed()
        h0 = b.head_local.copy()
        h1 = (T[b.parent.name] @ h0) if b.parent else h0
        M = Matrix.Translation(h1) @ S.to_4x4() @ Matrix.Translation(-h0)
        T[b.name] = M
        heads[b.name], tails[b.name] = h1, M @ b.tail_local
    return T, heads, tails


def reshape(objs, scale, rig_name, col, z_floor, ground_obj):
    """Kopio luurangosta (rig_name) ja verkkojen + luiden muunnos mittasuhteisiin; sitten maahan niin, että
    ground_obj:n alin verteksi on z_floor:ssa. Palauttaa (T, dz)."""
    src = bpy.data.objects["RIG"]
    remove_obj(rig_name)
    rig = src.copy()
    rig.data = src.data.copy()
    rig.name = rig_name
    get_col(col).objects.link(rig)
    T, heads, tails = bone_transforms(src, scale)
    for ob in objs:
        lbs(ob, T)
    dz = z_floor - min(v.co.z for v in ground_obj.data.vertices)
    for ob in objs:
        for v in ob.data.vertices:
            v.co.z += dz
        ob.data.update()
        ob.parent = rig
        ob.modifiers["Armature"].object = rig
    bpy.context.view_layer.objects.active = rig
    for o in bpy.context.view_layer.objects:
        o.select_set(o is rig)
    bpy.ops.object.mode_set(mode='EDIT')
    for eb in rig.data.edit_bones:
        roll = eb.roll
        eb.head, eb.tail = heads[eb.name] + V((0, 0, dz)), tails[eb.name] + V((0, 0, dz))
        eb.roll = roll
    bpy.ops.object.mode_set(mode='OBJECT')
    return T, dz


def add_mount(name, rig, bone, M, col):
    remove_obj(name)
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 0.06
    e.empty_display_type = 'ARROWS'
    get_col(col).objects.link(e)
    e.parent, e.parent_type, e.parent_bone = rig, 'BONE', bone
    bpy.context.view_layer.update()
    e.matrix_world = M
    return [round(x, 3) for x in M.translation]


def reshaped_body(T, dz, rig, name):
    """Tarkistusta varten: vakiovartalo BODY samalla muunnoksella (ei viedä)."""
    src = bpy.data.objects["BODY"]
    remove_obj(name)
    b = src.copy()
    b.data = src.data.copy()
    b.name = name
    get_col("PV_POHJA").objects.link(b)
    lbs(b, T)
    for v in b.data.vertices:
        v.co.z += dz
    b.data.update()
    b.parent = rig
    for m in b.modifiers:
        if m.type == 'ARMATURE':
            m.object = rig
    b.hide_render = True
    return b


def build_pohja(h):
    """Rakentaa hahmon h ('tanakka' | 'hoikka') kokoelmaan POHJA_<H> omalla luurangollaan RIG_<H>."""
    b = BUILDS[h]
    col, rig_name = "POHJA_" + h.upper(), "RIG_" + h.upper()
    if col in bpy.data.collections:
        for o in list(bpy.data.collections[col].objects):
            bpy.data.objects.remove(o, do_unlink=True)
    C = Ctx()
    pre = "char_" + h
    out = {"tris": {}}
    objs = {}
    for name, parts in (("_base", base_parts(C, b)), ("_nuttu_vaalea", nuttu_parts(C, "vaalea", b["skirt_k"])),
                        ("_nuttu_tumma", nuttu_parts(C, "tumma", b["skirt_k"])), ("_mail", mail_parts(C, b["skirt_k"]))):
        ob, st = assemble(pre + name, parts, col_name=col)
        objs[name] = ob
        out["tris"][pre + name] = st["tris"]
    base = objs["_base"]
    z_floor = min(v.co.z for v in base.data.vertices)
    T, dz = reshape(list(objs.values()), b["scale"], rig_name, col, z_floor, base)
    rig = bpy.data.objects[rig_name]
    off = V((0, 0, dz))
    # kypärä pään mittoihin (ei luurankoa)
    hel, st = assemble("helmet_" + h, helmet_parts(C, 0.142, (0.19, 0.195, 0.205)), col_name=col, rig=False)
    for v in hel.data.vertices:
        v.co = T["head"] @ v.co + off
    hel.data.update()
    out["tris"]["helmet_" + h] = st["tris"]
    # huotra ja kiinnityspisteet: paikka lantion muunnoksella, pituus ja suunta ennallaan (miekka on sama)
    top = T["hips"] @ SHEATH_TOP + off
    sh, st = assemble(pre + "_huotra", [sheath_part(top, SHEATH_D)], col_name=col, rig=True, rig_name=rig_name)
    out["tris"][pre + "_huotra"] = st["tris"]
    R = SHEATH_D.to_track_quat('Z', 'Y').to_matrix() @ Matrix(((1, 0, 0), (0, 0, 1), (0, -1, 0)))
    out["mount_huotra"] = add_mount("mount_huotra", rig, "hips", Matrix.Translation(top - SHEATH_D * 0.06) @ R.to_4x4(), col)
    # kirves vyöllä oikealla kupeella: pää vyön yläpuolella, varsi alas, terä eteen, lappeet sivuille
    belt_z = (T["hips"] @ V((0, 0.02, BELT_Z0))).z + dz
    side = T["hips"] @ V((-0.215, 0.0, BELT_Z0))
    # sarakkeet: X -> -Y, Y -> -Z, Z -> +X; sitten varren alapää 0,15 rad taaksepäin, jotta eteen heilahtava reisi ei osu siihen
    Rk = Matrix.Rotation(0.15, 3, 'X') @ Matrix(((0, 0, 1), (-1, 0, 0), (0, -1, 0)))
    head = V((side.x, side.y, belt_z + 0.05))                  # kirveen silmä 5 cm vyön yläpuolella
    out["mount_kirves"] = add_mount("mount_kirves", rig, "hips", Matrix.Translation(head - Rk @ V((0, -0.575, 0))) @ Rk.to_4x4(), col)
    out["belt_z"] = round(belt_z, 3)
    gp = T["hand_R"] @ GRIP_P + off
    gd = (T["hand_R"].to_3x3() @ GRIP_D).normalized()
    out["grip_channel_R"] = {"p": [round(x, 4) for x in gp], "d": [round(x, 4) for x in gd]}
    out["height"] = round(max(v.co.z for v in base.data.vertices) - z_floor, 3)
    reshaped_body(T, dz, rig, "BODY_" + h.upper())
    return out


def pohja_clearance(h, poses=("rest", "walk", "block", "overhead", "side")):
    """Kerrosten väli kuten char_modular_check.layer_margin, muunnettua BODY-kopiota vasten:
    rengaspaita vs kumpikin nuttu (vyön kaista pois), vyön nahka vs rengaspaita ja nuttu, nutun helma vs housut.
    Negatiivinen = ulompi kerros painuu sisemmän alle. Vertailukohta sankari (mail vs base): lepo -12,9 mm /
    103 verteksiä, ääri-kävely -13,5 mm / 109 verteksiä."""
    rig = bpy.data.objects["RIG_" + h.upper()]
    body = "BODY_" + h.upper()
    pre = "char_" + h
    belt = BELT_Z[h]
    base = bpy.data.objects[pre + "_base"]
    li = [m.name for m in base.data.materials].index(CM["leather"].name)
    bv = {v for pl in base.data.polygons if pl.material_index == li and abs(pl.normal.z) < 0.5 for v in pl.vertices}   # vyön ulkopinta, ei täytelevyjä
    keys = {tuple(round(c, 5) for c in base.data.vertices[i].co) for i in bv
            if abs(base.data.vertices[i].co.z - belt) < 0.035 and abs(base.data.vertices[i].co.x) < 0.3}
    belt_only = lambda p: tuple(round(c, 5) for c in p) in keys
    not_belt = lambda p: not (belt - 0.04 < p.z < belt + 0.045)
    below = lambda p: p.z < belt - 0.06 and abs(p.x) < 0.3
    pairs = [
        ("_mail", "_nuttu_vaalea", not_belt), ("_mail", "_nuttu_tumma", not_belt),
        ("_base", "_mail", belt_only), ("_base", "_nuttu_tumma", belt_only), ("_base", "_nuttu_vaalea", belt_only),
        ("_nuttu_tumma", "_base", below), ("_nuttu_vaalea", "_base", below),
    ]
    out = {}
    try:
        for pose in poses:
            set_pose(rig, pose)
            out[pose] = {f"{a[1:]}>{b_[1:]}".replace("base>", "vyo>"): layer_margin(pre + a, pre + b_, body, reg) for a, b_, reg in pairs}
    finally:
        reset_pose(rig)
    return out


def _show_with(mount, src_name, tmp):
    """Esikatselua varten: kopio aseesta kiinnityspisteeseen."""
    remove_obj(tmp)
    o = bpy.data.objects[src_name].copy()
    o.name = tmp
    get_col("PV_POHJA").objects.link(o)
    o.parent = bpy.data.objects[mount]
    o.matrix_parent_inverse = Matrix.Identity(4)
    o.location, o.rotation_euler, o.scale = (0, 0, 0), (0, 0, 0), (1, 1, 1)
    return o


def run_pohja(h, preview_dir=None, out_dir=None, checks=True):
    out = {}
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            pohja_materials()
            reset_pose(bpy.data.objects["RIG"])
            pose_arms(False)
            out = build_pohja(h)
            BELT_Z[h] = out["belt_z"]
            rig = bpy.data.objects["RIG_" + h.upper()]
            bpy.context.view_layer.update()
            if checks:
                out["clearance"] = pohja_clearance(h)
            pre = "char_" + h
            if preview_dir:
                if "kirves_parta" not in bpy.data.objects:
                    build_axes()
                _show_with("mount_huotra", "sword", "_pv_sword")
                _show_with("mount_kirves", "kirves_parta" if h == "tanakka" else "kirves_karjala", "_pv_axe")
                sets = {
                    "vaalea": [pre + "_base", pre + "_nuttu_vaalea"],
                    "tumma": [pre + "_base", pre + "_nuttu_tumma"],
                    "sotisopa": [pre + "_base", pre + "_nuttu_tumma", pre + "_mail", pre + "_huotra", "_pv_sword", "_pv_axe", "helmet_" + h],
                    "vaalea_mail": [pre + "_base", pre + "_nuttu_vaalea", pre + "_mail", "_pv_axe"],
                }
                reset_pose(rig)
                pose_arms(True, rig=rig.name)
                for k, names in sets.items():
                    sheet(names, os.path.join(preview_dir, "%s_%s.png" % (h, k)), yaws=(0, math.pi / 2, math.pi, -math.pi / 2), w=380, h=760)
                for k in ("vaalea", "tumma"):                    # lähikuva yläkehosta
                    p = os.path.join(preview_dir, "%s_%s_lahi.png" % (h, k))
                    sheet(sets[k], p, yaws=(0, 0.7), w=700, h=1400)
                    px = load_px(p)
                    save_px(px[int(px.shape[0] * 0.55):, :], p, "_crop")
                set_pose(rig, "walk")
                sheet(sets["sotisopa"][:-1], os.path.join(preview_dir, "%s_walk.png" % h), yaws=(0, math.pi / 2, -math.pi / 2), w=380, h=760)
                for n in ("_pv_sword", "_pv_axe"):
                    remove_obj(n)
            reset_pose(rig)
            remove_obj("BODY_" + h.upper())
            if out_dir:
                out["glb"] = export_folk(out_dir, "POHJA_" + h.upper(), rig.name, "pohja_%s.glb" % h)
    except Exception:
        out["err"] = traceback.format_exc()[-2500:]
    return out
