"""Sepän pajan lapsisälli (vaihe B5): noin 1,29 m pitkä poika (8–10-vuotias) aikuisen miesvartalon muunnoksena.

Hahmo kootaan ensin aikuisen mittoihin samoilla osilla kuin char_salli (char_smith.py), ja sitten
verkko ja luuranko skaalataan yhdessä lapsen mittasuhteisiin (childify). Jokaisella luulla on oma
skaalaus luun pituussuunnassa (l) ja poikittain (g); pää skaalautuu vähemmän kuin vartalo, joten
se on suhteessa noin 1,2-kertainen. Luiden suunnat ja kierrot (roll) eivät muutu, vain pituudet ja
paikat, joten pelin luukierrot liikuttavat lasta samoin kuin aikuisia. Painot säilyvät.

Luiden lepoasento on eri kuin aikuisilla, joten lapsi on omassa tiedostossaan
assets/smithfolk_child.glb omalla luurangollaan (tiedostossa nimellä RIG).

    FOLK_DIR = r"...\\assets-src\\blender"
    exec(open(r"...\\assets-src\\blender\\char_smith_child.py", encoding="utf-8").read())
    result = run_child(preview_dir=r"...", out_dir=r"...\\assets")
"""
import os

_SB = globals().get("FOLK_DIR") or (os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else r"C:\Data\3D Kalevala\assets-src\blender")
FOLK_DIR = _SB
exec(open(os.path.join(_SB, "char_smith.py"), encoding="utf-8").read())

COL_C = "SMITHFOLK_CHILD"
RIG_C = "RIG_CHILD"

# (pituus, poikittain) aikuiseen verrattuna. Aikuinen 1,70 m -> lapsi 1,29 m.
CHILD_SCALE = {
    "hips": (0.72, 0.70), "spine": (0.72, 0.68), "chest": (0.72, 0.66), "neck": (0.74, 0.70),
    "head": (0.90, 0.90),
    "upper_arm": (0.72, 0.64), "forearm": (0.72, 0.64), "hand": (0.75, 0.75),
    "finger1": (0.75, 0.75), "finger2": (0.75, 0.75), "finger3": (0.75, 0.75),
    "thigh": (0.76, 0.66), "shin": (0.76, 0.64), "foot": (0.74, 0.74),
}
# Lapsen kasvot (aikuisen mitoissa ennen skaalausta): silmien alapuoli matalammaksi ja kapeammaksi,
# nenä ja leuka vähemmän ulkonevat. Vaikutus kerrotaan head-luun painolla, joten kaula ei muutu.
EYE_Z, FACE_Y = 1.574, -0.08
FACE = {"low_z": 0.14, "low_x": 0.08, "front_y": 0.2}


def _bone_scale(name):
    return CHILD_SCALE[name.rsplit("_", 1)[0] if name.endswith(("_L", "_R")) else name]


def child_transforms(rig):
    """Luu -> 4x4-matriisi, joka vie aikuisen lepoasennon pisteen lapsen lepoasentoon.
    T_b = siirto(uusi pää) . R . diag(g, l, g) . R^T . siirto(-vanha pää); lapsiluun uusi pää on
    vanhemman T:n kuva, joten nivelet pysyvät kiinni."""
    T, heads, tails = {}, {}, {}
    for b in rig.data.bones:                     # vanhemmat ennen lapsia
        l, g = _bone_scale(b.name)
        R = b.matrix_local.to_3x3()
        S = R @ Matrix.Diagonal((g, l, g)) @ R.transposed()
        h0 = b.head_local.copy()
        h1 = (T[b.parent.name] @ h0) if b.parent else h0
        M = Matrix.Translation(h1) @ S.to_4x4() @ Matrix.Translation(-h0)
        T[b.name] = M
        heads[b.name], tails[b.name] = h1, M @ b.tail_local
    return T, heads, tails


def child_face(ob):
    """Pienentää kasvojen alaosaa ja ulkonemia (ks. FACE). Jatkuva: leveyden kavennus kasvaa
    silmien tasolta 2,5 cm alaspäin, joten silmien kohdalle ei synny porrasta."""
    hi = ob.vertex_groups["head"].index
    for v in ob.data.vertices:
        w = next((g.weight for g in v.groups if g.group == hi), 0.0)
        if w <= 0:
            continue
        c = v.co
        if c.z < EYE_Z:
            ramp = smoothstep(EYE_Z, EYE_Z - 0.025, c.z)
            c.z = EYE_Z + (c.z - EYE_Z) * (1 - FACE["low_z"] * w)
            c.x *= 1 - FACE["low_x"] * w * ramp
        if c.y < FACE_Y:
            c.y = FACE_Y + (c.y - FACE_Y) * (1 - FACE["front_y"] * w)
    ob.data.update()


def lbs(ob, T):
    """Siirtää verkon verteksit luiden muunnoksilla T painojen mukaan (kuten luuranko siirtäisi)."""
    names = [g.name for g in ob.vertex_groups]
    for v in ob.data.vertices:
        acc, s = Matrix(((0, 0, 0, 0),) * 4), 0.0
        for ge in v.groups:
            n = names[ge.group]
            if n in T and ge.weight > 0:
                acc = acc + T[n] * ge.weight
                s += ge.weight
        v.co = (acc * (1.0 / s)) @ v.co if s > 0 else T["hips"] @ v.co
    ob.data.update()


def child_body(dz):
    """Tarkistusta varten: aikuisen BODY samalla muunnoksella (kasvot, luut, maahan) lapsen
    luurankoon. Ei viedä peliin; apron_clearance mittaa kerrokset tämän pinnasta."""
    src = bpy.data.objects["BODY"]
    old = bpy.data.objects.get("BODY_CHILD")
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    b = src.copy()
    b.data = src.data.copy()
    b.name = "BODY_CHILD"
    get_col("PV_CHILD").objects.link(b)
    child_face(b)
    T, _, _ = child_transforms(bpy.data.objects["RIG"])
    lbs(b, T)
    for v in b.data.vertices:
        v.co.z += dz
    b.data.update()
    rig = bpy.data.objects[RIG_C]
    b.parent = rig
    for m in b.modifiers:
        if m.type == 'ARMATURE':
            m.object = rig
    b.hide_render = True
    return b


def childify(ob, rig_src="RIG"):
    """Tekee luurangosta kopion RIG_C ja muuntaa siihen ob:n verkon ja luut lapsen mittoihin.
    Palauttaa korkeuden ennen ja jälkeen."""
    src = bpy.data.objects[rig_src]
    rig = bpy.data.objects.get(RIG_C)
    if rig:
        bpy.data.objects.remove(rig, do_unlink=True)
    rig = src.copy()
    rig.data = src.data.copy()
    rig.name = RIG_C
    get_col(COL_C).objects.link(rig)
    for c in list(ob.users_collection):
        c.objects.unlink(ob)
    get_col(COL_C).objects.link(ob)
    T, heads, tails = child_transforms(src)
    me = ob.data
    z_old = max(v.co.z for v in me.vertices)
    lbs(ob, T)
    bpy.context.view_layer.objects.active = rig
    for o in bpy.context.view_layer.objects:
        o.select_set(o is rig)
    bpy.ops.object.mode_set(mode='EDIT')
    for eb in rig.data.edit_bones:
        roll = eb.roll
        eb.head, eb.tail = heads[eb.name], tails[eb.name]
        eb.roll = roll
    bpy.ops.object.mode_set(mode='OBJECT')
    ob.parent = rig
    ob.modifiers["Armature"].object = rig
    return {"z_top_adult": round(z_old, 3), "z_top_child": round(max(v.co.z for v in me.vertices), 3)}


def ground(ob, rig, z_floor):
    """Siirtää verkon ja luut niin, että alin verteksi on korkeudella z_floor."""
    me = ob.data
    dz = z_floor - min(v.co.z for v in me.vertices)
    for v in me.vertices:
        v.co.z += dz
    me.update()
    bpy.context.view_layer.objects.active = rig
    for o in bpy.context.view_layer.objects:
        o.select_set(o is rig)
    bpy.ops.object.mode_set(mode='EDIT')
    for eb in rig.data.edit_bones:
        eb.head.z += dz
        eb.tail.z += dz
    bpy.ops.object.mode_set(mode='OBJECT')
    return dz


def thin_brows(head, skin, hair, keep=(1.5935, 1.6015), mix=0.45):
    """Aikuisen kulmakarvat (skin_parts) ohuemmiksi ja vaaleammiksi: vain kapea vaakakaista jää
    kulmakarvan väriin, ja sekin sekoitetaan ihonväriin."""
    brow = tuple(x * 0.55 for x in hair)
    col = tuple(s + (b - s) * mix for s, b in zip(skin, brow))
    out = []
    for idx, mat, uvs, c, sm in head.faces:
        if c == brow:
            z = sum(head.co[i].z for i in idx) / len(idx)
            c = col if keep[0] < z < keep[1] else skin
        out.append((idx, mat, uvs, c, sm))
    head.faces = out


def child_hair(C, head, color, seed=21):
    """Lapsen polkkatukka: päälakikuori ja sen päällä joka puolelle laskeutuva lyhyt verho, jossa
    otsatukka kulmien yläpuolelle, korvien puoliväliin sivuilla ja niskaan takana. Verho asetetaan
    ihon pinnasta mitaten (säde ihon BVH:sta), joten se ei leikkaa otsaa eikä ohimoita."""
    rng = random.Random(seed)
    bvh = BVHTree.FromPolygons([tuple(c) for c in head.co], [f[0] for f in head.faces])
    parts = []
    ear = lambda c: abs(c.x) > 0.077 and 1.505 < c.z < 1.595 and -0.08 < c.y < 0.0
    is_scalp = lambda i, c: 1.455 < c.z and C.arm_frac[i] < 0.2 and not ear(c) and (c.z > 1.618 or (c.y > -0.035 and c.z > 1.50) or c.y > 0.0)
    parts.append(shell(C, is_scalp, lambda c: 0.012, "hair", smooth=1, colfn=lambda c: tuple(x * rng.uniform(0.8, 1.0) for x in color)))
    p = Part()
    n, rows, z0 = 44, 7, 1.672
    ctr = V((0, -0.03, 0))
    grid, shade = [], 0.86
    for k in range(n):
        a = math.radians(-180 + 360 * k / n)             # 0 = takana (+Y), ±180 = otsa
        t = (1 + math.cos(a)) / 2                        # 1 takana, 0 edessä
        bot = 1.622 - 0.12 * t ** 0.8 - rng.uniform(0.0, 0.01 if t < 0.15 else 0.026)
        d = V((math.sin(a), math.cos(a), 0))
        shade = 0.5 * shade + 0.5 * rng.uniform(0.72, 1.0)   # naapurisuortuvat lähellä toisiaan: ei raitoja
        tuft = rng.uniform(-0.003, 0.006)                # suortuvat eri etäisyydellä: ei kypärää
        colm, last = [], 0.0
        for j in range(rows + 1):
            s = j / rows
            z = z0 + (bot - z0) * s
            o = V((ctr.x, ctr.y, z))
            hit = bvh.ray_cast(o, d, 0.3)
            # tukka laskeutuu suoraan alas: säde ei pienene alaspäin (korvan yli, ei porrasta)
            r = max(hit[3] if hit[0] is not None else last, last if j else 0.0)
            last = r
            off = 0.014 + 0.002 * s + tuft * s + (0.006 * s * s if t < 0.2 else 0.0) + rng.uniform(0, 0.002)
            colm.append((p.v(o + d * (r + off), {"head": 1.0}), shade))
        grid.append(colm)
    for k in range(n):
        k1 = (k + 1) % n
        for j in range(rows):
            sh = grid[k][j][1] * (1 - 0.2 * j / rows) * rng.uniform(0.94, 1.0)
            p.f([grid[k][j][0], grid[k1][j][0], grid[k1][j + 1][0], grid[k][j + 1][0]], "hair", None, tuple(x * sh for x in color))
    parts.append(p)
    return parts


def build_lapsi():
    """Aikuisen mittoihin koottu lapsen asu; childify() pienentää sen."""
    C = Ctx()
    hair = (0.17, 0.06, 0.025)                    # ruskeanpunainen, ei sekoitu sällin vaaleaan
    skin = (0.8, 0.58, 0.45)
    tunic = (0.3, 0.26, 0.19)                     # värjäämätön ruskeanharmaa villa
    P = skin_parts(C, 0.74, hair, skin=skin, lips=(0.68, 0.42, 0.36))   # lapsen huulet lähellä ihonväriä
    thin_brows(P[0], skin, hair)
    P += child_hair(C, P[0], hair)
    under = torso_parts(C, "wool", tunic, 0.76, inflate=0.018, tile=0.16, smooth=9, collar=(0.3, 0.09, 0.05), baggy=0.012)
    under += [skirt(C, 1.0, 0.64, 0.022, (0.262, 0.21), "wool", tile=0.16, col=tunic)]
    P += under
    P += rolled_cuff(C, 0.725, "wool", tunic, off=0.026, width=0.045)
    P += legs_parts(C, "wool", (0.13, 0.11, 0.08), (0.36, 0.31, 0.23), baggy=0.035)
    P += belt_parts(C, off=0.032)
    D = Drape(C, 1.0, 0.5, 0.028, (0.29, 0.24), z_max=1.1)
    ap, _ = leather_apron(C, D, 0.99, 0.6, 0.14, 0.16, extra=0.018, seed=13, bib=False)
    APRON["char_lapsi"] = (sum(len(q.co) for q in P), sum(len(q.co) for q in ap))
    P += transfer_weights(ap, under)
    return assemble("char_lapsi", P, col_name=COL_C)


def run_child(preview_dir=None, out_dir=None, compare=True):
    out = {}
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            folk_materials()
            rig = bpy.data.objects["RIG"]
            reset_pose(rig)
            pose_arms(False)
            ob, info = build_lapsi()
            z_floor = min(v.co.z for v in ob.data.vertices)
            out["tris"] = info["tris"]
            child_face(ob)
            out["height"] = childify(ob)
            rc = bpy.data.objects[RIG_C]
            out["ground_dz"] = round(ground(ob, rc, z_floor), 4)
            out["height"]["z_top_child"] = round(max(v.co.z for v in ob.data.vertices), 3)
            out["head_bone"] = [round(x, 3) for x in rc.data.bones["head"].head_local]
            child_body(out["ground_dz"])
            bpy.context.view_layer.update()
            out["clearance"] = {}
            for pose in ["rest"] + list(SMITH_POSES):
                if pose == "rest":
                    reset_pose(rc)
                    pose_arms(True, rig=RIG_C)
                else:
                    set_smith_pose(rc, pose)
                out["clearance"][pose] = apron_clearance("char_lapsi", body="BODY_CHILD")
                if preview_dir and pose in ("walk", "palkeet"):
                    sheet(["char_lapsi"], os.path.join(preview_dir, "lapsi_%s.png" % pose),
                          yaws=(0, 0.6, math.pi / 2, -math.pi / 2), w=380, h=760)
            reset_pose(rc)
            if preview_dir and compare:
                build_salli()
                reset_pose(rig)
                pose_arms(True)
                pose_arms(True, rig=RIG_C)
                # sama kuvamittakaava: molemmat samassa ruudussa vierekkäin katsojaan nähden
                tiles = []
                for i, (yaw, axis) in enumerate(((0, 0), (-math.pi / 2, 1))):
                    rig.location[axis], rc.location[axis] = (-0.38, 0.38) if axis == 0 else (0.38, -0.38)
                    bpy.context.view_layer.update()
                    p = os.path.join(preview_dir, "_cmp%d.png" % i)
                    sheet(["char_salli", "char_lapsi"], p, yaws=(yaw,), w=640, h=760)
                    tiles.append(load_px(p))
                    os.remove(p)
                    rig.location[axis] = rc.location[axis] = 0.0
                save_px(np.concatenate(tiles, axis=1), os.path.join(preview_dir, "lapsi_vertailu.png"), "_cmp")
                bpy.context.view_layer.update()
                sheet(["char_lapsi"], os.path.join(preview_dir, "lapsi_rest.png"),
                      yaws=(0, math.pi / 2, math.pi, -math.pi / 2), w=380, h=760)
                reset_pose(rig)
                pose_arms(False)
            reset_pose(rc)
            for n in ("BODY_CHILD", "char_salli"):
                if n in bpy.data.objects:
                    bpy.data.objects.remove(bpy.data.objects[n], do_unlink=True)
            if out_dir:
                # viejä lisää muut luurangot (RIG__tmp, RIG_F) tyhjinä juurisolmuina kuten smithfolk.glb:hen
                out["glb"] = export_folk(out_dir, COL_C, RIG_C, "smithfolk_child.glb")
    except Exception:
        out["err"] = traceback.format_exc()[-2500:]
    return out
