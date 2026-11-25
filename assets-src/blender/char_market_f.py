"""Markkinapaikan naiset: juhla-asuinen emäntä ja arkisesti puettu nuori nainen (vain assetit, ei vielä pelissä).

Sama naisvartalo (BODY_F) ja luuranko (RIG_F) kuin jousineidolla, emännällä ja Louhella, joten peli voi
animoida hahmot samalla koodilla (lepoasento, luiden kierrot ja roll ennallaan, ei uusia luita).
Tiedosto assets/marketfolk_f.glb (kokoelma MARKETFOLK_F); luuranko viedään nimellä RIG kuten
villagers_f.glb:ssä (export_folk). Origo maan tasossa jalkojen välissä, kasvot -Y:hen (pelissä +Z).
Pituus noin 1,70 m kuten muillakin naisilla (peli voi pienentää sijoittaessaan, esim. 0,95).

  char_emanta_markkina  Sama emäntä kuin char_emanta (samat kasvot, iho, harmaantuva tukka ja vartalo),
                        markkina- ja juhla-asussa Euran ja Karjalan muinaispukujen henkeen:
                        syvänsininen villamekko, punainen villainen hartiavaate olkapäillä (reunassa
                        pronssispiraalinauha, kiinni kaulan alla pyöreällä pronssisoljella), sininen
                        esiliina vyötäröltä, jonka helmassa ja sivuilla pronssispiraalikaistat, kaksi
                        kupurasolkea rinnalla ja niiden välissä kolme helyketjua (alimmassa helyt),
                        punavalkoinen kudottu vyö pronssihelain ja puukko, valkoinen pellavahuntu ja sen
                        päällä spiraalikoristeinen otsanauha. Hihansuissa spiraalinauhat.
  char_nainen_arki      Uusi nuori työihminen: punertava pitkä palmikko selässä, yksinkertainen
                        sininen otsanauha, kapeampi ja nuorempi kasvojen alaosa, poskipuna.
                        Harmaanruskea hihaton villamekko (peplos) U-kauluksella, pellavainen alusmekko
                        hihat kyynärvarteen käärittyinä, karkea koristeeton pellavaesiliina,
                        ruosteenpunainen kudottu vyö ja puukko, villasukat ja nahkakengät. Ainoa koru on
                        pieni pyöreä pronssisolki alusmekon kaula-aukossa.

Uusi materiaali: M_MK_Trim_spiral (numpylla laskettu 512 x 256 -kuva: alapuolisko sininen, yläpuolisko
punainen pohja, pronssiset kierukkalangat, siksak ja spiraalit). Muut materiaalit ovat hahmojen
yhteisiä (C_*). Värit verteksiväreinä.

Törmäysehdotus pelille (kumpikin hahmo): pystysylinteri tai ympyrä säde 0,30 m keskellä origoa
(emännän hartiavaate ja helma ulottuvat noin 0,30 m:n päähän keskeltä, arkisen naisen 0,27 m),
korkeus 1,72 m. Ei kiinnityspisteitä (kädet vapaat; peli voi käyttää jousineidon kanavia).

Aja taustalla characters.blendin KOPIOLLA (lähdetiedostoa ei muuteta eikä tallenneta):
    blender --background kopio.blend --python ajo.py
    ajo.py: FOLK_DIR = r"...\\assets-src\\blender"
            exec(open(FOLK_DIR + r"\\char_market_f.py", encoding="utf-8").read())
            print(run_market_f(preview_dir=..., out_dir=r"...\\assets", save=False))
Ympäristömuuttujat: KALEVALA_TEXDIR (tekstuurikansio; rinnakkaisajoissa oma kopio), KALEVALA_ASSETS_OUT
ja KALEVALA_PREVIEW (oletuspolut, jos parametreja ei anneta).
"""
import os, io, contextlib, traceback, math, random

_MB = globals().get("FOLK_DIR") or (os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else r"C:\Data\3D Kalevala\assets-src\blender")
FOLK_DIR = _MB
exec(open(os.path.join(_MB, "char_pohja.py"), encoding="utf-8").read())      # -> lapsi, seppä, char_folk, tarkistukset
exec(open(os.path.join(_MB, "char_louhi.py"), encoding="utf-8").read())      # ellipsoid, loft
TEXDIR = os.environ.get("KALEVALA_TEXDIR", TEXDIR)
import numpy as np
from mathutils.bvhtree import BVHTree

COL_MF = "MARKETFOLK_F"
PV_MF = "PV_MARKET_F"
RIGF = FEM["rig"]
PV_W, PV_H = (260, 520) if os.environ.get("MK_SMALL") == "1" else (380, 760)     # tarkistuskuvien koko

# Pelin kyläläisasennot (src/folk.ts, three.js: y ylös, eteen +z) Blenderin akseleihin: (x, -z, y).
GAME_ARMS = {
    "lepo": ((0.14, -1, 0.02), (0.08, -1, 0.16)),           # ARM_DOWN
    "laulu": ((0.96, 0.16, 0.08), (0.98, 0.08, 0.12)),      # singArms
    "osuma": ((0.35, -0.72, -0.5), (0.38, -0.42, -0.62)),   # hitArms
}

# Värit (lineaarisia, kerrotaan tekstuurilla)
EM = {"hair": (0.62, 0.58, 0.5), "skin": (0.72, 0.5, 0.39), "lips": (0.5, 0.27, 0.24),   # = build_emanta
      "dress": (0.035, 0.05, 0.13), "apron": (0.07, 0.12, 0.30), "shawl": (0.36, 0.05, 0.035),
      "veil": (0.86, 0.85, 0.82), "collar": (0.9, 0.88, 0.8), "sock": (0.3, 0.12, 0.08)}
AR = {"hair": (0.36, 0.14, 0.06), "skin": (0.78, 0.56, 0.44), "lips": (0.62, 0.33, 0.30),
      "dress": (0.26, 0.24, 0.21), "linen": (0.74, 0.72, 0.66), "apron": (0.85, 0.85, 0.8),
      "belt": (0.30, 0.11, 0.05), "band": (0.34, 0.09, 0.05), "sock": (0.42, 0.36, 0.28)}
AR_LINEN = AR["linen"]
BRONZE, GOLD = (0.55, 0.36, 0.12), (0.7, 0.5, 0.16)
TRIM_BLUE, TRIM_RED = (0.0, 0.5), (0.5, 1.0)        # spiraalikuvan v-alueet


# ---------- materiaalit ----------
def _lin(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def _srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def _tex_mean_lin(mat):
    """Materiaalin diffuusikuvan keskiväri lineaarisena (kerrotaan verteksivärillä kuten varjostin)."""
    for nd in mat.node_tree.nodes:
        if nd.type == 'TEX_IMAGE' and nd.image and nd.image.colorspace_settings.name == "sRGB":
            px = get_px(nd.image)[..., :3].reshape(-1, 3)
            return _lin(px).mean(axis=0)
    return np.array([0.5, 0.5, 0.5])


def spiral_band_px(base, w=512, h=128):
    """Pronssispiraalikoristelu (Euran puvun tapaan): reunoilla kierukkalankarivit, välissä siksak ja
    kolmioiden sisällä kierukkaspiraalit. base = pohjaväri sRGB-arvoina. Yksi kuvio = h x h pikseliä."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    s = (xx / h) % 1.0
    t = yy / h
    px = np.broadcast_to(np.array(base, dtype=np.float32), (h, w, 3)).copy()
    stripe = 0.5 + 0.5 * np.sin(xx * 2 * np.pi / 5.0)                       # kierukan langat
    m = (np.abs(t - 0.1) < 0.055) | (np.abs(t - 0.9) < 0.055)
    tz = 0.24 + 0.52 * (1 - np.abs(2 * s - 1))
    m |= np.abs(t - tz) * 0.69 < 0.042
    for cx, cy in ((0.5, 0.37), (0.0, 0.63), (1.0, 0.63)):
        dx, dy = s - cx, t - cy
        rho = np.hypot(dx, dy)
        val = (rho / 0.05 - np.arctan2(dy, dx) / (2 * np.pi)) % 1.0
        m |= (rho < 0.135) & (np.abs(val - 0.5) < 0.26)
    edge = np.zeros_like(m)
    for d in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        edge |= np.roll(m, d, axis=(0, 1))
    edge &= ~m
    bronze = np.array([0.82, 0.6, 0.29], dtype=np.float32)
    px[edge] *= 0.45
    shade = (0.6 + 0.4 * stripe)[..., None]
    px = np.where(m[..., None], bronze * shade, px)
    weave = 0.92 + 0.08 * np.sin(xx * 2.2) * np.sin(yy * 2.2)
    return np.clip(px * weave[..., None], 0, 1)


def market_f_materials():
    folk_materials()
    wool = _tex_mean_lin(CM["wool"])
    blue = _srgb(wool * np.array(EM["apron"]))
    red = _srgb(wool * np.array(EM["shawl"]))
    img = np.concatenate([spiral_band_px(blue), spiral_band_px(red)], axis=0)     # rivi 0 = v 0 (sininen)
    CM["trim_spiral"] = pbr("M_MK_Trim_spiral", img_from_px(img, "mk_trim_spiral"), None, rough=0.6, twosided=True)
    return CM


# ---------- asennot ----------
def _b(v):
    return V((v[0], -v[2], v[1])).normalized()


def _rot_bone(rig, name, R3):
    pb = rig.pose.bones[name]
    h = pb.head.copy()
    pb.matrix = Matrix.Translation(h) @ R3.to_4x4() @ Matrix.Translation(-h) @ pb.matrix
    bpy.context.view_layer.update()


def aim_arms(rig, upper, fore):
    """Kuten folk.ts:n aimBone: olka- ja kyynärvarren luu osoittamaan annettuun suuntaan (x peilataan)."""
    for sfx in ("L", "R"):
        s = 1 if rig.pose.bones["upper_arm_" + sfx].head.x > 0 else -1
        for bn, d in (("upper_arm_", upper), ("forearm_", fore)):
            pb = rig.pose.bones[bn + sfx]
            tgt = _b(d)
            tgt.x *= s
            cur = (pb.tail - pb.head).normalized()
            _rot_bone(rig, bn + sfx, cur.rotation_difference(tgt).to_matrix())


def mk_pose(rig, name):
    """lepo / laulu / osuma = pelin käsiasennot; kavely = lepo + POSES['walk'] (jalat ja käsien heilahdus);
    walk = char_modular_check.py:n vakiokävely (kädet mallin lepoasennosta), vertailuluvuiksi."""
    reset_pose(rig)
    if name == "rest":
        return
    if name == "walk":
        set_pose(rig, "walk")
        return
    aim_arms(rig, *GAME_ARMS["lepo" if name == "kavely" else name])
    if name == "kavely":
        for bone, ax, ang in POSES["walk"]:
            _rot_bone(rig, bone, Matrix.Rotation(ang, 3, AX[ax]))


def posed_body(rig, poses):
    """BODY_F:n verteksit annetuissa asennoissa (numpy-taulukot)."""
    body = bpy.data.objects[FEM["body"]]
    tmp = None
    if not any(m.type == 'ARMATURE' and m.object == rig for m in body.modifiers):
        tmp = body.modifiers.new("_tmp_arm", 'ARMATURE')
        tmp.object = rig
    out = {}
    try:
        for nm in poses:
            mk_pose(rig, nm)
            dg = bpy.context.evaluated_depsgraph_get()
            ev = body.evaluated_get(dg)
            me = ev.to_mesh()
            mw = ev.matrix_world
            out[nm] = np.array([tuple(mw @ v.co) for v in me.vertices], dtype=np.float64)
            ev.to_mesh_clear()
    finally:
        reset_pose(rig)
        if tmp:
            body.modifiers.remove(tmp)
    return out


# ---------- apurit ----------
class Surf:
    """Kankaan pinta (Partit lepoasennossa) säteenheittoa, painoja ja välimittauksia varten."""
    def __init__(self, parts):
        self.co, self.ws, polys = [], [], []
        for t in parts:
            base = len(self.co)
            self.co += t.co
            self.ws += t.w
            polys += [tuple(i + base for i in f[0]) for f in t.faces]
        self.bvh = BVHTree.FromPolygons([tuple(c) for c in self.co], polys)
        self.kd = kdtree.KDTree(len(self.co))
        for i, c in enumerate(self.co):
            self.kd.insert(c, i)
        self.kd.balance()

    def hit(self, x, z, back=False):
        o = V((x, 0.6 if back else -0.6, z))
        d = V((0, -1 if back else 1, 0))
        loc, nrm, _, _ = self.bvh.ray_cast(o, d, 2.0)
        if loc is None:
            return None
        if nrm.dot(d) > 0:
            nrm = -nrm
        return loc, nrm.normalized()

    def weight(self, p, k=3):
        acc = {}
        hits = self.kd.find_n(p, k)
        for _, j, _ in hits:
            for g, w in self.ws[j].items():
                acc[g] = acc.get(g, 0.0) + w / len(hits)
        return acc

    def gap(self, p):
        """Etäisyys pinnasta, negatiivinen jos piste on pinnan sisäpuolella (vartalon akselia kohti)."""
        loc, _, _, d = self.bvh.find_nearest(p)
        out = V((loc.x, loc.y - 0.02, 0))
        return d if (p - loc).dot(out) >= 0 else -d


def fix_arm_weights(parts, bone):
    """Hihansuun nauha liikkuu vain käsivarren mukana: band() ottaa painot lähimmistä vartalon
    vertekseistä, jolloin käden viereen ulottuva rengas saa lantion/reiden painoja ja venyy, kun
    peli laskee kädet alas. Puoli valitaan x:n merkistä (+X = vasen)."""
    for p in parts:
        p.w = [{bone + ("_L" if c.x > 0 else "_R"): 1.0} for c in p.co]
    return parts


def rigid(parts, w=None):
    """Vyö jäykästi lantioon (band():n lähimmät painot osuisivat reisiin ja käsiin)."""
    for p in parts:
        p.w = [dict(w or {"hips": 0.8, "spine": 0.2}) for _ in p.co]
    return parts


def strip_arms(C, parts):
    """Kopio osista ilman käsivarsiin painotettuja tahkoja (kerrosvälin mittaukseen)."""
    out = []
    for p in parts:
        q = Part()
        q.co, q.w = p.co, p.w
        armw = [sum(v for k, v in w.items() if k.rsplit("_", 1)[0] in ARM) for w in p.w]
        q.faces = [f for f in p.faces if sum(armw[i] for i in f[0]) / len(f[0]) < 0.5]
        out.append(q)
    return out


def neutral(key, target):
    """Verteksiväri, jolla materiaalin tekstuurin keskiväri x väri = target (lineaarinen). Jersey-kuva on
    persikansävyinen, joten valkoinen pellava näytti iholta; enintään 1,0."""
    m = _tex_mean_lin(CM[key])
    c = np.array(target) / np.maximum(m, 1e-3)
    c = c / max(1.0, float(c.max()))
    return tuple(round(float(x), 4) for x in c)


def recolor(part, col):
    part.faces = [(i, m, uv, col, sm) for i, m, uv, _, sm in part.faces]
    return part


def dome(c0, out, xdir, rx, ry, h, w, cols, n=14, base_off=0.003):
    """Kupera solki: soikea kupu pinnan suuntaisesti (out = pinnan normaali). cols = värit renkaittain
    ulkoreunasta keskelle. Pohjalevy sulkee kuvun, joten sivulta ei näe läpi."""
    X = (xdir - out * xdir.dot(out)).normalized()
    U = out.cross(X).normalized()
    prof = [(1.0, 0.0), (0.97, 0.3), (0.82, 0.58), (0.55, 0.83), (0.25, 0.96), (0.0, 1.0)]
    p = Part()
    rings = []
    for rho, hh in prof:
        base = c0 + out * (base_off + h * hh)
        if rho == 0:
            rings.append([p.v(base, dict(w))])
            continue
        rings.append([p.v(base + X * (rx * rho * math.cos(2 * math.pi * k / n)) + U * (ry * rho * math.sin(2 * math.pi * k / n)), dict(w)) for k in range(n)])
    for j in range(len(rings) - 1):
        c = cols[min(j, len(cols) - 1)]
        a, b = rings[j], rings[j + 1]
        for k in range(n):
            k2 = (k + 1) % n
            if len(b) == 1:
                p.f([a[k], a[k2], b[0]], "metal", None, c)
            else:
                p.f([a[k], a[k2], b[k2], b[k]], "metal", None, c)
    p.f(list(reversed(rings[0])), "metal", None, tuple(x * 0.5 for x in cols[0]), False)
    return p, [p.co[i] for i in rings[0]]


def sleeve_cuff(C, sleeve, off, width, mat, col=(1, 1, 1), v=(0, 1), tile=None, rows=1, inset=0.4):
    """Hihansuun nauha hihan päähän. Akseli otetaan kyynärvarren luusta (RIG_F), koska naisvartalon
    maamerkkien ranne on sivussa ja cuff_parts():n rengas leikkasi käsivarren vinosti (iso irrallinen
    rengas, kun kädet lasketaan). Paikka = hihan kuoren kauimmainen kohta kyynärvarren suunnassa."""
    rig = bpy.data.objects[C.rig]
    parts = []
    for sfx, s in (("L", 1), ("R", -1)):
        b = rig.data.bones["forearm_" + sfx]
        h, t = b.head_local.copy(), b.tail_local.copy()
        a = (t - h).normalized()
        end = max((c - h).dot(a) for q in sleeve for c in q.co if c.x * s > 0.12 and (c - h).dot(a) > -0.1
                  and ((c - h) - a * (c - h).dot(a)).length < 0.08)
        keep = lambda i, c, s=s: c.x * s > 0.12 and C.arm_frac[i] > 0.5
        p = band(C, h + a * (end - width * inset), a, V((0, -1, 0)), width, off, mat, n=14, keep=keep, col=col,
                 vspan=v, tile=tile or width / 0.25, rows=rows)
        p.w = [{"forearm_" + sfx: 1.0} for _ in p.co]
        parts.append(p)
    return parts


def belt_knife(D, z, x=0.125, ex=0.042, sheath=(0.95, 0.85, 0.75), handle=(1.0, 0.9, 0.7), chape=None):
    """Puukko tupessa vyöltä riippumassa (kuten emanta_belt)."""
    hip = {"hips": 1.0}
    top = D.surf(x, z - 0.03, ex)
    R = Matrix.Rotation(-0.1, 3, 'Y')
    parts = [box_part(top + V((0, 0, -0.10)), (0.034, 0.018, 0.17), "leather", hip, sheath, R),
             tube_part([top, top + V((-0.007, 0, 0.085))], [0.012, 0.014], 6, "wood", hip, handle)]
    if chape:
        parts.append(box_part(top + R @ V((0, 0, -0.175)), (0.037, 0.021, 0.03), "metal", hip, chape, R))
    return parts


# ---------- emännän juhla-asu ----------
def veil_parts(C, col, z_end=1.465):
    """Valkoinen pellavahuntu: päälaki, sivut ja niska kaulan tyveen asti, kasvot auki; takana nuttura
    (sykerö) huntu alla pyöreänä kumpuna. headscarf_parts lyhennettynä ja kevyemmin levenevänä."""
    n = 24
    ax, ref = V((0, 0, 1)), V((0, -1, 0))
    ztop = max(c.z for c in C.co)
    spec = [(ztop - 0.012, 0), (1.655, 0), (1.635, 0), (1.612, 0), (1.59, 58), (1.56, 62), (1.53, 66), (1.50, 78), (z_end, 96)]
    p = Part()
    rings, prev = [], None
    for j, (z, g) in enumerate(spec):
        cy = -0.02 if z > 1.47 else -0.02 + 0.04 * min(1.0, (1.47 - z) / 0.1)
        keep = (lambda i, c: C.arm_frac[i] < 0.2 and abs(c.x) < 0.13)
        rad, e1, e2 = ring_profile(C, V((0, cy, z)), ax, ref, n, slab=0.012 if z > 1.6 else 0.02, keep=keep)
        g = math.radians(g)
        ring, cur = [], []
        for k in range(n + 1):
            a = g + (2 * math.pi - 2 * g) * k / n
            r = _interp(rad, a) + 0.036 + 0.026 * smoothstep(1.53, z_end, z)
            if 1.50 < z < 1.625 and abs(math.cos(a)) < 0.2 or (1.50 < z < 1.625 and math.cos(a) < 0):
                s = min(1.0, max(0.0, (1.605 - z) / 0.055))           # hair_parts-verhon säde (satunnaisvaihtelu mukaan)
                rho = 0.107 + 0.045 * s
                re = 1.0 / math.sqrt((math.sin(a) / (0.92 * rho)) ** 2 + (math.cos(a) / (1.08 * rho)) ** 2)
                r = max(r, re + 0.015 * math.cos(a) + 0.01)
            r += 0.03 * math.exp(-((a - math.pi) / 0.55) ** 2 - ((z - 1.56) / 0.04) ** 2)     # nuttura
            if prev and z < 1.56:
                r = max(r, prev[k] * 0.985)
            cur.append(r)
            rr = r * (1 + 0.035 * math.sin(a * 11) * smoothstep(1.55, z_end, z))
            pt = V((0, cy, z)) + (e1 * math.cos(a) + e2 * math.sin(a)) * rr
            t = smoothstep(1.50, 1.44, z)
            ring.append(p.v(pt, {"head": 1.0} if t <= 0 else {"head": 1 - 0.5 * t, "neck": 0.5 * t}))
        prev = cur
        rings.append(ring)
    apex = p.v(V((0, -0.02, ztop + 0.018)), {"head": 1.0})
    for k in range(n):
        p.f([apex, rings[0][k + 1], rings[0][k]], "jersey", [(0.5, 0), ((k + 1) / n * 4, 0.2), (k / n * 4, 0.2)], col)
    for j in range(len(spec) - 1):
        for k in range(n):
            sh = 0.95 + 0.05 * math.sin(k * 1.9 + j)
            uv = [(k / n * 4, spec[j][0] / 0.12), ((k + 1) / n * 4, spec[j][0] / 0.12), ((k + 1) / n * 4, spec[j + 1][0] / 0.12), (k / n * 4, spec[j + 1][0] / 0.12)]
            p.f([rings[j][k], rings[j][k + 1], rings[j + 1][k + 1], rings[j + 1][k]], "jersey", uv, tuple(x * sh for x in col))
    keep = lambda i, c: c.z > 1.5 and C.arm_frac[i] < 0.2
    w = 0.034
    hb = band(C, V((0, -0.03, 1.622)), V((0, 0.14, 1)).normalized(), V((0, -1, 0)), w, 0.040, "trim_spiral", n=22, keep=keep, vspan=TRIM_RED, tile=w / 0.25)
    return [p], [hb]


SHAWL_ZS = [1.445, 1.42, 1.395, 1.37, 1.34, 1.30, 1.26, 1.22, 1.18, 1.14, 1.10, 1.06, 1.02, 0.98, 0.94, 0.90]
SHAWL_XE = [(1.445, 0.004), (1.43, 0.012), (1.415, 0.035), (1.40, 0.075), (1.38, 0.115), (1.36, 0.14), (1.32, 0.16), (1.25, 0.17), (0.8, 0.18)]


def _bins(P, z, n, slab=0.025, cy=0.02):
    Q = P[np.abs(P[:, 2] - z) < slab]
    out = np.zeros(n)
    if len(Q):
        dx, dy = Q[:, 0], Q[:, 1] - cy
        r = np.hypot(dx, dy)
        k = r < 0.45
        a = np.arctan2(dx[k], -dy[k]) % (2 * np.pi)
        np.maximum.at(out, (a / (2 * np.pi) * n).astype(int) % n, r[k])
    if (out > 0).any():
        out[out == 0] = out[out > 0].mean()
    return out


class ShawlSurf:
    """Hartiavaatteen pinta: säde kulman ja korkeuden funktiona (kuten Drape). Säde = vartalo + väli,
    kun vartalo on koottu lepoasennon ylävartalosta ja käsistä pelin asennoissa (kädet alhaalla, kävely,
    osuma), joten vaate kulkee käsivarsien ulkopuolelta. Hartioiden alapuolella kangas putoaa suoraan."""
    def __init__(self, P, n=48):
        self.n, self.zs, self.rows = n, SHAWL_ZS, []
        prev = None
        for z in self.zs:
            raw = _bins(P, z, n) + (0.036 if z >= 1.36 else 0.048)
            front = np.maximum(0, np.cos((np.arange(n) + 0.5) / n * 2 * np.pi))
            raw += 0.012 * smoothstep(1.40, 1.445, z) * front          # kaulan alla mekon kaulus
            if prev is not None and z < 1.37:
                raw = np.maximum(raw, prev * 0.998)
            r = raw.copy()
            for _ in range(2):
                r = (np.roll(r, 1) + 2 * r + np.roll(r, -1)) / 4
            r = np.maximum(r, raw - 0.003)
            self.rows.append(list(r))
            prev = r

    def r(self, a, z):
        zs = self.zs
        if z >= zs[0]:
            return _interp(self.rows[0], a)
        for j in range(len(zs) - 1):
            if zs[j] >= z >= zs[j + 1]:
                t = (zs[j] - z) / (zs[j] - zs[j + 1])
                return _interp(self.rows[j], a) * (1 - t) + _interp(self.rows[j + 1], a) * t
        return _interp(self.rows[-1], a)

    def at(self, a, z, extra=0.0):
        R = self.r(a, z) + extra
        return V((math.sin(a) * R, 0.02 - math.cos(a) * R, z))


def _pw(tab, z):
    """Paloittain lineaarinen tab = [(z, arvo), ...] z laskevassa järjestyksessä."""
    if z >= tab[0][0]:
        return tab[0][1]
    for (z0, v0), (z1, v1) in zip(tab, tab[1:]):
        if z0 >= z >= z1:
            return v0 + (v1 - v0) * (z0 - z) / (z0 - z1)
    return tab[-1][1]


def shawl_parts(S, col, trim_v=TRIM_RED, ncol=60, nrow=11, band_h=0.05):
    """Hartiavaate: villahuivi olkapäillä ja selässä, edessä auki (aukko SHAWL_XE), kolmiokärki selässä.
    Koko reuna (etureunat ja helma) pronssispiraalinauhaa. Painot rinta/selkä korkeuden mukaan (_zw)."""
    z0 = SHAWL_ZS[0]
    hem = lambda a: 1.18 + 0.04 * max(0.0, math.cos(a)) - 0.22 * max(0.0, -math.cos(a)) ** 1.6

    def open_a(z):
        a = 0.05
        for _ in range(5):
            a = math.asin(min(0.99, _pw(SHAWL_XE, z) / S.r(a, z)))
        return a

    def col_pt(u, t):
        z, a = z0, 0.0
        for _ in range(4):
            g = open_a(z)
            a = g + (2 * math.pi - 2 * g) * u
            z = z0 + (hem(a) - z0) * t
        return a, z

    rng = random.Random(17)
    fold = [rng.uniform(0.6, 1.0) for _ in range(ncol + 1)]
    p = Part()
    grid, AZ = [], []
    for j in range(nrow + 2):
        row, az = [], []
        for k in range(ncol + 1):
            if j <= nrow:
                a, z = col_pt(k / ncol, (j / nrow) ** 1.15)
            else:
                a, z = AZ[-1][k][0], AZ[-1][k][1] - band_h
            s = min(1.0, (z0 - z) / 0.25)
            r = S.r(a, z) * (1 + 0.04 * s * (0.5 + 0.5 * math.sin(a * 14 + 1.0)) * fold[k])
            pt = V((math.sin(a) * r, 0.02 - math.cos(a) * r, z + 0.006 * math.sin(a * 5) * s))
            row.append(p.v(pt, _zw(z)))
            az.append((a, z, r))
        grid.append(row)
        AZ.append(az)
    v0, v1 = trim_v
    for j in range(nrow + 1):
        for k in range(ncol):
            q = [grid[j][k], grid[j + 1][k], grid[j + 1][k + 1], grid[j][k + 1]]
            (aa, za, ra), (ab, zb, rb) = AZ[j][k], AZ[j + 1][k + 1]
            if j == nrow:                                   # helmanauha
                ua, ub = aa * ra / band_h * 0.25, ab * rb / band_h * 0.25
                p.f(q, "trim_spiral", [(ua, v1), (ua, v0), (ub, v0), (ub, v1)])
            elif k in (0, ncol - 1):                         # etureunat: u pystysuunnassa
                vi, vo = (v0, v1) if k == 0 else (v1, v0)
                p.f(q, "trim_spiral", [(za * 10, vi), (zb * 10, vi), (zb * 10, vo), (za * 10, vo)])
            else:
                c = tuple(x * (0.86 + 0.14 * fold[k]) for x in col)
                p.f(q, "wool", [(aa * 0.25 / 0.14, za / 0.14), (aa * 0.25 / 0.14, zb / 0.14), (ab * 0.25 / 0.14, zb / 0.14), (ab * 0.25 / 0.14, za / 0.14)], c)
    return [p]


def eura_apron(D, col, z_top=1.075, z_bot=0.36, extra=0.025, hem_h=0.09, side_w=0.03, trim_v=TRIM_BLUE, mat="wool", plain_edge=None):
    """Esiliina vain edessä vyöltä sääriin. Euran malli: helmassa ja sivuilla pronssispiraalikaistat
    (trim_v). plain_edge = väri: koristeeton (arkiesiliina), reunat vain tummempaa kangasta."""
    zs = [z_top, D.z_top, 0.96, 0.88, 0.80, 0.72, 0.64, 0.56, 0.50, z_bot + hem_h, z_bot]
    hw = lambda z: 0.11 if z >= D.z_top else 0.12 + 0.11 * (D.z_top - z) / (D.z_top - z_bot)
    def xs(z):
        h = hw(max(z, z_bot))
        return [-h, -h + side_w, -0.6 * h, -0.3 * h, 0.0, 0.3 * h, 0.6 * h, h - side_w, h]
    p = Part()
    grid = []
    for j, z in enumerate(zs):
        row = []
        for i, x in enumerate(xs(z)):
            ex = extra + 0.003 * math.sin(x * 37 + z * 9) * (1 if 0 < i < 8 else 0)
            pt = D.surf(x, z, ex)
            row.append(p.v(pt, D.weight(pt)))
        grid.append(row)
    nk = 8
    v0, v1 = trim_v
    for j in range(len(zs) - 1):
        hem = j == len(zs) - 2
        for k in range(nk):
            q = [grid[j][k], grid[j + 1][k], grid[j + 1][k + 1], grid[j][k + 1]]
            xa, xb = xs(zs[j])[k], xs(zs[j + 1])[k + 1]
            side = k in (0, nk - 1)
            if plain_edge is not None:
                c = plain_edge if (hem or side) else col
                p.f(q, mat, [(xa * 4, zs[j] / 0.14), (xa * 4, zs[j + 1] / 0.14), (xb * 4, zs[j + 1] / 0.14), (xb * 4, zs[j] / 0.14)], c)
            elif hem:
                ua, ub = xa / hem_h * 0.25, xb / hem_h * 0.25
                p.f(q, "trim_spiral", [(ua, v1), (ua, v0), (ub, v0), (ub, v1)])
            elif side:
                vi, vo = (v0, v1) if k == 0 else (v1, v0)
                ua, ub = zs[j] / side_w * 0.25, zs[j + 1] / side_w * 0.25
                p.f(q, "trim_spiral", [(ua, vi), (ub, vi), (ub, vo), (ua, vo)])
            else:
                p.f(q, mat, [(xa * 4, zs[j] / 0.14), (xa * 4, zs[j + 1] / 0.14), (xb * 4, zs[j + 1] / 0.14), (xb * 4, zs[j] / 0.14)], col)
    return [p]


def festive_belt(C, D, z=1.04, off=0.07, width=0.05):
    """Punavalkoinen kudottu vyö esiliinan päällä, edessä pronssihelat ja solki."""
    keep = lambda i, c: abs(c.x) < 0.2 and C.arm_frac[i] < 0.3
    parts = rigid([band(C, V((0, 0.02, z)), V((0, 0, 1)), V((0, -1, 0)), width, off, "trim_tri", keep=keep, vspan=(0, 1), tile=0.2)])
    hip = {"hips": 1.0}
    ex = off - 0.034 + 0.003                 # vyön pinta Drapen kehyksessä (Drapen väli 0,034)
    for i in range(11):
        x = -0.15 + 0.03 * i
        if abs(x) < 0.02:
            continue
        c = D.surf(x, z, ex)
        out = V((c.x, c.y - 0.02, 0)).normalized()
        tang = V((0, 0, 1)).cross(out)
        R = Matrix((tang, out, V((0, 0, 1)))).transposed()
        parts.append(box_part(c, (0.012, 0.006, 0.03), "metal", hip, BRONZE, R))
    c = D.surf(0.0, z, ex + 0.002)
    parts.append(box_part(c, (0.04, 0.008, 0.044), "metal", hip, GOLD))          # solki
    parts += belt_knife(D, z, x=0.13, ex=0.044, chape=BRONZE)
    return parts


def brooch_chain_parts(dress_surf, shawl_surf):
    """Kaksi kupurasolkea rinnalla, kolme helyketjua niiden välissä (alimmassa helyt) ja pyöreä solki
    hartiavaatteen kiinnikkeenä kaulan alla. Sijainnit säteellä mekon (ja huivin) pinnasta, painot
    lähimmistä mekon vertekseistä. Palauttaa (osat, mittausaineisto)."""
    parts, meas = [], {"chains": [], "brooch_bases": [], "pendants": [], "round": []}
    xs, zb = 0.082, 1.335
    for s in (1, -1):
        loc, nrm = dress_surf.hit(xs * s, zb)
        w = dress_surf.weight(loc)
        b, base = dome(loc, nrm, V((1, 0, 0)), 0.026, 0.037, 0.019, w, [BRONZE, GOLD, BRONZE, GOLD, (0.8, 0.6, 0.22)])
        parts.append(b)
        meas["brooch_bases"].append(base)
    xa, za = xs - 0.006, zb - 0.026                          # ketjut lähtevät soljen alareunasta
    for ci, sag in enumerate((0.04, 0.075, 0.11)):
        pts, rad, cen = [], [], []
        for i in range(21):
            u = -1 + 2 * i / 20
            h = dress_surf.hit(u * xa, za - sag * (1 - u * u))
            r = 0.0032 if i % 2 else 0.0024
            pts.append(h[0] + h[1] * (0.0032 + 0.0025))
            rad.append(r)
            cen.append((pts[-1], 0.0032))
        w = dress_surf.weight(pts[10])
        parts.append(tube_part(pts, rad, 4, "metal", w, GOLD, cap=False))
        meas["chains"].append(cen)
        if ci == 2:                                          # helyt alimmassa ketjussa
            for i in range(3, 18, 2):
                top = pts[i]
                u = -1 + 2 * i / 20
                hb = dress_surf.hit(u * xa, top.z - 0.026)
                bot = hb[0] + hb[1] * 0.0035
                side = V((1, 0, 0))
                pp = Part()
                q = [pp.v(top + side * 0.0035, w), pp.v(top - side * 0.0035, w), pp.v(bot - side * 0.0075, w), pp.v(bot + side * 0.0075, w)]
                pp.f(q, "metal", None, GOLD)
                pp.f(list(reversed(q)), "metal", None, BRONZE)
                parts.append(pp)
                meas["pendants"].append(bot)
    # pyöreä solki kaulan alla hartiavaatteen kulmien päällä
    zr = 1.428
    c0 = shawl_surf.at(0.0, zr, 0.0)
    tz = shawl_surf.at(0.0, zr + 0.01) - shawl_surf.at(0.0, zr - 0.01)
    out = V((1, 0, 0)).cross(tz).normalized()
    if out.y > 0:
        out = -out
    rb, base = dome(c0, out, V((1, 0, 0)), 0.026, 0.026, 0.009, {"chest": 1.0}, [GOLD, BRONZE, GOLD, BRONZE, GOLD], n=16, base_off=0.002)
    parts.append(rb)
    meas["round"] = base
    return parts, meas


def build_emanta_markkina(C, rig, P_union):
    D = Drape(C, 1.04, 0.17, 0.034, (0.37, 0.33))
    L = {}
    L["head"] = skin_parts(C, 0.9, EM["hair"], skin=EM["skin"], lips=EM["lips"], face=(-0.008, 0.002), carve=False)
    L["head"] += hair_parts(C, EM["hair"], length=1.55, beard=0, cap=True)
    veil, hb = veil_parts(C, neutral("jersey", EM["veil"]))
    L["veil"] = veil + hb
    torso = torso_parts(C, "wool", EM["dress"], 0.93, inflate=0.024, tile=0.14, smooth=10, collar=EM["collar"], baggy=0.016)
    L["dress"] = torso + [drape_skirt(D, "wool", EM["dress"])]
    L["dress"] += [skirt(C, 0.30, 0.115, 0.0, (0.36, 0.32), "jersey", tile=0.14, col=neutral("jersey", (0.8, 0.79, 0.75)), rows=2)]   # alushelma
    L["cuffs"] = sleeve_cuff(C, torso, 0.036, 0.04, "trim_spiral", v=TRIM_BLUE)
    L["shoes"] = shoes_parts(C, EM["sock"])
    L["apron"] = transfer_weights(eura_apron(D, EM["apron"]), [L["dress"][1]])
    S = ShawlSurf(P_union)
    L["shawl"] = shawl_parts(S, EM["shawl"])
    dsurf = Surf(torso)
    L["metal"], meas = brooch_chain_parts(dsurf, S)
    L["belt"] = festive_belt(C, D)
    P = [q for k in ("head", "veil", "dress", "cuffs", "shoes", "apron", "shawl", "metal", "belt") for q in L[k]]
    ob, st = assemble("char_emanta_markkina", P, col_name=COL_MF, rig_name=RIGF)
    return ob, st, L, {"dress_torso": dsurf, "shawl": S, "meas": meas, "D": D}


# ---------- arkinen nainen ----------
def young_face(head, eye_z, k_z=0.05, k_x=0.06, k_y=0.10, fy=-0.09):
    """Nuoremmat kasvot (kuten child_face, lievempänä): silmien alapuoli matalammaksi ja kapeammaksi,
    nenä ja leuka vähemmän ulkonevat. Kerrotaan head-painolla, joten kaula ei muutu."""
    for i, c in enumerate(head.co):
        w = head.w[i].get("head", 0.0)
        if w <= 0:
            continue
        if c.z < eye_z:
            ramp = smoothstep(eye_z, eye_z - 0.025, c.z)
            c.z = eye_z + (c.z - eye_z) * (1 - k_z * w)
            c.x *= 1 - k_x * w * ramp
        if c.y < fy:
            c.y = fy + (c.y - fy) * (1 - k_y * w)


def blush(head, eye_z, col=(0.82, 0.42, 0.36), amt=0.3):
    new = []
    for idx, mat, uvs, c, sm in head.faces:
        q = sum((head.co[i] for i in idx), V()) / len(idx)
        t = 0.0
        if q.y < -0.085:
            t = math.exp(-((abs(q.x) - 0.048) / 0.016) ** 2 - ((q.z - (eye_z - 0.035)) / 0.014) ** 2) * amt
        if t > 0.01:
            c = tuple(c[k] * (1 - t) + col[k] * t for k in range(3))
        new.append((idx, mat, uvs, c, sm))
    head.faces = new


def peplos_parts(C, col):
    """Hihaton villamekko: U-kaula-aukko edessä (alusmekko näkyy), olkapäät peitetty lyhyesti."""
    def sel(i, c):
        if C.arm_frac[i] > 0.5:
            return C.arm_t(c) < 0.10
        if c.z < 0.95 or C.leg_frac[i] > 0.6:
            return False
        if C.w[i].get("neck", 0) + C.w[i].get("head", 0) >= 0.55:
            return False
        top = 1.43
        if c.y < -0.02:
            top -= 0.075 * smoothstep(0.11, 0.0, abs(c.x))
        return c.z < top
    return [shell(C, sel, lambda c: 0.032 + 0.012 * smoothstep(1.3, 1.1, c.z), "wool", tile=0.14, smooth=10, col=col)]


def back_braid(C, surf, color, z_end=1.09):
    """Pitkä palmikko niskasta selkää pitkin vyötärölle; säde pinnasta (mekko, alusmekko, niska)."""
    pts = [V((0, 0.055, 1.565)), V((0, 0.083, 1.52))]
    zz = 1.485
    while zz > z_end - 1e-6:
        h = surf.hit(0.0, zz, back=True)
        t = (1.485 - zz) / (1.485 - z_end)
        pts.append(h[0] + h[1] * (0.021 - 0.007 * t + 0.005 + 0.008 * smoothstep(1.36, 1.42, zz)))
        zz -= 0.04
    dense = []
    for a, b in zip(pts, pts[1:]):
        for i in range(3):
            dense.append(a.lerp(b, i / 3))
    dense.append(pts[-1])
    parts = []
    nseg = len(dense) - 1
    for i in range(nseg):
        t = i / nseg
        r0 = (0.021 - 0.007 * t) * (1.0 if i % 2 else 0.8)
        r1 = (0.021 - 0.007 * (i + 1) / nseg) * (0.8 if i % 2 else 1.0)
        z = dense[i].z
        w = {"head": 1.0} if z > 1.50 else {"head": 0.35, "neck": 0.35, "chest": 0.3} if z > 1.44 else surf.weight(dense[i])
        sh = 0.8 + 0.2 * (i % 2)
        parts.append(tube_part([dense[i], dense[i + 1]], [r0, r1], 7, "hair", w, tuple(x * sh for x in color), cap=False))
    end = dense[-1]
    w = surf.weight(end)
    parts.append(tube_part([end + V((0, 0, 0.01)), end + V((0, 0, -0.012))], [0.0145, 0.0145], 6, "leather", w, (0.6, 0.4, 0.25)))
    parts.append(tube_part([end + V((0, 0, -0.012)), end + V((0, 0.006, -0.075))], [0.013, 0.003], 6, "hair", w, tuple(x * 0.85 for x in color)))
    return parts


def work_belt(C, D, z=1.04, off=0.066, width=0.036):
    keep = lambda i, c: abs(c.x) < 0.2 and C.arm_frac[i] < 0.3
    parts = rigid([band(C, V((0, 0.02, z)), V((0, 0, 1)), V((0, -1, 0)), width, off, "wool", keep=keep, col=AR["belt"], tile=0.1)])
    hip = {"hips": 1.0}
    ex = off - 0.032 + 0.004
    for x0, zb in ((0.03, 0.86), (0.055, 0.89)):            # solmun päät
        p = Part()
        w = 0.026
        zs = [z, z - 0.05, 0.5 * (z + zb), zb]
        ids = [(p.v(D.surf(x0, zz, ex), hip), p.v(D.surf(x0 + w, zz, ex), hip)) for zz in zs]
        for (a0, a1), (b0, b1), za, zc in zip(ids, ids[1:], zs, zs[1:]):
            p.f([a0, b0, b1, a1], "wool", [(0, za / 0.1), (0, zc / 0.1), (1, zc / 0.1), (1, za / 0.1)], AR["belt"])
        parts.append(p)
    parts += belt_knife(D, z, x=0.128, ex=0.04, sheath=(0.8, 0.68, 0.58), handle=(0.85, 0.72, 0.55))
    return parts


def build_nainen_arki(C, rig, eye_z):
    D = Drape(C, 1.04, 0.15, 0.032, (0.38, 0.34))
    L = {}
    head = skin_parts(C, 0.6, AR["hair"], skin=AR["skin"], lips=AR["lips"], face=(-0.008, 0.002), carve=False)
    young_face(head[0], eye_z)
    blush(head[0], eye_z)
    L["head"] = head + hair_parts(C, AR["hair"], length=1.50, beard=0, cap=True)
    keep = lambda i, c: c.z > 1.5 and C.arm_frac[i] < 0.2
    L["band"] = [band(C, V((0, -0.03, 1.622)), V((0, 0.0, 1)), V((0, -1, 0)), 0.02, 0.017, "wool", n=22, keep=keep, col=AR["band"], vspan=(0, 1), tile=0.08)]
    AR["linen"] = neutral("jersey", AR_LINEN)
    chem = torso_parts(C, "jersey", AR["linen"], 0.66, inflate=0.011, tile=0.12, smooth=4, collar=None)
    L["chemise"] = chem + sleeve_cuff(C, chem, 0.026, 0.05, "jersey", col=AR["linen"], tile=0.08, rows=2, inset=0.3)
    L["chemise"] += sleeve_cuff(C, chem, 0.031, 0.026, "jersey", col=tuple(x * 0.88 for x in AR["linen"]), tile=0.08, inset=0.9)
    pep = peplos_parts(C, AR["dress"])
    L["peplos"] = pep
    L["skirt"] = [drape_skirt(D, "wool", AR["dress"])]
    L["shoes"] = shoes_parts(C, AR["sock"])
    L["apron"] = eura_apron(D, AR["apron"], z_top=1.07, z_bot=0.44, extra=0.022, hem_h=0.03, side_w=0.02, mat="hessian",
                            plain_edge=tuple(x * 0.8 for x in AR["apron"]))
    transfer_weights(L["apron"], L["skirt"])
    L["belt"] = work_belt(C, D)
    csurf = Surf(chem)
    loc, nrm = csurf.hit(0.0, 1.385)
    br, base = dome(loc, nrm, V((1, 0, 0)), 0.013, 0.013, 0.005, csurf.weight(loc), [BRONZE, GOLD, BRONZE, GOLD], n=12)
    L["brooch"] = [br]
    bsurf = Surf(pep + chem + [head[0]])
    L["braid"] = back_braid(C, bsurf, AR["hair"])
    P = [q for k in ("head", "band", "chemise", "peplos", "skirt", "shoes", "apron", "belt", "brooch", "braid") for q in L[k]]
    ob, st = assemble("char_nainen_arki", P, col_name=COL_MF, rig_name=RIGF)
    return ob, st, L, {"chem": csurf, "brooch_base": base, "D": D}


# ---------- tarkistus ----------
def _layer(name, parts):
    return assemble(name, parts, col_name=PV_MF, rig_name=RIGF)[0]


def body_pen(outer, body=None):
    """Kangas vartalon sisällä (läpimeno): verteksit, joiden etäisyys vartalon pinnasta on negatiivinen
    pinnan normaalin suhteen. Palauttaa määrän ja syvimmän (mm)."""
    dg = bpy.context.evaluated_depsgraph_get()
    bb = BVHTree.FromObject(bpy.data.objects[body or FEM["body"]], dg)
    ob = bpy.data.objects[outer]
    ev = ob.evaluated_get(dg)
    me = ev.to_mesh()
    worst, n, at = 0.0, 0, None
    for v in me.vertices:
        p = ev.matrix_world @ v.co
        loc, nrm, _, d = bb.find_nearest(p)
        if loc is None or d > 0.05:
            continue
        sd = (p - loc).dot(nrm)
        if sd < 0:
            n += 1
            if sd < worst:
                worst, at = sd, [round(x, 3) for x in p]
    ev.to_mesh_clear()
    return {"inside": n, "worst_mm": round(worst * 1000, 1), "at": at}


def metal_gaps(meas, dress_surf, shawl_parts_):
    """Ketjujen, helyjen ja solkien etäisyys kankaasta (mm). Ketju: keskilinjan etäisyys - säde."""
    out = {}
    for i, cen in enumerate(meas["chains"]):
        g = [dress_surf.gap(p) - r for p, r in cen]
        out["ketju%d" % (i + 1)] = {"min_mm": round(min(g) * 1000, 1), "max_mm": round(max(g) * 1000, 1)}
    g = [dress_surf.gap(p) for base in meas["brooch_bases"] for p in base]
    out["kupurasoljet_pohja"] = {"min_mm": round(min(g) * 1000, 1), "max_mm": round(max(g) * 1000, 1)}
    g = [dress_surf.gap(p) for p in meas["pendants"]]
    out["helyt_alapaa"] = {"min_mm": round(min(g) * 1000, 1), "max_mm": round(max(g) * 1000, 1)}
    ss = Surf(shawl_parts_)
    g = [ss.gap(p) for p in meas["round"] if p.z > 1.415]          # yläpuolisko on huivin kulmien päällä
    out["pyorea_solki_vs_huivi"] = {"min_mm": round(min(g) * 1000, 1), "max_mm": round(max(g) * 1000, 1)}
    g = [dress_surf.gap(p) for p in meas["round"]]
    out["pyorea_solki_vs_mekko"] = {"min_mm": round(min(g) * 1000, 1)}
    return out


CHECK_POSES = ("lepo", "kavely", "walk", "osuma", "laulu")


def check_emanta(L, aux, rig):
    names = {}
    for k, parts in (("dress", L["dress"] + L["cuffs"]), ("apron", L["apron"]), ("shawl", L["shawl"]), ("belt", L["belt"][:1]),
                     ("veil", L["veil"][:1]), ("head", L["head"]), ("under_belt", strip_arms(None, L["dress"][:1]) + L["dress"][1:] + L["apron"])):
        names[k] = _layer("_mk_e_" + k, parts).name
    skirt_only = _layer("_mk_e_skirt", [L["dress"][1]]).name
    below = lambda p: p.z < 1.0
    res = {}
    for pose in CHECK_POSES:
        mk_pose(rig, pose)
        r = {"esiliina>mekko": layer_margin(names["apron"], names["dress"], FEM["body"], below),
             "huivi>mekko": layer_margin(names["shawl"], names["dress"], FEM["body"]),
             "vyo>esiliina+mekko": layer_margin(names["belt"], names["under_belt"], FEM["body"]),
             "huntu>pää": layer_margin(names["veil"], names["head"], FEM["body"]),
             "helma_vs_vartalo": body_pen(skirt_only),
             "esiliina_vs_vartalo": body_pen(names["apron"])}
        res[pose] = r
    reset_pose(rig)
    res["metalli_lepo"] = metal_gaps(aux["meas"], aux["dress_torso"], L["shawl"])
    return res


def check_arki(L, aux, rig):
    names = {}
    for k, parts in (("chem", strip_arms(None, L["chemise"])), ("pep", L["peplos"]), ("skirt", L["skirt"]), ("apron", L["apron"]),
                     ("belt", L["belt"][:1]), ("under_belt", L["peplos"] + L["skirt"] + L["apron"]),
                     ("braid", L["braid"]), ("back", L["peplos"] + L["chemise"] + L["head"][:1]), ("head", L["head"]), ("band", L["band"])):
        names[k] = _layer("_mk_a_" + k, parts).name
    below = lambda p: p.z < 1.0
    res = {}
    for pose in CHECK_POSES:
        mk_pose(rig, pose)
        res[pose] = {"peplos>alusmekko": layer_margin(names["pep"], names["chem"], FEM["body"]),
                     "esiliina>hame": layer_margin(names["apron"], names["skirt"], FEM["body"], below),
                     "vyo>esiliina+mekko": layer_margin(names["belt"], names["under_belt"], FEM["body"]),
                     "palmikko>selka": layer_margin(names["braid"], names["back"], FEM["body"], lambda p: p.z < 1.5),
                     "otsanauha>hiukset": layer_margin(names["band"], names["head"], FEM["body"]),
                     "helma_vs_vartalo": body_pen(names["skirt"]),
                     "esiliina_vs_vartalo": body_pen(names["apron"])}
    reset_pose(rig)
    g = [aux["chem"].gap(p) for p in aux["brooch_base"]]
    res["solki_lepo"] = {"min_mm": round(min(g) * 1000, 1), "max_mm": round(max(g) * 1000, 1)}
    return res


# ---------- esikatselu ----------
def static_copy(name, new, dx=0.0, dy=0.0):
    dg = bpy.context.evaluated_depsgraph_get()
    ob = bpy.data.objects[name]
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), depsgraph=dg)
    remove_obj(new)
    o = bpy.data.objects.new(new, me)
    get_col(PV_MF).objects.link(o)
    o.matrix_world = Matrix.Translation(V((dx, dy, 0))) @ ob.matrix_world
    return o


def persp_shot(names, path, target, dist=6.5, elev=35.0, yaw=0.0, w=1600, h=900, lens=85, bg=(0.55, 0.57, 0.6)):
    """Pelikameran tapainen kuva: perspektiivi, elev astetta alaspäin, dist metrin päästä."""
    sc = _setup_scene(w, h)
    sun = _sun()
    sun.rotation_euler = (math.radians(55), 0, yaw + math.radians(35))
    targets = [bpy.data.objects[n] for n in names]
    hidden = {}
    for o in bpy.data.objects:
        hidden[o.name] = o.hide_render
        o.hide_render = o not in targets and o is not sun
    e = math.radians(elev)
    cd = bpy.data.cameras.new("PvCam")
    cd.lens = lens
    cam = bpy.data.objects.new("PvCam", cd)
    sc.collection.objects.link(cam)
    cam.location = target + V((math.sin(yaw) * math.cos(e), -math.cos(yaw) * math.cos(e), math.sin(e))) * dist
    cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam
    tmp = path + "_tmp.png"
    sc.render.filepath = tmp
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam, do_unlink=True)
    for o in bpy.data.objects:
        if o.name in hidden:
            o.hide_render = hidden[o.name]
    px = load_px(tmp)
    os.remove(tmp)
    a = px[..., 3:4]
    rgb = px[..., :3] * a + np.array(bg, dtype=np.float32) * (1 - a)
    old = bpy.data.images.get("_persp")
    if old:
        bpy.data.images.remove(old)
    save_px(np.concatenate([rgb, np.ones_like(a)], axis=-1), path, "_persp")
    return path


def previews(pv, rig):
    os.makedirs(pv, exist_ok=True)
    out = []
    for n in ("char_emanta_markkina", "char_nainen_arki"):
        short = n[5:]
        mk_pose(rig, "lepo")
        out.append(sheet([n], os.path.join(pv, short + "_lepo.png"), yaws=(0, math.pi / 2, math.pi, -math.pi / 2), w=PV_W, h=PV_H))
        p = os.path.join(pv, short + "_lahi.png")
        sheet([n], p, yaws=(0, 0.7, math.pi), w=700, h=1400)
        px = load_px(p)
        save_px(px[int(px.shape[0] * 0.52):, :], p, "_crop")
        out.append(p)
        mk_pose(rig, "kavely")
        out.append(sheet([n], os.path.join(pv, short + "_kavely.png"), yaws=(0, 0.6, math.pi / 2, -math.pi / 2), w=PV_W, h=PV_H))
        mk_pose(rig, "laulu")
        out.append(sheet([n], os.path.join(pv, short + "_laulu.png"), yaws=(0, math.pi / 2), w=500, h=760))
    # vertailu: uusi emäntä, vanha emäntä, arkinen nainen samassa ruudussa (kädet alhaalla)
    mk_pose(rig, "lepo")
    trio = [("char_emanta_markkina", "_cmp_a", -0.75), ("char_emanta", "_cmp_b", 0.0), ("char_nainen_arki", "_cmp_c", 0.75)]
    for n, new, dx in trio:
        static_copy(n, new, dx=dx)
    tiles = []
    for i, yaw in enumerate((0.0, math.pi)):
        tp = os.path.join(pv, "_t%d.png" % i)
        sheet([t[1] for t in trio], tp, yaws=(yaw,), w=900, h=760)
        tiles.append(load_px(tp))
        os.remove(tp)
    p = os.path.join(pv, "vertailu_edessa_takana.png")
    save_px(np.concatenate(tiles, axis=1), p, "_cmp")
    out.append(p)
    for n, new, dx in trio:                                   # sivukuva: rivi syvyyssuunnassa
        bpy.data.objects[new].matrix_world = Matrix.Translation(V((0, dx * 1.2, 0))) @ bpy.data.objects[n].matrix_world
    out.append(sheet([t[1] for t in trio], os.path.join(pv, "vertailu_sivu.png"), yaws=(math.pi / 2,), w=900, h=760))
    for n, new, dx in trio:
        bpy.data.objects[new].matrix_world = Matrix.Translation(V((dx, 0, 0))) @ bpy.data.objects[n].matrix_world
    tgt = V((0, 0, 0.9))
    out.append(persp_shot([t[1] for t in trio], os.path.join(pv, "vertailu_pelikamera.png"), tgt, dist=6.5, elev=35, yaw=0.35))
    out.append(persp_shot([t[1] for t in trio], os.path.join(pv, "vertailu_pelikamera_taka.png"), tgt, dist=6.5, elev=35, yaw=math.pi - 0.5))
    # lähikuvat koruista: emännän rinta ylhäältä viistosti
    out.append(persp_shot(["_cmp_a"], os.path.join(pv, "emanta_markkina_korut.png"), V((-0.75, 0, 1.3)), dist=1.1, elev=20, yaw=0.25, w=1200, h=900, lens=50))
    out.append(persp_shot(["_cmp_c"], os.path.join(pv, "nainen_arki_kasvot.png"), V((0.75, 0, 1.45)), dist=0.9, elev=10, yaw=0.35, w=1200, h=900, lens=50))
    out.append(persp_shot(["_cmp_b"], os.path.join(pv, "emanta_vanha_kasvot.png"), V((0.0, 0, 1.52)), dist=0.7, elev=8, yaw=0.3, w=1000, h=900, lens=50))
    out.append(persp_shot(["_cmp_a"], os.path.join(pv, "emanta_markkina_kasvot.png"), V((-0.75, 0, 1.52)), dist=0.7, elev=8, yaw=0.3, w=1000, h=900, lens=50))
    reset_pose(rig)
    return out


def _bbox(ob):
    pts = [ob.matrix_world @ V(c) for c in ob.bound_box]
    mn = [min(p[i] for p in pts) for i in range(3)]
    mx = [max(p[i] for p in pts) for i in range(3)]
    return {"min": [round(x, 3) for x in mn], "max": [round(x, 3) for x in mx]}


def run_market_f(preview_dir=None, out_dir=None, save=False, checks=True):
    preview_dir = preview_dir or os.environ.get("KALEVALA_PREVIEW")
    out_dir = out_dir or os.environ.get("KALEVALA_ASSETS_OUT")
    out = {"tris": {}}
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            market_f_materials()
            if FEM["body"] not in bpy.data.objects or RIGF not in bpy.data.objects:
                build_base_f()
            rig = bpy.data.objects[RIGF]
            for cn in (COL_MF, PV_MF):
                if cn in bpy.data.collections:
                    for o in list(bpy.data.collections[cn].objects):
                        bpy.data.objects.remove(o, do_unlink=True)
            reset_pose(rig)
            C = Ctx(FEM["body"], FEM["src"], RIGF, FEM_P, fem_xf())
            # ylävartalo lepoasennosta + kädet pelin asennoista (hartiavaatteen säde)
            posed = posed_body(rig, ("lepo", "kavely", "walk"))
            body_co = np.array([tuple(c) for c in C.co])
            arm = np.array(C.arm_frac) > 0.3
            torso = (~arm) & (np.array(C.leg_frac) < 0.6) & np.array([w.get("head", 0) < 0.5 for w in C.w])
            P_union = np.concatenate([body_co[torso]] + [posed[k][arm & (posed[k][:, 2] > 1.06)] for k in posed])
            eye_z = sum((C.xf @ bpy.data.objects[C.src + s].matrix_local).translation.z for s in (".eye.L", ".eye.R")) / 2
            ob_e, st_e, L_e, aux_e = build_emanta_markkina(C, rig, P_union)
            ob_a, st_a, L_a, aux_a = build_nainen_arki(C, rig, eye_z)
            out["tris"] = {"char_emanta_markkina": st_e["tris"], "char_nainen_arki": st_a["tris"]}
            out["mats"] = {"char_emanta_markkina": [m.name for m in ob_e.data.materials], "char_nainen_arki": [m.name for m in ob_a.data.materials]}
            out["bbox"] = {o.name: _bbox(o) for o in (ob_e, ob_a)}
            out["eye_z"] = round(eye_z, 4)
            bpy.context.view_layer.update()
            if checks:
                out["clearance"] = {"emanta": check_emanta(L_e, aux_e, rig), "arki": check_arki(L_a, aux_a, rig)}
            if preview_dir:
                out["previews"] = previews(preview_dir, rig)
            reset_pose(rig)
            if PV_MF in bpy.data.collections:
                for o in list(bpy.data.collections[PV_MF].objects):
                    bpy.data.objects.remove(o, do_unlink=True)
            if save:
                bpy.ops.wm.save_mainfile()
            if out_dir:
                out["glb"] = export_folk(out_dir, COL_MF, RIGF, "marketfolk_f.glb")
    except Exception:
        out["err"] = traceback.format_exc()[-2500:]
    return out
