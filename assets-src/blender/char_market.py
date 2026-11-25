"""Markkinapaikan miehet: vierasmaalainen kauppias sekä seppä ja sälli markkina-asussa.

Kaikki kolme ovat vakiomiehen vartalolla (BODY) ja luurangolla (RIG), joten peli animoi ne samalla
koodilla kuin tietäjän, sepän ja sällin (lepoasento, luiden kierrot ja roll ennallaan, ei uusia luita).
Skripti lukee char_pohja.py:n (joka lukee char_smith_child.py:n -> char_smith.py:n -> char_folk.py:n),
joten sepän ja sällin kasvot, hiukset, parta ja otsanauha tulevat samoista osafunktioista ja samoilla
arvoilla kuin smithfolk.glb:ssä.

Tulos: kokoelma MARKETFOLK ja tiedosto assets/marketfolk.glb luurankoineen (RIG):
- char_kauppias: vierasmaalainen kauppamies meren takaa (Gotlanti / Viron rannikko). Syvänsininen
  pellavatunika polvien yläpuolelle, kauluksessa ja hihansuissa punakeltainen lautanauha.
  Viininpunainen villanuttu (päällekkäin kiedottu, lyhyt helma lantion alle, puolihihat), reunoissa
  keltapunainen nauha. Nahkavyö nutun päällä: pronssisolki ja 14 pronssihelaa (vuorotellen soikea ja
  neliskulmainen), vasemmalla nahkakukkaro, oikealla puukko tupessa. Kierretty pronssinen kaularengas
  (torques), aukko ja nupit edessä. Tummat villahousut, lyhytvartiset nahkasaapikkaat (varsi puoleen
  sääreen, käänne ja kaksi nauhasidosta, edessä ristiinpujotus). Tummanruskea tukka, lyhyeksi
  leikattu harmaantuva parta ja viikset. Ei viittaa.
- char_seppa_markkina: char_seppa (samat kasvot, parta, hiukset, otsanauha, housut, säärikääreet ja
  kengät) ilman nahkaesiliinaa: puhdas ruskea villatunika hihat alhaalla, hihansuissa lautanauha,
  oliivinharmaa villainen hartiaviitta (auki oikealla, pronssinen rengassolki), vyö ja puukko.
- char_salli_markkina: char_salli (samat kasvot ja vaalea tukka) ilman esiliinaa: vaalea
  pellavatunika hihat alhaalla (käännetyt hihansuut), punaruskea suippo huopalakki käänteineen,
  nahkalaukku selässä vasemmalla ja kantohihna oikean olan yli vinosti rinnan poikki.

Mitat ja suunnat: pituus 1,70 m (sällin lakki 1,78 m), origo maan tasossa jalkojen välissä, kasvot -Y:hen
(pelissä +Z), Z ylös. Kolmiot: kauppias 28 856, seppä 25 902, sälli 25 278 (kenkäkuoret kevennetty Decimatella);
marketfolk.glb 4,6 Mt.
Törmäysehdotus kaikille: pystysylinteri / ympyrä r = 0,28 m (kauppiaan kukkaro ja puukko mahtuvat),
korkeus 1,8 m. Ei tyhjiä kiinnityspisteitä (puukot ja laukku ovat osa verkkoa).

Kerrosvälit mitataan kuten char_smith.apron_clearance / char_modular_check.layer_margin: ulomman
kerroksen verteksin ja lähimmän sisemmän pinnan pisteen etäisyyksien erotus vartalosta (BODY samassa
asennossa); negatiivinen = sisempi tulee läpi. Asennot: lepo (kädet alhaalla kuten pelissä) ja
SMITH_POSES (kävely + kolme työasentoa).

Aja taustalla characters.blendin KOPIOLLA (lähdetiedostoa ei muuteta eikä tallenneta):
    blender --background kopio.blend --python ajo.py
    ajo.py: FOLK_DIR = r"...\\assets-src\\blender"
            exec(open(FOLK_DIR + r"\\char_market.py", encoding="utf-8").read())
            print(run_market(preview_dir=r"...", out_dir=r"...\\assets", save=False))
Ympäristömuuttujat: KALEVALA_TEXDIR (laskettujen tekstuurien kansio rinnakkaisajoissa).
"""
import os, io, contextlib, traceback, math, random

_MB = globals().get("FOLK_DIR") or (os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else r"C:\Data\3D Kalevala\assets-src\blender")
FOLK_DIR = _MB
exec(open(os.path.join(_MB, "char_pohja.py"), encoding="utf-8").read().rsplit('\nif __name__ == "__main__":', 1)[0])
TEXDIR = os.environ.get("KALEVALA_TEXDIR", TEXDIR)

COL_M = "MARKETFOLK"
MK_RANGES = {}           # hahmo -> {osa: [(ensimmäinen verteksi, määrä), ...]} mittauksia varten
MK_EXTRA = {}            # hahmo -> lisätiedot (kaularenkaan rengasjako ym.)

# Värit lineaarisina kuten muillakin hahmoilla.
BLUE = (0.1, 0.15, 0.3)              # morsinkosininen pellava (pellavatekstuuri on itsessään sinertävä):
                                     # kirkkaampi ja tasaisempi kuin kyläläisten luonnonvärit
WINE = (0.2, 0.03, 0.035)            # viininpunainen villanuttu
BRONZE = (0.62, 0.42, 0.14)
BRONZE_HI = (0.74, 0.53, 0.2)
BRONZE_LO = (0.34, 0.22, 0.07)


# ---------- tekstuurit ----------
def lauta_px(kind, w=256, h=64):
    """Lautanauha. 'pk': punainen pohja, keltainen vinoneliö-koukkukuvio ja keltaiset reunat.
    'kp': keltainen pohja, pienet punaiset vinoneliöt ja tummat reunat (nutun reunanauha)."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    u = (xx / w * 8) % 1.0
    v = yy / h
    red = np.array([0.46, 0.06, 0.035], dtype=np.float32)
    yel = np.array([0.78, 0.56, 0.14], dtype=np.float32)
    dark = np.array([0.12, 0.04, 0.025], dtype=np.float32)
    d = np.abs(u - 0.5) + np.abs(v - 0.5) * 1.25
    if kind == "pk":
        px = np.broadcast_to(red, (h, w, 3)).copy()
        m = (np.abs(d - 0.27) < 0.065) | ((np.abs(u - 0.5) < 0.07) & (np.abs(v - 0.5) < 0.07))
        m |= (np.minimum(u, 1 - u) < 0.05) & (np.abs(v - 0.5) < 0.2)               # koukut vinoneliöiden välissä
        px[m] = yel
        px[(v < 0.1) | (v > 0.9)] = yel
        px[(v < 0.04) | (v > 0.96)] = dark
    else:
        px = np.broadcast_to(yel, (h, w, 3)).copy()
        px[(d < 0.22) & (d > 0.08)] = red
        px[(np.abs(v - 0.15) < 0.05) | (np.abs(v - 0.85) < 0.05)] = red
        px[(v < 0.05) | (v > 0.95)] = dark
    twill = 0.88 + 0.12 * np.sin((xx + yy) * 1.6)           # lautojen kierteen vino juova
    return np.clip(px * twill[..., None], 0, 1)


def market_materials():
    folk_materials()
    for k in ("pk", "kp"):
        name = "M_MK_Trim_" + k
        m = bpy.data.materials.get(name)
        if not m:
            m = pbr(name, img_from_px(lauta_px(k), "mk_lauta_" + k), None, rough=0.85, twosided=True)
        CM["trim_" + k] = m
    return CM


# ---------- apurit ----------
class Track:
    """Kerää osat ja muistaa kunkin osaryhmän verteksivälit koottua verkkoa varten."""
    def __init__(self):
        self.P, self.R = [], {}

    def add(self, key, parts):
        s = sum(len(p.co) for p in self.P)
        self.P += parts
        if key:
            self.R.setdefault(key, []).append((s, sum(len(p.co) for p in parts)))
        return parts


def vert_normals(p, C):
    """Verteksinormaalit osan omista tahkoista (Newell); käännetään ulospäin vartalosta."""
    nrm = [V((0, 0, 0)) for _ in p.co]
    for idx, *_ in p.faces:
        pts = [p.co[i] for i in idx]
        n = V((0, 0, 0))
        for k in range(len(pts)):
            a, b = pts[k], pts[(k + 1) % len(pts)]
            n += V(((a.y - b.y) * (a.z + b.z), (a.z - b.z) * (a.x + b.x), (a.x - b.x) * (a.y + b.y)))
        for i in idx:
            nrm[i] += n
    nrm = [n.normalized() if n.length > 1e-12 else V((0, 0, 1)) for n in nrm]
    s = sum(n.dot(c - C.co[C.kd.find(c)[1]]) for n, c in zip(nrm, p.co))
    return nrm if s >= 0 else [-n for n in nrm]


def offset_part(C, src, dist, keep, mat, col):
    """Päällysvaate alemman kerroksen pinnasta: tahkot, joille keep(keskipiste, tahko) on tosi, siirretään
    verteksinormaalia pitkin dist metriä ulos. Painot ja UV:t samat kuin alemmalla, joten väli säilyy
    myös asennoissa."""
    nrm = vert_normals(src, C)
    p = Part()
    remap = {}
    for idx, m, uvs, c0, sm in src.faces:
        c = sum((src.co[i] for i in idx), V()) / len(idx)
        if not keep(c, idx):
            continue
        new = []
        for i in idx:
            if i not in remap:
                remap[i] = p.v(src.co[i] + nrm[i] * dist, dict(src.w[i]))
            new.append(remap[i])
        p.f(new, mat, uvs, col)
    return p


def arm_share(w):
    return sum(v for k, v in w.items() if k.rsplit("_", 1)[0] in ARM)


def skirt_rows(C, zs, z_top, z_bot, off, hem, mat, tile=0.14, n=28, col=(1, 1, 1), trim_rows=(), trim=None, extra=0.0, wav_amp=0.035):
    """Kuten char_build.skirt, mutta rivien korkeudet annetaan (zs). extra > 0 tekee päällyshelman, joka on
    säteittäin extra metriä saman parametrisen helman ulkopuolella; painot lasketaan alemman helman
    pisteestä, joten kerrokset liikkuvat yhdessä."""
    ctr = V((0, 0.02, z_top))
    rad, e1, e2 = ring_profile(C, ctr, V((0, 0, 1)), V((0, -1, 0)), n, keep=lambda i, c: abs(c.x) < 0.2)
    p = Part()
    rings = []
    for z in zs:
        s = min(1.0, max(0.0, (z_top - z) / (z_top - z_bot))) ** 0.8
        ring = []
        for k in range(n):
            a = (k + 0.5) / n * 2 * math.pi
            r_h = 1.0 / math.sqrt((math.cos(a) / hem[1]) ** 2 + (math.sin(a) / hem[0]) ** 2)
            r = ((rad[k] + off) * (1 - s) + r_h * s) * (1 + wav_amp * math.sin(a * 7) * s)
            d = e1 * math.cos(a) + e2 * math.sin(a)
            base = V((0, 0.02, z)) + d * r
            ring.append(p.v(base + d * extra, C.near_w(V((base.x * 0.6, base.y * 0.6 + 0.01, z)), 4, blend=("hips", 0.45))))
        rings.append(ring)
    circ = 2 * math.pi * 0.2
    for j in range(len(zs) - 1):
        for k in range(n):
            k2 = (k + 1) % n
            q = [rings[j][k], rings[j][k2], rings[j + 1][k2], rings[j + 1][k]]
            if j in trim_rows:
                p.f(q, trim, [(k / n * 6, 1), ((k + 1) / n * 6, 1), ((k + 1) / n * 6, 0), (k / n * 6, 0)])
            else:
                u0, u1 = k / n * circ / tile, (k + 1) / n * circ / tile
                p.f(q, mat, [(u0, zs[j] / tile), (u1, zs[j] / tile), (u1, zs[j + 1] / tile), (u0, zs[j + 1] / tile)], col)
    return p


def part_bvh(parts):
    co, polys, base = [], [], 0
    for t in parts:
        co += [tuple(c) for c in t.co]
        polys += [tuple(i + base for i in f[0]) for f in t.faces]
        base += len(t.co)
    return BVHTree.FromPolygons(co, polys)


def surface_out(bvh, a, z, ctr_y=0.02):
    """Pisteen kulmassa a (0 = edessä -Y, +pi/2 = +X) ja korkeudella z ulkopinta: säde heitetään ulkoa
    akselia kohti. Palauttaa (piste, ulospäin osoittava vaakasuunta)."""
    d = V((math.sin(a), -math.cos(a), 0))
    o = V((0, ctr_y, z)) + d * 0.8
    hit = bvh.ray_cast(o, -d, 1.0)
    return (hit[0] if hit[0] is not None else V((0, ctr_y, z)) + d * 0.2), d


class NearW:
    """Painot alemman kerroksen lähimmistä vertekseistä; noarm=True jättää käsivarren luut pois (hihnat ja
    vyöesineet eivät saa seurata käsiä)."""
    def __init__(self, parts, noarm=False):
        self.co = [c for p in parts for c in p.co]
        self.w = [w for p in parts for w in p.w]
        self.kd = kdtree.KDTree(len(self.co))
        for i, c in enumerate(self.co):
            self.kd.insert(c, i)
        self.kd.balance()
        self.noarm = noarm

    def __call__(self, pt, k=3):
        acc = {}
        for _, j, _ in self.kd.find_n(pt, k):
            for g, x in self.w[j].items():
                if self.noarm and g.rsplit("_", 1)[0] in ARM:
                    continue
                acc[g] = acc.get(g, 0.0) + x
        s = sum(acc.values())
        return {g: x / s for g, x in acc.items()} if s > 0 else {"chest": 1.0}


def rigid_w(C, under, pt, k=6):
    """Jäykän esineen painot: keskiarvo alemman kerroksen lähimmistä vertekseistä (ilman käsiä)."""
    return NearW(under, noarm=True)(pt, k)


def set_w(parts, w):
    for p in parts:
        p.w = [dict(w) for _ in p.co]
    return parts


def hull_loop(pts, ctr, axis, ref, slab, nb=48, rmax=0.3, dil=1, passes=3):
    """Pisteiden ulkoreuna kallistetussa tasossa (ctr, axis): säde kulman funktiona, kun mukaan otetaan
    pisteet enintään slab metrin päästä tasosta. Laaksot pehmennetään (dil, passes), mutta säde ei koskaan
    mene mitatun alle. Palauttaa (R(a), e1, e2); a = 0 on ref-suunta."""
    e1 = (ref - axis * ref.dot(axis)).normalized()
    e2 = axis.cross(e1)
    prof = [0.0] * nb
    for c in pts:
        d = c - ctr
        if abs(d.dot(axis)) > slab:
            continue
        x, y = d.dot(e1), d.dot(e2)
        r = math.hypot(x, y)
        if r > rmax:
            continue
        k = int(((math.atan2(y, x) + 2 * math.pi) % (2 * math.pi)) / (2 * math.pi) * nb) % nb
        prof[k] = max(prof[k], r)
    for _ in range(nb):
        if all(prof):
            break
        prof = [prof[k] if prof[k] > 0 else max(prof[k - 1], prof[(k + 1) % nb]) for k in range(nb)]
    r = prof[:]
    for _ in range(dil):
        r = [max(r[k - 1], r[k], r[(k + 1) % nb]) for k in range(nb)]
    for _ in range(passes):
        r = [max(prof[k], (r[k - 1] + 2 * r[k] + r[(k + 1) % nb]) / 4) for k in range(nb)]
    return (lambda a: _interp(r, a)), e1, e2


def body_bvh(C):
    return BVHTree.FromPolygons(C.co, [tuple(p.vertices) for p in C.body.data.polygons])


def push_out(C, parts, under, gap=0.01, iters=2, maxd=0.06, body_gap=0.008):
    """Lepoasennon korjaus: päällysosan verteksi, joka on alle gap metriä alemman kerroksen ulkopuolella
    (mitattuna kuten layer_margin, etäisyys vartalosta) tai alle body_gap metriä paljaan vartalon (kaula,
    kädet) ulkopuolella, siirretään vartalosta poispäin. Palauttaa siirrettyjen määrän."""
    bb = body_bvh(C)
    bu = part_bvh(under)
    moved = 0
    for _ in range(iters):
        for p in parts:
            for i, c in enumerate(p.co):
                bp, bn, _, dp = bb.find_nearest(c)
                sd = dp if (c - bp).dot(bn) >= 0 else -dp
                if sd < body_gap:
                    c = p.co[i] = c + bn.normalized() * (body_gap - sd)
                    bp, _, _, dp = bb.find_nearest(c)
                    moved += 1
                q, _, _, dq = bu.find_nearest(c)
                if q is None or dq > maxd:
                    continue
                m = dp - bb.find_nearest(q)[3]
                if m < gap and dp > 1e-5:
                    p.co[i] = c + (c - bp).normalized() * (gap - m + 0.001)
                    moved += 1
    return moved


def decimate_part(C, part, ratio, tile=0.2):
    """Kevennetty kopio tiheästä kuoriosasta (kengät): Blenderin Decimate (collapse), painot vartalon
    lähimmistä vertekseistä ja UV:t sylinteriprojektiona kuten shell(). Väri ja materiaali säilyvät."""
    me = bpy.data.meshes.new("_dec")
    me.from_pydata([tuple(c) for c in part.co], [], [list(f[0]) for f in part.faces])
    me.update()
    ob = bpy.data.objects.new("_dec", me)
    bpy.context.scene.collection.objects.link(ob)
    m = ob.modifiers.new("dec", 'DECIMATE')
    m.ratio = ratio
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    m2 = ev.to_mesh()
    mat, col = part.faces[0][1], part.faces[0][3]
    p = Part()
    for v in m2.vertices:
        p.v(v.co.copy(), C.near_w(v.co))
    for pl in m2.polygons:
        pts = [p.co[i] for i in pl.vertices]
        c = sum(pts, V()) / len(pts)
        p.f(list(pl.vertices), mat, cyl_uvs(pts, C.seg_frame(p.w[pl.vertices[0]], c), tile), col)
    ev.to_mesh_clear()
    bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.meshes.remove(me)
    return p


# ---------- kauppiaan osat ----------
def nuttu_parts(C, tunic, tunic_skirt_args, zs):
    """Viininpunainen nuttu tunikan päällä: runko ja puolihihat tunikan pinnasta 13 mm ulos, helma
    saman parametrisen helman päälle 14 mm ulos (lantion alle, viimeinen rivi reunanauhaa)."""
    def keep(c, idx):
        w = {}
        for i in idx:
            for g, x in tunic.w[i].items():
                w[g] = w.get(g, 0.0) + x / len(idx)
        if arm_share(w) > 0.5:
            return C.arm_t(c) < 0.47
        return (c.z - 0.35 * c.y) < 1.392
    torso = offset_part(C, tunic, 0.013, keep, "wool", WINE)
    z_top, z_bot, off, hem = tunic_skirt_args
    sk = skirt_rows(C, zs, z_top, z_bot, off, hem, "wool", col=WINE, trim_rows={len(zs) - 2}, trim="trim_kp", extra=0.014)
    trims = collar_band(C, "trim_kp", off=0.033, width=0.024, z=1.383)
    trims += cuff_parts(C, 0.465, "trim_kp", 0.036, width=0.032)
    # päällekkäisliepeen reuna kauluksesta vinosti vasemmalle kupeelle ja helmaa pitkin alas
    trims.append(surface_strip([torso], [(-0.05, 1.372), (0.0, 1.30), (0.06, 1.17), (0.09, 1.03)], 0.03, "trim_kp", off=0.004))
    trims.append(surface_strip([sk], [(0.095, 0.99), (0.1, 0.84)], 0.03, "trim_kp", off=0.004))
    return [torso, sk], trims


class HullBelt:
    """Nahkavyö alla olevien vaatteiden päällä: säde vaatteiden ulkoreunasta vyön korkeudella + clear
    (hull_loop), joten vyö ei painu levenevän helman sisään selässäkään. band = ulkopinta, flange = ylä- ja
    alareunan sisäänpäin kääntyvä paksuus (painuu tarkoituksella kankaaseen, ei mitata)."""
    def __init__(self, C, under, z=1.0, width=0.046, clear=0.01, n=32, col=(0.62, 0.42, 0.3)):
        self.C, self.z, self.clear = C, z, clear
        self.ctr = V((0, 0.02, z))
        pts = [c for p in under for c, w in zip(p.co, p.w) if abs(c.z - z) < width / 2 + 0.015 and arm_share(w) < 0.5]
        self.R, self.e1, self.e2 = hull_loop(pts, self.ctr, V((0, 0, 1)), V((0, -1, 0)), width / 2 + 0.015, nb=36, dil=1, passes=2)
        self.band, self.flange = Part(), Part()
        circ = 2 * math.pi * 0.17

        def ring(p, dz, extra):
            out = []
            for k in range(n):
                a = (k + 0.5) / n * 2 * math.pi
                pt = self.ctr + V((0, 0, dz)) + self.d(a) * (self.R(a) + clear + extra)
                out.append(p.v(pt, C.near_w(V((pt.x, pt.y, z)))))
            return out
        lo, hi = ring(self.band, -width / 2, 0.0), ring(self.band, width / 2, 0.0)
        for k in range(n):
            k2 = (k + 1) % n
            u0, u1 = k / n * circ / 0.2, (k + 1) / n * circ / 0.2
            self.band.f([lo[k], lo[k2], hi[k2], hi[k]], "leather", [(u0, 0), (u1, 0), (u1, 1), (u0, 1)], col)
        dark = tuple(x * 0.7 for x in col)
        for dz, sg in ((-width / 2, -1), (width / 2, 1)):
            inn, out = ring(self.flange, dz, -0.016), ring(self.flange, dz, 0.0)
            for k in range(n):
                k2 = (k + 1) % n
                q = [inn[k], inn[k2], out[k2], out[k]] if sg < 0 else [out[k], out[k2], inn[k2], inn[k]]
                self.flange.f(q, "leather", [(0, 0), (1, 0), (1, 1), (0, 1)], dark, False)

    def d(self, a):
        return self.e1 * math.cos(a) + self.e2 * math.sin(a)

    def at(self, a, extra):
        return self.ctr + self.d(a) * (self.R(a) + self.clear + extra), self.d(a)

    def buckle(self):
        p0, d0 = self.at(0.0, 0.006)
        R0 = Matrix((V((1, 0, 0)), -d0, V((0, 0, 1)))).transposed()
        w0 = self.C.near_w(p0)
        return [box_part(p0, (0.052, 0.01, 0.058), "metal", w0, BRONZE, R0),
                box_part(p0 + d0 * 0.006, (0.032, 0.006, 0.034), "metal", w0, BRONZE_LO, R0),
                box_part(p0 + d0 * 0.008, (0.006, 0.006, 0.05), "metal", w0, BRONZE_HI, R0)]

    def helat(self):
        """14 pronssihelaa tasavälein, vuorotellen neliskulmainen levy ja soikea nuppi."""
        fit = []
        for i, a in enumerate([s * (0.42 + 0.36 * k) for s in (1, -1) for k in range(7)]):
            p, d = self.at(a, 0.003)
            t = V((0, 0, 1)).cross(d).normalized()
            R = Matrix((t, d, V((0, 0, 1)))).transposed()
            w = self.C.near_w(p)
            if i % 2 == 0:
                fit.append(box_part(p, (0.018, 0.005, 0.026), "metal", w, BRONZE_HI, R))
            else:
                disc = lathe(V((0, 0, 0)), [(0.0, 0.0035), (0.009, 0.0025), (0.011, 0.0)], 8, "metal", w, BRONZE_HI)
                for j, c in enumerate(disc.co):      # soikea nuppi: pyörähdysakseli z -> ulospäin
                    disc.co[j] = p + t * (c.x * 0.85) + V((0, 0, 1)) * (c.y * 1.25) + d * c.z
                fit.append(disc)
        return fit


def skirt_clear(bvh, a, zs, gap):
    """Kohta helman ulkopuolella kulmassa a: suurin pinnan etäisyys suunnassa d korkeuksilla zs + gap."""
    best, d = -1.0, None
    for z in zs:
        sp, d = surface_out(bvh, a, z)
        best = max(best, (sp - V((0, 0.02, sp.z))).dot(d))
    return best + gap, d


def belt_knife(belt, skirt, a=-0.95, tilt=-0.14, under_z=(0.84, 0.88, 0.92, 0.96)):
    """Puukko tupessa vyöltä riippuen, tuppi vähintään 10 mm helman ulkopuolella koko pituudeltaan."""
    bvh = part_bvh([skirt])
    r, d = skirt_clear(bvh, a, under_z, 0.009 + 0.01)
    t = V((0, 0, 1)).cross(d).normalized()
    R = Matrix((t, d, V((0, 0, 1)))).transposed() @ Matrix.Rotation(tilt, 3, 'Y')
    c0 = V((0, 0.02, belt.z - 0.085)) + d * r
    knife = [box_part(c0, (0.034, 0.018, 0.16), "leather", {}, (0.4, 0.27, 0.18), R),
             box_part(c0 + R @ V((0, 0, -0.078)), (0.036, 0.02, 0.012), "metal", {}, BRONZE, R)]
    htop = c0 + R @ V((0, 0, 0.08))
    knife.append(tube_part([htop, htop + R @ V((0, 0, 0.085))], [0.012, 0.014], 6, "wood", {}, (0.9, 0.75, 0.55)))
    knife.append(tube_part([htop + R @ V((0, 0, -0.004)), htop + R @ V((0, 0, 0.008))], [0.0145, 0.0145], 6, "metal", {}, BRONZE))
    return knife


def belt_pouch(belt, skirt, a=0.95):
    """Nahkainen kukkaro vyöltä nyörissä; pussi vähintään 10 mm helman ulkopuolella."""
    bvh = part_bvh([skirt])
    hd = 0.043 * 0.55
    r, d = skirt_clear(bvh, a, (0.85, 0.88, 0.91, 0.94), hd + 0.01)
    t = V((0, 0, 1)).cross(d).normalized()
    ctr = V((0, 0.02, 0.905)) + d * r
    prof = [(0.004, -0.06), (0.03, -0.056), (0.042, -0.035), (0.043, -0.005), (0.034, 0.02), (0.02, 0.032), (0.024, 0.04), (0.012, 0.046)]
    bag = lathe(V((0, 0, 0)), prof, 12, "leather", {}, (0.75, 0.55, 0.4), tile=0.1)
    for j, c in enumerate(bag.co):
        bag.co[j] = ctr + t * c.x + d * (c.y * 0.55) + V((0, 0, c.z))
    bag.f(list(range(len(bag.co) - 12, len(bag.co))), "leather", None, (0.4, 0.28, 0.2))
    top = ctr + V((0, 0, 0.046))
    bp, _ = belt.at(a, 0.002)
    cord = tube_part([top, top.lerp(bp, 0.5) + d * 0.006, bp + V((0, 0, -0.012))], [0.004] * 3, 5, "leather", {}, (0.5, 0.35, 0.25), cap=False)
    return [bag, cord]


def torques_parts(C, clothes, z=1.44, tilt=-0.42, tube=0.0068, gap=0.3, n=48, sides=9):
    """Kierretty pronssinen kaularengas kaulan tyvellä: renkaan muoto on kaulan, kauluksen ja vaatteiden
    ulkoreunan pehmennetty ääriviiva kallistetussa tasossa (edessä alempana, kauluksen nauhan yläpuolella,
    takana niskan tyvellä), joten rengas lepää uppoamatta eikä leiju. Aukko ja nupit edessä.
    Palauttaa (osat, renkaiden määrä, puolien määrä, keskiviiva, säde edessä)."""
    axis = V((0, tilt, 1)).normalized()
    ctr = V((0, 0.005, z))
    pts = [c for i, c in enumerate(C.co) if C.arm_frac[i] < 0.2 and (C.w[i].get("head", 0) < 0.5 or (c.z < 1.475 and c.y > -0.06)) and c.z > 1.28]
    pts += [c for p in clothes for c in p.co]
    nw = NearW(clothes)
    Rh, e1, e2 = hull_loop(pts, ctr, axis, V((0, -1, 0)), tube * 1.3, nb=40, rmax=0.24, dil=0, passes=4)
    R = lambda a: Rh(a) + tube + 0.0045
    angs = [gap + (2 * math.pi - 2 * gap) * i / (n - 1) for i in range(n)]
    cl = [ctr + (e1 * math.cos(a) + e2 * math.sin(a)) * R(a) for a in angs]
    p = Part()
    rings = []
    acc = 0.0
    for i, c in enumerate(cl):
        if i:
            acc += (c - cl[i - 1]).length
        tng = (cl[min(i + 1, n - 1)] - cl[max(i - 1, 0)]).normalized()
        nr = (c - ctr - axis * (c - ctr).dot(axis)).normalized()
        bn = tng.cross(nr).normalized()
        w = nw(c, 6)                                     # painot alla olevasta kauluksesta: rengas seuraa
                                                         # hartioiden pullistumaa, kun kädet lasketaan
        ring = []
        for k in range(sides):
            ph = k / sides * 2 * math.pi
            rr = tube * (1 + 0.2 * math.cos(3 * ph - acc / 0.016 * 2 * math.pi))
            ring.append(p.v(c + (nr * math.cos(ph) + bn * math.sin(ph)) * rr, w))
        rings.append((ring, acc))
    for i in range(n - 1):
        for k in range(sides):
            k2 = (k + 1) % sides
            ph = (k + 0.5) / sides * 2 * math.pi
            sh = 0.72 + 0.4 * (0.5 + 0.5 * math.cos(3 * ph - rings[i][1] / 0.016 * 2 * math.pi))
            p.f([rings[i][0][k], rings[i][0][k2], rings[i + 1][0][k2], rings[i + 1][0][k]], "metal", None, tuple(min(1.0, x * sh) for x in BRONZE))
    parts = [p]
    for i in (0, n - 1):                                  # nupit renkaan päissä, suunta aukkoa kohti
        c = cl[i]
        tng = (cl[0] - cl[1]).normalized() if i == 0 else (cl[-1] - cl[-2]).normalized()
        w = dict(p.w[rings[i][0][0]])
        parts.append(tube_part([c - tng * 0.003, c + tng * 0.004, c + tng * 0.012, c + tng * 0.02, c + tng * 0.024],
                               [0.006, 0.0095, 0.0115, 0.009, 0.003], 9, "metal", w, BRONZE_HI))
    return parts, n, sides, cl, R(0.0)


def trousers_boots(C, trousers_col, boot_col):
    """Tummat villahousut nilkkaan ja lyhytvartiset saapikkaat: varsi puoleen sääreen (31 cm), varren
    yläreunassa käänne, kaksi nauhasidosta ja edessä ristiinpujotus."""
    is_leg = (lambda i, c: (C.leg_frac[i] > 0.5 or (c.z < 1.03 and C.arm_frac[i] < 0.2)))
    tr = shell(C, lambda i, c: is_leg(i, c) and 0.22 < c.z < 1.03,
               lambda c: 0.012 + 0.03 * smoothstep(0.41, 0.47, c.z) * (1 - smoothstep(0.60, 0.70, c.z)), "wool", smooth=4, col=trousers_col)
    boot = shell(C, lambda i, c: is_leg(i, c) and c.z < 0.31, lambda c: 0.014 + 0.013 * smoothstep(0.08, 0.15, c.z), "leather",
                 tile=0.2, smooth=4, col=boot_col)
    zmin = min(c.z for c in boot.co)
    for c in boot.co:
        if c.z < 0.07:
            c.z -= (zmin + 0.004) * (1 - c.z / 0.07)
    parts = [decimate_part(C, boot, 0.45)]
    L = C.L
    lace_col = (0.85, 0.7, 0.5)
    for s in (1, -1):
        kn = V((L["knee"].x * s, L["knee"].y, L["knee"].z))
        an = V((L["ankle"].x * s, L["ankle"].y, L["ankle"].z))
        ax = (an - kn).normalized()
        keep = lambda i, c, s=s: c.x * s > 0.02 and C.leg_frac[i] > 0.5
        tz = lambda z: kn + (an - kn) * ((kn.z - z) / (kn.z - an.z))
        parts.append(band(C, tz(0.295), ax, V((0, -1, 0)), 0.034, 0.031, "leather", n=14, keep=keep, col=tuple(x * 0.8 for x in boot_col), flare=0.006, rows=2))
        for z in (0.24, 0.18):
            parts.append(band(C, tz(z), ax, V((0, -1, 0)), 0.008, 0.031, "leather", n=14, keep=keep, col=lace_col))
        # ristiinpujotus säären edessä
        rad, e1, e2 = ring_profile(C, tz(0.2), ax, V((0, -1, 0)), 14, keep=keep)
        pts = []
        for j in range(7):
            z = 0.115 + j * 0.022
            c = tz(z)
            a = (0.32 if j % 2 else -0.32)
            d = (e1 * math.cos(a) + e2 * math.sin(a))
            pts.append(c + d * (_interp(rad, a) + 0.03))
        wsh = {"shin_" + ("L" if s > 0 else "R"): 1.0}
        parts.append(tube_part(pts, [0.0032] * len(pts), 4, "leather", wsh, lace_col, cap=False))
    return [tr], parts


def build_kauppias():
    C = Ctx()
    T = Track()
    hair = (0.1, 0.06, 0.038)
    skin = (0.72, 0.49, 0.37)
    T.add("skin", skin_parts(C, 0.75, hair, skin=skin, lips=(0.48, 0.27, 0.23)))
    hp = hair_parts(C, hair, length=1.465, beard=0.007, beard_long=0.009, cap=True, moustache=True)
    rng = random.Random(17)
    beard = hp[-1]                                       # harmaantuva lyhyt parta (tasainen pippurisuola)
    for j, f in enumerate(beard.faces):
        t = rng.uniform(0.15, 0.4)
        col = tuple((a * (1 - t) + b * t) * rng.uniform(0.9, 1.05) for a, b in zip((0.08, 0.05, 0.034), (0.28, 0.25, 0.22)))
        beard.faces[j] = (f[0], f[1], f[2], col, f[4])
    T.add("hair", hp)
    tunic = torso_parts(C, "linen", BLUE, 0.78, inflate=0.014, tile=0.12, smooth=9, baggy=0.006)
    T.add("tunic", tunic)
    zs = [1.0, 0.95, 0.9, 0.86, 0.83, 0.76, 0.68, 0.6]
    sk_args = (1.0, 0.6, 0.024, (0.28, 0.225))
    t_skirt = skirt_rows(C, zs, *sk_args, "linen", tile=0.12, col=BLUE)
    T.add("tunic_helma", [t_skirt])
    collar = collar_band(C, "trim_pk", off=0.021, width=0.032, z=1.421)
    T.add("tunic_trim", collar + cuff_parts(C, 0.772, "trim_pk", 0.022, width=0.03))
    nut, ntrim = nuttu_parts(C, tunic[0], sk_args, zs[:5])
    T.add("nuttu", nut[:1])
    T.add("nuttu_helma", nut[1:])
    T.add("nuttu_trim", ntrim)
    tr, boots = trousers_boots(C, (0.075, 0.066, 0.062), (0.42, 0.3, 0.22))
    T.add("trousers", tr)
    T.add("boots", boots)
    belt = HullBelt(C, nut + tunic, z=1.0)
    T.add("belt", [belt.band])
    T.add("belt_fl", [belt.flange])
    T.add("helat", transfer_weights(belt.buckle() + belt.helat(), [belt.band]))
    pouch, knife = belt_pouch(belt, nut[1]), belt_knife(belt, nut[1])
    for grp in (pouch, knife):                          # jäykät esineet liikkuvat nutun helman mukana
        c = sum((q for g in grp for q in g.co), V()) / sum(len(g.co) for g in grp)
        set_w(grp, rigid_w(C, [nut[1]], c))
    T.add("pouch", pouch)
    T.add("knife", knife)
    tq, nr, ns, cl, r0 = torques_parts(C, tunic + nut[:1] + ntrim[:1] + collar)
    T.add("torques", tq)
    MK_EXTRA["char_kauppias"] = {"torques_rings": nr, "torques_sides": ns}
    MK_RANGES["char_kauppias"] = T.R
    return assemble("char_kauppias", T.P, col_name=COL_M)[1]


# ---------- seppä ja sälli markkina-asussa ----------
def build_seppa_markkina():
    """char_seppa (char_smith.build_seppa) ilman esiliinaa ja käärittyjä hihoja: hihat ranteeseen,
    lautanauhahihansuut, oliivinharmaa hartiaviitta, vyö ja puukko."""
    C = Ctx()
    T = Track()
    hair = (0.075, 0.048, 0.03)
    skin = (0.74, 0.5, 0.38)
    tunic_col = (0.2, 0.15, 0.1)                     # puhdas ruskea villa (työtunika 0,16/0,14/0,10)
    T.add("skin", skin_parts(C, 0.75, hair, skin=skin))
    T.add("hair", hair_parts(C, hair, length=1.43, beard=0.017, beard_long=0.034, cap=True))
    T.add("hair", headband(C, (0.09, 0.055, 0.035)))
    under = torso_parts(C, "wool", tunic_col, 0.77, inflate=0.022, tile=0.14, smooth=9, collar=(0.09, 0.075, 0.055), baggy=0.01)
    under += [skirt(C, 1.0, 0.6, 0.026, (0.27, 0.215), "wool", tile=0.14, col=tunic_col)]
    T.add("tunic", under[:1])
    T.add("tunic_helma", under[1:])
    T.add("tunic_trim", cuff_parts(C, 0.765, "trim_pk", 0.03, width=0.03))
    legs = legs_parts(C, "wool", (0.12, 0.1, 0.075), (0.3, 0.26, 0.2), baggy=0.04)
    T.add("legs", legs[:2] + [decimate_part(C, legs[2], 0.5)])
    belt = HullBelt(C, under, z=1.005, clear=0.009)
    T.add("belt", [belt.band])
    T.add("belt_fl", [belt.flange])
    knife = belt_knife(belt, under[1], a=-0.75)
    set_w(knife, rigid_w(C, under[1:], sum((q for g in knife for q in g.co), V()) / sum(len(g.co) for g in knife)))
    T.add("helat", transfer_weights(belt.buckle()[:1], [belt.band]))
    T.add("knife", knife)
    # hartiaviitta: muoto char_folk.mantle_parts (auki oikealla, rengassolki), sitten työnnetään lepoasennossa
    # vähintään 12 mm tunikan ulkopuolelle ja painot tunikasta (kuten esiliinalla), jolloin viitta seuraa
    # hihojen ja rinnan liikettä eikä käsivarsi tule sen läpi kävellessä
    cape_col = (0.17, 0.18, 0.11)
    cape = mantle_parts(C, col=cape_col, edge=(0.06, 0.05, 0.03), z_hem=1.2, a_open=-62, gap=24, pleat=0.05, pleat_n=19,
                        hem_trim=None, cowl=False, clear=0.045, brooch_row=2)
    MK_EXTRA["char_seppa_markkina"] = {"cape_pushed": push_out(C, cape, under, gap=0.013)}
    T.add("cape", transfer_weights(cape, under))
    MK_RANGES["char_seppa_markkina"] = T.R
    return assemble("char_seppa_markkina", T.P, col_name=COL_M)[1]


def felt_cap(C, col, hair, tip=0.075):
    """Suippo huopalakki: päälaen kuori 26 mm vartalosta (hiukset 12 mm) ylös vedettynä ja käänteinen reuna;
    lopuksi työnnetään vähintään 10 mm hiusten ulkopuolelle."""
    is_cap = lambda i, c: c.z > 1.585 and C.arm_frac[i] < 0.2 and not (c.y < -0.09 and c.z < 1.615)
    p = shell(C, is_cap, lambda c: 0.026, "wool", tile=0.1, smooth=3, col=col)
    ztop = max(c.z for c in p.co)
    cy = sum(c.y for c in p.co if c.z > ztop - 0.01) / max(1, sum(1 for c in p.co if c.z > ztop - 0.01))
    for i, c in enumerate(p.co):
        t = smoothstep(1.63, ztop, c.z)
        k = 1 - 0.55 * t ** 1.3
        p.co[i] = V((c.x * k, cy + (c.y - cy) * k + 0.025 * t * t, c.z + tip * t ** 1.5))
    keep = lambda i, c: c.z > 1.5 and C.arm_frac[i] < 0.2
    brim = band(C, V((0, -0.03, 1.603)), V((0, 0.14, 1)).normalized(), V((0, -1, 0)), 0.03, 0.033, "wool", n=22, keep=keep,
                col=tuple(x * 0.75 for x in col), flare=0.004, rows=2, tile=0.1)
    push_out(C, [p, brim], hair, gap=0.01)
    return [p, brim]


def bag_parts(C, under):
    """Nahkalaukku selässä vasemmalla ja kantohihna oikean olan yli: hihnan silmukka on kallistettu taso
    (oikea olka -> vasen kylki rinnan edestä -> vasen alaselkä), laukku riippuu sen alimmasta kohdasta."""
    A, F, B = V((-0.145, 0.0, 1.47)), V((0.17, -0.10, 1.10)), V((0.1, 0.15, 1.06))
    nrm = (F - A).cross(B - A).normalized()
    ctr = (A + F + B) / 3
    # hihnan reitti: tunikan ja vartalon (ei käsiä, kaulaa eikä päätä) ulkoreuna tasossa + 5 mm
    pts = [c for u in under for c, w in zip(u.co, u.w) if arm_share(w) < 0.3]
    pts += [c for i, c in enumerate(C.co) if C.arm_frac[i] < 0.3 and C.w[i].get("head", 0) + C.w[i].get("neck", 0) < 0.3]
    ws = 0.032
    Rh, e1, e2 = hull_loop(pts, ctr, nrm, V((0, -1, 0)), ws / 2 + 0.006, nb=48, dil=1, passes=4)
    nw = NearW(under)                                # hihna seuraa tunikan muotoa myös kainalon alla
    strap = Part()
    Ls, Rs = [], []
    n = 48
    for k in range(n):
        a = (k + 0.5) / n * 2 * math.pi
        d = e1 * math.cos(a) + e2 * math.sin(a)
        q = ctr + d * (Rh(a) + 0.005)
        w = nw(q)
        Ls.append(strap.v(q - nrm * ws / 2, w))
        Rs.append(strap.v(q + nrm * ws / 2, dict(w)))
    for k in range(n):
        k2 = (k + 1) % n
        strap.f([Ls[k], Ls[k2], Rs[k2], Rs[k]], "leather", [(k / 6, 0), ((k + 1) / 6, 0), ((k + 1) / 6, 1), (k / 6, 1)], (0.62, 0.45, 0.32))
    MK_EXTRA["char_salli_markkina"] = {"strap_pushed": push_out(C, [strap], under, gap=0.012)}
    # laukku: litteä pussi, jonka selkäpuoli on 12 mm tunikan ja vartalon ulkopuolella
    bvh = part_bvh(under)
    ymax = -1.0
    for x in (-0.02, 0.03, 0.08, 0.13, 0.17):
        for z in (0.9, 0.95, 1.0, 1.05, 1.08):
            hit = bvh.ray_cast(V((x, 0.8, z)), V((0, -1, 0)), 1.0)
            if hit[0] is not None:
                ymax = max(ymax, hit[0].y)
    bodymax = max(c.y for c in C.co if -0.02 < c.x < 0.17 and 0.9 < c.z < 1.08)
    ymax = max(ymax, bodymax + 0.02)
    hd = 0.03
    c = V((0.075, ymax + 0.012 + hd, 0.985))
    prof = [(0.0, -0.08), (0.05, -0.078), (0.085, -0.066), (0.098, -0.04), (0.1, 0.03), (0.097, 0.062), (0.08, 0.075), (0.0, 0.078)]
    bag = lathe(V((0, 0, 0)), prof, 16, "leather", {}, (0.78, 0.58, 0.42), tile=0.12)
    for j, q in enumerate(bag.co):
        bag.co[j] = c + V((q.x, q.y * (hd / 0.1), q.z))
    # kansi ulkopinnalla
    lid = Part()
    rows = []
    for zz in (0.08, 0.06, 0.03, 0.0, -0.02):
        row = []
        for k in range(9):
            a = -1.35 + 2.7 * k / 8
            r = 0.1 if zz < 0.03 else 0.1 - (zz - 0.03) * 0.5
            row.append(lid.v(c + V((math.sin(a) * (r + 0.003), math.cos(a) * (r * hd / 0.1 + 0.004), zz - 0.004 * math.cos(a))), {}))
        rows.append(row)
    for j in range(len(rows) - 1):
        for k in range(8):
            lid.f([rows[j][k], rows[j][k + 1], rows[j + 1][k + 1], rows[j + 1][k]], "leather", [(k / 8, j / 4), ((k + 1) / 8, j / 4), ((k + 1) / 8, (j + 1) / 4), (k / 8, (j + 1) / 4)], (0.45, 0.3, 0.2))
            lid.f([rows[j + 1][k], rows[j + 1][k + 1], rows[j][k + 1], rows[j][k]], "leather", [(k / 8, (j + 1) / 4), ((k + 1) / 8, (j + 1) / 4), ((k + 1) / 8, j / 4), (k / 8, j / 4)], (0.3, 0.2, 0.13))
    peg = tube_part([c + V((0, hd + 0.004, -0.024)), c + V((0, hd + 0.016, -0.024))], [0.005, 0.005], 6, "wood", {}, (0.9, 0.75, 0.55))
    # sivuhihnat laukun yläkulmista hihnan silmukkaan
    sides = []
    for sx in (-1, 1):
        corner = c + V((sx * 0.085, 0.0, 0.07))
        j = min(range(len(strap.co)), key=lambda i: (strap.co[i] - corner).length_squared + (0.0 if strap.co[i].y > 0.05 else 9.0))
        top = strap.co[j]
        sides.append(tube_part([corner, corner.lerp(top, 0.5) + V((0, 0.004, 0)), top], [0.006] * 3, 4, "leather", {}, (0.62, 0.45, 0.32), cap=False))
    items = [bag, lid, peg] + sides
    set_w(items, rigid_w(C, under, c - V((0, hd, 0))))
    return [strap], items


def build_salli_markkina():
    """char_salli (char_smith.build_salli) ilman esiliinaa: vaalea pellavatunika hihat alhaalla,
    huopalakki ja nahkalaukku."""
    C = Ctx()
    T = Track()
    hair = (0.3, 0.2, 0.09)
    skin = (0.77, 0.56, 0.43)
    linen = (0.8, 0.97, 1.0)                      # vaalea pellava: jersey-tekstuuri on itsessään lämpimän punertava
    T.add("skin", skin_parts(C, 0.74, hair, skin=skin))
    hp = hair_parts(C, hair, length=1.46, beard=0, cap=True, moustache=False)
    T.add("hair", hp)
    under = torso_parts(C, "jersey", linen, 0.76, inflate=0.018, tile=0.16, smooth=9, collar=(0.8, 0.74, 0.62), baggy=0.01)
    under += [skirt(C, 1.0, 0.66, 0.022, (0.262, 0.21), "jersey", tile=0.16, col=linen)]
    T.add("tunic", under[:1])
    T.add("tunic_helma", under[1:])
    T.add("tunic_trim", rolled_cuff(C, 0.74, "jersey", tuple(x * 0.9 for x in linen), off=0.026, width=0.04))
    legs = legs_parts(C, "wool", (0.1, 0.075, 0.05), (0.35, 0.3, 0.22), baggy=0.035)
    T.add("legs", legs[:2] + [decimate_part(C, legs[2], 0.5)])
    belt = HullBelt(C, under, z=1.005, clear=0.009)
    T.add("belt", [belt.band])
    T.add("belt_fl", [belt.flange])
    T.add("helat", transfer_weights(belt.buckle()[:1], [belt.band]))
    T.add("cap", felt_cap(C, (0.3, 0.075, 0.04), hp))
    strap, bag = bag_parts(C, under)
    T.add("strap", strap)
    T.add("bag", bag)
    MK_RANGES["char_salli_markkina"] = T.R
    return assemble("char_salli_markkina", T.P, col_name=COL_M)[1]


# ---------- tarkistus ----------
def _mesh_now(char):
    dg = bpy.context.evaluated_depsgraph_get()
    ob = bpy.data.objects[char]
    ev = ob.evaluated_get(dg)
    me = ev.to_mesh()
    mw = ev.matrix_world
    verts = [mw @ v.co for v in me.vertices]
    polys = [tuple(pl.vertices) for pl in me.polygons]
    ev.to_mesh_clear()
    rest = [ob.matrix_world @ v.co for v in ob.data.vertices]
    return verts, polys, rest, dg


def _idx(char, keys):
    out = []
    for k in keys:
        for s, n in MK_RANGES[char].get(k, []):
            out += range(s, s + n)
    return out


_ARMV = {}


def _arm_verts(char):
    """Verteksit, joiden paino on yli puolet käsivarren luissa (hihat ja kädet)."""
    if char not in _ARMV:
        ob = bpy.data.objects[char]
        gi = {g.index for g in ob.vertex_groups if g.name.rsplit("_", 1)[0] in ARM}
        _ARMV[char] = {v.index for v in ob.data.vertices if sum(g.weight for g in v.groups if g.group in gi) > 0.5}
    return _ARMV[char]


def mk_gap(char, outer, inner, region=None, maxd=0.06, body="BODY", inner_noarm=False):
    """Kerrosväli kuten layer_margin: d_vartalo(p) - d_vartalo(q), q = lähin piste sisemmällä kerroksella.
    inner_noarm: sisemmästä jätetään hihat pois (esim. helma vs alas lasketut hihat ei ole kerrosväli)."""
    verts, polys, rest, dg = _mesh_now(char)
    ins = set(_idx(char, inner))
    if inner_noarm:
        ins -= _arm_verts(char)
    bi = BVHTree.FromPolygons(verts, [p for p in polys if all(i in ins for i in p)])
    bb = BVHTree.FromObject(bpy.data.objects[body], dg)
    worst, n, clip, lt8, at = 1.0, 0, 0, 0, None
    for i in _idx(char, outer):
        if region and not region(rest[i]):
            continue
        loc, _, _, d = bi.find_nearest(verts[i])
        if loc is None or d > maxd:
            continue
        m = bb.find_nearest(verts[i])[3] - bb.find_nearest(loc)[3]
        n += 1
        clip += m < 0
        lt8 += m < 0.008
        if m < worst:
            worst, at = m, [round(x, 3) for x in rest[i]]
    return {"n": n, "min_mm": round(worst * 1000, 1), "clip": clip, "lt8mm": lt8, "at_rest": at}


def mk_contact(char, outer, inner, ring=None, body="BODY"):
    """Esineen etäisyys alla olevista pinnoista (vartalo + annetut osat). Etumerkki: vartaloon pinnan
    normaalista, vaatteeseen siitä, onko piste vartalosta kauempana kuin vaatteen lähin piste (vaatteiden
    normaalit eivät ole luotettavia). Negatiivinen = uppoaa. ring=(renkaat, puolet): lisäksi jokaisen
    poikkileikkauksen lähin etäisyys, jonka suurin arvo kertoo, leijuuko rengas jossain kohdassa."""
    verts, polys, rest, dg = _mesh_now(char)
    ins = set(_idx(char, inner))
    bi = BVHTree.FromPolygons(verts, [p for p in polys if all(i in ins for i in p)]) if ins else None
    bb = BVHTree.FromObject(bpy.data.objects[body], dg)
    idx = _idx(char, outer)
    sd = []
    for i in idx:
        p = verts[i]
        loc, nrm, _, d = bb.find_nearest(p)
        best = d if (p - loc).dot(nrm) >= 0 else -d
        if bi:
            q, _, _, dq = bi.find_nearest(p)
            if q is not None and dq < abs(best):
                best = dq if d >= bb.find_nearest(q)[3] else -dq
        sd.append(best if best is not None else 1.0)
    j = min(range(len(sd)), key=lambda k: sd[k])
    out = {"min_mm": round(min(sd) * 1000, 1), "inside": sum(1 for s in sd if s < 0), "at_rest": [round(x, 3) for x in rest[idx[j]]]}
    if ring:
        nr, ns = ring
        per = [min(sd[r * ns:(r + 1) * ns]) for r in range(nr)]
        out["ring_gap_mm"] = [round(min(per) * 1000, 1), round(sorted(per)[len(per) // 2] * 1000, 1), round(max(per) * 1000, 1)]
    return out


def mk_inside(char, outer, inner, arm_only=False):
    """Montako ulomman osan verteksiä on helman/viitan sisäpuolella: säde vaakasuoraan akselista poispäin
    osuu sisempään osaan. max_mm = syvin (etäisyys osumaan)."""
    verts, polys, rest, dg = _mesh_now(char)
    ins = set(_idx(char, inner)) - _arm_verts(char)          # hihat eivät ole helmaa
    bi = BVHTree.FromPolygons(verts, [p for p in polys if all(i in ins for i in p)])
    idx = _idx(char, outer)
    if arm_only:
        av = _arm_verts(char)
        idx = [i for i in idx if i in av]
    cnt, deep = 0, 0.0
    for i in idx:
        p = verts[i]
        d = V((p.x, p.y - 0.02, 0))
        if d.length < 1e-6:
            continue
        d.normalize()
        hit = bi.ray_cast(p + d * 0.0005, d, 0.25)
        if hit[0] is not None:
            cnt += 1
            deep = max(deep, hit[3])
    return {"n": len(idx), "inside": cnt, "max_mm": round(deep * 1000, 1)}


ARMPIT = lambda p: not (abs(p.x) > 0.13 and 1.05 < p.z < 1.32)     # kainalon poimu (alas lasketut kädet) erikseen


def market_checks(pose):
    tq = MK_EXTRA["char_kauppias"]
    K, S, L = "char_kauppias", "char_seppa_markkina", "char_salli_markkina"
    out = {
        "kauppias": {
            "nuttu>tunika": mk_gap(K, ["nuttu"], ["tunic"], region=ARMPIT),
            "nuttu>tunika_kainalo": mk_gap(K, ["nuttu"], ["tunic"], region=lambda p: not ARMPIT(p)),
            "nuttuhelma>tunikan helma": mk_gap(K, ["nuttu_helma"], ["tunic_helma"]),
            "vyo>nuttu": mk_gap(K, ["belt"], ["nuttu", "nuttu_helma"], inner_noarm=True),
            "vyo_nutun_sisalla": mk_inside(K, ["belt"], ["nuttu", "nuttu_helma"]),
            "nuttuhelma_tunikan_sisalla": mk_inside(K, ["nuttu_helma"], ["tunic_helma"]),
            "kukkaro_helman_sisalla": mk_inside(K, ["pouch"], ["nuttu_helma", "tunic_helma"]),
            "puukko_helman_sisalla": mk_inside(K, ["knife"], ["nuttu_helma", "tunic_helma"]),
            "kukkaro>vartalo": mk_contact(K, ["pouch"], []),
            "puukko>vartalo": mk_contact(K, ["knife"], []),
            "torques": mk_contact(K, ["torques"], ["tunic", "tunic_trim", "nuttu", "nuttu_trim"], ring=(tq["torques_rings"], tq["torques_sides"])),
            "saapas>housut": mk_gap(K, ["boots"], ["trousers"], region=lambda p: 0.16 < p.z < 0.3),
            "helma>housut": mk_gap(K, ["tunic_helma"], ["trousers"]),
            "nuttuhelma>housut": mk_gap(K, ["nuttu_helma"], ["trousers"]),
            "kasi_helmojen_sisalla": mk_inside(K, ["skin", "tunic", "tunic_trim"], ["nuttu_helma", "tunic_helma"], arm_only=True),
        },
        "seppa_markkina": {
            "viitta>tunika": mk_gap(S, ["cape"], ["tunic"]),
            "viitta>vartalo": mk_contact(S, ["cape"], []),
            "vyo>tunika": mk_gap(S, ["belt"], ["tunic", "tunic_helma"], inner_noarm=True),
            "vyo_tunikan_sisalla": mk_inside(S, ["belt"], ["tunic", "tunic_helma"]),
            "puukko_helman_sisalla": mk_inside(S, ["knife"], ["tunic_helma"]),
            "helma>housut": mk_gap(S, ["tunic_helma"], ["legs"]),
            "kasi_helman_sisalla": mk_inside(S, ["skin", "tunic", "tunic_trim"], ["tunic_helma"], arm_only=True),
        },
        "salli_markkina": {
            "hihna>tunika": mk_gap(L, ["strap"], ["tunic"]),
            "hihna>tunikan_runko": mk_gap(L, ["strap"], ["tunic"], inner_noarm=True),
            "hihna>vartalo": mk_contact(L, ["strap"], []),
            "laukku>tunika": mk_gap(L, ["bag"], ["tunic", "tunic_helma", "legs"], inner_noarm=True),
            "laukku>vartalo": mk_contact(L, ["bag"], []),
            "lakki>hiukset": mk_gap(L, ["cap"], ["hair"]),
            "vyo>tunika": mk_gap(L, ["belt"], ["tunic", "tunic_helma"], inner_noarm=True),
            "vyo_tunikan_sisalla": mk_inside(L, ["belt"], ["tunic", "tunic_helma"]),
            "helma>housut": mk_gap(L, ["tunic_helma"], ["legs"]),
            "kasi_helman_sisalla": mk_inside(L, ["skin", "tunic", "tunic_trim"], ["tunic_helma"], arm_only=True),
        },
    }
    return out


# ---------- esikatselu ----------
def snapshot(names, dx, tag):
    """Asennon mukainen kopio (ilman luurankoa) x-siirrolla vierekkäisiä kuvia varten."""
    dg = bpy.context.evaluated_depsgraph_get()
    out = []
    for nm in names:
        ob = bpy.data.objects[nm]
        ev = ob.evaluated_get(dg)
        me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
        o = bpy.data.objects.new("_snap_%s_%s" % (tag, nm), me)
        get_col("PV_MK").objects.link(o)
        o.matrix_world = Matrix.Translation(V((dx, 0, 0))) @ ev.matrix_world
        out.append(o.name)
    return out


def clear_snaps():
    for o in list(bpy.data.objects):
        if o.name.startswith("_snap_") or o.name == "_pv_pole":
            bpy.data.objects.remove(o, do_unlink=True)


def pole(x):
    o, _ = assemble("_pv_pole", [box_part(V((x, 0, 0.9)), (0.03, 0.03, 1.8), "plain", {}, (0.8, 0.15, 0.1))], col_name="PV_MK", rig=False)
    return o.name


def crop_top(path, frac=0.55):
    px = load_px(path)
    old = bpy.data.images.get("_crop")
    if old:
        bpy.data.images.remove(old)
    save_px(px[int(px.shape[0] * frac):, :], path, "_crop")


CHARS = ("char_kauppias", "char_seppa_markkina", "char_salli_markkina")
SHEET = sheet


def previews(preview_dir, rig):
    """MK_SMALL=1: pienemmät tarkistuskuvat iterointiin."""
    os.makedirs(preview_dir, exist_ok=True)
    k = 0.68 if os.environ.get("MK_SMALL") == "1" else 1.0
    sheet = lambda names, path, yaws, w, h: SHEET(names, path, yaws=yaws, w=int(w * k), h=int(h * k))
    files = []
    for n in CHARS:
        reset_pose(rig)
        pose_arms(True)
        p = os.path.join(preview_dir, n + "_lepo.png")
        sheet([n], p, yaws=(0, math.pi / 2, math.pi, -math.pi / 2), w=380, h=760)
        files.append(p)
        p = os.path.join(preview_dir, n + "_lahi.png")
        sheet([n], p, yaws=(0, 0.75, math.pi - 0.6), w=700, h=1400)
        crop_top(p, 0.56)
        files.append(p)
        set_pose(rig, "walk")
        p = os.path.join(preview_dir, n + "_kavely.png")
        sheet([n], p, yaws=(0, math.pi / 2, -math.pi / 2), w=380, h=760)
        files.append(p)
    # vertailu: kauppias, seppä ja sälli markkina-asussa sekä smithfolk.glb:n seppä ja sälli (sama mittakaava)
    reset_pose(rig)
    pose_arms(True)
    clear_snaps()
    names = []
    for i, n in enumerate(("char_kauppias", "char_seppa_markkina", "char_seppa", "char_salli_markkina", "char_salli")):
        names += snapshot([n], i * 0.72, "cmp")
    names.append(pole(-0.62))
    p = os.path.join(preview_dir, "vertailu.png")
    sheet(names, p, yaws=(0,), w=1600, h=900)
    files.append(p)
    p = os.path.join(preview_dir, "vertailu_taka.png")
    sheet(names, p, yaws=(math.pi - 0.5,), w=1600, h=900)
    files.append(p)
    p = os.path.join(preview_dir, "vertailu_kasvot.png")
    sheet(names[:-1], p, yaws=(0.35,), w=1600, h=1100)
    crop_top(p, 0.7)
    files.append(p)
    clear_snaps()
    reset_pose(rig)
    return files


def reimport_overview(glb, preview_dir):
    """Vientitarkistus: GLB tuodaan takaisin ja sen hahmot kuvataan rivissä 1,8 m:n pylvään kanssa."""
    before = set(bpy.data.objects.keys())
    bpy.ops.import_scene.gltf(filepath=glb)
    new = [bpy.data.objects[n] for n in set(bpy.data.objects.keys()) - before]
    meshes = sorted([o for o in new if o.type == 'MESH' and o.name.startswith("char_")], key=lambda o: o.name)   # tuoja lisää luiden näyttömuodon (Icosphere)
    info = {o.name: len(o.data.polygons) for o in meshes}
    for o in new:
        o.hide_render = True
    names = []
    for i, o in enumerate(meshes):
        o.hide_render = False
        names += snapshot([o.name], i * 1.0, "glb")
    names.append(pole(-0.6))
    p = os.path.join(preview_dir, "glb_rivi.png")
    sheet(names, p, yaws=(0, 0.6), w=1200, h=800)
    clear_snaps()
    for o in new:
        if o.name in bpy.data.objects:
            bpy.data.objects.remove(o, do_unlink=True)
    return p, info


def run_market(preview_dir=None, out_dir=None, save=False, checks=True):
    out = {"tris": {}}
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            market_materials()
            rig = bpy.data.objects["RIG"]
            if COL_M in bpy.data.collections:
                for o in list(bpy.data.collections[COL_M].objects):
                    bpy.data.objects.remove(o, do_unlink=True)
            reset_pose(rig)
            pose_arms(False)
            out["tris"]["char_kauppias"] = build_kauppias()["tris"]
            out["tris"]["char_seppa_markkina"] = build_seppa_markkina()["tris"]
            out["tris"]["char_salli_markkina"] = build_salli_markkina()["tris"]
            bpy.context.view_layer.update()
            out["part_tris"] = {}
            for n in CHARS:
                ob = bpy.data.objects[n]
                first = sorted((s0, s0 + c0, k) for k, rs in MK_RANGES[n].items() for s0, c0 in rs)
                acc = {}
                for pl in ob.data.polygons:
                    v0 = pl.vertices[0]
                    for s0, s1, k in first:
                        if s0 <= v0 < s1:
                            acc[k] = acc.get(k, 0) + len(pl.vertices) - 2
                            break
                out["part_tris"][n] = acc
            out["extra"] = {k: v for k, v in MK_EXTRA.items()}
            out["bbox"] = {}
            for n in CHARS:
                vs = [v.co for v in bpy.data.objects[n].data.vertices]
                out["bbox"][n] = [[round(min(c[k] for c in vs), 3) for k in range(3)], [round(max(c[k] for c in vs), 3) for k in range(3)]]
            if checks:
                out["clearance"] = {}
                for pose in ["rest"] + list(SMITH_POSES):
                    if pose == "rest":
                        reset_pose(rig)
                        pose_arms(True)
                    else:
                        set_smith_pose(rig, pose)
                    out["clearance"][pose] = market_checks(pose)
                reset_pose(rig)
            if preview_dir:
                if "char_seppa" not in bpy.data.objects or "char_salli" not in bpy.data.objects:
                    build_seppa()
                    build_salli()
                out["previews"] = previews(preview_dir, rig)
            reset_pose(rig)
            if save:
                bpy.ops.wm.save_mainfile()
            if out_dir:
                out["glb"] = export_folk(out_dir, COL_M, "RIG", "marketfolk.glb")
                out["glb"]["mb_exact"] = round(os.path.getsize(os.path.join(out_dir, "marketfolk.glb")) / 1e6, 3)
                if preview_dir:
                    p, info = reimport_overview(os.path.join(out_dir, "marketfolk.glb"), preview_dir)
                    out["previews"].append(p)
                    out["glb_meshes"] = info
    except Exception:
        out["err"] = traceback.format_exc()[-2500:]
    return out
