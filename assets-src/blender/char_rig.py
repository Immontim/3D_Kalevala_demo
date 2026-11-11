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


def landmarks(ob):
    """Nivelpisteet vartalon geometriasta (vasen puoli, +X). Oikea peilataan."""
    co = np.array([v.co[:] for v in ob.data.vertices])
    L = {}
    def cen(mask):
        return V(co[mask].mean(axis=0))
    # käsivarsi: olkapäästä sormenpäähän
    tip = V(co[np.argmax(co[:, 0])])
    sh = V((0.175, 0.025, 1.39))
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
    L["hip"] = V((0.095, 0.02, 0.93))
    L["knee"] = cen(leg & (co[:, 2] > 0.47) & (co[:, 2] < 0.53))
    L["ankle"] = cen(leg & (co[:, 2] > 0.07) & (co[:, 2] < 0.11) & (co[:, 1] > -0.02))
    foot = leg & (co[:, 2] < 0.06)
    L["toe"] = V((float(co[foot][:, 0].mean()), float(co[foot][:, 1].min()), 0.02))
    # selkäranka ja pää
    L["hips"] = V((0, 0.02, 0.96))
    L["spine"] = V((0, 0.02, 1.08))
    L["chest"] = V((0, 0.015, 1.22))
    L["neck"] = V((0, 0.0, 1.43))
    L["head"] = V((0, -0.02, 1.50))
    L["head_top"] = V((0, -0.03, float(co[:, 2].max())))
    head = co[:, 2] > 1.46
    L["nose_tip"] = V(co[head][np.argmin(co[head][:, 1])])
    return L


def curl_fingers_chain(ob, L, side=1, angles=(1.25, 1.5, 0.9)):
    """Koukistaa sormet nyrkkiin: kolme niveltä (rystyset, keski- ja kärkinivel),
    joista jokainen kiertää kärkipuolensa kämmentä kohti. Peukalo jää paikalleen.
    side=1 vasen (+X), -1 oikea."""
    me = ob.data
    mir = lambda p: V((p.x * side, p.y, p.z))
    W, K = mir(L["wrist"]), mir(L["knuckle"])
    a = (mir(L["fingertip"]) - mir(L["shoulder"])).normalized()
    idx = [v.index for v in me.vertices
           if v.co.x * side > 0.2 and (v.co - W).dot(a) > -0.02 and (v.co - (W + a * (v.co - W).dot(a))).length < 0.13]
    pts = np.array([me.vertices[i].co[:] for i in idx])
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
    joints = (0.0, 0.04, 0.07)
    out = []
    for i in range(len(idx)):
        p = V(pts[i])
        o = off[i] * thumb_sign
        if (o > 0.040 and d[i] < 0.025) or (o > 0.030 and d[i] < -0.015):
            out.append(p)       # peukalo
            continue
        M = Matrix.Identity(4)
        for j0, ang in zip(joints, angles):
            k = smoothstep(j0 - 0.01, j0 + 0.01, d[i])
            if k <= 0:
                break
            piv = K + a * j0
            M = M @ Matrix.Translation(piv) @ Matrix.Rotation(-ang * k, 4, axis) @ Matrix.Translation(-piv)
        out.append(M @ p)
    for vi, p in zip(idx, out):
        me.vertices[vi].co = p
    me.update()
    return {"count": len(idx), "thumb_sign": thumb_sign}


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


def make_rig(L):
    remove_obj("RIG")
    arm = bpy.data.armatures.new("RIG")
    ob = bpy.data.objects.new("RIG", arm)
    get_col("GAME").objects.link(ob)
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
    info["landmarks"] = {k: [round(x, 3) for x in v] for k, v in L.items()}
    return info
