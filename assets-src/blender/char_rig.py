"""Hahmojen yhteinen vartalo ja luuranko.

Lähde: Blender Studion Human Base Meshes (CC0), objekti GEO-body_male_realistic
SRC-kokoelmassa. Tämä tiedosto:
  - kopioi vartalon työmalliksi BODY (ilman multires-muokkainta)
  - koukistaa sormet nyrkkiin, jotta ase istuu käteen
  - rakentaa pelin luurangon RIG (17 luuta, nimet ilman pisteitä glTF:ää varten)
  - laskee painot automaattisesti (heat weights)
Blender: Z ylös, hahmo katsoo -Y:hen, hahmon vasen käsi on +X:ssä.
"""
import bpy, bmesh, math
import numpy as np
from mathutils import Vector, Matrix, kdtree

V = Vector


def smoothstep(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def get_col(name, parent=None):
    c = bpy.data.collections.get(name)
    if not c:
        c = bpy.data.collections.new(name)
        (parent or bpy.context.scene.collection).children.link(c)
    return c


def remove_obj(name):
    o = bpy.data.objects.get(name)
    if o:
        bpy.data.objects.remove(o, do_unlink=True)


def make_body():
    src = bpy.data.objects["GEO-body_male_realistic"]
    remove_obj("BODY")
    me = src.data.copy()
    me.name = "BODY"
    ob = bpy.data.objects.new("BODY", me)
    get_col("WORK").objects.link(ob)
    for p in me.polygons:
        p.use_smooth = True
    return ob


def landmarks(ob, P=None, xf=None):
    """Nivelpisteet vartalon geometriasta (vasen puoli, +X). Oikea peilataan.
    P korvaa käsin asetetut pisteet (shoulder, hip, hips, spine, chest, neck, head) ja polven
    korkeuden (knee_z); xf on lähdemallin verteksien muunnos (4x4), jos malli ei ole paikallaan."""
    P = P or {}
    co = np.array([(xf @ v.co)[:] if xf else v.co[:] for v in ob.data.vertices])
    L = {}
    def cen(mask):
        return V(co[mask].mean(axis=0))
    # käsivarsi: olkapäästä sormenpäähän
    tip = V(co[np.argmax(co[:, 0])])
    sh = V(P.get("shoulder", (0.175, 0.025, 1.39)))
    axis = (tip - sh)
    alen = axis.length
    a = axis.normalized()
    rel = co - np.array(sh)
    t = rel @ np.array(a) / alen
    radial = np.linalg.norm(rel - np.outer(t * alen, np.array(a)), axis=1)
    arm = (co[:, 0] > 0.19) & (radial < 0.12)
    L["shoulder"] = sh
    L["elbow"] = cen(arm & (t > 0.40) & (t < 0.46))
    L["wrist"] = cen(arm & (t > 0.77) & (t < 0.81))
    L["knuckle"] = cen(arm & (t > 0.91) & (t < 0.95))
    L["fingertip"] = tip
    # jalka
    leg = co[:, 0] > 0.015
    L["hip"] = V(P.get("hip", (0.095, 0.02, 0.93)))
    kz = P.get("knee_z", 0.50)
    L["knee"] = cen(leg & (co[:, 2] > kz - 0.03) & (co[:, 2] < kz + 0.03))
    L["ankle"] = cen(leg & (co[:, 2] > 0.07) & (co[:, 2] < 0.11) & (co[:, 1] > -0.02))
    foot = leg & (co[:, 2] < 0.06)
    L["toe"] = V((float(co[foot][:, 0].mean()), float(co[foot][:, 1].min()), 0.02))
    # selkäranka ja pää
    L["hips"] = V(P.get("hips", (0, 0.02, 0.96)))
    L["spine"] = V(P.get("spine", (0, 0.02, 1.08)))
    L["chest"] = V(P.get("chest", (0, 0.015, 1.22)))
    L["neck"] = V(P.get("neck", (0, 0.0, 1.43)))
    L["head"] = V(P.get("head", (0, -0.02, 1.50)))
    L["head_top"] = V((0, -0.03, float(co[:, 2].max())))
    head = co[:, 2] > 1.46
    L["nose_tip"] = V(co[head][np.argmin(co[head][:, 1])])
    return L


FINGER_J = (0.0, 0.04, 0.07)           # nivelten paikat rystysistä sormenpäitä kohti (m)
FINGER_ANG = (1.25, 1.5, 0.9)          # nyrkkiin koukistuksen kulmat (rad)
FINGER_TIP = 0.105                     # sormenpään etäisyys rystysistä
FINGER_BONES = [f"finger{i}_{s}" for s in ("L", "R") for i in (1, 2, 3)]


def finger_setup(co, L, side=1):
    """Sormien valinta ja kehys koukistamattomasta vartalosta (co = verteksien paikat järjestyksessä).
    side=1 vasen (+X), -1 oikea. Palauttaa kehyksen, josta nyrkkiin koukistus ja sormiluiden painot
    lasketaan samoilla luvuilla."""
    mir = lambda p: V((p.x * side, p.y, p.z))
    W, K = mir(L["wrist"]), mir(L["knuckle"])
    a = (mir(L["fingertip"]) - mir(L["shoulder"])).normalized()
    idx = [i for i, p in enumerate(co)
           if p.x * side > 0.2 and (p - W).dot(a) > -0.02 and (p - (W + a * (p - W).dot(a))).length < 0.13]
    pts = np.array([co[i][:] for i in idx])
    c = pts - pts.mean(axis=0)
    _, vec = np.linalg.eigh(c.T @ c)
    n = V(vec[:, 0])            # kämmenen normaali
    n = (n - a * n.dot(a)).normalized()
    if n.x * side > 0:          # osoittamaan vartaloa kohti = kämmenen puoli
        n = -n
    axis = n.cross(a).normalized()
    d = np.array([(V(p) - K).dot(a) for p in pts])          # etäisyys rystysistä sormenpäitä kohti
    off = np.array([(V(p) - K).dot(axis) for p in pts])
    back = d < -0.03
    thumb_sign = 1 if off[back].max() > -off[back].min() else -1
    thumb = []
    for i in range(len(idx)):
        o = off[i] * thumb_sign
        thumb.append(bool((o > 0.040 and d[i] < 0.025) or (o > 0.030 and d[i] < -0.015)))
    return {"idx": idx, "pts": pts, "a": a, "axis": axis, "K": K, "d": d, "thumb": thumb, "side": side}


def finger_ks(dd):
    """Nivelten koukistusosuudet (0..1) etäisyydellä dd rystysistä; myöhempi nivel vaikuttaa vain, jos edellinen on."""
    out = []
    for j0 in FINGER_J:
        k = smoothstep(j0 - 0.01, j0 + 0.01, dd)
        if k <= 0:
            break
        out.append(k)
    return out


def curl_fingers_chain(ob, L, side=1, angles=FINGER_ANG):
    """Koukistaa sormet nyrkkiin: kolme niveltä (rystyset, keski- ja kärkinivel),
    joista jokainen kiertää kärkipuolensa kämmentä kohti. Peukalo jää paikalleen.
    side=1 vasen (+X), -1 oikea."""
    me = ob.data
    S = finger_setup([v.co.copy() for v in me.vertices], L, side)
    K, a, axis, d = S["K"], S["a"], S["axis"], S["d"]
    out = []
    for i, p0 in enumerate(S["pts"]):
        p = V(p0)
        if S["thumb"][i]:
            out.append(p)       # peukalo
            continue
        M = Matrix.Identity(4)
        for j0, ang, k in zip(FINGER_J, angles, finger_ks(d[i])):
            piv = K + a * j0
            M = M @ Matrix.Translation(piv) @ Matrix.Rotation(-ang * k, 4, axis) @ Matrix.Translation(-piv)
        out.append(M @ p)
    for vi, p in zip(S["idx"], out):
        me.vertices[vi].co = p
    me.update()
    return {"count": len(S["idx"]), "thumb_sign": None}


def finger_joints(S, angles=FINGER_ANG):
    """Sormiluiden nivelet koukistetussa (lepo)asennossa: rystyset, kaksi niveltä ja sormenpää."""
    K, a, axis = S["K"], S["a"], S["axis"]
    P = [K + a * j for j in FINGER_J]
    Ms = [Matrix.Translation(p) @ Matrix.Rotation(-ang, 4, axis) @ Matrix.Translation(-p) for p, ang in zip(P, angles)]
    tip = K + a * FINGER_TIP
    return [P[0], Ms[0] @ P[1], Ms[0] @ Ms[1] @ P[2], Ms[0] @ Ms[1] @ Ms[2] @ tip]


def add_fingers(body, rig, co_straight, L):
    """Lisää luurankoon sormiluut (finger1..3 kummallekin kädelle) ja jakaa vartalon sormien painot niille.
    Lepoasento on nyrkki, kuten ennenkin: luut ovat koukistetun sormen mukaisessa asennossa, ja sormien
    avaaminen on luun kierto sen paikallisen Z-akselin ympäri (Z = koukistuksen akseli).
    co_straight = vartalon verteksit ennen koukistusta."""
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    setups = {s: finger_setup(co_straight, L, 1 if s == "L" else -1) for s in ("L", "R")}
    bpy.ops.object.mode_set(mode='EDIT')
    eb = rig.data.edit_bones
    for s, S in setups.items():
        J = finger_joints(S)
        for i in range(3):
            nm = f"finger{i + 1}_{s}"
            if nm in eb:
                eb.remove(eb[nm])
            b = eb.new(nm)
            b.head, b.tail = J[i], J[i + 1]
            b.parent = eb[f"hand_{s}"] if i == 0 else eb[f"finger{i}_{s}"]
            b.use_connect = False
            b.align_roll(S["axis"])
    bpy.ops.object.mode_set(mode='OBJECT')
    me = body.data
    groups = {nm: body.vertex_groups.get(nm) or body.vertex_groups.new(name=nm) for nm in FINGER_BONES}
    moved = 0
    for s, S in setups.items():
        hg = body.vertex_groups[f"hand_{s}"]
        for n_i, vi in enumerate(S["idx"]):
            if S["thumb"][n_i]:
                continue
            ks = finger_ks(S["d"][n_i])
            if not ks:
                continue
            try:
                h = hg.weight(vi)
            except RuntimeError:
                continue
            k = ks + [0.0] * (3 - len(ks))
            share = [1 - k[0], k[0] * (1 - k[1]), k[0] * k[1] * (1 - k[2]), k[0] * k[1] * k[2]]
            hg.add([vi], h * share[0], 'REPLACE')
            for j in range(3):
                groups[f"finger{j + 1}_{s}"].add([vi], h * share[j + 1], 'REPLACE')
            moved += 1
    me.update()
    return {"moved": moved, "joints": {s: [[round(x, 3) for x in p] for p in finger_joints(S)] for s, S in setups.items()},
            "axis": {s: [round(x, 3) for x in S["axis"]] for s, S in setups.items()}}


BONES = [
    # nimi, emo, pää, häntä (maamerkin nimi tai (nimi, peilaus))
    ("hips", None, "hips", "spine"),
    ("spine", "hips", "spine", "chest"),
    ("chest", "spine", "chest", "neck"),
    ("neck", "chest", "neck", "head"),
    ("head", "neck", "head", "head_top"),
]
for sfx, sgn in (("L", 1), ("R", -1)):
    BONES += [
        ("upper_arm_" + sfx, "chest", ("shoulder", sgn), ("elbow", sgn)),
        ("forearm_" + sfx, "upper_arm_" + sfx, ("elbow", sgn), ("wrist", sgn)),
        ("hand_" + sfx, "forearm_" + sfx, ("wrist", sgn), ("knuckle", sgn)),
        ("thigh_" + sfx, "hips", ("hip", sgn), ("knee", sgn)),
        ("shin_" + sfx, "thigh_" + sfx, ("knee", sgn), ("ankle", sgn)),
        ("foot_" + sfx, "shin_" + sfx, ("ankle", sgn), ("toe", sgn)),
    ]


def make_rig(L, name="RIG", col="GAME"):
    remove_obj(name)
    arm = bpy.data.armatures.new(name)
    ob = bpy.data.objects.new(name, arm)
    get_col(col).objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.view_layer.objects:
        o.select_set(o == ob)
    bpy.ops.object.mode_set(mode='EDIT')
    def P(key):
        if isinstance(key, tuple):
            p = L[key[0]]
            return V((p.x * key[1], p.y, p.z))
        return L[key].copy()
    for name, parent, h, t in BONES:
        b = arm.edit_bones.new(name)
        b.head, b.tail = P(h), P(t)
        b.roll = 0
        if parent:
            b.parent = arm.edit_bones[parent]
            b.use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    return ob


def auto_weights(mesh_ob, rig):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    mesh_ob.vertex_groups.clear()
    mesh_ob.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    n_un = sum(1 for v in mesh_ob.data.vertices if not v.groups)
    return {"groups": len(mesh_ob.vertex_groups), "unweighted": n_un}


def build_base():
    body = make_body()
    L = landmarks(body)
    info = {"L": curl_fingers_chain(body, L, 1), "R": curl_fingers_chain(body, L, -1)}
    rig = make_rig(L)
    info["weights"] = auto_weights(body, rig)
    info["fingers"] = add_fingers(body, rig, [v.co.copy() for v in bpy.data.objects["GEO-body_male_realistic"].data.vertices], L)
    info["landmarks"] = {k: [round(x, 3) for x in v] for k, v in L.items()}
    return info
