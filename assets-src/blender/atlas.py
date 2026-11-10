"""Kokoaa kaikki oksakortit yhteen 2048x2048 RGBA-atlakseen.
Edellyttää: cards.py ja sprigs.py on ajettu (exec) samaan nimiavaruuteen.
Tulos: assets-src/cards/foliage_atlas.png ja atlas.json (UV-ruudut ja koot metreinä).
"""
import json

ATLAS = 2048
# nimi: (lähdeobjektit, näkymä, x, y, w, h)  — y alhaalta, pikseleinä
CELLS = {
    "fir_side":   ("fir_dense", "side", 0, 1024, 683, 1024),
    "pine_side":  ("pine_dense", "side", 683, 1024, 683, 1024),
    "pine_side2": ("pine_dense2", "side", 1366, 1024, 682, 1024),
    "fir_top":    ("fir_top_dense", "top", 0, 512, 512, 512),
    "pine_top":   ("pine_dense", "top", 512, 512, 512, 512),
    "birch":      (["sprig_birch"], "side", 1024, 512, 512, 512),
    "birch2":     (["sprig_birch2"], "side", 1536, 512, 512, 512),
    "bilberry":   (["sprig_bilberry"], "side", 0, 256, 512, 256),
    "lingon":     (["sprig_lingon"], "side", 512, 256, 512, 256),
    "heather":    (["sprig_heather"], "side", 1024, 256, 512, 256),
    "bilberry2":  (["sprig_bilberry2"], "side", 1536, 256, 512, 256),
    "fir_top2":   (["fir_sapling_b"], "top", 0, 0, 256, 256),
    "fir_side2":  ("fir_dense2", "side", 256, 0, 256, 256),
}


# Tiheämmät oksat: useita taimia päällekkäin eri kulmissa (objekti, kierto z, skaala).
COMBOS = {
    "fir_dense": [("fir_sapling_a", 0, 1), ("fir_sapling_b", 1.9, 1.3), ("fir_sapling_c", 3.9, 1.6), ("fir_sapling_a", 2.9, 0.9)],
    "fir_dense2": [("fir_sapling_b", 0.5, 1.35), ("fir_sapling_a", 2.2, 1), ("fir_sapling_c", 4.4, 1.7)],
    "fir_top_dense": [("fir_sapling_a", 0, 1), ("fir_sapling_b", 1.0, 1.25)],
    "pine_dense": [("pine_sapling_small_a", 0, 1), ("pine_sapling_small_b", 2.1, 1.2), ("pine_sapling_small_c", 4.2, 1.3)],
    "pine_dense2": [("pine_sapling_small_b", 0.7, 1.2), ("pine_sapling_small_c", 2.6, 1.3), ("pine_sapling_small_a", 4.6, 0.95)],
}


def make_combos(col):
    out = {}
    for o in [o for o in bpy.data.objects if o.name.startswith("combo_")]:
        bpy.data.objects.remove(o, do_unlink=True)
    for i, (name, parts) in enumerate(COMBOS.items()):
        names = []
        for j, (src, rz, sc) in enumerate(parts):
            ob = bpy.data.objects[src].copy()
            ob.name = "combo_%s_%d" % (name, j)
            col.objects.link(ob)
            ob.location = (60 + 10 * i, 40, 0)
            ob.rotation_mode = 'XYZ'
            ob.rotation_euler = (0, 0, rz)
            ob.scale = (sc, sc, sc)
            names.append(ob.name)
        out[name] = names
    return out


def build_atlas():
    col = bpy.data.collections.get("SRC_sprigs")
    if not col:
        col = bpy.data.collections.new("SRC_sprigs")
        bpy.data.collections["SRC"].children.link(col)
    birch_twig("sprig_birch", 3, col).location = (0, 20, 0)
    birch_twig("sprig_birch2", 11, col).location = (0, 24, 0)
    shrub_patch("sprig_bilberry", 5, col, "bilberry").location = (2, 20, 0)
    shrub_patch("sprig_bilberry2", 15, col, "bilberry").location = (2, 24, 0)
    shrub_patch("sprig_lingon", 6, col, "lingon").location = (4, 20, 0)
    shrub_patch("sprig_heather", 7, col, "heather").location = (6, 20, 0)
    combos = make_combos(col)
    bpy.context.view_layer.update()

    atlas = np.zeros((ATLAS, ATLAS, 4), dtype=np.float32)
    meta = {}
    for name, (objs, view, x, y, w, h) in CELLS.items():
        if isinstance(objs, str):
            objs = combos[objs]
        r = render_card(objs, "cell_" + name, view, w, h)
        px = load_px(r["path"])
        # varvut renderöityvät tummina; vaalennetaan, etteivät ne näytä pelissä mustilta siluetilta
        gain = 1.7 if name in ("bilberry", "bilberry2", "lingon", "heather") else 1.0
        px[..., :3] = np.clip(px[..., :3] * gain, 0, 1)
        atlas[y:y + h, x:x + w] = px
        meta[name] = {"uv": [x / ATLAS, y / ATLAS, (x + w) / ATLAS, (y + h) / ATLAS],
                      "w": r["world_w"], "h": r["world_h"]}
        os.remove(r["path"])
    atlas = dilate_rgba(atlas, 20)
    path = os.path.join(CARDS, "foliage_atlas.png")
    save_px(atlas, path, "foliage_atlas")
    with open(os.path.join(CARDS, "atlas.json"), "w") as f:
        json.dump(meta, f, indent=1)
    return meta
