"""Sepän pihapiirin sommittelu (vaihe B3): kokoaa valmiit mallit Blenderiin pelin koordinaateissa ja
piirtää esikatselukuvat. Ei vie uutta GLB:tä; sijoitusehdotus Codexille on tiedostossa
docs/SMITHY_INTEGRATION.md ja taulukossa LAYOUT alla.

    blender --background --factory-startup --python assets-src/blender/smithy_yard.py

Esikatselukuvat: KALEVALA_PREVIEW=<polku ilman päätettä> (oletus: ei kuvia, vain taulukko tulostetaan).

Pelin koordinaatit kuten world.ts:ssä: x itään, z etelään (portti +z), yaw = kierto pystyakselin
ympäri. Blenderissä X = x, Y = -z ja kierto Z:n ympäri = yaw. Rakennuksen etusivu (Blenderin -Y)
osoittaa yawin suuntaan, ja `on_ring` kääntää sen pihan keskelle kuten world.ts:n `onRing`.
"""
import bpy, bmesh, math, os, json
from mathutils import Vector, Matrix

_HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else r"C:\Data\3D Kalevala\assets-src\blender"
exec(open(os.path.join(_HERE, "smithy.py"), encoding="utf-8").read().rsplit('\nif __name__ == "__main__":', 1)[0])

FENCE_R, GATE_HALF, CAM_MAX_R = 12.9, 0.11, 12.2     # samat kuin world.ts:n pihoilla


def on_ring(a_deg, d, hx, front, back):
    a = math.radians(a_deg)
    return {"x": math.sin(a) * d, "z": math.cos(a) * d, "yaw": a + math.pi, "hx": hx, "front": front, "back": back}


def from_local(f, lx, lz):
    s, c = math.sin(f["yaw"]), math.cos(f["yaw"])
    return f["x"] + lx * c + lz * s, f["z"] - lx * s + lz * c


# ---------- sijoitusehdotus ----------
# Paja pohjoiskoillisessa: portista sisään tuleva näkee ahjon hehkun suoraan edessä hieman oikealla.
# Sepän talo pihan länsilaidalla noin 23 m pajasta (paloriski), aitta lounaassa portin vieressä.
# Etusivut ja kauppapaikka pihan keskelle päin. Pajan jalanjälki: räystäät x ±3,4, etuna räystäs
# 2,6 m (kauppapaikka erikseen), takana kiviseinä 2,3 m.
SMITHY = on_ring(155, 14.2, 3.4, 2.6, 2.3)
HOUSE = on_ring(255, 16.0, 5.3, 3.4, 3.4)          # talo_seppa 8,4 x 5,0 m, ovi pihalle
STOREHOUSE = on_ring(-38, 15.6, 2.0, 3.0, 2.1)     # aitta
WOOD_A = 208.0                                     # halkopinorivin keskikulma talon ja pajan välissä


def smithy_pt(bx, by):
    """Pajan Blender-koordinaatti (x, y) pelin maailmaan (pajan paikallinen lz = -y)."""
    return from_local(SMITHY, bx, -by)


def item(name, x, z, yaw, **kw):
    return dict(name=name, x=round(x, 3), z=round(z, 3), yaw=round(yaw, 4), **kw)


def layout():
    L = []
    # pajan solmut samalla muunnoksella (poyta_aihiot = pukkipoyta-pöydän muunnos, ks. smithy.py)
    for n in ("paja", "paja_katto", "ahjo", "ahjo_hiillos", "palkeet", "paja_rekvisiitta", "keihasteline",
              "saarisuojat_myytavat", "poyta_aihiot"):
        L.append(item(n, SMITHY["x"], SMITHY["z"], SMITHY["yaw"], file="smithy.glb"))
    tx, tz = smithy_pt(TABLE_POS.x, TABLE_POS.y)
    L.append(item("pukkipoyta", tx, tz, SMITHY["yaw"], file="household.glb"))
    L.append(item("talo_seppa", HOUSE["x"], HOUSE["z"], HOUSE["yaw"], file="homestead.glb"))
    L.append(item("aitta", STOREHOUSE["x"], STOREHOUSE["z"], STOREHOUSE["yaw"], file="homestead.glb"))
    # halkopinot (pino 2,2 x 0,5 m) kahtena kolmen pinon rivinä aidan vieressä: lähin puu noin 5 m
    # pajan räystäästä ja 10 m ahjosta; hakkuupölkky pinojen eteen
    for i in range(1, 4):
        a = math.radians(WOOD_A + (i - 1.5) * 11.0)
        L.append(item("pino", math.sin(a) * 12.0, math.cos(a) * 12.0, a + math.pi, file="homestead.glb"))
    for i in range(3):
        a = math.radians(WOOD_A + (i - 0.5) * 11.5)
        L.append(item("pino", math.sin(a) * 11.35, math.cos(a) * 11.35, a + math.pi, file="homestead.glb"))
    a = math.radians(WOOD_A + 3)
    L.append(item("polkky", math.sin(a) * 10.2, math.cos(a) * 10.2, 0.8, file="homestead.glb"))
    # emännän keittopaikka talon edessä: penkki seinustalla ja pata kivillä (household.glb)
    x, z = from_local(HOUSE, -1.9, 3.15)
    L.append(item("penkki", x, z, HOUSE["yaw"], file="household.glb"))
    x, z = from_local(HOUSE, 2.3, 4.8)
    L.append(item("pata", x, z, HOUSE["yaw"] + 0.6, file="household.glb"))
    # punosaita kehänä kuten world.ts:ssä; rakennusten kohdalta aita jää pois
    step = 2.0 / FENCE_R
    a = GATE_HALF + step / 2
    while a < math.tau - GATE_HALF - step / 2 + 1e-6:
        rr = FENCE_R + math.sin(a * 3.1) * 0.25
        x, z = math.sin(a) * rr, math.cos(a) * rr
        if not blocked(x, z, 0.9):
            L.append(item("aita", x, z, a + math.sin(a * 7) * 0.06, file="homestead.glb"))
        a += step
    for s in (-1, 1):
        L.append(item("portinpieli", math.sin(s * GATE_HALF) * FENCE_R, math.cos(s * GATE_HALF) * FENCE_R, s, file="homestead.glb"))
    return L


def footprints():
    return [HOUSE, STOREHOUSE, SMITHY]


def blocked(x, z, pad):
    for f in footprints():
        s, c = math.sin(f["yaw"]), math.cos(f["yaw"])
        dx, dz = x - f["x"], z - f["z"]
        lx, lz = dx * c - dz * s, dx * s + dz * c
        if abs(lx) < f["hx"] + pad and -f["back"] - pad < lz < f["front"] + pad:
            return True
    return False                     # kauppapaikka on aidan sisäpuolella, se ei poista aitaa


# Hahmojen paikat (pajan Blender-koordinaateissa) ja katsesuunta pajan paikallisena kulmana:
# 0 = kohti pajan takaseinää (+Y), pi = pihalle päin.
FOLK = {
    "seppa_alasin": ((0.35, -0.4), 0.0, 1.8),     # takoo alasimella
    "seppa_ahjo": ((-0.75, 0.05), 0.0, 1.8),       # kääntää rautaa ahjossa
    "seppa_kauppa": ((-1.25, -2.55), math.pi, 1.8),  # pöydän takana pihalle päin
    "salli_palkeet": ((-3.3, 0.9), -math.pi / 2, 1.75),  # pumppaa palkeita kasvot ahjoon (+X)
    "salli_kivialasin": ((1.45, -1.0), 0.0, 1.75),
    "lapsi_hiilet": ((-1.4, -1.0), -0.35, 1.35),  # kantaa hiiliä korista ahjoon
}


TRADE_SPOT = (-0.1, -4.4)     # sankarin paikka kauppapaikalla (pajan koordinaatit), katse pajaan


def folk_points():
    out = {}
    for k, ((bx, by), ang, h) in FOLK.items():
        x, z = smithy_pt(bx, by)
        # katse pajan +Y-suuntaan = pelissä pajan yaw + pi (etusivu osoittaa yawiin)
        out[k] = dict(x=round(x, 2), z=round(z, 2), yaw=round(SMITHY["yaw"] + math.pi + ang, 3), height=h)
    return out


# ---------- kokoaminen Blenderiin ----------
def to_blender(ob, x, z, yaw):
    ob.matrix_world = Matrix.Translation((x, -z, 0)) @ Matrix.Rotation(yaw, 4, 'Z') @ ob.matrix_world


def compose():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    build_smithy(export=False)
    game = bpy.data.collections["GAME"]
    protos = {o.name: o for o in game.objects if o.type == 'MESH'}
    lib = bpy.data.collections.new("LIB")
    bpy.context.scene.collection.children.link(lib)
    for f in (build_smith_house, build_storehouse, build_woodpile, build_block, build_fence, build_gatepost):
        o = f(lib)
        protos[o.name] = o
    make_household_materials()        # household.glb:n esineet omilla materiaaleillaan (tyhjentää MATS:n)
    for f in (build_table, build_bench, build_pot):
        o = f(lib)
        protos[o.name] = o
    yard = bpy.data.collections.new("YARD")
    bpy.context.scene.collection.children.link(yard)
    smithy_names = {"paja", "paja_katto", "ahjo", "ahjo_hiillos", "palkeet", "paja_rekvisiitta", "keihasteline",
                    "saarisuojat_myytavat", "poyta_aihiot"}
    for it in layout():
        src = protos[it["name"]]
        if it["name"] in smithy_names:
            # pajan solmut ja niiden tyhjät pisteet siirretään paikalleen sellaisinaan
            to_blender(src, it["x"], it["z"], it["yaw"])
            continue
        o = src.copy()
        yard.objects.link(o)
        o.matrix_world = Matrix.Identity(4)
        to_blender(o, it["x"], it["z"], it["yaw"])
    lib.hide_render = True
    for o in lib.objects:
        o.hide_render = True
    return yard


def label(text, x, z, size=0.9, h=0.05):
    cu = bpy.data.curves.new("lbl_" + text, 'FONT')
    cu.body = text
    cu.size = size
    cu.align_x = 'CENTER'
    o = bpy.data.objects.new("lbl_" + text, cu)
    o.location = (x, -z, h)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(bpy.data.materials["pv_lbl"])
    o.hide_render = True
    return o


def ring(name, r, mat, w=0.06):
    bm = bmesh.new()
    n = 160
    vo = [bm.verts.new((math.cos(i / n * math.tau) * (r + w), math.sin(i / n * math.tau) * (r + w), 0.03)) for i in range(n)]
    vi = [bm.verts.new((math.cos(i / n * math.tau) * (r - w), math.sin(i / n * math.tau) * (r - w), 0.03)) for i in range(n)]
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new([vi[i], vi[j], vo[j], vo[i]])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    me.materials.append(mat)
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.hide_render = True
    return o


def preview(prefix):
    sc = bpy.context.scene
    def mk(n, c, emit=0.0):
        m = bpy.data.materials.new(n)
        try:
            m.use_nodes = True
        except Exception:
            pass
        bsdf = m.node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Base Color"].default_value = c
        bsdf.inputs["Roughness"].default_value = 0.95
        if emit:
            bsdf.inputs["Emission Color"].default_value = c
            bsdf.inputs["Emission Strength"].default_value = emit
        m.diffuse_color = c
        return m
    gm = mk("pv_g", (0.2, 0.24, 0.12, 1))
    dm = mk("pv_dirt", (0.24, 0.2, 0.15, 1))
    mk("pv_lbl", (0.95, 0.85, 0.2, 1), emit=3.0)
    for nm, r, z, m in (("pv_ground", 60, 0.0, gm), ("pv_yarddirt", 15.0, 0.004, dm)):
        bm = bmesh.new()
        bm.faces.new([bm.verts.new((math.cos(i / 64 * math.tau) * r, math.sin(i / 64 * math.tau) * r, z)) for i in range(64)])
        me = bpy.data.meshes.new(nm)
        bm.to_mesh(me)
        me.materials.append(m)
        sc.collection.objects.link(bpy.data.objects.new(nm, me))
    # hahmojen paikkamerkit: seppä ja sälli 1,8 m, lapsi 1,35 m
    fm = {"seppa": mk("pv_smith", (0.55, 0.25, 0.15, 1)), "salli": mk("pv_appr", (0.25, 0.35, 0.6, 1)),
          "lapsi": mk("pv_child", (0.75, 0.65, 0.2, 1))}
    refs = []
    for k, p in folk_points().items():
        if k in ("seppa_ahjo", "seppa_kauppa", "salli_kivialasin"):
            continue                       # vaihtoehtoiset paikat näkyvät vain kartassa
        bpy.ops.mesh.primitive_cylinder_add(radius=0.2 if not k.startswith("lapsi") else 0.15, depth=p["height"],
                                            location=(p["x"], -p["z"], p["height"] / 2))
        o = bpy.context.active_object
        o.name = "pv_" + k
        o.data.materials.append(fm[k.split("_")[0]])
        refs.append(o)
    hero_m = mk("pv_hero", (0.8, 0.8, 0.85, 1))

    def hero_at(x, z):
        bpy.ops.mesh.primitive_cylinder_add(radius=0.2, depth=1.8, location=(x, -z, 0.9))
        o = bpy.context.active_object
        o.data.materials.append(hero_m)
        return o
    # tasokartan apuviivat ja nimet (vain kuvassa a)
    lm = mk("pv_line", (0.9, 0.9, 0.9, 1), emit=1.5)
    cm = mk("pv_cam", (0.9, 0.3, 0.2, 1), emit=1.5)
    helpers = [ring("pv_fence", FENCE_R, lm), ring("pv_cammax", CAM_MAX_R, cm, 0.04)]
    tx, tz = smithy_pt(-0.2, -3.9)
    for t, (x, z) in (("SEPÄN TALO", (HOUSE["x"], HOUSE["z"] - 0.5)), ("AITTA", (STOREHOUSE["x"] - 0.6, STOREHOUSE["z"] + 2.6)),
                      ("PAJA", smithy_pt(0, 3.4)), ("KAUPPA", (tx, tz)), ("PORTTI", (0, FENCE_R + 1.6)),
                      ("PINOT", (math.sin(math.radians(WOOD_A)) * 9.6, math.cos(math.radians(WOOD_A)) * 9.6)), ("POHJOINEN", (-26, -15.5))):
        helpers.append(label(t, x, z))
    sun = bpy.data.objects.new("pv_sun", bpy.data.lights.new("pv_sun", 'SUN'))
    sun.data.energy = 4
    sun.rotation_euler = (0.75, 0.15, 2.3)
    sc.collection.objects.link(sun)
    wd = bpy.data.worlds.new("pv_world")
    wd.use_nodes = True
    bg = wd.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.7, 0.78, 0.85, 1)
    sc.world = wd
    cam = bpy.data.objects.new("pv_cam", bpy.data.cameras.new("pv_cam"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = 1280, 720

    gate_hero = (0.0, 10.5)                       # sankari juuri portin sisäpuolella, katse pohjoiseen
    tbl = smithy_pt(*TRADE_SPOT)                  # sankari kauppapaikalla pöydän ja telineen välissä
    heroes = [hero_at(*gate_hero), hero_at(*tbl)]

    def game_cam(hx, hz, tx_, tz_):
        """Pelikamera: 4,4 m sankarin takana katsesuuntaa vastaan ja 2,3 m korkealla, katse sankarin ohi."""
        d = Vector((tx_ - hx, tz_ - hz)).normalized()
        return (hx - d.x * 4.4, hz - d.y * 4.4), (hx + d.x * 3.0, hz + d.y * 3.0)
    g_pos, g_tgt = game_cam(*gate_hero, 0.0, 0.0)
    sx_, sz_ = smithy_pt(0, 0)
    fx, fz = smithy_pt(TRADE_SPOT[0], 0.0)
    t_pos, t_tgt = game_cam(*tbl, fx, fz)
    shots = [
        # nimi, kohde (x, z, korkeus), paikka (x, z, korkeus), polttoväli, orto, apuviivat näkyvissä
        ("a", (0, 0, 0), (0, 0, 60), 50, 64.0, True),
        ("b", (2.0, 1.0, 1.0), (-22.0, 26.0, 16.0), 32, None, False),
        ("c", (g_tgt[0], g_tgt[1], 1.2), (g_pos[0], g_pos[1], 2.3 + 0.9), 45, None, False),
        ("d", (t_tgt[0], t_tgt[1], 1.1), (t_pos[0], t_pos[1], 2.3 + 0.9), 45, None, False),
        ("e", (SMITHY["x"], SMITHY["z"], 1.2), (1.0, -3.0, 5.0), 35, None, False),       # paja pihalta
        ("f", (HOUSE["x"], HOUSE["z"], 2.0), (9.0, 3.0, 4.5), 30, None, False),        # talo ja pinot
    ]
    only = os.environ.get("KALEVALA_SHOTS")
    for name, tgt, pos, lens, ortho, show in shots:
        if only and name not in only:
            continue
        for h in helpers:
            h.hide_render = not show
        for h in heroes:
            h.hide_render = show
        bpy.data.objects["paja_katto"].hide_render = show
        cam.location = Vector((pos[0], -pos[1], pos[2]))
        tv = Vector((tgt[0], -tgt[1], tgt[2]))
        cam.rotation_euler = (tv - cam.location).to_track_quat('-Z', 'Y').to_euler() if not ortho else (0, 0, 0)
        cam.data.type = 'ORTHO' if ortho else 'PERSP'
        if ortho:
            cam.data.ortho_scale = ortho
        cam.data.lens = lens
        sc.render.filepath = prefix + "_" + name + ".png"
        bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    compose()
    print("LAYOUT_JSON " + json.dumps({"smithy": {k: round(v, 4) for k, v in SMITHY.items()},
                                      "house": {k: round(v, 4) for k, v in HOUSE.items()},
                                      "storehouse": {k: round(v, 4) for k, v in STOREHOUSE.items()},
                                      "folk": folk_points(),
                                      "trade_spot": [round(v, 2) for v in smithy_pt(*TRADE_SPOT)],
                                      "items": [i for i in layout() if i["name"] != "aita"],
                                      "fence_pieces": sum(1 for i in layout() if i["name"] == "aita")}))
    pv = os.environ.get("KALEVALA_PREVIEW")
    if pv:
        preview(pv)
