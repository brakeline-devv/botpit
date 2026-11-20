"""Botpit contestants as glossy vinyl-toy robots (TV-head + shoulders), rendered in Cycles on a transparent background.
Each robot's face is a glowing texture on a dark glass screen (blender/faces/<id>-<mood>.png, made by faces.cjs), so every
mood is its own render and the site swaps images when an agent's mood changes. The monkey has no screen: it is the no-AI one.

  D:/blender.exe -b -P bots.py -- preview <id> <mood> <out.png>
  D:/blender.exe -b -P bots.py -- all <out_dir>            # 6 agents x 6 moods, <id>-<mood>.png
  D:/blender.exe -b -P bots.py -- lineup <out.png>         # all six side by side
"""
import bpy, math, sys, os
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
MODE = argv[0]
HERE = os.path.dirname(os.path.abspath(__file__))
FACES = os.path.join(HERE, "faces")
AG = {"rocket": "#ff5a36", "boomer": "#5b8def", "sigma": "#2fd4a3", "doomer": "#a07cff", "hype": "#ffc531", "monkey": "#a8764b"}
MOODS = ["euphoric", "confident", "calm", "nervous", "salty", "smug"]

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "CYCLES"
prefs = bpy.context.preferences.addons["cycles"].preferences
for dev in ("OPTIX", "CUDA"):
    try:
        prefs.compute_device_type = dev; prefs.get_devices()
        for d in prefs.devices: d.use = True
        sc.cycles.device = "GPU"; break
    except TypeError:
        continue
sc.cycles.samples = int(os.environ.get("SAMPLES", "96"))
sc.cycles.use_denoising = True
try: sc.cycles.denoiser = "OPTIX"
except TypeError: pass
sc.render.film_transparent = True
sc.view_settings.view_transform = "Standard"
sc.view_settings.look = "None"
world = bpy.data.worlds.new("w"); sc.world = world; world.use_nodes = True
bg = world.node_tree.nodes["Background"]; bg.inputs[0].default_value = (0.012, 0.012, 0.03, 1); bg.inputs[1].default_value = 1.0

def lin(hexc, k=1.0):
    def c(v):
        v /= 255; return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (c(int(hexc[1:3], 16)) * k, c(int(hexc[3:5], 16)) * k, c(int(hexc[5:7], 16)) * k, 1)

# ---------------- materials ----------------
def vinyl(name, hexc, rough=0.32, coat=1.0, k=1.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = lin(hexc, k)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Coat Roughness"].default_value = 0.06
    return m

def emissive(name, hexc, strength):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = lin(hexc)
    b.inputs["Emission Color"].default_value = lin(hexc)
    b.inputs["Emission Strength"].default_value = strength
    return m

def face_mat(path, glow):
    """Image on a plane: glowing (robots) or printed ink (monkey); transparent where the image is empty."""
    m = bpy.data.materials.new("face"); m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; L = nt.links; N.clear()
    out = N.new("ShaderNodeOutputMaterial")
    tex = N.new("ShaderNodeTexImage"); tex.image = bpy.data.images.load(path); tex.extension = "CLIP"
    mixs = N.new("ShaderNodeMixShader"); tr = N.new("ShaderNodeBsdfTransparent")
    if glow:
        sh = N.new("ShaderNodeEmission"); sh.inputs["Strength"].default_value = 5.5
        L.new(tex.outputs["Color"], sh.inputs["Color"])
    else:
        sh = N.new("ShaderNodeBsdfPrincipled"); sh.inputs["Roughness"].default_value = 0.35
        L.new(tex.outputs["Color"], sh.inputs["Base Color"])
    L.new(tex.outputs["Alpha"], mixs.inputs[0]); L.new(tr.outputs[0], mixs.inputs[1]); L.new(sh.outputs[0], mixs.inputs[2])
    L.new(mixs.outputs[0], out.inputs[0])
    return m

# ---------------- geometry helpers ----------------
def obj_done(o, parent, mat, smooth=True):
    if mat: o.data.materials.append(mat)
    if smooth:
        for p in o.data.polygons: p.use_smooth = True
    o.parent = parent
    return o

def rbox(parent, mat, size, loc, bevel, seg=6, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object; o.scale = size; bpy.ops.object.transform_apply(scale=True)
    b = o.modifiers.new("bv", "BEVEL"); b.width = bevel; b.segments = seg; b.limit_method = "NONE"
    return obj_done(o, parent, mat)

def cyl(parent, mat, r, depth, loc, rot=(0, 0, 0), verts=48, bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, rotation=rot, vertices=verts)
    o = bpy.context.object
    if bevel:
        b = o.modifiers.new("bv", "BEVEL"); b.width = bevel; b.segments = 4; b.limit_method = "ANGLE"
    obj_done(o, parent, mat)
    return o

def sphere(parent, mat, r, loc, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=48, ring_count=24)
    o = bpy.context.object; o.scale = scale; bpy.ops.object.transform_apply(scale=True)
    return obj_done(o, parent, mat)

def cone(parent, mat, r, depth, loc, rot):
    bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=0.012, depth=depth, location=loc, rotation=rot, vertices=32)
    return obj_done(o := bpy.context.object, parent, mat)

def torus(parent, mat, R, r, loc, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, location=loc, rotation=rot, major_segments=64, minor_segments=16)
    return obj_done(bpy.context.object, parent, mat)

def plane(parent, mat, w, h, loc):
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=(math.pi / 2, 0, 0))
    o = bpy.context.object; o.scale = (w, h, 1); bpy.ops.object.transform_apply(scale=True)
    return obj_done(o, parent, mat, smooth=False)

DARK = vinyl("dark", "#23262e", rough=0.4)
GLASS = vinyl("glass", "#05060a", rough=0.08)

# Head: 1.30 wide, 1.02 deep, 1.08 tall, centred at z = 1.55. Screen on the front (-y) face.
HW, HD, HH, HZ = 1.30, 1.02, 1.08, 1.55
SW, SH = 0.92, 0.70
FRONT = -HD / 2

def eye_xy(px, py):
    """face SVG coords (viewBox 0 12 100 76) -> world (x, z) on the screen"""
    return ((px - 50) / 100 * SW, HZ - (py - 50) / 76 * SH)

def make_bot(id_, mood, loc=(0, 0, 0), rotz=0.0):
    root = bpy.data.objects.new(f"bot_{id_}", None); sc.collection.objects.link(root)
    col = AG[id_]
    body = vinyl(f"body_{id_}", col, rough=0.3)
    torso_m = vinyl(f"torso_{id_}", col, rough=0.36, k=0.42)
    # torso + neck
    rbox(root, torso_m, (1.16, 0.76, 0.6), (0, 0.04, 0.44), 0.26)
    cyl(root, DARK, 0.15, 0.32, (0, 0.02, 0.86))
    sph = emissive(f"badge_{id_}", col, 3.0)
    cyl(root, sph, 0.075, 0.03, (0.26, -0.33, 0.52), rot=(math.pi / 2, 0, 0))
    # head + screen
    rbox(root, body, (HW, HD, HH), (0, 0, HZ), 0.26, seg=8)
    if id_ == "monkey":
        tan = vinyl("tan", "#d9a77a", rough=0.38)
        rbox(root, tan, (SW, 0.07, SH + 0.04), (0, FRONT - 0.005, HZ - 0.02), 0.2, seg=6)
        plane(root, face_mat(os.path.join(FACES, f"{id_}-{mood}.png"), False), SW, SH, (0, FRONT - 0.045, HZ))
    else:
        rbox(root, GLASS, (SW, 0.07, SH), (0, FRONT - 0.005, HZ), 0.16, seg=6)
        plane(root, face_mat(os.path.join(FACES, f"{id_}-{mood}.png"), True), SW * 0.98, SH * 0.98, (0, FRONT - 0.042, HZ))
    # side bolts (robots) / ears (monkey)
    if id_ != "monkey":
        for s in (-1, 1):
            cyl(root, DARK, 0.11, 0.08, (s * (HW / 2 + 0.02), 0, HZ), rot=(0, math.pi / 2, 0))
    gear(id_, root, col)
    root.location = loc; root.rotation_euler = (0, 0, rotz)
    return root

def gear(id_, root, col):
    top = HZ + HH / 2
    if id_ == "rocket":
        y = vinyl("mohawk", "#ffb21f", rough=0.3)
        for i, x in enumerate((-0.40, -0.2, 0.0, 0.2, 0.40)):
            h = (0.34, 0.48, 0.6, 0.48, 0.34)[i]
            cone(root, y, 0.13, h, (x, 0.02, top + h / 2 - 0.06), (math.radians(-10), math.radians(x * 40), 0))
        shade = vinyl("shades", "#07080b", rough=0.05)
        ex, ez = eye_xy(38, 49)
        for s in (-1, 1):
            rbox(root, shade, (0.33, 0.06, 0.2), (s * 0.18, FRONT - 0.1, ez + 0.01), 0.07, seg=5)
        rbox(root, shade, (0.08, 0.04, 0.035), (0, FRONT - 0.1, ez + 0.06), 0.012, seg=2)
        for s in (-1, 1):
            rbox(root, shade, (0.035, 0.5, 0.035), (s * 0.34, FRONT + 0.12, ez + 0.06), 0.012, seg=2)
    elif id_ == "boomer":
        cap = vinyl("cap", "#2f3d55", rough=0.6, coat=0.2)
        sphere(root, cap, 0.62, (0, 0.04, top - 0.12), scale=(1.12, 0.9, 0.42))
        rbox(root, cap, (0.9, 0.42, 0.05), (0, FRONT - 0.12, top - 0.05), 0.15, seg=6, rot=(math.radians(8), 0, 0))
        rim = vinyl("rim", "#c9a24a", rough=0.2)
        for px in (38, 62):
            ex, ez = eye_xy(px, 50)
            torus(root, rim, 0.085, 0.012, (ex, FRONT - 0.075, ez), rot=(math.pi / 2, 0, 0))
        rbox(root, rim, (0.05, 0.015, 0.015), (0, FRONT - 0.075, eye_xy(50, 50)[1]), 0.005, seg=2)
    elif id_ == "sigma":
        frame = vinyl("frame", "#0b0d10", rough=0.15)
        for px in (38, 62):
            ex, ez = eye_xy(px, 49.5)
            bpy.ops.mesh.primitive_cube_add(size=1, location=(ex, FRONT - 0.075, ez))
            o = bpy.context.object; o.scale = (0.19, 0.02, 0.12); bpy.ops.object.transform_apply(scale=True)
            w = o.modifiers.new("wf", "WIREFRAME"); w.thickness = 0.018
            obj_done(o, root, frame, smooth=False)
        rbox(root, frame, (0.05, 0.015, 0.015), (0, FRONT - 0.075, eye_xy(50, 49.5)[1]), 0.005, seg=2)
        cyl(root, DARK, 0.025, 0.42, (0.36, 0.08, top + 0.19))
        sphere(root, emissive("tip", col, 8.0), 0.065, (0.36, 0.08, top + 0.42))
    elif id_ == "doomer":
        hood = vinyl("hood", "#3a2d5c", rough=0.8, coat=0.0)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=(0, 0.1, HZ + 0.06), segments=64, ring_count=32)
        o = bpy.context.object; o.scale = (0.88, 0.76, 0.84); bpy.ops.object.transform_apply(scale=True)
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.95, HZ - 0.04))
        cutter = bpy.context.object; cutter.scale = (1.0, 1.0, 0.8); cutter.display_type = "WIRE"; cutter.hide_render = True
        bo = o.modifiers.new("cut", "BOOLEAN"); bo.object = cutter; bo.operation = "DIFFERENCE"
        so = o.modifiers.new("sol", "SOLIDIFY"); so.thickness = 0.06
        bv = o.modifiers.new("bv", "BEVEL"); bv.width = 0.02; bv.segments = 3; bv.limit_method = "ANGLE"
        obj_done(o, root, hood)
        cutter.parent = root
        # drape over the shoulders
        rbox(root, hood, (1.2, 0.82, 0.3), (0, 0.06, 0.72), 0.15)
    elif id_ == "hype":
        hp = vinyl("phones", "#2b2f37", rough=0.35)
        accent = vinyl("phones_acc", col, rough=0.25)
        bpy.ops.mesh.primitive_torus_add(major_radius=0.74, minor_radius=0.05, location=(0, 0.02, HZ + 0.08), rotation=(0, 0, 0), major_segments=96, minor_segments=16)
        o = bpy.context.object; o.rotation_euler = (math.pi / 2, 0, 0)
        bpy.ops.object.transform_apply(rotation=True)
        bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.bisect(plane_co=(0, 0, HZ + 0.02), plane_no=(0, 0, 1), clear_inner=True)
        bpy.ops.object.mode_set(mode="OBJECT")
        o.scale = (1.0, 1.0, 1.0); obj_done(o, root, hp)
        for s in (-1, 1):
            cyl(root, hp, 0.24, 0.16, (s * 0.72, 0.0, HZ - 0.02), rot=(0, math.pi / 2, 0), bevel=0.04)
            cyl(root, accent, 0.17, 0.03, (s * 0.81, 0.0, HZ - 0.02), rot=(0, math.pi / 2, 0))
        # mic boom
        cyl(root, hp, 0.022, 0.5, (0.62, -0.42, HZ - 0.34), rot=(math.radians(90), 0, math.radians(-50)))
        sphere(root, hp, 0.05, (0.44, -0.6, HZ - 0.34))
    elif id_ == "monkey":
        fur = vinyl("ear", AG["monkey"], rough=0.35)
        inner = vinyl("ear_in", "#d9a77a", rough=0.4)
        for s in (-1, 1):
            cyl(root, fur, 0.27, 0.11, (s * (HW / 2 + 0.1), 0.05, HZ + 0.06), rot=(0, math.pi / 2, 0), bevel=0.04)
            cyl(root, inner, 0.17, 0.03, (s * (HW / 2 + 0.165), 0.05, HZ + 0.06), rot=(0, math.pi / 2, 0))
        # a tuft on top
        sphere(root, fur, 0.16, (0, 0.05, top - 0.02), scale=(1.4, 1.0, 0.6))

# ---------------- lights + camera ----------------
def area(name, loc, size, energy, color, target=(0, 0, 1.3)):
    d = bpy.data.lights.new(name, "AREA"); d.size = size; d.energy = energy; d.color = color
    o = bpy.data.objects.new(name, d); sc.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler(); return o

def lights(scale=1.0):
    area("key", (-2.6 * scale, -4.2 * scale, 3.6), 3.0 * scale, 260 * scale ** 2, (1.0, 0.97, 0.95))
    area("fill", (3.2 * scale, -3.6 * scale, 1.8), 4.0 * scale, 90 * scale ** 2, (0.75, 0.8, 1.0))
    area("rimL", (-3.6 * scale, 2.6, 2.4), 2.0, 420 * scale, (0.2, 0.6, 1.0))
    area("rimR", (3.6 * scale, 2.6, 2.2), 2.0, 380 * scale, (0.55, 0.25, 1.0))
    area("top", (0, 0.6, 5.5), 3.0 * scale, 160 * scale, (0.8, 0.82, 1.0))

def camera(loc, look, lens):
    cd = bpy.data.cameras.new("cam"); cam = bpy.data.objects.new("cam", cd); sc.collection.objects.link(cam); sc.camera = cam
    cd.lens = lens
    cam.location = loc
    cam.rotation_euler = (Vector(look) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return cam

# light bloom on the faces
sc.use_nodes = True
ct = sc.node_tree; ct.nodes.clear()
rl = ct.nodes.new("CompositorNodeRLayers")
gl = ct.nodes.new("CompositorNodeGlare"); gl.glare_type = "FOG_GLOW"; gl.quality = "HIGH"; gl.threshold = 1.2; gl.size = 6
try: gl.mix = -0.3
except AttributeError: pass
comp = ct.nodes.new("CompositorNodeComposite"); comp.use_alpha = True
ct.links.new(rl.outputs["Image"], gl.inputs["Image"]); ct.links.new(gl.outputs["Image"], comp.inputs["Image"])
ct.links.new(rl.outputs["Alpha"], comp.inputs["Alpha"])

sc.render.image_settings.file_format = "PNG"
sc.render.image_settings.color_mode = "RGBA"

def portrait_setup():
    sc.render.resolution_x = sc.render.resolution_y = int(os.environ.get("RES", "640"))
    lights()
    camera((0.9, -5.8, 2.15), (0, 0, 1.3), 68)

def clear_bots():
    for o in list(bpy.data.objects):
        if o.name.startswith("bot_") or (o.parent and o.parent.name.startswith("bot_")) or o.type == "MESH":
            bpy.data.objects.remove(o, do_unlink=True)

if MODE == "preview":
    portrait_setup()
    make_bot(argv[1], argv[2], rotz=math.radians(17))
    sc.render.filepath = argv[3]
    bpy.ops.render.render(write_still=True)
elif MODE == "all":
    portrait_setup()
    only = os.environ.get("ONLY", "").split(",") if os.environ.get("ONLY") else list(AG)
    for id_ in only:
        for mood in MOODS:
            clear_bots()
            make_bot(id_, mood, rotz=math.radians(17))
            sc.render.filepath = os.path.join(argv[1], f"{id_}-{mood}.png")
            bpy.ops.render.render(write_still=True)
elif MODE == "lineup":
    sc.render.resolution_x, sc.render.resolution_y = 3000, 1230
    lights(2.2)
    order = [("hype", "euphoric"), ("sigma", "smug"), ("rocket", "confident"), ("doomer", "salty"), ("boomer", "calm"), ("monkey", "confident")]
    xs = [-5.0, -3.0, -1.0, 1.0, 3.0, 5.0]
    for (id_, mood), x in zip(order, xs):
        make_bot(id_, mood, loc=(x, abs(x) * 0.18, 0), rotz=math.radians(-x * 4.5))
    camera((0, -17.5, 2.3), (0, 0, 1.2), 50)
    sc.render.filepath = argv[1]
    bpy.ops.render.render(write_still=True)
