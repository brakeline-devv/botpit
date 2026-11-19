"""Arena hero: glass slabs + small cubes flowing through 8 formations on a 10 s loop (crown -> fan -> columns ->
cross -> arc -> core -> wide V -> gate -> crown), rendered in Cycles with bevelled edges, a gradient glass shader,
light pouring from below and fog-glow bloom. Rendered on black for the site hero.

  D:/blender.exe -b -P hero.py -- preview <t_seconds> <out.png> [wide|tall]
  D:/blender.exe -b -P hero.py -- render <out_dir/f_> [wide|tall]
"""
import bpy, math, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
MODE = argv[0]
FMT = argv[3] if MODE == "preview" and len(argv) > 3 else (argv[2] if MODE == "render" and len(argv) > 2 else "wide")
FPS, LOOP = 60, 10.0
NF = int(FPS * LOOP)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.frame_start, sc.frame_end, sc.render.fps = 0, NF - 1, FPS

# ---------------- render settings ----------------
sc.render.engine = "CYCLES"
prefs = bpy.context.preferences.addons["cycles"].preferences
for dev in ("OPTIX", "CUDA"):
    try:
        prefs.compute_device_type = dev
        prefs.get_devices()
        for d in prefs.devices: d.use = True
        sc.cycles.device = "GPU"
        break
    except TypeError:
        continue
sc.cycles.samples = 40 if MODE == "render" else 32
sc.render.use_motion_blur = True
sc.render.motion_blur_shutter = 0.5
sc.cycles.use_denoising = True
try: sc.cycles.denoiser = "OPTIX"
except TypeError: pass
sc.cycles.max_bounces = 6
sc.cycles.transmission_bounces = 6
if FMT == "wide": sc.render.resolution_x, sc.render.resolution_y = 1600, 900
else: sc.render.resolution_x, sc.render.resolution_y = 720, 1280
sc.render.resolution_percentage = 100
sc.view_settings.view_transform = "Standard"
sc.view_settings.look = "None"
sc.view_settings.exposure = 0.0
world = bpy.data.worlds.new("w"); sc.world = world; world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0, 0, 0, 1)

# ---------------- materials ----------------
def slab_material():
    m = bpy.data.materials.new("slab"); m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; L = nt.links; N.clear()
    out = N.new("ShaderNodeOutputMaterial")
    bsdf = N.new("ShaderNodeBsdfPrincipled")
    tc = N.new("ShaderNodeTexCoord")
    sep = N.new("ShaderNodeSeparateXYZ")
    ramp = N.new("ShaderNodeValToRGB")          # body colour: deep violet at the foot -> periwinkle at the top
    r = ramp.color_ramp
    r.elements[0].position, r.elements[0].color = 0.0, (0.012, 0.01, 0.05, 1)
    r.elements[1].position, r.elements[1].color = 1.0, (0.10, 0.12, 0.40, 1)
    eramp = N.new("ShaderNodeValToRGB")         # glow colour: white at the top -> lavender at the foot
    e = eramp.color_ramp
    e.elements[0].position, e.elements[0].color = 0.0, (0.10, 0.08, 0.42, 1)
    e.elements[1].position, e.elements[1].color = 1.0, (0.70, 0.78, 1.0, 1)
    gl = N.new("ShaderNodeAttribute"); gl.attribute_type = "OBJECT"; gl.attribute_name = "glow"
    op = N.new("ShaderNodeAttribute"); op.attribute_type = "OBJECT"; op.attribute_name = "op"
    mul = N.new("ShaderNodeMath"); mul.operation = "MULTIPLY"; mul.inputs[1].default_value = float(__import__("os").environ.get("GLOWMUL", "0.5"))
    L.new(tc.outputs["Generated"], sep.inputs[0])
    L.new(sep.outputs["Z"], ramp.inputs[0]); L.new(sep.outputs["Z"], eramp.inputs[0])
    L.new(ramp.outputs[0], bsdf.inputs["Base Color"])
    L.new(eramp.outputs[0], bsdf.inputs["Emission Color"])
    L.new(gl.outputs["Fac"], mul.inputs[0]); L.new(mul.outputs[0], bsdf.inputs["Emission Strength"])
    L.new(op.outputs["Fac"], bsdf.inputs["Alpha"])
    bsdf.inputs["Roughness"].default_value = 0.12
    bsdf.inputs["Coat Weight"].default_value = 1.0
    bsdf.inputs["Coat Roughness"].default_value = 0.08
    bsdf.inputs["Transmission Weight"].default_value = 0.0
    bsdf.inputs["IOR"].default_value = 1.45
    bsdf.inputs["Specular IOR Level"].default_value = 0.6
    L.new(bsdf.outputs[0], out.inputs[0])
    return m

def cube_material():
    m = bpy.data.materials.new("cube"); m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; L = nt.links
    bsdf = N["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.42, 0.50, 0.95, 1)
    bsdf.inputs["Roughness"].default_value = 0.2
    bsdf.inputs["Coat Weight"].default_value = 0.5
    bsdf.inputs["Emission Color"].default_value = (0.80, 0.88, 1.0, 1)
    gl = N.new("ShaderNodeAttribute"); gl.attribute_type = "OBJECT"; gl.attribute_name = "glow"
    mul = N.new("ShaderNodeMath"); mul.operation = "MULTIPLY"; mul.inputs[1].default_value = 1.1
    L.new(gl.outputs["Fac"], mul.inputs[0]); L.new(mul.outputs[0], bsdf.inputs["Emission Strength"])
    return m

SLAB_M, CUBE_M = slab_material(), cube_material()

def make_box(name, sx, sy, sz, mat, bevel):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.object; o.name = name
    o.scale = (sx, sy, sz); bpy.ops.object.transform_apply(scale=True)
    b = o.modifiers.new("bevel", "BEVEL"); b.width = bevel; b.segments = 3; b.limit_method = "ANGLE"
    o.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    o.rotation_mode = "YZX"   # matches three.js XYZ intrinsic order after the axis swap below
    o["glow"] = 0.0; o["op"] = 1.0
    return o

SLABS = [make_box(f"slab{s}", 0.78, 0.24, 4.8, SLAB_M, 0.035) for s in range(-5, 6)]
CUBES = [make_box(f"cube{c}", 0.5, 0.5, 0.5, CUBE_M, 0.03) for c in range(-2, 3)]

# ---------------- lights + camera ----------------
def area(name, loc, size, energy, color, target=(0, 0, 0)):
    d = bpy.data.lights.new(name, "AREA"); d.size = size; d.energy = energy; d.color = color
    o = bpy.data.objects.new(name, d); sc.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler(); return o
area("under", (0, 1.2, -4.8), 2.0, 260, (0.70, 0.76, 1.0), (0, 0.5, 2))      # light pouring up from below the formation
area("back", (0, 5.0, 0.0), 3.0, 180, (0.45, 0.42, 1.0), (0, 0, 0))         # halo behind
area("key", (0, -10, 6), 7, 25, (0.55, 0.60, 1.0), (0, 0, 0))              # soft top-front fill
area("rimL", (-8, -4, 2.5), 3.5, 520, (0.16, 0.52, 1.0), (0, 0, 0))         # cyan from the left
area("rimR", (8, -4, 2.0), 3.5, 430, (0.45, 0.18, 1.0), (0, 0, 0))          # violet from the right

cam_d = bpy.data.cameras.new("cam"); cam = bpy.data.objects.new("cam", cam_d); sc.collection.objects.link(cam); sc.camera = cam
cam_d.sensor_fit = "VERTICAL"; cam_d.angle = math.radians(32)
if FMT == "wide": cam.location, look_z = (0, -14.2, 0.2), 0.3
else: cam.location, look_z = (0, -29, 0.8), 2.2

# ---------------- formations (same poses as the WebGL version, three.js axes: x right, y up, z to camera) ----------------
sgn = lambda x: (x > 0) - (x < 0)
def crown_s(s):
    a = abs(s); return dict(x=s * 0.62, y=-1.6 + (-0.8 if a > 3 else 0), z=-a * 0.35, rx=0, ry=-s * 0.08, rz=-sgn(s) * min(a, 3) * 0.12, h=1 - a * 0.05, g=3.2 if a == 0 else 1.6 if a == 1 else 0.5 if a == 2 else 0.12)
def crown_c(c): return dict(x=c * 1.15, y=-3.3 + abs(c) * 0.2, z=1, r=0.6 + c, g=0 if c == 0 else 0.6, k=0.01 if c == 0 else 0.9)
def fan_s(s):
    th = s * 0.23; R = 2.2 if s == 0 else 3.6
    return dict(x=math.sin(th) * R, y=-6.2 + math.cos(th) * R, z=-abs(s) * 0.2, rx=0, ry=0, rz=-th, h=0.55 if s == 0 else 1, g=1.5 if abs(s) >= 4 else 0.9 if s == 0 else 0.25)
def fan_c(c): return dict(x=c * 1.5, y=-2.4 - abs(c) * 0.3, z=0.6, r=0.8 + c * 0.5, g=1.4 if abs(c) == 1 else 0.3, k=0.5 if c == 0 else 0.85)
def col_s(s): return dict(x=s * 1.02, y=-0.9 + (abs(s) % 2) * 0.35, z=-math.cos(s * 0.25) * 0.5, rx=0, ry=-s * 0.12, rz=0, h=0.86, g=1.4 if abs(s) == 5 else 0.9 if abs(s) == 3 else 0.2)
def col_c(c): return dict(x=c * 1.6, y=-3.4, z=1.2, r=0.3 + c * 0.2, g=1.6 if c == 0 else 0.9, k=0.95)
def cross_s(s):
    a = abs(s); return dict(x=s * 0.82, y=-1.3, z=-a * 0.25, rx=0, ry=-s * 0.1, rz=sgn(s) * (0.2 + a * 0.035), h=0.95, g=1.7 if 3 <= a <= 4 else 0.6 if a == 0 else 0.3)
def cross_c(c): return dict(x=c * 2.6, y=-2.6 + abs(c) * 0.35, z=0.8, r=1 + c, g=1.4, k=0.01 if c == 0 else 0.85)
def arc_s(s):
    th = s * 0.29; R = 6.4; a = abs(s)
    return dict(x=math.sin(th) * R, y=-0.9 - (3 if a == 5 else 0), z=-(1 - math.cos(th)) * R, rx=0, ry=-th * 0.9, rz=0, h=1.12 if a == 0 else 1.02 - a * 0.015, g=2.2 if a == 0 else 1.1 if a >= 4 else 0.35, o=0 if a == 5 else 1)
def arc_c(c): return dict(x=c * 2.4, y=-4.6, z=0.5, r=c, g=0.2, k=0.01)
def core_s(s):
    a = abs(s); return dict(x=s * (0.95 if a <= 1 else 1.55), y=-1.0 - (0 if a <= 1 else 0.3), z=-a * 0.45, rx=0, ry=-s * 0.14, rz=-sgn(s) * 0.12 if a > 2 else 0, h=0.08 if a == 0 else 0.92, g=1.2 if a == 5 else 0.15, o=0 if a == 0 else 1)
def core_c(c): return dict(x=0 if c == 0 else c * 1.35, y=-1.9 if c == 0 else -1.3 - abs(c) * 0.9, z=1.5 if c == 0 else 0.8, r=0.785 if c == 0 else c * 0.7, g=4 if c == 0 else 0.9, k=1.1 if c == 0 else 0.8)
def wide_s(s):
    a = abs(s)
    if a <= 1: return dict(x=s * 0.95, y=-1.3, z=0, rx=0, ry=-s * 0.15, rz=0, h=0.85, g=0 if a == 0 else 0.35, o=0 if a == 0 else 1)
    return dict(x=sgn(s) * (1.9 + a * 0.6), y=-1.2 + a * 0.15, z=-a * 0.3, rx=0, ry=0, rz=-sgn(s) * (0.32 + a * 0.05), h=1, g=1.9 if a == 3 else 0.3)
def wide_c(c): return dict(x=c * 1.0, y=-1.2 if c == 0 else -2.3, z=1.2, r=0.785 + c * 0.3, g=2.6 if c == 0 else 0.8, k=1 if c == 0 else 0.7)
def gate_s(s):
    a = abs(s)
    if a == 1: return dict(x=s * 1.0, y=-1.7, z=0.5, rx=0, ry=0, rz=0, h=0.8, g=3.4)
    return dict(x=sgn(s) * (1.2 + a * 0.55), y=-3.2, z=-0.8 - a * 0.2, rx=-0.3, ry=0, rz=-sgn(s) * (0.5 + a * 0.1), h=0.95, g=0 if a == 0 else 0.25, o=0 if a == 0 else 1)
def gate_c(c): return dict(x=c * 1.3, y=0.1 if c == 0 else -2.9, z=0.7, r=c * 0.9, g=1.3 if c == 0 else 0.5, k=0.9 if c == 0 else 0.75)

P = {"crown": (crown_s, crown_c), "fan": (fan_s, fan_c), "columns": (col_s, col_c), "cross": (cross_s, cross_c),
     "arc": (arc_s, arc_c), "core": (core_s, core_c), "wide": (wide_s, wide_c), "gate": (gate_s, gate_c)}
TL = [(0, "crown"), (1.55, "fan"), (2.9, "columns"), (4.0, "cross"), (5.0, "arc"), (6.5, "core"), (7.9, "wide"), (9.1, "gate"), (10, "crown")]
def B(x, y, z): return Vector((x, -z, y))   # three.js -> Blender axes

# Smooth, never-stopping motion: every property follows a periodic cubic Hermite (Catmull-Rom) spline through the
# 8 formations, so velocity is continuous at each formation instead of easing to a stop and starting again.
KT = [tt for tt, _ in TL[:-1]]                       # key times, period LOOP
KN = [nm for _, nm in TL[:-1]]
SLAB_KEYS = {s: [dict({"o": 1}, **P[n][0](s)) for n in KN] for s in range(-5, 6)}
CUBE_KEYS = {c: [P[n][1](c) for n in KN] for c in range(-2, 3)}
TENSION = 0.9                                        # <1 = slightly softer arrival at each formation

def spline(keys, field, t):
    n = len(KT); t %= LOOP
    i = max(j for j in range(n) if KT[j] <= t)
    T = lambda j: KT[j % n] + LOOP * (j // n)        # unwrapped key time
    V = lambda j: keys[j % n][field]
    t0, t1, t2, t3 = T(i - 1), T(i), T(i + 1), T(i + 2)
    p0, p1, p2, p3 = V(i - 1), V(i), V(i + 1), V(i + 2)
    d = t2 - t1; u = (t - t1) / d
    m1 = TENSION * (p2 - p0) / (t2 - t0) * d
    m2 = TENSION * (p3 - p1) / (t3 - t1) * d
    u2, u3 = u * u, u * u * u
    return (2 * u3 - 3 * u2 + 1) * p1 + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2 + (u3 - u2) * m2

def apply(t):
    W = math.tau / LOOP
    for i, o in enumerate(SLABS):
        s = i - 5; K = SLAB_KEYS[s]; f = lambda k: spline(K, k, t)
        wob = math.sin(t * W * 2 + s) * 0.03     # periodic over the loop
        o.location = B(f("x"), f("y") + wob, f("z"))
        o.rotation_euler = (f("rx"), -(f("rz") + wob * 0.3), f("ry"))
        op = float(min(1.0, max(0.0, f("o"))))   # float: an int here turns the keyed property into a 0/1 step
        h = max(0.02, f("h"))
        fade = op * op * (3 - 2 * op)            # smoothstep: fade + shrink together, no pop
        o.scale = (max(0.001, fade), max(0.001, fade), h * (0.6 + 0.4 * fade))
        o["glow"] = float(max(0.0, f("g"))); o["op"] = op
    for i, o in enumerate(CUBES):
        c = i - 2; K = CUBE_KEYS[c]; f = lambda k: spline(K, k, t)
        o.location = B(f("x"), f("y") + math.sin(t * W * 3 + c) * 0.06, f("z"))
        base, spin = f("r"), t * W               # whole turns per loop on every axis, so the loop closes exactly
        o.rotation_euler = (base * 0.6 + spin, -base * 0.3 - spin, base + spin)
        o.scale = [max(0.001, f("k"))] * 3
        o["glow"] = float(max(0.0, f("g")))
    sway = math.sin(t / LOOP * math.tau) * 0.35
    cam.location.x = sway
    d = Vector((0, 0, look_z)) - cam.location
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()

def key_all(frame):
    for o in SLABS + CUBES:
        for p in ("location", "rotation_euler", "scale", '["glow"]', '["op"]'):
            o.keyframe_insert(p, frame=frame)
    for p in ("location", "rotation_euler"): cam.keyframe_insert(p, frame=frame)

# ---------------- compositor: fog-glow bloom ----------------
sc.use_nodes = True
ct = sc.node_tree; ct.nodes.clear()
rl = ct.nodes.new("CompositorNodeRLayers")
g1 = ct.nodes.new("CompositorNodeGlare"); g1.glare_type = "FOG_GLOW"; g1.quality = "HIGH"; g1.threshold = 1.0; g1.size = 8
try: g1.mix = 0.0
except AttributeError: pass
g2 = ct.nodes.new("CompositorNodeGlare"); g2.glare_type = "BLOOM" if "BLOOM" in [e.identifier for e in g2.bl_rna.properties["glare_type"].enum_items] else "FOG_GLOW"
g2.threshold = 1.6; g2.size = 6
comp = ct.nodes.new("CompositorNodeComposite")
ct.links.new(rl.outputs["Image"], g1.inputs["Image"]); ct.links.new(g1.outputs["Image"], g2.inputs["Image"]); ct.links.new(g2.outputs["Image"], comp.inputs["Image"])

if MODE == "preview":
    apply(float(argv[1]))
    sc.render.filepath = argv[2]
    sc.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)
else:
    for f in range(-3, NF + 3):              # keys past both ends so motion blur at frame 0 / NF-1 matches mid-loop
        apply(f / FPS); key_all(f)
    for o in SLABS + CUBES + [cam]:
        if o.animation_data and o.animation_data.action:
            for fc in o.animation_data.action.fcurves:
                for kp in fc.keyframe_points: kp.interpolation = "LINEAR"
    import os
    if os.environ.get("FRAMES"): sc.frame_start, sc.frame_end = map(int, os.environ["FRAMES"].split("-"))
    if os.environ.get("NOBLUR"): sc.render.use_motion_blur = False
    sc.render.filepath = argv[1]
    sc.render.image_settings.file_format = "JPEG"; sc.render.image_settings.quality = 94
    bpy.ops.render.render(animation=True)
