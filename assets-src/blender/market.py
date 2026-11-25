"""Markkinapaikan rakennelmat: kaksi kangas- ja tuohikojua, nahkasuoja, myyntipöytä, turkisteline ja
aseteline. Vie tiedoston assets/market.glb; peli sijoittelee mallit nimen mukaan.

Käyttää smithy.py:n apuja (frustum, grid_out, stump, mount, build_keihasteline-logiikka), homestead.py:n
rakentajaa (HB), household.py:n apuja (HH) ja niiden materiaaleja. Aja taustalla:

    blender --background --factory-startup --python assets-src/blender/market.py

Vientikansio: KALEVALA_ASSETS_OUT. Esikatselukuvat: KALEVALA_PREVIEW=<polku ilman päätettä>
(esikatselu tuo viedyn GLB:n uudelleen sekä characters.glb:n ja kirveet.glb:n ja kloonaa aseet tyhjiin
kiinnityspisteisiin). KALEVALA_TEXDIR ohjaa välitekstuurien kansion (rinnakkaisajot).

Koordinaatit: Z ylös, mitat metreinä, **asiakaspuoli / etusivu = -Y** (pelissä +Z). Jokainen solmu on oma
juurisolmunsa, ja sen origo on maan tasossa mallin keskellä. Kaikki puuosat jatkuvat noin 0,1-0,15 m
maan alle, jotta ne eivät leiju epätasaisella maalla.

- katos_vaate: myyntikoju, neljä kuorittua paalua (x = ±1,4; y = ±1,1), pulpettina pingotettu raidallinen
  villakangas (luonnonvalkoinen, ruskea, punamulta). Paalun yläpää etureunassa 2,25 m, takareunassa
  1,8 m. Kangas lepää paalujen päällä ja notkahtaa niiden välissä enintään noin 7 cm, etuliepeet
  roikkuvat 15 cm (alareuna noin 2,08 m, 1,8 m:n hahmo mahtuu), sivu- ja takaliepeet 7-8 cm. Paalujen
  päissä sidontanarut; takapaalujen vinot harukset kulkevat maahan vaarnoihin (x = ±1,95; y = 1,95).
  Alue noin 3,0 x 2,4 m (kangas 3,3 x 2,2 m ja liepeet). Törmäys: neljä ympyrää (säde 0,08) paalujen
  kohdalla; kojun alla on vapaata kulkua. Kojun alla myyjän paikka on noin (0; 0,4).
- katos_tuohi: järeämpi kojukatos, neljä kuorellista paalua (x = ±1,45; y = ±1,05), kaksi x-suuntaista
  orsipuuta (etu 2,22 m, taka 1,82 m), niiden päällä y-suuntaiset sarat ja poikkiriu'ut sekä
  päällekkäin laotut tuohilevyt ja painoriu'ut. Pulpetti, kalteva taaksepäin: räystään alapinta edessä
  noin 2,3 m, takana noin 1,8 m. Alue 3,4 x 2,6 m. Törmäys: neljä ympyrää (säde 0,1) paalujen
  kohdalla.
- katos_nahka: kauppamiehen pieni suoja. Kaksi pystyä (x = ±1,2; y = 0) ja niiden haarojen väliin
  asetettu harjariuku (z = 2,2). Kate on kaksi parkittua nahkaa, jotka on ommeltu yhteen harjalla
  (näkyvä sauma ja ommelkohdat). Etuluisku on matala ja avoin (reuna noin 1,7 m, kaksi tukea), taka
  (+Y) laskeutuu lähes maahan (reuna noin 0,2 m, tuulensuoja) ja se on harustettu vaarnoihin.
  Alue noin 2,6 x 2,0 m, harja 2,2 m. Törmäys: takaluiska laatikkona x -1,3..1,3, y 0,05..1,0
  (tuulensuoja); etutuet ympyröinä (säde 0,08).
- myyntipoyta: kaksi lohkottua paksua lankkua vierekkäin kahden pukin päällä; pituus 2,2 m, syvyys 0,7 m.
  **Pinnan korkeus on COUNTER_TOP = 0,80 m.** Etureunan yli roikkuu kapea pellavaliina (x = 0,4). Tyhjä
  piste `mount_poyta` pinnan keskellä (0; 0; 0,80), orientaatio: -Y asiakkaaseen. Törmäys: laatikko
  x -1,1..1,1, y -0,35..0,35.
- turkisteline: kaksi haarapuuta (x = ±1,3; y = 0), yläorsi 1,9 m (x -1,5..1,5) ja alempi orsi
  1,1 m (x -1,45..1,45; hieman haarapuiden takana, y = 0,07). Yläorrella: kolme ketunnahkaa
  (x = -1,15; -0,85; -0,55; roikkuvat kuono ylöspäin), kaksi oravannippua (x = -0,05 ja 0,25) ja
  hirvennahka orren yli taitettuna (keskus x = 0,95; leveys noin 1,1 m, pituus 1,8 m).
  Alemmalla orrella karhuntalja (keskus x = -0,2, leveys noin 1,4 m käpälineen, pituus 1,4 m; pää
  alaspäin, käpälät sivuille). Takana haarapuita tukevat vinotuet. Turkit ovat suljettuja,
  hieman paksuja kuoria (ei alfaa); karvatekstuuri tulee numpyllä ja sävyt verteksiväreistä.
  Törmäys: laatikko x -1,6..1,6, y -0,3..0,4 (tai kaksi ympyrää haarapuiden kohdalla; telineen
  alta pääsee kuitenkin kävelemään vain hirvennahkan ulkopuolelta).
- aseteline: kaksi haarapuuta (x = ±1,45; y = 0), orsi 1,45 m:ssä, maapuu tyvien edessä
  (y = -0,48), takana (y 0,30..0,35) lankkuseinä pystypaaluineen (x = ±1,6) ja tapit. Tyhjät pisteet
  (kaikki ovat muunnoksia, joihin peli kloonaa mallin **suoraan pisteen maailmamuunnokseen**):
  - mount_keihas_1..3 (x = -1,15; -0,9; -0,65): characters.glb:n `spear`. Otekohta origossa, tyvi
    0,625 m takana (+Y paikallisessa), kärki 1,52 m edessä (-Y paikallisessa). Keihäs nojaa orteen kuten
    smithy.py:n keihästelineessä (tyvi maassa y = -0,40, kärki noin z 2,08).
  - mount_kilpi_1..2: characters.glb:n kilpi (`shield_hero`, `shield_pohja` tai `shield_urho`; kaikilla
    sama muoto: leveys 0,634, korkeus 0,814, paksuus -0,114..+0,044). Origo on kilven keskellä (ote),
    pinta ja napa osoittavat paikallisen -Y:n suuntaan, ylös on +Z. kilpi_1 (x = 0,65) nojaa maasta
    taaksepäin kallistettuna lankkuseinää vasten, kilpi_2 (x = 1,1) roikkuu pystysuorana tapista.
  - mount_kirves_1..2 (x = -0,2 ja 0,25): kirveet.glb:n `kirves_parta` ja `kirves_karjala`. Kehys:
    ote origossa, pää -Y, terä +X, lappeet ±Z. Pisteessä kirves seisoo pää ylhäällä, 6 astetta
    seinää vasten kallistettuna, tyven nojaa tappiin ja terä osoittaa +X:ään.
  Törmäys: laatikko x -1,7..1,7, y -0,55..0,5 (keihäät ja kilpi ovat telineen etupuolella).

Kolmiobudjetti: yhteensä <= 13 000, GLB <= 2,5 Mt. Tekstuurit enintään 512 x 512.
"""
import bpy, bmesh, math, os, random, json
import numpy as np
from mathutils import Vector, Matrix

_HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else r"C:\Data\3D Kalevala\assets-src\blender"
# smithy.py ilman pääohjelmaa; se lukee itse cairnfield.py:n, homestead.py:n ja household.py:n
exec(open(os.path.join(_HERE, "smithy.py"), encoding="utf-8").read().rsplit('\nif __name__ == "__main__":', 1)[0])

OUT = os.environ.get("KALEVALA_ASSETS_OUT", OUT)
TEXDIR = os.environ.get("KALEVALA_TEXDIR", TEXDIR)

COUNTER_TOP = 0.80        # myyntipöydän pinnan korkeus


# ---------- tekstuurit ----------
def wool_px(size=512, seed=17):
    """Raidallinen villakangas: luonnonvalkoista, ruskeaa ja punamultaa; loimi ja kude näkyvät."""
    rs = np.random.RandomState(seed)
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    W, B, R = (0.88, 0.83, 0.7), (0.42, 0.28, 0.17), (0.64, 0.18, 0.12)
    segs = [(W, 168), (B, 30), (W, 14), (R, 62), (W, 14), (B, 30), (W, 166), (R, 28)]
    colx = np.zeros((size, 3), dtype=np.float32)
    x = 0
    for c, n in segs:
        colx[x:x + n] = c
        x += n
    colx[x:] = W
    col = np.broadcast_to(colx[None, :, :], (size, size, 3)).copy()
    warp = 0.5 + 0.5 * np.sin(2 * np.pi * xx * 64 / size)             # loimilangat
    weft = 0.5 + 0.5 * np.sin(2 * np.pi * yy * 64 / size)             # kude
    over = ((np.floor(xx / 4) + np.floor(yy / 4)) % 2) == 0
    hgt = np.where(over, warp, weft).astype(np.float32)
    slub = tile_noise(rs, size, size, 12, 12, 10)
    k = 0.86 + 0.1 * hgt + 0.1 * slub + rs.normal(0, 0.015, (size, size))
    col = col * k[..., None]
    return np.clip(col, 0, 1).astype(np.float32), height_to_normal(hgt, 1.6)


def fur_px(size=512, seed=7):
    """Neutraali karvatekstuuri: pitkittäiset karvaviirut (v-suunta), laikkuinen sävy; väri tulee verteksiväreistä."""
    rs = np.random.RandomState(seed)
    base = rs.rand(size, size).astype(np.float32)
    k = 26
    c = np.cumsum(np.concatenate([base, base[:k]], axis=0), axis=0)
    blur = (c[k:] - c[:-k]) / k
    c2 = np.cumsum(np.concatenate([blur, blur[:, :2]], axis=1), axis=1)
    blur = (c2[:, 2:] - c2[:, :-2]) / 2
    blur = (blur - blur.min()) / (blur.max() - blur.min())
    patch = tile_noise(rs, size, size, 7, 7, 10)
    strand = rs.rand(size, size).astype(np.float32)
    k2 = 7
    c3 = np.cumsum(np.concatenate([strand, strand[:k2]], axis=0), axis=0)
    fine = (c3[k2:] - c3[:-k2]) / k2
    fine = (fine - fine.min()) / (fine.max() - fine.min())
    g = 0.74 + 0.48 * (blur - 0.5) + 0.28 * (fine - 0.5) + 0.08 * patch + rs.normal(0, 0.012, (size, size))
    g = np.clip(g, 0.15, 1.0)
    col = np.stack([g, g * 0.985, g * 0.96], axis=-1)
    return col.astype(np.float32), height_to_normal((blur * 0.6 + fine * 0.4).astype(np.float32), 2.0)


def load_sq(path, size):
    """Kuva neliöksi skaalattuna (load_px olettaa neliön; linen_*.png on 512 x 513)."""
    im = bpy.data.images.load(path)
    im.scale(size, size)
    px = np.empty(size * size * 4, dtype=np.float32)
    im.pixels.foreach_get(px)
    bpy.data.images.remove(im)
    return px.reshape(size, size, 4)[..., :3]


def bark_px(size=512, seed=23):
    """Tuohi: harmaanvalkoinen paperimainen pinta, jossa tummat poikkiviirut (kaarnahuokoset) ja vaakakuitu."""
    rs = np.random.RandomState(seed)
    base = 0.8 + 0.04 * tile_noise(rs, size, size, 6, 6, 8)
    fib = rs.rand(size, size).astype(np.float32)
    k = 20
    c = np.cumsum(np.concatenate([fib, fib[:, :k]], axis=1), axis=1)
    fib = (c[:, k:] - c[:, :-k]) / k
    fib = (fib - fib.min()) / (fib.max() - fib.min())
    mask = np.zeros((size, size), dtype=np.float32)
    for _ in range(70):
        x0, y0, w, h = rs.randint(size), rs.randint(size), rs.randint(14, 48), rs.randint(2, 4)
        mask[(y0 + np.arange(h))[:, None] % size, (x0 + np.arange(w))[None, :] % size] = rs.uniform(0.5, 1.0)
    g = base * (0.95 + 0.1 * fib) * (1 - 0.35 * mask)
    col = np.stack([g, g * 0.96, g * 0.88], axis=-1)
    hgt = (0.5 + 0.1 * fib - 0.3 * mask).astype(np.float32)
    return np.clip(col, 0, 1).astype(np.float32), height_to_normal(hgt, 2.5)


def make_market_materials():
    make_household_materials()        # wood, bark, clay, straw, weave, birch, plain
    wd, wn = wool_px()
    fd, fn_ = fur_px()
    ld = load_px(os.path.join(DL, "tex_brown_leather", "brown_leather_diff_1k.jpg"), 512)
    lv = ld.mean(axis=-1, keepdims=True)
    lv = lv / lv.mean()
    ld = np.clip(np.array([0.58, 0.51, 0.42], dtype=np.float32) * (0.62 + 0.38 * lv), 0, 1)
    ln = load_px(os.path.join(DL, "tex_brown_leather", "brown_leather_nor_1k.jpg"), 512)
    li = load_sq(os.path.join(TEXDIR, "linen_diff.png"), 512)
    lum = li.mean(axis=-1, keepdims=True)
    li = np.clip(lum * np.array([1.12, 1.04, 0.9], dtype=np.float32) * 1.5, 0, 1)
    lnn = load_sq(os.path.join(TEXDIR, "linen_nor.png"), 512)
    bd, bn = bark_px()
    MATS.update({
        "tuohi": pbr("M_MK_Birch", save_px(bd, "mk_birch_diff"), save_px(bn, "mk_birch_nor", "Non-Color"), rough=0.8),
        "wool": pbr("M_MK_Wool", save_px(wd, "mk_wool_diff"), save_px(wn, "mk_wool_nor", "Non-Color"), rough=1.0),
        "fur": pbr("M_MK_Fur", save_px(fd, "mk_fur_diff"), save_px(fn_, "mk_fur_nor", "Non-Color"), rough=0.95),
        "leather": pbr("M_MK_Leather", save_px(ld, "mk_leather_diff"), save_px(ln, "mk_leather_nor", "Non-Color"), rough=0.8),
        "linen": pbr("M_MK_Linen", save_px(li, "mk_linen_diff"), save_px(lnn, "mk_linen_nor", "Non-Color"), rough=0.95),
    })


# ---------- apurit ----------
def loop(b, c, r, z, color=(0.7, 0.58, 0.4), rad=0.008, tail=True, a0=0.0, n=7):
    """Sidontanarun kierros pylvään ympäri (c = pylvään x, y) ja roikkuva pää."""
    pts = [V((c[0] + math.cos(a0 + i * 0.95) * r, c[1] + math.sin(a0 + i * 0.95) * r, z + 0.006 * i)) for i in range(n)]
    b.tube(pts, rad, "leather", 3, color, vtile=0.1)
    if tail:
        e = pts[-1]
        b.tube([e, e + V((0.0, 0.0, -0.09)), e + V((0.012, 0.01, -0.15))], [rad, rad * 0.9, rad * 0.7], "leather", 3, color, vtile=0.1)


def guy(b, a, s, sag=0.06, color=(0.62, 0.5, 0.34)):
    """Haruslanka pisteestä a vaarnan päähän s."""
    a, s = V(a), V(s)
    m = (a + s) / 2 + V((0, 0, -sag))
    b.tube([a, a + (m - a) * 0.5 + V((0, 0, -sag * 0.2)), m, m + (s - m) * 0.5 + V((0, 0, -sag * 0.2)), s], 0.0065, "leather", 3, color, vtile=0.1)


def stake(b, p, away, h=0.3):
    """Vaarna: maahan lyöty seiväs, jonka yläpää kallistuu poispäin."""
    p, away = V(p), V(away).normalized()
    top = p + away * 0.07 + V((0, 0, h))
    bot = p - away * 0.04 + V((0, 0, -0.14))
    b.tube([bot, top], [0.022, 0.026], "wood", 5, (0.7, 0.62, 0.5), vtile=0.3)


class Path:
    """Profiili (y, z)-tasossa: kulkusuunta T = (ty, tz); ulkonormaali (ny, nz) = (tz, -ty).
    Alaspäin kulkeva polku osoittaa asiakkaaseen (-Y) ja ylöspäin kulkeva taaksepäin (+Y)."""

    def __init__(self, pts):
        self.p = [(float(y), float(z)) for y, z in pts]
        n = len(self.p)
        self.cum = [0.0]
        segs = []
        for i in range(1, n):
            dy, dz = self.p[i][0] - self.p[i - 1][0], self.p[i][1] - self.p[i - 1][1]
            ln_ = math.hypot(dy, dz)
            self.cum.append(self.cum[-1] + ln_)
            segs.append((dy / ln_, dz / ln_))
        self.len = self.cum[-1]
        self.t = []
        for i in range(n):
            a, c = segs[max(i - 1, 0)], segs[min(i, n - 2)]
            ty, tz = a[0] + c[0], a[1] + c[1]
            ln_ = math.hypot(ty, tz) or 1.0
            self.t.append((ty / ln_, tz / ln_))

    def at(self, s):
        s = min(max(s, 0.0), self.len)
        i = 0
        while i < len(self.p) - 2 and s > self.cum[i + 1]:
            i += 1
        f = (s - self.cum[i]) / (self.cum[i + 1] - self.cum[i])
        y = self.p[i][0] + (self.p[i + 1][0] - self.p[i][0]) * f
        z = self.p[i][1] + (self.p[i + 1][1] - self.p[i][1]) * f
        ty = self.t[i][0] + (self.t[i + 1][0] - self.t[i][0]) * f
        tz = self.t[i][1] + (self.t[i + 1][1] - self.t[i][1]) * f
        ln_ = math.hypot(ty, tz) or 1.0
        ty, tz = ty / ln_, tz / ln_
        return y, z, tz, -ty


def drape(yc, zc, R, drop_b, drop_f, narc=7):
    """Polku, joka nousee orren takaa, kaartuu sen yli ja laskeutuu edessä (orsi = ympyrä keskipisteessä (yc, zc))."""
    pts = [(yc + R, zc - drop_b)]
    for i in range(narc):
        a = math.pi * i / (narc - 1)
        pts.append((yc + R * math.cos(a), zc + R * math.sin(a)))
    pts.append((yc - R, zc - drop_f))
    return Path(pts)


def interp(prof, v):
    """Leveysprofiili (v, puolileveys) kosinipehmeästi."""
    for k in range(len(prof) - 1):
        v0, w0 = prof[k]
        v1, w1 = prof[k + 1]
        if v <= v1 or k == len(prof) - 2:
            t = min(1.0, max(0.0, (v - v0) / (v1 - v0)))
            t = 0.5 - 0.5 * math.cos(math.pi * t)
            return w0 + (w1 - w0) * t
    return prof[-1][1]


def pillow(b, path, s0, L, x0, prof, T, nu, nv, colfn, tile=0.2, rag=0.0, seed=0, xs=None, off=0.0, mat="fur"):
    """Suljettu, paksuinen turkislevy: polun (path) mukainen kuori, jonka leveysprofiili on prof ja paksuus enintään T.
    Etukuori (karvapuoli ulos) ja takakuori jakavat reunaverteksit. v kulkee polkua pitkin (karva v-suunnassa).
    colfn(u, v, side) palauttaa sRGB-sävyn."""
    bm = b.bm

    def pos(u, v, side):
        s = s0 + v * L
        y, z, ny, nzz = path.at(s)
        w = interp(prof, v)
        wl = w * (1 + rag * nz((v * 9.0, 1.3, 0.0), 1.0, seed))
        wr = w * (1 + rag * nz((v * 9.0, 4.1, 0.0), 1.0, seed + 5.0))
        sh = xs(v) if xs else 0.0
        x = x0 + sh + (-(1 - 2 * u) * wl if u < 0.5 else (2 * u - 1) * wr)
        t = T * (math.sin(math.pi * u) ** 0.55) * (math.sin(math.pi * v) ** 0.55)
        wob = 0.004 * nz((x * 7.0, s * 7.0, 0.0), 1.0, seed + 2.0)
        d = off + side * t + wob * (1 if side else 0)
        return V((x, y + ny * d, z + nzz * d)), (ny, nzz), x - x0

    top = [[None] * (nu + 1) for _ in range(nv + 1)]
    bot = [[None] * (nu + 1) for _ in range(nv + 1)]
    xl = {}
    for j in range(nv + 1):
        for i in range(nu + 1):
            u, v = i / nu, j / nv
            pt, nn, x_ = pos(u, v, 1)
            xl[(i, j)] = (x_, s0 + v * L)
            if i in (0, nu) or j in (0, nv):
                vt = bm.verts.new(pos(u, v, 0)[0])
                top[j][i] = bot[j][i] = vt
            else:
                top[j][i] = bm.verts.new(pt)
                bot[j][i] = bm.verts.new(pos(u, v, -1)[0])
    mi = b.mi(mat)
    for side, grid_ in ((1, top), (-1, bot)):
        for j in range(nv):
            for i in range(nu):
                idx = [(i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)]
                vs = [grid_[jj][ii] for ii, jj in idx]
                a, c_, d_ = vs[0].co, vs[1].co, vs[3].co
                g = (c_ - a).cross(d_ - a)
                nn = pos((i + 0.5) / nu, (j + 0.5) / nv, 0)[1]
                want = V((0, nn[0], nn[1])) * side
                if g.dot(want) < 0:
                    idx = [idx[0], idx[3], idx[2], idx[1]]
                    vs = [grid_[jj][ii] for ii, jj in idx]
                try:
                    f = bm.faces.new(vs)
                except ValueError:
                    continue
                f.material_index = mi
                f.smooth = True
                for l, (ii, jj) in zip(f.loops, idx):
                    xlc, sl = xl[(ii, jj)]
                    l[b.uv].uv = (xlc / tile, sl / tile)
                    l[b.col] = b._c(colfn(ii / nu, jj / nv, side), None)


def sstep(a, b_, x):
    t = min(1.0, max(0.0, (x - a) / (b_ - a)))
    return t * t * (3 - 2 * t)


def mixc(c0, c1, t):
    return tuple(c0[i] + (c1[i] - c0[i]) * t for i in range(3))


def edge_k(u, v, k=0.3):
    """Reunan tummuminen: 1 keskellä, 1-k reunalla."""
    e = max(abs(2 * u - 1) ** 3, abs(2 * v - 1) ** 6)
    return 1 - k * e


# ---------- 1. katos_vaate ----------
def build_katos_vaate(col):
    b = HH("katos_vaate", 201)
    PXv, PYv = 1.4, 1.1
    ZF, ZB = 2.25, 1.8
    XE = PXv + 0.15

    def zr(y):
        return ZF + (ZB - ZF) * (y + PYv) / (2 * PYv)

    def zc(x, y):
        """Kankaan yläpinta: lepää paalujen päällä, notkahtaa väleissä ja riippuu hieman reunoilla."""
        sag = 0.035 * max(0.0, 1 - (x / PXv) ** 2) + 0.028 * max(0.0, 1 - (y / PYv) ** 2)
        droop = 0.05 * (max(0.0, abs(x) - PXv) / 0.15) ** 2
        return zr(y) + 0.014 - sag - droop + 0.006 * nz((x * 3, y * 3, 0), 1.0, 4.0)

    rng = b.rng
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * PXv, sy * PYv
            zt = zr(y)
            k = rng.uniform(0.9, 1.0)
            lean = V((rng.uniform(-0.012, 0.012), rng.uniform(-0.012, 0.012), 0))
            b.tube([V((x, y, -0.13)), V((x, y, zt * 0.5)) + lean, V((x, y, zt)) + lean * 0.6], [0.058, 0.052, 0.043], "wood", 8,
                   (k, k * 0.95, k * 0.84), vtile=0.7)
            loop(b, (x + lean.x * 0.6, y + lean.y * 0.6), 0.055, zt - 0.075, a0=rng.uniform(0, 6))
    # kangas: raidat kulkevat etu-takasuunnassa (u = x)
    col_c = lambda p: tuple(c_ * (0.93 + 0.07 * nz(p, 4.0, 1.0)) for c_ in (1, 1, 1))
    uvx = lambda u, v, y0=0.0: ((u * 2 * XE) / 0.64, v)

    def top(u, v):
        x = -XE + u * 2 * XE
        y = -PYv + v * 2 * PYv
        return V((x, y, zc(x, y)))
    grid_out(b, top, 24, 12, "wool", col_c, uvfn=lambda u, v: ((u * 2 * XE) / 0.64, (v * 2 * PYv) / 0.64), out=lambda p: V((0, 0, 1)))

    def front(u, v):
        x = -XE + u * 2 * XE
        hem = 0.012 * math.sin(x * 11.0 + 1.0) + 0.008 * nz((x * 5, 0, 1), 1.0, 2.0)
        return V((x, -PYv - 0.05 * v - 0.012 * math.sin(math.pi * v), zc(x, -PYv) - v * 0.15 + hem * v))
    grid_out(b, front, 24, 3, "wool", col_c, uvfn=lambda u, v: ((u * 2 * XE) / 0.64, 0.2 + v * 0.2), out=lambda p: V((0, -1, -0.2)))

    def back(u, v):
        x = -XE + u * 2 * XE
        return V((x, PYv + 0.03 * v, zc(x, PYv) - v * 0.08 + 0.006 * v * math.sin(x * 9)))
    grid_out(b, back, 24, 1, "wool", col_c, uvfn=lambda u, v: ((u * 2 * XE) / 0.64, 0.5 + v * 0.1), out=lambda p: V((0, 1, -0.2)))
    for sx in (-1, 1):
        def side(u, v, sx=sx):
            y = -PYv + u * 2 * PYv
            return V((sx * (XE + 0.012 * v), y, zc(sx * XE, y) - v * 0.07))
        grid_out(b, side, 12, 1, "wool", col_c, uvfn=lambda u, v, sx=sx: (sx * XE / 0.64, u * 2 * PYv / 0.64), out=lambda p, sx=sx: V((sx, 0, -0.2)))
    # takapaalujen vinot harukset vaarnoihin
    for sx in (-1, 1):
        x, y = sx * PXv, PYv
        st = V((sx * 1.95, 1.95, 0.0))
        guy(b, V((x, y, zr(y) - 0.2)), st + V((sx * 0.07, 0.05, 0.31)), sag=0.07)
        stake(b, st, V((sx * 0.6, 0.8, 0)))
    return b.finish(col)


# ---------- 2. katos_tuohi ----------
def build_katos_tuohi(col):
    b = HH("katos_tuohi", 202)
    PXt, PYt = 1.45, 1.05
    OZF, OZB = 2.4, 1.6                                      # orsipuiden keskikorkeudet (kaltevuus noin 21 astetta)
    ORS = 0.055
    rng = b.rng
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * PXt, sy * PYt
            zt = (OZF if sy < 0 else OZB) - ORS * 0.55
            k = rng.uniform(0.82, 0.92)
            b.tube([V((x, y, -0.15)), V((x + rng.uniform(-0.015, 0.015), y, zt * 0.5)), V((x, y, zt))], [0.085, 0.075, 0.068], "bark", 8,
                   (k, k * 0.97, k * 0.93), vtile=0.9, urep=2.0)
            loop(b, (x, y), 0.075, zt - 0.05, rad=0.011, a0=rng.uniform(0, 6))
    for y, oz in ((-PYt, OZF), (PYt, OZB)):
        k = rng.uniform(0.85, 0.95)
        b.tube([V((-1.78, y, oz - 0.01)), V((0.0, y, oz)), V((1.78, y, oz + 0.01))], [0.052, 0.058, 0.052], "bark", 7, (k, k * 0.97, k * 0.93), vtile=0.9, urep=2.0)
    slope = (OZB - OZF) / (2 * PYt)
    phi = math.atan(slope)
    ca, sa = math.cos(phi), math.sin(phi)
    nrm = V((0, -sa, ca))

    def roof(x, t, off):
        """Piste katolla: t = matka räystäältä (y = -1,3) pitkin luiskaa, off = normaalietäisyys saran keskilinjasta."""
        y = -1.3 + t * ca
        zc = OZF + ORS + 0.03 + slope * (y + PYt)
        return V((x, y, zc)) + nrm * off
    for i in range(7):
        x = -1.65 + i * 0.55
        a, c = roof(x, -0.0, 0.0), roof(x, 2.95, 0.0)
        b.tube([a, (a + c) / 2 + V((rng.uniform(-0.01, 0.01), 0, 0)), c], [0.034, 0.03, 0.026], "bark", 5, (0.85, 0.82, 0.78), vtile=0.8)
    for k_ in range(8):
        t = 0.1 + k_ * 0.38
        a, c = roof(-1.8, t, 0.05), roof(1.8, t, 0.05)
        b.tube([a, (a + c) / 2, c], [0.02, 0.02, 0.018], "bark", 5, (0.9, 0.86, 0.8), vtile=0.8)
    # tuohilevyt: kahdeksan limittäistä riviä; levy on loivemmin kuin katto, joten alareuna nousee edellisen levyn päälle
    DEL = 0.06
    for kk in range(8):
        t = 0.33 + 0.36 * kk
        for c_ in range(7):
            x = -1.65 + (c_ + (0.5 if kk % 2 else 0.0)) * 0.55 + rng.uniform(-0.02, 0.02)
            x = max(-1.62, min(1.62, x))
            R = Matrix.Rotation(phi + DEL + rng.uniform(-0.025, 0.025), 3, 'X') @ Matrix.Rotation(rng.uniform(-0.06, 0.06), 3, 'Y') @ Matrix.Rotation(rng.uniform(-0.05, 0.05), 3, 'Z')
            p = roof(x, t + rng.uniform(-0.03, 0.03), 0.104 + rng.uniform(0, 0.006))
            kc = rng.uniform(0.8, 1.0)
            red = rng.random() < 0.1                         # sisäpinta ylöspäin: punaruskea
            tint = (kc * 0.78, kc * 0.62, kc * 0.52) if red else (kc * 1.0, kc * 0.99, kc * 0.96)
            b.box(p, (0.58 + rng.uniform(-0.03, 0.03), 0.74, 0.024), "tuohi", tint, tile=0.6, rot=R)
    # painoriu'ut harjan suuntaan (x) levyjen päällä
    for t in (0.6, 1.55, 2.5):
        a, c = roof(-1.9, t, 0.175), roof(1.9, t + rng.uniform(-0.03, 0.03), 0.175)
        b.tube([a, (a + c) / 2, c], [0.036, 0.034, 0.03], "bark", 6, (0.8, 0.76, 0.72), vtile=0.8)
    return b.finish(col)


# ---------- 3. katos_nahka ----------
def build_katos_nahka(col):
    b = HH("katos_nahka", 203)
    rng = b.rng
    XP = 1.2
    RZ = 2.2
    for sx in (-1, 1):
        x = sx * XP
        b.tube([V((x, 0.0, -0.14)), V((x + sx * 0.01, 0.0, 1.0)), V((x, 0.0, 2.05))], [0.062, 0.055, 0.048], "bark", 7, (0.88, 0.85, 0.8), vtile=0.9, urep=2.0)
        for s in (-1, 1):
            b.pole(V((x, 0.0, 1.98)), V((x, s * 0.075, 2.25)), 0.024, "bark", 5, (0.85, 0.82, 0.78), taper=0.8)
        loop(b, (x, 0.0), 0.058, 1.9, rad=0.01, a0=rng.uniform(0, 6))
    b.tube([V((-1.45, 0.0, RZ)), V((0, 0.0, RZ + 0.005)), V((1.45, 0.0, RZ))], [0.04, 0.045, 0.04], "bark", 6, (0.9, 0.87, 0.82), vtile=0.9, urep=2.0)
    Rr = 0.062
    arc = [(Rr * math.cos(math.radians(a)), RZ + Rr * math.sin(math.radians(a))) for a in (150, 120, 90, 60, 30)]
    EXT0, EXT1 = 0.5, 0.3
    d0 = V((0.41, 0.255)).normalized()
    d1 = V((0.27, -0.87)).normalized()
    pts = [(-0.88 - d0.x * EXT0, 1.72 - d0.y * EXT0), (-0.88, 1.72), (-0.47, 1.975)] + arc + [(0.25, 1.70), (0.52, 1.02), (0.78, 0.0)]
    path = Path(pts)
    s_r = path.cum[5]                                          # sauma harjan huipulla, harjan suuntaan keskellä

    def gs(u, c, w):
        return math.exp(-((u - c) / w) ** 2)

    def hide(is_front, s_a, s_b, off, tint, seed, nu=16, nv=8):
        keymap = {}

        def fn(u, v):
            hw = 1.3 * (1 + 0.04 * nz((v * 5.0, 0.3, 0), 1.0, seed)) + 0.18 * gs(v, 0.12, 0.1) + 0.18 * gs(v, 0.88, 0.1) - 0.1 * gs(v, 0.5, 0.15)
            x = (2 * u - 1) * hw
            n = 0.025 * nz((u * 6.0, 0.7, 0), 1.0, seed + 3)
            if is_front:   # vapaa reuna v = 0: etujalkalohkot sivuilla, kaulan kaari keskellä
                free = EXT0 - (0.45 * gs(u, 0.08, 0.1) + 0.45 * gs(u, 0.92, 0.1)) + 0.2 * gs(u, 0.5, 0.17) + n
                s = free * (1 - v) + s_b * v
            else:          # vapaa reuna v = 1: takajalat alas, häntä keskellä
                free = (path.len - EXT1) + 0.28 * gs(u, 0.08, 0.1) + 0.28 * gs(u, 0.92, 0.1) + 0.1 * gs(u, 0.5, 0.07) - 0.07 * gs(u, 0.5, 0.2) + n
                s = s_a * (1 - v) + free * v
            y, z, ny, nzz = path.at(s)
            d = off + 0.006 * nz((u * 4.0, v * 2.0, 0), 1.0, seed)
            p = V((x, y + ny * d, z + nzz * d))
            keymap[(round(p.x, 4), round(p.y, 4), round(p.z, 4))] = (u, v)
            return p

        def colr(p):
            u, v = keymap.get((round(p.x, 4), round(p.y, 4), round(p.z, 4)), (0.5, 0.5))
            fe = (1 - v) if is_front else v
            e = max(abs(2 * u - 1) ** 3, fe ** 3)
            k = (0.9 + 0.1 * nz(p, 2.5, seed) + 0.05 * nz(p, 9.0, seed)) * (1 - 0.42 * e)
            return tuple(min(1, c_ * k) for c_ in tint)
        mid = path.at((s_a + s_b) / 2)
        grid_out(b, fn, nu, nv, "leather", colr, uvfn=lambda u, v: (u * 2.6 / 0.9, v * (s_b - s_a) / 0.9), out=lambda p: V((0, mid[2], mid[3])))
    hide(True, 0.0, s_r + 0.02, 0.0, (0.74, 0.7, 0.64), 11.0)             # ruskeanharmaa
    hide(False, s_r - 0.02, path.len, 0.008, (1.0, 0.93, 0.66), 23.0, 16, 10)  # kellanruskea
    ts = path.at(s_r)
    ya, za, nya, nza = path.at(s_r - 0.032)
    yb, zb, nyb, nzb = path.at(s_r + 0.032)
    for i in range(24):
        x = -1.25 + i * 0.109
        q = [V((x - 0.006, ya + nya * 0.0095, za + nza * 0.0095)), V((x + 0.006, ya + nya * 0.0095, za + nza * 0.0095)),
             V((x + 0.006, yb + nyb * 0.0145, zb + nzb * 0.0145)), V((x - 0.006, yb + nyb * 0.0145, zb + nzb * 0.0145))]
        face_dir(b, q, V((0, ts[2], ts[3])), "leather", (0.97, 0.9, 0.72), tile=0.3)
    for sx in (-1, 1):
        y0, z0, n0y, n0z = path.at(EXT0 + 0.12)
        top = V((sx * 1.18, y0 + n0y * -0.012, z0 + n0z * -0.012))
        b.tube([V((sx * 1.2, -1.22, -0.12)), V((sx * 1.19, -1.05, 0.9)), top], [0.036, 0.034, 0.03], "bark", 6, (0.86, 0.83, 0.78), vtile=0.8)
        ye, ze, ney, nze = path.at(path.len - EXT1)
        e = V((sx * 1.16, ye, ze))
        st = V((sx * 1.45, 1.3, 0.0))
        guy(b, e, st + V((sx * 0.05, 0.05, 0.31)), sag=0.05)
        stake(b, st, V((sx * 0.4, 0.9, 0)))
    return b.finish(col)


# ---------- 4. myyntipoyta ----------
def rough_plank(b, cx, y0, y1, L, TH, ztop, seed, col):
    """Lohkottu lankku: epätasaiset pitkät reunat ja päädyt, paksuus TH."""
    rng = random.Random(seed)
    N = 9
    xs = [-L / 2 + L * i / (N - 1) for i in range(N)]
    fr = [(cx + x + (rng.uniform(-0.02, 0.02) if i in (0, N - 1) else 0.0), y0 + rng.uniform(-0.014, 0.014)) for i, x in enumerate(xs)]
    bk = [(cx + x + (rng.uniform(-0.02, 0.02) if i in (0, N - 1) else 0.0), y1 + rng.uniform(-0.014, 0.014)) for i, x in enumerate(xs)][::-1]
    P = fr + bk
    top = [V((x, y, ztop)) for x, y in P]
    bot = [V((x, y, ztop - TH)) for x, y in P]
    face_dir(b, top, (0, 0, 1), "wood", col, 0.7, uaxis=(0, 1, 0))
    face_dir(b, bot, (0, 0, -1), "wood", tuple(c * 0.8 for c in col), 0.7, uaxis=(0, 1, 0))
    cen = V((cx, (y0 + y1) / 2, ztop - TH / 2))
    for i in range(len(P)):
        j = (i + 1) % len(P)
        q = [top[i], top[j], bot[j], bot[i]]
        face_dir(b, q, (q[0] + q[2]) / 2 - cen, "wood", tuple(c * 0.9 for c in col), 0.7, uaxis=(0, 0, 1))


def build_myyntipoyta(col):
    b = HH("myyntipoyta", 204)
    rng = b.rng
    L, D, TH = 2.2, 0.7, 0.1
    for i, (y0, y1) in enumerate(((-0.35, -0.008), (0.008, 0.35))):
        k = 0.8 + 0.1 * rng.random()
        rough_plank(b, rng.uniform(-0.02, 0.02), y0, y1, L + rng.uniform(-0.05, 0.0), TH, COUNTER_TOP, 40 + i, (k, k * 0.96, k * 0.9))
    zt = COUNTER_TOP - TH - 0.045
    for sx in (-1, 1):
        x = sx * 0.78
        b.pole(V((x, -0.31, zt)), V((x, 0.31, zt)), 0.045, "wood", 7, (0.7, 0.66, 0.6), taper=0.92)
        for sy in (-1, 1):
            for dx in (-1, 1):
                b.pole(V((x + dx * 0.22, sy * 0.36, -0.06)), V((x + dx * 0.02, sy * 0.27, zt + 0.02)), 0.034, "bark", 6, (0.8, 0.77, 0.73), taper=0.85)
    b.pole(V((-0.8, 0.0, 0.38)), V((0.8, 0.0, 0.38)), 0.028, "wood", 6, (0.7, 0.66, 0.6), taper=0.95)

    # pellavaliina etureunan yli: laskoksia ja pyöristetty reuna
    xc, hw = 0.4, 0.16
    zt0 = COUNTER_TOP + 0.005

    def cloth(u, v):
        s = v * 0.8
        fold = 0.014 * math.sin(u * math.pi * 6 + 0.8)
        if s < 0.44:
            y, z = 0.08 - s, zt0 + 0.004 * math.sin(u * 11 + v * 5)
        else:
            q = s - 0.44
            ang = min(1.0, q / 0.1)
            y = -0.364 - 0.03 * math.sin(ang * math.pi / 2) - fold * min(1.0, q / 0.2) - 0.02 * q
            z = zt0 - q * 0.93
        x = xc + (u - 0.5) * 2 * hw * (1 + 0.03 * math.sin(v * 7 + 1)) * (1 + 0.05 * max(0.0, s - 0.44))
        return V((x, y, z))

    def ccol(p):
        k = 0.9 + 0.1 * math.sin(p.x * 70) * 0.3 + 0.06 * nz(p, 9.0, 3.0)
        stripe = 1.0 if (0.462 < p.z < 0.49 and p.y < -0.34) else 0.0
        c = (0.93 * k, 0.9 * k, 0.83 * k)
        return mixc(c, (0.55, 0.2, 0.12), stripe * 0.85)
    grid_out(b, cloth, 8, 16, "linen", ccol, uvfn=lambda u, v: (u * 0.32 / 0.15, v * 0.8 / 0.15), out=lambda p: V((0, -0.3, 1)) if p.z >= COUNTER_TOP else V((0, -1, 0)))
    ob = b.finish(col)
    mount(col, ob, "mount_poyta", V((0, 0, COUNTER_TOP)))
    return ob


# ---------- 5. turkisteline ----------
FUR_RED = (0.78, 0.34, 0.11)
FUR_WHITE = (0.93, 0.9, 0.84)


def fox_pelt(b, x, y_p, z_top, seed, sc=1.0, red=FUR_RED):
    rng = random.Random(seed)
    path = Path([(y_p, z_top), (y_p, z_top - 1.4)])
    L = 0.5 * sc
    prof0 = [(0.0, 0.007), (0.03, 0.017), (0.07, 0.037), (0.12, 0.062), (0.18, 0.045), (0.26, 0.066), (0.36, 0.072), (0.5, 0.07),
             (0.62, 0.072), (0.72, 0.078), (0.82, 0.075), (0.92, 0.062), (1.0, 0.03)]
    prof = [(v, w * sc) for v, w in prof0]

    def body(u, v, side):
        m = abs(2 * u - 1)
        r_ = mixc(red, tuple(c * 0.78 for c in red), 0.45 * (1 - m) * sstep(0.1, 0.25, v)) if side > 0 else (0.82, 0.5, 0.3)
        bib = (1 - sstep(0.45, 0.85, m)) * sstep(0.16, 0.25, v) * (1 - sstep(0.4, 0.5, v))
        muzzle = (1 - sstep(0.05, 0.12, v)) * 0.8
        c = mixc(r_, FUR_WHITE, max(bib * (1.0 if side > 0 else 0.5), muzzle))
        c = mixc(c, (0.07, 0.05, 0.04), (1 - sstep(0.0, 0.025, v)))
        k = edge_k(u, v, 0.32) * (0.93 + 0.1 * nz((u * 3, v * 5, side), 1.0, seed))
        return tuple(max(0.0, min(1.0, ch * k)) for ch in c)
    pillow(b, path, 0.0, L, x, prof, 0.036 * sc, 5, 12, body, tile=0.22, rag=0.05, seed=seed)
    # jalat: kapeat suikaleet rungon sivuilla alaspäin, päissä mustat käpälät
    for sv in (0.26, 0.6):
        w0 = interp(prof, sv)
        for sx in (-1, 1):
            def leg(u, v, side):
                c = mixc(red, tuple(ch * 0.7 for ch in red), 0.3)
                c = mixc(c, (0.06, 0.05, 0.04), sstep(0.58, 0.72, v))
                return tuple(ch * edge_k(u, v, 0.25) for ch in c)
            pillow(b, path, sv * L - 0.01, 0.2 * sc, x + sx * (w0 * 0.62), [(0, 0.02 * sc), (0.5, 0.018 * sc), (0.85, 0.015 * sc), (1, 0.008 * sc)], 0.012, 2, 4, leg,
                   tile=0.2, seed=seed, off=0.03 * sc)

    def tail(u, v, side):
        m = abs(2 * u - 1)
        c = mixc(red, tuple(ch * 0.7 for ch in red), 0.4 * (1 - m) * (1 - sstep(0.1, 0.5, v)))
        c = mixc(c, (0.18, 0.1, 0.07), 0.35 * sstep(0.5, 0.65, v) * (1 - sstep(0.75, 0.82, v)) * (1 - m))
        c = mixc(c, FUR_WHITE, sstep(0.76, 0.86, v))
        k = edge_k(u, v, 0.3) * (0.93 + 0.1 * nz((u * 3, v * 4, side), 1.0, seed + 4))
        return tuple(max(0.0, min(1.0, ch * k)) for ch in c)
    pillow(b, path, L * 0.97, 0.36 * sc, x, [(0, 0.04 * sc), (0.14, 0.07 * sc), (0.45, 0.092 * sc), (0.75, 0.078 * sc), (0.93, 0.05 * sc), (1.0, 0.012 * sc)], 0.05 * sc, 4, 6, tail,
           tile=0.22, rag=0.04, seed=seed + 1, off=-0.003)
    epath = Path([(y_p, z_top + 0.06), (y_p, z_top - 0.1)])
    for sx in (-1, 1):
        def ear(u, v, side):
            return tuple(ch * edge_k(u, v, 0.2) for ch in (0.1, 0.06, 0.04))
        pillow(b, epath, 0.0, 0.14 * sc, x + sx * 0.05 * sc, [(0, 0.004), (0.4, 0.015), (1.0, 0.024)], 0.011, 2, 2, ear, tile=0.2, seed=seed, off=-0.011)


def squirrel_bundle(b, x, y_p, z_top, n, seed):
    """Oravannippu: n pientä litistettyä nahkaa (pää, vartalo ja tuuhea häntä) sidottuna yläpäästä, viuhkana."""
    rng = random.Random(seed)
    for i in range(n):
        fx = (i - (n - 1) / 2) / ((n - 1) / 2)
        tilt = fx * 0.05 + rng.uniform(-0.01, 0.01)
        yo = rng.uniform(-0.012, 0.012) + (0.012 if i % 2 else -0.01)
        path = Path([(y_p + yo, z_top), (y_p + yo, z_top - 0.8)])
        grey = rng.uniform(0.5, 0.62)
        rust = rng.random() < 0.3

        def sk(u, v, side, grey=grey, rust=rust):
            m = abs(2 * u - 1)
            base = (0.55, 0.43, 0.32) if rust else (grey, grey * 0.99, grey * 0.97)
            belly = (0.9, 0.88, 0.82)
            c = mixc(base, belly, 0.0 if side > 0 else 0.9)
            c = mixc(c, belly, (0.5 * sstep(0.4, 0.9, m) if side > 0 else 0.0))
            c = mixc(c, tuple(ch * 0.55 for ch in base), 0.6 * sstep(0.55, 0.7, v) * (1 - m))
            c = mixc(c, (0.2, 0.18, 0.16), 0.75 * sstep(0.88, 0.97, v))
            c = mixc(c, (0.14, 0.11, 0.09), 0.5 * (1 - sstep(0.0, 0.16, v)))
            return tuple(max(0.0, min(1.0, ch * edge_k(u, v, 0.28))) for ch in c)
        pillow(b, path, 0.0, 0.29, x + fx * 0.09,
               [(0, 0.012), (0.07, 0.024), (0.15, 0.02), (0.22, 0.034), (0.45, 0.038), (0.52, 0.028), (0.6, 0.044), (0.8, 0.052), (0.93, 0.046), (1, 0.026)],
               0.013, 2, 6, sk, tile=0.16, seed=seed + i, xs=lambda v, tilt=tilt: tilt * v * 0.6, off=0.0)
    b.tube([V((x + math.cos(a) * 0.085, y_p + math.sin(a) * 0.02, z_top - 0.035 + a * 0.003)) for a in (0, 1.1, 2.2, 3.3, 4.4, 5.5, 6.4)], 0.007, "leather", 3, (0.72, 0.58, 0.4), vtile=0.1)


def hang_thong(b, x, y_o, z_o, r, y_p, z_att, color=(0.7, 0.57, 0.38)):
    """Nahkalenkki orren yli ja alas turkin yläpäähän."""
    pts = [V((x, y_o + r + 0.01, z_o - 0.05)), V((x, y_o + r + 0.01, z_o)), V((x, y_o, z_o + r + 0.01)), V((x, y_o - r - 0.01, z_o)),
           V((x, y_p, z_att))]
    b.tube(pts, 0.007, "leather", 3, color, vtile=0.1)


def build_turkisteline(col):
    b = HH("turkisteline", 205)
    rng = b.rng
    FX = 1.3
    UZ, LZ, LY = 1.9, 1.1, 0.07
    kb = (0.8, 0.77, 0.74)
    for sx in (-1, 1):
        x = sx * FX
        b.tube([V((x, 0, -0.15)), V((x + sx * 0.005, 0.01, UZ * 0.5)), V((x, 0.02, UZ - 0.15))], [0.075, 0.065, 0.058], "bark", 7, kb, vtile=0.9, urep=2.0)
        for s in (-1, 1):
            b.pole(V((x, 0.02, UZ - 0.17)), V((x + s * 0.11, 0.02, UZ + 0.12)), 0.032, "bark", 5, (0.78, 0.75, 0.72))
        # vinotuet taakse
        b.tube([V((x, 0.04, 1.35)), V((x * 1.03, 0.55, 0.65)), V((x * 1.06, 1.05, -0.1))], [0.04, 0.036, 0.034], "bark", 6, kb, vtile=0.9)
        loop(b, (x, 0.0), 0.07, 1.05, rad=0.01, a0=rng.uniform(0, 6))
        loop(b, (x, 0.0), 0.07, 1.42, rad=0.01, a0=rng.uniform(0, 6))
    b.tube([V((-1.55, 0, UZ - 0.004)), V((0, 0, UZ)), V((1.55, 0, UZ - 0.004))], [0.046, 0.052, 0.046], "bark", 7, (0.82, 0.78, 0.74), vtile=0.9, urep=2.0)
    b.tube([V((-1.5, LY, LZ)), V((0, LY, LZ - 0.004)), V((1.5, LY, LZ))], [0.04, 0.045, 0.04], "bark", 7, (0.82, 0.78, 0.74), vtile=0.9, urep=2.0)
    ORT = 0.05
    # ketunnahat
    y_f = -0.1
    for x, sd, sc_, rc in ((-1.15, 11.0, 1.0, (0.78, 0.34, 0.11)), (-0.85, 12.0, 0.9, (0.84, 0.41, 0.15)), (-0.55, 13.0, 1.08, (0.7, 0.29, 0.1))):
        zt = UZ - 0.08
        hang_thong(b, x, 0.0, UZ, ORT, y_f, zt + 0.01)
        fox_pelt(b, x, y_f, zt, sd, sc_, rc)
    # oravannipput
    squirrel_bundle(b, -0.05, y_f, UZ - 0.1, 9, 31)
        # sidontanarut
    hang_thong(b, -0.05, 0.0, UZ, ORT, y_f, UZ - 0.1)
    squirrel_bundle(b, 0.25, y_f, UZ - 0.1, 8, 41)
    hang_thong(b, 0.25, 0.0, UZ, ORT, y_f, UZ - 0.1)
    # hirvennahka orren yli taitettuna (yläorsi)
    mp = drape(0.0, UZ, 0.075, 0.35, 1.27)
    mprof = [(0.0, 0.2), (0.03, 0.42), (0.09, 0.55), (0.17, 0.5), (0.25, 0.58), (0.35, 0.52), (0.5, 0.54), (0.65, 0.5), (0.76, 0.6), (0.84, 0.52),
             (0.92, 0.4), (0.98, 0.28), (1.0, 0.1)]

    def moose(u, v, side):
        m = abs(2 * u - 1)
        c = mixc((0.43, 0.35, 0.27), (0.56, 0.5, 0.42), sstep(0.65, 1.0, m) * 0.7)
        c = mixc(c, (0.28, 0.21, 0.16), 0.55 * sstep(0.84, 0.95, v) * (1 - m))
        c = mixc(c, (0.34, 0.27, 0.2), 0.4 * (1 - m) * sstep(0.2, 0.5, v) * (1 - sstep(0.5, 0.8, v)))
        k = edge_k(u, v, 0.3) * (0.92 + 0.12 * nz((u * 4, v * 5, 1.0), 1.0, 5.0))
        if side < 0:
            c = (0.62, 0.52, 0.4)
        return tuple(max(0.0, min(1.0, ch * k)) for ch in c)
    pillow(b, mp, 0.0, mp.len, 0.95, mprof, 0.032, 10, 11, moose, tile=0.3, rag=0.1, seed=71.0)
    for x in (0.55, 1.35):
        hang_thong(b, x, 0.0, UZ, ORT, y_f - 0.0, UZ - 0.0, color=(0.65, 0.5, 0.35))
    # karhuntalja alemman orren yli
    bp = drape(LY, LZ, 0.062, 0.22, 1.0)
    bprof = [(0.0, 0.1), (0.06, 0.28), (0.15, 0.36), (0.3, 0.34), (0.45, 0.32), (0.58, 0.34), (0.68, 0.3), (0.75, 0.2),
             (0.8, 0.17), (0.86, 0.22), (0.93, 0.2), (0.98, 0.1), (1.0, 0.05)]

    def bear(u, v, side):
        m = abs(2 * u - 1)
        c = mixc((0.27, 0.16, 0.09), (0.34, 0.21, 0.12), 0.5 * sstep(0.5, 1.0, m))
        c = mixc(c, (0.3, 0.2, 0.12), sstep(0.88, 0.94, v) * (1 - sstep(0.96, 0.99, v)) * 0.8)
        c = mixc(c, (0.05, 0.04, 0.035), sstep(0.975, 0.99, v))
        c = mixc(c, (0.13, 0.08, 0.05), 0.4 * (1 - m) * sstep(0.1, 0.4, v) * (1 - sstep(0.6, 0.75, v)))
        k = edge_k(u, v, 0.35) * (0.9 + 0.14 * nz((u * 4, v * 5, 2.0), 1.0, 8.0))
        if side < 0:
            c = (0.45, 0.35, 0.26)
        return tuple(max(0.0, min(1.0, ch * k)) for ch in c)
    BX = -0.2
    pillow(b, bp, 0.0, bp.len, BX, bprof, 0.045, 10, 13, bear, tile=0.3, rag=0.04, seed=91.0)

    def bleg(u, v, side):
        c = mixc((0.26, 0.15, 0.085), (0.13, 0.08, 0.05), sstep(0.55, 0.85, v))
        c = mixc(c, (0.7, 0.62, 0.5), sstep(0.93, 0.97, v) * 0.9)
        return tuple(max(0.0, min(1.0, ch * edge_k(u, v, 0.35))) for ch in c)
    for sv, ln_, tilt in ((0.3, 0.44, 0.34), (0.62, 0.46, 0.4)):
        for sx in (-1, 1):
            pillow(b, bp, sv * bp.len, ln_, BX + sx * 0.26, [(0, 0.15), (0.5, 0.14), (0.85, 0.125), (1, 0.08)], 0.04, 4, 5, bleg, tile=0.3, seed=95.0 + sx,
                   xs=lambda v, sx=sx, tilt=tilt: sx * tilt * v, off=-0.006)
    # korvat: pienet pyöreät nystyt pään yläpäässä
    yh, zh, nyh, nzh = bp.at(bp.len * 0.82)
    ep = Path([(yh + nyh * 0.01, zh + 0.045), (yh + nyh * 0.01, zh - 0.05)])
    for sx in (-1, 1):
        def bear_ear(u, v, side):
            return tuple(ch * edge_k(u, v, 0.3) for ch in (0.14, 0.085, 0.05))
        pillow(b, ep, 0.0, 0.095, BX + sx * 0.185, [(0, 0.012), (0.5, 0.042), (1, 0.014)], 0.02, 3, 3, bear_ear, tile=0.2, seed=3.0, off=0.02)
    hang_thong(b, -0.2, LY, LZ, 0.04, LY - 0.07, LZ + 0.0, color=(0.6, 0.48, 0.34))
    return b.finish(col)


# ---------- 6. aseteline ----------
AF = (-1.45, 1.45)             # haarapuiden x
A_RZ = 1.45                    # orren korkeus
A_YF = 0.30                    # lankkuseinän etupinta
A_BUTT_Y = -0.40               # keihäiden tyvet
A_GRIP = 0.625                 # characters.glb:n `spear`: tyvi 0,625 m otteen takana
SPEAR_XS = (-1.15, -0.9, -0.65)
SH_CX = (0.65, 1.1)
AXE_X = (-0.2, 0.25)
AXE_TILT = math.radians(6.0)
AXE_PEG_Z = 0.98


def a_spear_dir():
    """Orteen nojaavan keihään suunta tyvestä kärkeen (kuten smithy.py:n spear_dir)."""
    return V((0, -0.06 - A_BUTT_Y, A_RZ + 0.01)).normalized()


def frame_from(x_, y_):
    z_ = x_.cross(y_)
    return Matrix((x_, y_, z_)).transposed().to_euler()


def build_aseteline(col):
    b = HH("aseteline", 206)
    rng = b.rng
    kb = (0.8, 0.77, 0.74)
    for x in AF:
        b.pole(V((x, 0, -0.15)), V((x, 0.02, A_RZ - 0.16)), 0.055, "bark", 7, kb, taper=0.85)
        for s in (-1, 1):
            b.pole(V((x, 0.02, A_RZ - 0.18)), V((x + s * 0.1, 0.02, A_RZ + 0.08)), 0.03, "bark", 5, (0.78, 0.75, 0.72))
        loop(b, (x, 0.0), 0.058, A_RZ - 0.24, rad=0.009, a0=rng.uniform(0, 6))
    b.pole(V((AF[0] - 0.25, 0, A_RZ)), V((AF[1] + 0.25, 0, A_RZ)), 0.045, "bark", 7, kb, taper=0.92)
    b.pole(V((SPEAR_XS[0] - 0.1, A_BUTT_Y - 0.08, 0.05)), V((SPEAR_XS[2] + 0.1, A_BUTT_Y - 0.08, 0.05)), 0.055, "bark", 7, (0.78, 0.75, 0.72), taper=0.95)
    # takaseinä: pystypaalut, vaakariu'ut ja pystylankut
    for sx in (-1, 1):
        x = sx * 1.6
        b.tube([V((x, 0.45, -0.12)), V((x, 0.45, 1.0)), V((x, 0.45, 2.02))], [0.058, 0.052, 0.045], "bark", 7, kb, vtile=0.9, urep=2.0)
        for z in (1.2, 0.6):                                              # sidepuut haarapuusta seinäpaaluun
            b.pole(V((sx * 1.45, 0.04, z)), V((x, 0.43, z)), 0.026, "bark", 5, (0.78, 0.75, 0.72), taper=0.95)
    for z in (0.5, 1.62):
        b.pole(V((-1.62, A_YF + 0.085, z)), V((1.62, A_YF + 0.085, z)), 0.032, "bark", 6, (0.8, 0.77, 0.73), taper=1.0)
    xcur = -1.5
    widths = [0.31, 0.46, 0.38, 0.5, 0.33, 0.42, 0.28, 0.32]
    sc_w = 3.0 / (sum(widths) + 0.02 * len(widths))
    for wv in widths:
        w = wv * sc_w
        x = xcur + w / 2
        xcur += w + 0.02 * sc_w
        top = rng.uniform(1.84, 1.98)
        k = rng.uniform(0.4, 0.5)
        b.box(V((x + rng.uniform(-0.004, 0.004), A_YF + 0.02, 0.004 + (top - 0.004) / 2)), (w, 0.04, top - 0.004), "wood", (k * 0.95, k * 0.97, k * 1.0), tile=0.11, grain=2)
    # tapit: kirveiden jalkatapit ja kilven ripustustappi
    for ax in AXE_X:
        peg_top = AXE_PEG_Z + 0.016
        b.pole(V((ax, A_YF - 0.005, AXE_PEG_Z)), V((ax, A_YF - 0.17, AXE_PEG_Z + 0.004)), 0.016, "wood", 5, (0.85, 0.8, 0.7), taper=0.9)
    sx_ = SH_CX[1]
    b.pole(V((sx_, A_YF - 0.005, 1.93)), V((sx_, A_YF - 0.115, 1.935)), 0.017, "wood", 5, (0.85, 0.8, 0.7), taper=0.9)
    # kilven ripustushihna tapista alas
    b.tube([V((sx_, A_YF - 0.108, 1.945)), V((sx_, A_YF - 0.12, 1.91)), V((sx_, A_YF - 0.11, 1.86))], 0.008, "leather", 3, (0.7, 0.55, 0.38), vtile=0.1)
    ob = b.finish(col)
    d = a_spear_dir()
    z_ = (V((0, -1, 0)) + d * d.y).normalized()
    rot = frame_from((-d).cross(z_), -d)
    for i, x in enumerate(SPEAR_XS):
        grip = V((x, A_BUTT_Y, -0.01)) + d * A_GRIP
        e = mount(col, ob, "mount_keihas_%d" % (i + 1), grip)
        e.rotation_euler = rot
    # kilvet: paikallinen -Y on kilven pinta, +Z ylös
    SH_T = (0.114, 0.044)
    for i, (cx, alpha) in enumerate(zip(SH_CX, (math.radians(12), 0.0))):
        ca, sa = math.cos(alpha), math.sin(alpha)
        cz = 0.407 * ca + SH_T[1] * sa + 0.004
        cy = (A_YF - 0.004) - (SH_T[1] * ca + 0.407 * sa)
        if i == 1:
            cz, cy = 1.46, A_YF - 0.004 - SH_T[1]
        e = mount(col, ob, "mount_kilpi_%d" % (i + 1), V((cx, cy, cz)))
        e.rotation_euler = Matrix.Rotation(-alpha, 3, 'X').to_euler()
    # kirveet: pää ylhäällä, 6 astetta seinää vasten, tyven jalkatapin päällä
    dd = V((0, math.sin(AXE_TILT), math.cos(AXE_TILT)))
    yy = -dd
    for i, ax in enumerate(AXE_X):
        # varren yläpää painuu seinää kohti: tyven keskipiste y = seinä - 0,021 - 0,70 * sin
        butt = V((ax, A_YF - 0.021 - 0.70 * math.sin(AXE_TILT) - 0.006, AXE_PEG_Z + 0.016 + 0.0145 + 0.002))
        grip = butt + dd * 0.085
        e = mount(col, ob, "mount_kirves_%d" % (i + 1), grip)
        e.rotation_euler = frame_from(V((1, 0, 0)), yy)
    return ob


# ---------- kokoonpano ----------
BUILDERS_MK = [build_katos_vaate, build_katos_tuohi, build_katos_nahka, build_myyntipoyta, build_turkisteline, build_aseteline]


def build_market(export=True):
    col = bpy.data.collections.get("GAME")
    if not col:
        col = bpy.data.collections.new("GAME")
        bpy.context.scene.collection.children.link(col)
    for o in list(col.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    make_market_materials()
    obs = [f(col) for f in BUILDERS_MK]
    bpy.context.view_layer.update()
    out = {}
    for o in obs:
        xs = [v.co for v in o.data.vertices]
        out[o.name] = {"tris": sum(len(p.vertices) - 2 for p in o.data.polygons),
                       "min": [round(min(c[i] for c in xs), 2) for i in range(3)],
                       "max": [round(max(c[i] for c in xs), 2) for i in range(3)]}
    out["tris_total"] = sum(v["tris"] for v in out.values())
    fv = [v.co for v in bpy.data.objects["katos_vaate"].data.vertices if v.co.y < -1.0 and v.co.z > 1.6]
    ft = [v.co for v in bpy.data.objects["katos_tuohi"].data.vertices if v.co.y < -0.9 and v.co.z > 1.8 and abs(v.co.x) < 1.2]
    out["vaate_front_hem_min_z"] = round(min(c.z for c in fv), 3)
    out["tuohi_front_eave_min_z"] = round(min(c.z for c in ft), 3)
    if export:
        out["glb_mb"] = export_market()
    return out


def export_market():
    col = bpy.data.collections["GAME"]
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    objs = list(col.objects)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    path = os.path.join(OUT, "market.glb")
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True,
        export_image_format='WEBP', export_image_quality=82,
        export_vertex_color='NAME', export_vertex_color_name='Col', export_all_vertex_colors=False,
        export_apply=False, export_animations=False, export_morph=False, export_yup=True,
        export_cameras=False, export_lights=False,
    )
    return round(os.path.getsize(path) / 1e6, 2)


# ---------- esikatselu: viedystä GLB:stä ----------
POS = {"katos_vaate": (-10.0, 0), "katos_tuohi": (-5.4, 0), "katos_nahka": (-1.2, 0), "myyntipoyta": (2.3, 0),
       "turkisteline": (6.0, 0), "aseteline": (10.6, 0)}


def preview_market(prefix, glb=None):
    sc = bpy.context.scene
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    glb = glb or os.path.join(OUT, "market.glb")
    bpy.ops.import_scene.gltf(filepath=glb)
    mk = {o.name.split(".")[0]: o for o in bpy.data.objects if o.parent is None and o.type in ('MESH',)}
    for nm, o in list(mk.items()):
        o.location = V((POS[nm][0], POS[nm][1], 0))
    gm = bpy.data.materials.new("pv_g")
    gm.use_nodes = True
    gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.1, 0.16, 0.06, 1)
    ground = bpy.data.meshes.new("pv_ground")
    bm = bmesh.new()
    bm.faces.new([bm.verts.new(p) for p in ((-40, -30, 0.0), (40, -30, 0.0), (40, 40, 0.0), (-40, 40, 0.0))])
    bm.to_mesh(ground)
    ground.materials.append(gm)
    sc.collection.objects.link(bpy.data.objects.new("pv_ground", ground))
    rm = bpy.data.materials.new("pv_ref")
    rm.use_nodes = True
    rm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.15, 0.25, 0.7, 1)
    refs = []
    for nm, (x, y) in (("pv_h1", (-10.0, -1.0)), ("pv_h2", (-5.4, -1.3)), ("pv_h3", (2.3, -0.9)), ("pv_h4", (-1.2, -1.5)), ("pv_h5", (6.0, -0.9))):
        bpy.ops.mesh.primitive_cylinder_add(radius=0.2, depth=1.8, location=(x, y, 0.9))
        o = bpy.context.active_object
        o.name = nm
        o.data.materials.append(rm)
        refs.append(o)
    # aseet
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(_HERE, "..", "..", "assets", "characters.glb"))
    ch = [o for o in bpy.data.objects if o not in before]
    bpy.ops.import_scene.gltf(filepath=os.path.join(_HERE, "..", "..", "assets", "kirveet.glb"))
    kv = [o for o in bpy.data.objects if o not in before and o not in ch]
    spear = next(o for o in ch if o.name.startswith("spear"))
    shield = next(o for o in ch if o.name.startswith("shield_hero"))
    shield2 = next(o for o in ch if o.name.startswith("shield_pohja"))
    axes = {o.name.split(".")[0]: o for o in kv if o.type == 'MESH'}
    src = {"spear": spear, "shield_hero": shield, "shield_pohja": shield2, "kirves_parta": axes["kirves_parta"], "kirves_karjala": axes["kirves_karjala"]}
    for o in ch + kv:
        o.hide_render = o not in src.values()
        o.hide_viewport = o.hide_render
        if o.type == 'MESH':
            o.parent = None
    for o in src.values():
        o.hide_render = True
    mounts = {o.name: o for o in bpy.data.objects if o.name.startswith("mount_") and o.name.split(".")[0] not in ("mount_huotra", "mount_kilpi_selka", "mount_kirves")}
    assign = {"mount_keihas_1": "spear", "mount_keihas_2": "spear", "mount_keihas_3": "spear",
              "mount_kilpi_1": "shield_hero", "mount_kilpi_2": "shield_pohja",
              "mount_kirves_1": "kirves_parta", "mount_kirves_2": "kirves_karjala"}
    bpy.context.view_layer.update()
    for nm, key in assign.items():
        m = next(o for o in bpy.data.objects if o.name.split(".")[0] == nm and o.type == 'EMPTY')
        c = src[key].copy()
        sc.collection.objects.link(c)
        c.hide_render = False
        c.hide_viewport = False
        c.matrix_world = m.matrix_world.copy()
    sun = bpy.data.objects.new("pv_sun", bpy.data.lights.new("pv_sun", 'SUN'))
    sun.data.energy = 2.6
    sun.rotation_euler = (0.9, 0.2, 0.6)
    sc.collection.objects.link(sun)
    sc.view_settings.view_transform = 'Standard'
    wd = bpy.data.worlds.new("pv_world")
    wd.use_nodes = True
    bg = wd.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.7, 0.78, 0.85, 1)
    bg.inputs[1].default_value = 0.7
    sc.world = wd
    cam = bpy.data.objects.new("pv_cam", bpy.data.cameras.new("pv_cam"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = 960, 540
    X = POS
    shots = [
        ("row", (0.4, 0.0, 1.2), (0.4, -21.0, 6.5), 28),
        ("rowb", (0.4, 0.0, 1.2), (0.4, 21.0, 6.5), 28),
        ("vaate_a", (X["katos_vaate"][0], 0, 1.4), (X["katos_vaate"][0] + 2.5, -7.0, 3.9), 35),
        ("vaate_b", (X["katos_vaate"][0], 0, 1.4), (X["katos_vaate"][0] - 5.0, 5.5, 4.5), 35),
        ("tuohi_a", (X["katos_tuohi"][0], 0, 1.4), (X["katos_tuohi"][0] + 3.0, -7.5, 4.2), 35),
        ("tuohi_b", (X["katos_tuohi"][0], 0, 1.8), (X["katos_tuohi"][0] - 3, 3.0, 5.6), 35),
        ("nahka_a", (X["katos_nahka"][0], 0.2, 1.3), (X["katos_nahka"][0] + 2.2, -6.0, 3.6), 35),
        ("nahka_b", (X["katos_nahka"][0], 0.2, 1.3), (X["katos_nahka"][0] - 3.0, 5.0, 4.0), 35),
        ("poyta_a", (X["myyntipoyta"][0], 0, 0.7), (X["myyntipoyta"][0] + 1.0, -3.3, 2.0), 35),
        ("poyta_b", (X["myyntipoyta"][0], 0, 0.7), (X["myyntipoyta"][0] - 1.5, 2.6, 2.4), 35),
        ("turkis_a", (X["turkisteline"][0], 0, 1.2), (X["turkisteline"][0] + 1.5, -7.0, 3.7), 33),
        ("turkis_close", (X["turkisteline"][0] - 0.4, 0, 1.3), (X["turkisteline"][0] - 0.2, -3.8, 2.2), 40),
        ("turkis_close_r", (X["turkisteline"][0] + 0.6, 0, 1.2), (X["turkisteline"][0] + 1.4, -3.6, 2.0), 40),
        ("turkis_b", (X["turkisteline"][0], 0, 1.2), (X["turkisteline"][0] - 2.0, 4.5, 3.4), 35),
        ("aseteline_a", (X["aseteline"][0], 0.1, 1.1), (X["aseteline"][0] + 1.8, -6.5, 3.5), 35),
        ("aseteline_close", (X["aseteline"][0] + 0.2, 0.15, 1.3), (X["aseteline"][0] + 1.5, -3.6, 2.1), 45),
        ("aseteline_side", (X["aseteline"][0], 0.15, 1.2), (X["aseteline"][0] + 5.5, -1.0, 1.9), 40),
        ("aseteline_b", (X["aseteline"][0], 0.15, 1.1), (X["aseteline"][0] - 2.5, 4.0, 3.0), 35),
    ]
    only = os.environ.get("KALEVALA_SHOTS")
    if only:
        names = only.split(",")
        shots = [s_ for s_ in shots if s_[0] in names]
    for name, tgt, pos, lens in shots:
        for r in refs:
            r.hide_render = name in ("poyta_b", "vaate_b", "nahka_b", "tuohi_b", "turkis_b", "aseteline_b", "turkis_close", "turkis_close_r",
                                     "aseteline_close", "aseteline_side")
        cam.location = V(pos)
        cam.rotation_euler = (V(tgt) - V(pos)).to_track_quat('-Z', 'Y').to_euler()
        cam.data.lens = lens
        sc.render.filepath = prefix + "_" + name + ".png"
        bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    if os.environ.get("KALEVALA_PREVIEW_ONLY"):
        preview_market(os.environ["KALEVALA_PREVIEW"])
        print("PREVIEW_DONE")
    else:
        for o in list(bpy.data.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        res = build_market(export=os.environ.get("KALEVALA_NO_EXPORT") is None)
        pv = os.environ.get("KALEVALA_PREVIEW")
        if pv:
            glb_path = os.path.join(OUT, "market.glb")
            if os.path.exists(glb_path):
                preview_market(pv, glb_path)
        print("RESULT_JSON " + json.dumps(res))
