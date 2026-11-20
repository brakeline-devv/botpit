"""Botpit logo in 3D: the flat 'bot head' mark as a glossy white vinyl head with a dark glass screen, glowing lavender
eyes + smile and an antenna with a glowing tip. Transparent PNG, square, for the X pfp and the OG image.

  D:/blender.exe -b -P logo.py -- <out.png> [size]
"""
import bpy, math, sys, os
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
SIZE = int(argv[1]) if len(argv) > 1 else 1200

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
sc.cycles.samples = int(os.environ.get("SAMPLES", "160"))
sc.cycles.use_denoising = True
sc.render.film_transparent = True
sc.view_settings.view_transform = "Standard"
sc.render.resolution_x = sc.render.resolution_y = SIZE
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.015, 0.015, 0.035, 1)

def lin(h):
    c = lambda v: (v / 255) / 12.92 if v / 255 <= 0.04045 else (((v / 255) + 0.055) / 1.055) ** 2.4
    return (c(int(h[1:3], 16)), c(int(h[3:5], 16)), c(int(h[5:7], 16)), 1)

def mat(name, hexc, rough=0.3, coat=1.0, emit=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = lin(hexc); b.inputs["Roughness"].default_value = rough
    b.inputs["Coat Weight"].default_value = coat; b.inputs["Coat Roughness"].default_value = 0.05
    if emit:
        b.inputs["Emission Color"].default_value = lin(hexc); b.inputs["Emission Strength"].default_value = emit
    return m

WHITE = mat("white", "#eef0f8", rough=0.25)
GLASS = mat("glass", "#04050a", rough=0.06)
LAV = mat("lav", "#b8b3ff", rough=0.2, coat=0.0, emit=9.0)
DARK = mat("dark", "#23262e", rough=0.35)

def done(o, m):
    o.data.materials.append(m)
    for p in o.data.polygons: p.use_smooth = True
    return o

def rbox(m, size, loc, bevel, seg=8):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object; o.scale = size; bpy.ops.object.transform_apply(scale=True)
    b = o.modifiers.new("bv", "BEVEL"); b.width = bevel; b.segments = seg; b.limit_method = "NONE"
    return done(o, m)

# flat mark (64 units): head 52x42 rx14, screen 38x28 rx8, eyes 6x9 rx3, antenna stick + ball. Scale 1 unit = 0.03.
U = 0.03
rbox(WHITE, (52 * U, 30 * U, 42 * U), (0, 0, 0), 13 * U)
rbox(GLASS, (38 * U, 4 * U, 28 * U), (0, -15 * U, 0), 7 * U, seg=6)
for x in (-9, 9):
    rbox(LAV, (5 * U, 2 * U, 9.5 * U), (x * U, -17.2 * U, 1.8 * U), 2.45 * U, seg=6)
# smile: a short torus arc
bpy.ops.mesh.primitive_torus_add(major_radius=6.5 * U, minor_radius=1.15 * U, location=(0, -17.2 * U, 2.5 * U), major_segments=64, minor_segments=12)
s = bpy.context.object; s.rotation_euler = (math.pi / 2, 0, 0); bpy.ops.object.transform_apply(rotation=True)
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.bisect(plane_co=(0, 0, -3.6 * U), plane_no=(0, 0, 1), clear_outer=True)
bpy.ops.object.mode_set(mode="OBJECT")
done(s, LAV)
# antenna
bpy.ops.mesh.primitive_cylinder_add(radius=2 * U, depth=10 * U, location=(0, 0, 25 * U), vertices=32); done(bpy.context.object, WHITE)
bpy.ops.mesh.primitive_uv_sphere_add(radius=4.6 * U, location=(0, 0, 31 * U), segments=48, ring_count=24); done(bpy.context.object, LAV)
# side bolts
for x in (-1, 1):
    bpy.ops.mesh.primitive_cylinder_add(radius=4.5 * U, depth=3 * U, location=(x * 27 * U, 0, 0), rotation=(0, math.pi / 2, 0), vertices=48)
    done(bpy.context.object, DARK)

def area(name, loc, size, energy, color, target=(0, 0, 0.1)):
    d = bpy.data.lights.new(name, "AREA"); d.size = size; d.energy = energy; d.color = color
    o = bpy.data.objects.new(name, d); sc.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
area("key", (-2.4, -3.8, 3.0), 2.5, 160, (1, 0.97, 0.95))
area("fill", (2.8, -3.2, 1.0), 3.5, 60, (0.75, 0.8, 1.0))
area("rimL", (-3.2, 2.4, 1.6), 2.0, 300, (0.2, 0.6, 1.0))
area("rimR", (3.2, 2.4, 1.4), 2.0, 300, (0.55, 0.25, 1.0))
area("top", (0, 0.5, 4.5), 2.5, 90, (0.85, 0.85, 1.0))

cd = bpy.data.cameras.new("cam"); cam = bpy.data.objects.new("cam", cd); sc.collection.objects.link(cam); sc.camera = cam
cd.lens = 85
cam.location = (0.55, -6.4, 0.75)
cam.rotation_euler = (Vector((0, 0, 0.12)) - cam.location).to_track_quat("-Z", "Y").to_euler()

sc.use_nodes = True
ct = sc.node_tree; ct.nodes.clear()
rl = ct.nodes.new("CompositorNodeRLayers")
gl = ct.nodes.new("CompositorNodeGlare"); gl.glare_type = "FOG_GLOW"; gl.quality = "HIGH"; gl.threshold = 1.2; gl.size = 7
comp = ct.nodes.new("CompositorNodeComposite"); comp.use_alpha = True
ct.links.new(rl.outputs["Image"], gl.inputs["Image"]); ct.links.new(gl.outputs["Image"], comp.inputs["Image"]); ct.links.new(rl.outputs["Alpha"], comp.inputs["Alpha"])
sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"
sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
