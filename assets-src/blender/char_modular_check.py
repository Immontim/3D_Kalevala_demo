"""Modulaaristen vaateosien tarkistus: luuranko ääriasentoihin ja kerrosten väli mitattuna.

Edellyttää char_all.py:n (tai char_folk.py:n) ajoa samassa nimiavaruudessa sekä avointa characters.blendiä.
Käyttö (Blender MCP:n kautta):

    exec(open(r"...\\assets-src\\blender\\char_modular_check.py", encoding="utf-8").read())
    result = check_set("hero")      # tai "fem"

Mittaus on suuntariippumaton: kullekin ulomman osan (mail, viitta) verteksille p etsitään lähin piste q
sisemmältä osalta (base), ja verrataan niiden etäisyyttä pelkästä vartalosta (BODY / BODY_F, sama asento).
margin = d_vartalo(p) - d_vartalo(q): negatiivinen = ulompi kerros painuu sisemmän alle (läpileikkaus),
alle 2 mm = z-fighting-riski. Vain verteksit, joiden lähin sisempi pinta on alle 6 cm päässä, lasketaan.
"""
import bpy, math
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

# Asennot: (luu, akseli (maailma), kulma rad). Kierto tehdään luun pään ympäri nykyisen asennon päälle.
# Eteen on -Y, ylös +Z. Jalan eteenheilautus on X-akselin ympäri negatiivisesti, polven koukistus positiivisesti.
POSES = {
    "rest": [],
    "walk": [("thigh_L", "X", -0.6), ("shin_L", "X", 0.4), ("thigh_R", "X", 0.45), ("shin_R", "X", 0.7),
             ("upper_arm_L", "X", 0.4), ("upper_arm_R", "X", -0.45), ("forearm_R", "X", -0.6)],
    "block": [("spine", "Z", -0.3), ("upper_arm_L", "X", -1.4), ("forearm_L", "X", -1.3),
              ("upper_arm_R", "X", -0.9), ("forearm_R", "X", -1.1), ("thigh_L", "X", -0.35), ("shin_L", "X", 0.3)],
    "overhead": [("spine", "X", 0.5), ("chest", "X", 0.3), ("upper_arm_R", "X", -2.8), ("forearm_R", "X", -1.0),
                 ("upper_arm_L", "X", -0.6), ("thigh_L", "X", -0.5), ("shin_L", "X", 0.45), ("thigh_R", "X", 0.3)],
    "side": [("upper_arm_L", "Y", 1.2), ("upper_arm_R", "Y", -1.2), ("thigh_L", "Y", 0.5), ("thigh_R", "Y", -0.5)],
}
AX = {"X": Vector((1, 0, 0)), "Y": Vector((0, 1, 0)), "Z": Vector((0, 0, 1))}


def reset_pose(rig):
    for pb in rig.pose.bones:
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
    bpy.context.view_layer.update()


def set_pose(rig, name):
    reset_pose(rig)
    for bone, ax, ang in POSES[name]:
        pb = rig.pose.bones[bone]
        head = pb.head.copy()
        R = Matrix.Translation(head) @ Matrix.Rotation(ang, 4, AX[ax]) @ Matrix.Translation(-head)
        pb.matrix = R @ pb.matrix
        bpy.context.view_layer.update()


def _bvh(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    return BVHTree.FromObject(ob, dg), ob.evaluated_get(dg)


def _verts_world(ob_eval):
    me = ob_eval.to_mesh()
    mw = ob_eval.matrix_world
    pts = [mw @ v.co for v in me.vertices]
    ob_eval.to_mesh_clear()
    return pts


def layer_margin(outer, inner, body, region=None):
    """Palauttaa tilaston: ulomman kerroksen vertekseille margin sisempään kerrokseen nähden."""
    bb, _ = _bvh(bpy.data.objects[body])
    bi, _ = _bvh(bpy.data.objects[inner])
    ob_out = bpy.data.objects[outer]
    bvh_out, ev = _bvh(ob_out)
    pts = _verts_world(ev)
    rest = [ob_out.matrix_world @ v.co for v in ob_out.data.vertices]      # region arvioidaan lepoasennon paikasta
    worst, clip, close, n = 1.0, [], 0, 0
    for p, r0 in zip(pts, rest):
        if region and not region(r0):
            continue
        hit = bi.find_nearest(p)
        if hit[0] is None or hit[3] > 0.06:
            continue
        q = hit[0]
        dp = bb.find_nearest(p)[3]
        dq = bb.find_nearest(q)[3]
        m = dp - dq
        n += 1
        worst = min(worst, m)
        if m < 0.0:
            clip.append((round(m, 4), [round(c, 3) for c in p]))
        elif m < 0.002:
            close += 1
    clip.sort()
    return {"n": n, "worst_mm": round(worst * 1000, 1), "clip": len(clip), "close_lt2mm": close, "worst_at": clip[:3]}


def check_set(kind, poses=("rest", "walk", "block", "overhead", "side")):
    """Tarkistaa mail/greaves/shoes vs base. Tarkoituksella päällekkäiset kohdat jätetään pois lepoasennon
    korkeuden mukaan: vyö ja huotra (mail alle vyön), kengän yläreuna (säärikäärin alla)."""
    if kind == "hero":
        rig, body, pre, belt = bpy.data.objects["RIG"], "BODY", "char_hero", (0.965, 1.05)
    else:
        rig, body, pre, belt = bpy.data.objects["RIG_F"], "BODY_F", "char_jousineito", (1.0, 1.1)
    pairs = [
        (pre + "_mail", pre + "_base", lambda p: not (belt[0] < p.z < belt[1])),
        (pre + "_greaves", pre + "_base", None),
        (pre + "_shoes", pre + "_base", lambda p: p.z < 0.095),
    ]
    out = {}
    try:
        for pose in poses:
            set_pose(rig, pose)
            out[pose] = {f"{a} vs {b}": layer_margin(a, b, body, reg) for a, b, reg in pairs}
    finally:
        reset_pose(rig)
    return out
