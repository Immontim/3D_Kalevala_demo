"""Sepän pajan väki (vaihe B4): tavallinen kyläseppä ja aikuinen sälli sekä sepän vasara.

Samaa miesvartaloa (BODY) ja luurankoa (RIG) kuin taistelijoilla ja tietäjällä, joten peli voi
animoida hahmot samalla koodilla. Käyttää char_folk.py:n apuja (Drape, folk_materials,
export_folk), joten se luetaan ensin. Aja Blenderissä characters.blend-tiedostossa (tai sen
kopiossa taustalla):

    FOLK_DIR = r"...\\assets-src\\blender"      # vain jos ajat toisesta työpuusta
    exec(open(r"...\\assets-src\\blender\\char_smith.py", encoding="utf-8").read())
    result = run_smith(preview_dir=r"...", out_dir=r"...\\assets", save=False)

Tulos: kokoelma SMITHFOLK ja tiedosto assets/smithfolk.glb luurankoineen (RIG):
- char_seppa: keski-ikäinen seppä. Täysi tumma parta, nahkainen otsanauha, villatunika hihat
  kyynärpäiden alle käärittyinä, paksu nahkaesiliina rinnasta polvien alle (niskahihna ja
  vyötärösidos), villahousut, säärikääreet ja nahkakengät. Esiliinassa kipinöiden polttamia
  tummia läikkiä.
- char_salli: nuori aikuinen sälli. Vaalea tukka, harva parta, vaalea pellavatunika, hihat
  käärittyinä kyynärvarteen, lyhyt nahkaesiliina vyötäröltä polviin, villahousut.
- sepan_vasara: käsivasara, ote origossa ja pää -Y:n päässä kuten keihään kärki ja sauvan
  linnunpää, joten peli voi pitää sitä samalla otekanavalla (GRIP_P, GRIP_D). Pään iskupinnat
  osoittavat ±Z:aan (pelissä ±Y).

Kumpikin käyttää koverrettua miehen nyrkkiä (carve=True), joten 2,7–2,8 cm:n varsi mahtuu
käteen kuten keihäs ja sauva.
"""
import os, math, random

_SB = globals().get("FOLK_DIR") or (os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else r"C:\Data\3D Kalevala\assets-src\blender")
FOLK_DIR = _SB
exec(open(os.path.join(_SB, "char_folk.py"), encoding="utf-8").read())
exec(open(os.path.join(_SB, "char_modular_check.py"), encoding="utf-8").read())

COL = "SMITHFOLK"
# Värit ovat lineaarisia (kuten muillakin hahmoilla): 0,1 näkyy tummana, 0,4 jo vaaleana.
LEATHER_APRON = (0.3, 0.17, 0.09)
SOOT = (0.05, 0.035, 0.025)

# Testiasennot (luu, maailma-akseli, kulma) char_modular_check.py:n tapaan: eteen -Y, ylös +Z.
SMITH_POSES = {
    "walk": POSES["walk"],
    # vasara ylhäällä ennen iskua: oikea olka nousee, kyynärpää koukussa, keho kallistuu hieman
    "isku_ylhaalla": [("spine", "X", 0.18), ("upper_arm_R", "X", -2.3), ("forearm_R", "X", -1.2),
                      ("upper_arm_L", "X", -0.75), ("forearm_L", "X", -0.9), ("thigh_L", "X", -0.3), ("shin_L", "X", 0.25)],
    # isku alasimeen: käsi edessä alhaalla, selkä kumarassa
    "isku_alhaalla": [("spine", "X", 0.32), ("chest", "X", 0.12), ("upper_arm_R", "X", -0.75), ("forearm_R", "X", -0.35),
                      ("upper_arm_L", "X", -0.7), ("forearm_L", "X", -0.9), ("thigh_L", "X", -0.3), ("shin_L", "X", 0.25)],
    # palkeiden pumppaus: molemmat kädet edessä kahvojen korkeudella, polvet hieman koukussa
    "palkeet": [("spine", "X", 0.22), ("upper_arm_L", "X", -0.95), ("forearm_L", "X", -0.55),
                ("upper_arm_R", "X", -0.6), ("forearm_R", "X", -0.75), ("thigh_L", "X", -0.25), ("shin_L", "X", 0.35),
                ("thigh_R", "X", -0.15), ("shin_R", "X", 0.25)],
}


# ---------- osat ----------
def headband(C, col=(0.3, 0.2, 0.13)):
    """Nahkainen otsanauha hiusten päällä."""
    keep = lambda i, c: c.z > 1.5 and C.arm_frac[i] < 0.2
    return [band(C, V((0, -0.03, 1.598)), V((0, 0.14, 1)).normalized(), V((0, -1, 0)), 0.026, 0.024, "leather",
                 n=22, keep=keep, col=col, vspan=(0, 1), tile=0.08)]


def rolled_cuff(C, t, mat, col, off=0.03, width=0.055):
    """Käärityt hihat: paksu rulla kyynärvarren ympärillä kohdassa t (0 olka, 1 ranne)."""
    parts = []
    L = C.L
    for s in (1, -1):
        m = lambda q: V((q.x * s, q.y, q.z))
        sh, wr = m(L["shoulder"]), m(L["wrist"])
        a = (wr - sh).normalized()
        keep = lambda i, c, s=s: c.x * s > 0.15 and C.arm_frac[i] > 0.5
        for k, (dt, o, w) in enumerate(((0.0, off, width), (0.03, off + 0.006, width * 0.55))):
            ctr = sh + (wr - sh) * (t + dt)
            parts.append(band(C, ctr, a, V((0, -1, 0)), w, o, mat, n=14, keep=keep, col=tuple(x * (1 - 0.12 * k) for x in col),
                              vspan=(0, 1), tile=0.08, rows=2, flare=0.004))
    return parts


def apron_col(seed, base=LEATHER_APRON):
    """Nahan sävy: hienoinen vaihtelu ja kipinöiden polttamia tummia läikkiä."""
    rng = random.Random(seed)
    burns = [(rng.uniform(-0.17, 0.17), rng.uniform(0.55, 1.3), rng.uniform(0.02, 0.035)) for _ in range(14)]

    def fn(pt):
        k = 0.85 + 0.15 * (0.5 + 0.5 * math.sin(pt.x * 41 + pt.z * 23) * math.sin(pt.z * 37 - pt.x * 11))
        c = tuple(x * k for x in base)
        for bx, bz, r in burns:
            d = math.hypot(pt.x - bx, pt.z - bz)
            if d < r:
                t = 0.5 * (1 - d / r) ** 0.7
                c = tuple(c[i] * (1 - t) + SOOT[i] * t for i in range(3))
        return c
    return fn


def leather_apron(C, D, z_top, z_bot, hw_top, hw_bot, extra=0.024, seed=3, bib=True):
    """Nahkaesiliina vain edessä: paneeli Drapen pinnalla (seuraa rintaa, levenee helmaan päin).
    bib=False: vyötäröltä alas."""
    col = apron_col(seed)
    zs = [z_top]
    zz = z_top
    while zz - 0.04 > z_bot:
        zz -= 0.04
        zs.append(zz)
    zs.append(z_bot)
    us = [-1 + k / 6 for k in range(13)]

    def hw(z):
        if bib and z > D.z_top + 0.02:            # rintalappu: kapenee ylös
            t = (z - D.z_top - 0.02) / (z_top - D.z_top - 0.02)
            return hw_bot * 0.85 * (1 - t) + hw_top * t
        t = (D.z_top - z) / max(1e-3, D.z_top - z_bot) if z < D.z_top else 0.0
        return hw_bot * (0.85 + 0.15 * t)
    p = Part()
    grid = []
    for z in zs:
        row = []
        for u in us:
            ex = extra + 0.022 * max(0.0, min(1.0, (0.98 - z) / 0.2))    # jäykkä nahka seisoo irti reisistä
            pt = D.surf(u * hw(z), z, ex, False)
            if z < 0.62:                               # alaosa ei kierry polvien ympärille
                pt = V((pt.x, min(pt.y, D.surf(0.0, z, ex).y + 0.035 * abs(u)), pt.z))
            row.append(p.v(pt, D.weight(pt)))
        grid.append(row)
    for j in range(len(zs) - 1):
        for k in range(len(us) - 1):
            q = [grid[j][k], grid[j][k + 1], grid[j + 1][k + 1], grid[j + 1][k]]
            c = sum((p.co[i] for i in q), V()) / 4
            uv = [(us[k] * 1.4, zs[j] / 0.25), (us[k + 1] * 1.4, zs[j] / 0.25), (us[k + 1] * 1.4, zs[j + 1] / 0.25), (us[k] * 1.4, zs[j + 1] / 0.25)]
            p.f(q, "leather", uv, col(c))
            p.f(list(reversed(q)), "leather", list(reversed(uv)), tuple(x * 0.7 for x in col(c)))   # nurja puoli
    # paksuutta reunoille: kapea reunus alareunassa ja sivuilla (tummempi)
    edges = [grid[-1][k] for k in range(len(us))]
    parts = [p]
    pts = [p.co[i] for i in edges]
    parts.append(tube_part(pts, [0.004] * len(pts), 4, "leather", D.weight(pts[len(pts) // 2]), tuple(x * 0.55 for x in LEATHER_APRON), cap=False))
    for k in (0, len(us) - 1):
        side = [p.co[grid[j][k]] for j in range(len(zs))]
        parts.append(tube_part(side, [0.004] * len(side), 4, "leather", D.weight(side[len(side) // 2]), tuple(x * 0.55 for x in LEATHER_APRON), cap=False))
    return parts, [p.co[grid[0][0]], p.co[grid[0][-1]]]


def apron_ties(C, z, off, corners=None, col=(0.3, 0.2, 0.13)):
    """Vyötärösidos (vain takapuoli; edessä se jää esiliinan alle) ja rintalapullisessa esiliinassa
    niskahihna."""
    keep = lambda i, c: abs(c.x) < 0.2 and C.arm_frac[i] < 0.3
    tie = band(C, V((0, 0.02, z)), V((0, 0, 1)), V((0, -1, 0)), 0.022, off, "leather", keep=keep, col=col)
    tie.faces = [f for f in tie.faces if sum(tie.co[i].y for i in f[0]) / len(f[0]) > -0.06]
    parts = [tie]
    if corners:
        for s, c0 in zip((1, -1), sorted(corners, key=lambda q: -q.x)):
            pts = [c0, c0 + V((-0.005 * s, 0.03, 0.045)), V((0.072 * s, -0.012, 1.468)), V((0.068 * s, 0.04, 1.486)),
                   V((0.03 * s, 0.072, 1.478)), V((0.0, 0.079, 1.474))]
            w = [{"chest": 1.0}, {"chest": 0.8, "neck": 0.2}, {"chest": 0.4, "neck": 0.6}, {"neck": 1.0}, {"neck": 1.0}, {"neck": 1.0}]
            p = Part()
            seg = tube_part(pts, [0.007] * len(pts), 4, "leather", {}, col, cap=False)
            for i, c in enumerate(seg.co):              # painot pisteittäin lähimmän ohjauspisteen mukaan
                j = min(range(len(pts)), key=lambda jj: (pts[jj] - c).length)
                seg.w[i] = dict(w[j])
            parts.append(seg)
    return parts


def build_seppa():
    C = Ctx()
    hair = (0.075, 0.048, 0.03)
    skin = (0.74, 0.5, 0.38)
    tunic = (0.16, 0.14, 0.1)
    P = skin_parts(C, 0.6, hair, skin=skin)
    P += hair_parts(C, hair, length=1.43, beard=0.017, beard_long=0.034, cap=True)
    P += headband(C, (0.09, 0.055, 0.035))
    under = torso_parts(C, "wool", tunic, 0.62, inflate=0.022, tile=0.14, smooth=9, collar=(0.09, 0.075, 0.055), baggy=0.01)
    under += [skirt(C, 1.0, 0.6, 0.026, (0.27, 0.215), "wool", tile=0.14, col=tunic)]
    P += under
    P += rolled_cuff(C, 0.585, "wool", tunic)
    P += legs_parts(C, "wool", (0.12, 0.1, 0.075), (0.3, 0.26, 0.2), baggy=0.04)
    P += belt_parts(C, off=0.036)
    D = Drape(C, 1.0, 0.46, 0.03, (0.30, 0.25), z_max=1.4)
    ap, corners = leather_apron(C, D, 1.355, 0.47, 0.105, 0.2, seed=5)
    P += transfer_weights(ap, under)
    APRON["char_seppa"] = (sum(len(q.co) for q in P) - sum(len(q.co) for q in ap), sum(len(q.co) for q in ap))
    P += apron_ties(C, 1.07, 0.036, corners, (0.09, 0.055, 0.035))
    return assemble("char_seppa", P, col_name=COL)[1]


def build_salli():
    C = Ctx()
    hair = (0.3, 0.2, 0.09)
    skin = (0.77, 0.56, 0.43)
    tunic = (0.2, 0.24, 0.3)                       # haalistunut sininen villa
    P = skin_parts(C, 0.74, hair, skin=skin)
    P += hair_parts(C, hair, length=1.46, beard=0, cap=True, moustache=False)
    under = torso_parts(C, "wool", tunic, 0.76, inflate=0.018, tile=0.16, smooth=9, collar=(0.3, 0.09, 0.05), baggy=0.01)
    under += [skirt(C, 1.0, 0.66, 0.022, (0.262, 0.21), "wool", tile=0.16, col=tunic)]
    P += under
    P += rolled_cuff(C, 0.725, "wool", tunic, off=0.026, width=0.045)
    P += legs_parts(C, "wool", (0.1, 0.075, 0.05), (0.35, 0.3, 0.22), baggy=0.035)
    P += belt_parts(C, off=0.032)
    D = Drape(C, 1.0, 0.5, 0.028, (0.29, 0.24), z_max=1.1)
    ap, _ = leather_apron(C, D, 0.99, 0.55, 0.15, 0.17, extra=0.018, seed=9, bib=False)
    APRON["char_salli"] = (sum(len(q.co) for q in P), sum(len(q.co) for q in ap))
    P += transfer_weights(ap, under)          # esiliina riippuu vyöstä, erillistä sidosta ei tarvita
    return assemble("char_salli", P, col_name=COL)[1]


def build_hammer():
    """Sepän käsivasara: ote origossa, varsi +Y:hen 7 cm ja -Y:hen 27 cm, pää -Y:n päässä."""
    W = {}
    p = Part()
    wood = (0.5, 0.34, 0.2)
    p.extend(tube_part([V((0, 0.07, 0)), V((0, 0.0, 0)), V((0, -0.2, 0)), V((0, -0.285, 0))], [0.0145, 0.014, 0.0125, 0.012], 7, "wood", W, wood, tile=0.2))
    iron = (0.05, 0.048, 0.046)
    c = V((0, -0.285, 0))
    # pää: silmän kohdalla 36 x 42 mm, +Z:ssa kapeneva iskupinta, -Z:ssa poikittainen peeni (särmä x-suunnassa)
    p.extend(prism_part(c, (0.036, 0.042), (0.03, 0.034), 0.0, 0.072, "metal", W, iron))
    p.extend(prism_part(c, (0.03, 0.034), (0.03, 0.034), 0.072, 0.08, "metal", W, (0.16, 0.16, 0.16)))
    p.extend(prism_part(c, (0.036, 0.042), (0.032, 0.01), 0.0, -0.058, "metal", W, iron))
    p.extend(box_part(V((0, -0.285, 0.0)), (0.008, 0.046, 0.02), "wood", W, (0.6, 0.48, 0.34)))     # kiila
    return assemble("sepan_vasara", [p], col_name=COL, rig=False)[1]


def transfer_weights(parts, under):
    """Päällysvaate liikkuu kuten sen alla oleva kangas: painot lähimmistä alemman kerroksen
    vertekseistä (3 lähintä). Näin esiliina pysyy tunikan päällä myös kävellessä ja kumartuessa."""
    co = [c for u in under for c in u.co]
    ws = [w for u in under for w in u.w]
    kd = kdtree.KDTree(len(co))
    for i, c in enumerate(co):
        kd.insert(c, i)
    kd.balance()
    for p in parts:
        for i, c in enumerate(p.co):
            acc = {}
            hits = kd.find_n(c, 3)
            for _, j, _ in hits:
                for g, w in ws[j].items():
                    acc[g] = acc.get(g, 0.0) + w / len(hits)
            p.w[i] = acc
    return parts


def prism_part(c, s0, s1, z0, z1, mat, w, col):
    """Kapeneva särmiö z-suunnassa: poikkileikkaus s0 = (x, y) tasolla z0 ja s1 tasolla z1."""
    p = Part()
    ring = lambda s, z: [p.v(c + V((sx * s[0] / 2, sy * s[1] / 2, z)), w) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    a, b = ring(s0, z0), ring(s1, z1)
    flip = z1 < z0
    ordr = (lambda q: list(reversed(q))) if flip else (lambda q: q)
    p.f(ordr(b), mat, None, col, False)
    p.f(ordr(list(reversed(a))), mat, None, col, False)
    for i in range(4):
        j = (i + 1) % 4
        p.f(ordr([a[i], a[j], b[j], b[i]]), mat, None, col, False)
    return p


APRON = {}       # hahmo -> (ensimmäinen verteksi, määrä): esiliinan verteksit koottua verkkoa varten


# ---------- tarkistus ----------
def apron_clearance(char, cloth=("wool", "hessian", "linen", "jersey")):
    """Esiliinan ja hahmon oman kankaan (tunika, housut, kääreet) väli samassa asennossa, mitattuna kuten
    char_modular_check.layer_margin: nahkaverteksin p ja lähimmän kangaspisteen q etäisyyksien erotus
    vartalosta. Negatiivinen = kangas tulee nahan läpi. lt5mm = alle 5 mm:n verteksit."""
    dg = bpy.context.evaluated_depsgraph_get()
    ob = bpy.data.objects[char]
    ev = ob.evaluated_get(dg)
    me = ev.to_mesh()
    mw = ev.matrix_world
    names = [m.name for m in ob.data.materials]
    keep = {names.index(CM[k].name) for k in cloth if CM[k].name in names}
    verts = [mw @ v.co for v in me.vertices]
    polys = [tuple(pl.vertices) for pl in me.polygons if pl.material_index in keep]
    bb = BVHTree.FromPolygons(verts, polys)
    body = BVHTree.FromObject(bpy.data.objects["BODY"], dg)
    i0, n = APRON[char]
    worst, close, at = 1.0, 0, None
    for i in range(i0, i0 + n):
        loc, _, _, d = bb.find_nearest(verts[i])
        if loc is None or d > 0.08:
            continue
        # kuten char_modular_check.layer_margin: nahan ja lähimmän kangaspisteen etäisyys vartalosta
        sd = body.find_nearest(verts[i])[3] - body.find_nearest(loc)[3]
        if sd < worst:
            worst, at = sd, [round(x, 3) for x in ob.data.vertices[i].co]
        close += sd < 0.005
    ev.to_mesh_clear()
    return {"n": n, "min_mm": round(worst * 1000, 1), "lt5mm": close, "worst_rest_at": at}


def set_smith_pose(rig, name):
    POSES[name] = SMITH_POSES[name]
    set_pose(rig, name)


def hold_hammer(rig):
    """Esikatselu: vasaran kopio oikean käden otekanavaan ja käden luun lapseksi."""
    src = bpy.data.objects["sepan_vasara"]
    h = bpy.data.objects.get("_pv_vasara") or src.copy()
    h.name = "_pv_vasara"
    if not h.users_collection:
        get_col("PV_SMITH").objects.link(h)
    d = V((GRIP_D.x, GRIP_D.y, GRIP_D.z))
    R = (-d).to_track_quat('Y', 'Z').to_matrix().to_4x4()         # paikallinen -Y = GRIP_D
    h.parent = None
    h.matrix_world = Matrix.Translation(GRIP_P) @ R
    bpy.context.view_layer.update()
    mw = h.matrix_world.copy()
    h.parent, h.parent_type, h.parent_bone = rig, 'BONE', "hand_R"
    bpy.context.view_layer.update()
    h.matrix_world = mw
    return h


def run_smith(preview_dir=None, out_dir=None, save=False):
    out = {"tris": {}}
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            folk_materials()
            rig = bpy.data.objects["RIG"]
            reset_pose(rig)
            pose_arms(False)
            out["tris"]["char_seppa"] = build_seppa()["tris"]
            out["tris"]["char_salli"] = build_salli()["tris"]
            out["tris"]["sepan_vasara"] = build_hammer()["tris"]
            bpy.context.view_layer.update()
            out["clearance"] = {}
            for pose in ["rest"] + list(SMITH_POSES):
                if pose == "rest":
                    reset_pose(rig)
                    pose_arms(True)              # peli pitää kädet alhaalla
                else:
                    set_smith_pose(rig, pose)
                out["clearance"][pose] = {n: apron_clearance(n) for n in ("char_seppa", "char_salli")}
            reset_pose(rig)
            if preview_dir:
                hold_hammer(rig)
                for n in ("char_seppa", "char_salli"):
                    extra = ["_pv_vasara"] if n == "char_seppa" else []
                    reset_pose(rig)
                    pose_arms(True)
                    sheet([n] + extra, os.path.join(preview_dir, n + "_rest.png"), yaws=(0, math.pi / 2, math.pi, -math.pi / 2), w=380, h=760)
                    for pose in SMITH_POSES:
                        set_smith_pose(rig, pose)
                        sheet([n] + extra, os.path.join(preview_dir, "%s_%s.png" % (n, pose)), yaws=(0, math.pi / 2, -math.pi / 2), w=380, h=760)
                    reset_pose(rig)
                sheet(["sepan_vasara"], os.path.join(preview_dir, "sepan_vasara.png"), yaws=(math.pi / 2,), w=300, h=500)
                bpy.data.objects.remove(bpy.data.objects["_pv_vasara"], do_unlink=True)
            reset_pose(rig)
            if save:
                bpy.ops.wm.save_mainfile()
            if out_dir:
                out["glb"] = export_folk(out_dir, COL, "RIG", "smithfolk.glb")
    except Exception:
        out["err"] = traceback.format_exc()[-2500:]
    return out
