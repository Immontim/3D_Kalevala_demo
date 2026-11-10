"""Proseduraaliset varvut ja koivunoksa oksakorttien lähteeksi.
Geometria on värjätty verteksiväreillä; renderöidään cards.py:n render_card:lla.
"""
import bpy, bmesh, math, random
from mathutils import Vector, Matrix


def _vc_material():
    m = bpy.data.materials.get("SprigVC")
    if m:
        return m
    m = bpy.data.materials.new("SprigVC")
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    vc = nt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "Col"
    nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.7
    return m


class Sprig:
    def __init__(self, name, seed):
        self.name = name
        self.rng = random.Random(seed)
        self.bm = bmesh.new()
        self.col = self.bm.loops.layers.color.new("Col")

    def _face(self, verts, color):
        try:
            f = self.bm.faces.new(verts)
        except ValueError:
            return
        for l in f.loops:
            l[self.col] = (*color, 1)

    def tube(self, pts, r0, r1, color, sides=4):
        rings = []
        n = len(pts)
        for i, p in enumerate(pts):
            d = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
            a = d.orthogonal().normalized()
            b = d.cross(a)
            r = r0 + (r1 - r0) * i / max(1, n - 1)
            rings.append([self.bm.verts.new(p + (a * math.cos(t) + b * math.sin(t)) * r)
                          for t in [k * 2 * math.pi / sides for k in range(sides)]])
        for i in range(n - 1):
            for k in range(sides):
                self._face([rings[i][k], rings[i][(k + 1) % sides], rings[i + 1][(k + 1) % sides], rings[i + 1][k]], color)

    def leaf(self, base, direction, length, width, color, facing=None, shape="ovate"):
        """Lehti: tyvi base, kärki suuntaan direction. facing = lehden normaali (oletus kameraan -Y)."""
        rng = self.rng
        d = direction.normalized()
        nrm = facing or Vector((rng.uniform(-0.5, 0.5), -1, rng.uniform(-0.5, 0.5)))
        side = d.cross(nrm).normalized()
        if shape == "birch":   # kolmiomainen, leveä tyvi, suippo kärki
            prof = [(0.0, 0.0), (0.12, 0.42), (0.35, 0.5), (0.7, 0.28), (1.0, 0.0)]
        elif shape == "needle":
            prof = [(0.0, 0.0), (0.5, 0.5), (1.0, 0.0)]
        else:
            prof = [(0.0, 0.0), (0.25, 0.4), (0.55, 0.5), (0.85, 0.3), (1.0, 0.0)]
        left = [self.bm.verts.new(base + d * (t * length) - side * (w * width)) for t, w in prof[1:-1]]
        right = [self.bm.verts.new(base + d * (t * length) + side * (w * width)) for t, w in prof[1:-1]]
        v0 = self.bm.verts.new(base)
        v1 = self.bm.verts.new(base + d * length)
        c2 = tuple(min(1, c * rng.uniform(0.8, 1.15)) for c in color)
        self._face([v0] + right + [v1] + left[::-1], c2)

    def berry(self, p, r, color):
        m = Matrix.Translation(p)
        res = bmesh.ops.create_icosphere(self.bm, subdivisions=1, radius=r, matrix=m)
        for v in res["verts"]:
            for f in v.link_faces:
                for l in f.loops:
                    l[self.col] = (*color, 1)

    def finish(self, collection, location=(0, 0, 0)):
        me = bpy.data.meshes.new(self.name)
        self.bm.to_mesh(me)
        self.bm.free()
        old = bpy.data.objects.get(self.name)
        if old:
            bpy.data.objects.remove(old, do_unlink=True)
        ob = bpy.data.objects.new(self.name, me)
        me.materials.append(_vc_material())
        collection.objects.link(ob)
        ob.location = location
        return ob


def mix(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def birch_twig(name, seed, col):
    """Riippuva koivunoksa: tyvi ylhäällä (0,0,0), kasvaa alaspäin n. 0,9 m."""
    s = Sprig(name, seed)
    rng = s.rng
    green, yellow, ochre = (0.24, 0.42, 0.07), (0.80, 0.66, 0.08), (0.70, 0.45, 0.07)
    bark = (0.10, 0.06, 0.04)

    def twig(start, d, length, depth):
        pts = [start]
        p = start.copy()
        n = max(4, int(length / 0.05))
        for i in range(n):
            d = (d + Vector((rng.uniform(-0.12, 0.12), rng.uniform(-0.05, 0.05), -0.10))).normalized()
            p = p + d * (length / n)
            pts.append(p.copy())
            if i > 0:
                for sgn in (-1, 1):
                    if rng.random() < 0.85:
                        ld = (Vector((sgn * rng.uniform(0.5, 1.0), rng.uniform(-0.3, 0.3), rng.uniform(-0.9, -0.1)))).normalized()
                        t = rng.random()
                        c = mix(green, yellow, min(1, t * 1.6)) if t < 0.9 else mix(yellow, ochre, rng.random())
                        s.leaf(p + ld * 0.012, ld, rng.uniform(0.04, 0.06), rng.uniform(0.034, 0.046), c, shape="birch")
            if depth > 0 and i > 1 and rng.random() < 0.3:
                sd = Vector((rng.choice((-1, 1)) * rng.uniform(0.5, 0.9), rng.uniform(-0.2, 0.2), -0.5)).normalized()
                twig(p.copy(), sd, length * rng.uniform(0.35, 0.6), depth - 1)
        s.tube(pts, 0.004 if depth > 1 else 0.0025, 0.0012, bark, 3)

    for k in range(5):
        d0 = Vector((rng.uniform(-0.75, 0.75), rng.uniform(-0.2, 0.2), -0.6)).normalized()
        twig(Vector((rng.uniform(-0.03, 0.03), 0, 0)), d0, rng.uniform(0.6, 0.95), 2)
    return s.finish(col)


def shrub_patch(name, seed, col, kind="bilberry", width=0.6):
    """Varpukasvusto: leveä kaistale versoja, tyvi z=0."""
    s = Sprig(name, seed)
    rng = s.rng
    if kind == "bilberry":      # mustikka: kulmikas vihreä varsi, ohuet kirkkaat lehdet, syksyllä punertavia
        n, hmin, hmax = 26, 0.14, 0.30
        stemc = (0.16, 0.26, 0.06)
        leafs = [(0.20, 0.31, 0.08), (0.25, 0.35, 0.09), (0.23, 0.34, 0.08), (0.28, 0.37, 0.10), (0.33, 0.34, 0.09)]
        ll, lw = (0.016, 0.026), 0.6
    elif kind == "lingon":      # puolukka: matala, tumma nahkea lehti, punaisia marjoja
        n, hmin, hmax = 34, 0.06, 0.15
        stemc = (0.12, 0.09, 0.05)
        leafs = [(0.07, 0.17, 0.05), (0.10, 0.22, 0.06), (0.06, 0.14, 0.05)]
        ll, lw = (0.012, 0.02), 0.55
    else:                       # kanerva: pystyt varret, suomumaiset lehdet, lilat kukinnot
        n, hmin, hmax = 30, 0.18, 0.36
        stemc = (0.14, 0.09, 0.06)
        leafs = [(0.14, 0.19, 0.09), (0.17, 0.21, 0.10), (0.20, 0.18, 0.10)]
        ll, lw = (0.010, 0.016), 0.45
    for i in range(n):
        x = rng.uniform(-width / 2, width / 2) * 0.92
        base = Vector((x, rng.uniform(-0.05, 0.05), 0))
        h = rng.uniform(hmin, hmax) * (1 - 0.35 * abs(x) / (width / 2))

        def shoot(start, d, length, depth):
            pts = [start]
            p = start.copy()
            steps = max(3, int(length / 0.022))
            for j in range(steps):
                d = (d + Vector((rng.uniform(-0.18, 0.18), rng.uniform(-0.1, 0.1), 0.06))).normalized()
                p = p + d * (length / steps)
                pts.append(p.copy())
                t = j / steps
                if kind == "heather":
                    for _ in range(6):
                        ld = (d + Vector((rng.uniform(-1, 1), rng.uniform(-0.6, 0.6), rng.uniform(-0.2, 0.6)))).normalized()
                        if t > 0.6 and rng.random() < 0.3:
                            c = mix((0.36, 0.26, 0.30), (0.50, 0.36, 0.40), rng.random())
                            s.leaf(p, ld, rng.uniform(0.010, 0.015), 0.010, c)
                        else:
                            s.leaf(p, ld, rng.uniform(*ll), rng.uniform(*ll) * lw, rng.choice(leafs))
                elif j > 0:
                    for sgn in (-1, 1):
                        if rng.random() < 0.9:
                            ld = (d * 0.5 + Vector((sgn * rng.uniform(0.5, 1), rng.uniform(-0.5, 0.5), rng.uniform(0, 0.5)))).normalized()
                            L = rng.uniform(*ll)
                            s.leaf(p, ld, L, L * lw, rng.choice(leafs))
                    if kind == "lingon" and t > 0.6 and rng.random() < 0.12:
                        s.berry(p + Vector((rng.uniform(-0.01, 0.01), -0.008, -0.004)), 0.0045, (0.55, 0.03, 0.03))
                    if kind == "bilberry" and rng.random() < 0.04:
                        s.berry(p + Vector((rng.uniform(-0.01, 0.01), -0.008, -0.006)), 0.004, (0.05, 0.06, 0.16))
                if depth > 0 and j > 1 and rng.random() < 0.35:
                    sd = (d + Vector((rng.choice((-1, 1)) * rng.uniform(0.5, 1.0), rng.uniform(-0.3, 0.3), 0.2))).normalized()
                    shoot(p.copy(), sd, length * rng.uniform(0.4, 0.7), depth - 1)
            s.tube(pts, 0.0022, 0.0009, stemc, 3)

        shoot(base, Vector((rng.uniform(-0.25, 0.25), 0, 1)).normalized(), h, 2 if kind != "lingon" else 1)
    return s.finish(col)
