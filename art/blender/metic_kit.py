"""Metic Blender kit: shared helpers for script-built low-poly models.

See docs/ART_SPEC.md. Conventions:
  * 1 Blender unit = 1 game px. Nose/forward = +Y, top (faces the game camera) = +Z.
  * Every face samples one swatch of a shared N×1 palette texture (via UVs), using
    one of two materials: M_Palette_lit (matte) or M_Palette_glow (emissive).
  * Flat shading everywhere. Static parts are joined; animated parts (`anim_*`)
    and sockets (`socket_*`) stay separate children of the root.
"""
import json
import math
import os

import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PALETTE_PATH = os.path.join(ROOT, "art", "palette", "palette.json")

with open(PALETTE_PATH, encoding="utf-8") as f:
    _pal = json.load(f)
SWATCHES = list(_pal["swatches"].items())
SWATCH_INDEX = {name: i for i, (name, _) in enumerate(SWATCHES)}
GLOW_SWATCHES = set(_pal["glow"])

_materials = {}


# --- scene / materials -------------------------------------------------------
def begin():
    """Reset to an empty scene and (re)build the palette materials."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _materials.clear()
    img = bpy.data.images.new("metic_palette", len(SWATCHES), 1)
    px = []
    for _, hexcol in SWATCHES:
        px += [int(hexcol[i:i + 2], 16) / 255 for i in (1, 3, 5)] + [1.0]
    img.pixels = px
    img.pack()
    for kind in ("lit", "glow"):
        m = bpy.data.materials.new(f"M_Palette_{kind}")
        nt = m.node_tree
        if nt is None:  # Blender < 5: node trees are opt-in
            m.use_nodes = True
            nt = m.node_tree
        bsdf = nt.nodes.get("Principled BSDF") or nt.nodes.new("ShaderNodeBsdfPrincipled")
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = img
        tex.interpolation = "Closest"  # exported as NEAREST: swatches never blend
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        bsdf.inputs["Roughness"].default_value = 0.6
        if kind == "glow":
            nt.links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
            bsdf.inputs["Emission Strength"].default_value = 2.0
        out = nt.nodes.get("Material Output") or nt.nodes.new("ShaderNodeOutputMaterial")
        nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
        _materials[kind] = m


def paint(obj, swatch):
    """Map every face of obj to one palette swatch and flat-shade it."""
    if swatch not in SWATCH_INDEX:
        raise KeyError(f"unknown swatch '{swatch}' (add it to art/palette/palette.json)")
    me = obj.data
    uv = me.uv_layers[0] if me.uv_layers else me.uv_layers.new(name="UVMap")
    u = (SWATCH_INDEX[swatch] + 0.5) / len(SWATCHES)
    for loop_uv in uv.data:
        loop_uv.uv = (u, 0.5)
    me.materials.clear()
    me.materials.append(_materials["glow" if swatch in GLOW_SWATCHES else "lit"])
    for p in me.polygons:
        p.use_smooth = False
    return obj


def _finish(name, bm, swatch, location=(0, 0, 0)):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    obj.location = location
    bpy.context.scene.collection.objects.link(obj)
    return paint(obj, swatch)


def mirror_x(points, side=1):
    """Flip points to the given side (+1 keeps them, -1 mirrors across X)."""
    return [(side * x, y, z) for x, y, z in points]


# --- primitives --------------------------------------------------------------
def hull(name, points, swatch, symmetric=True):
    """Convex hull of points — the workhorse for chunky hard-surface parts.

    symmetric=True mirrors the points across X into ONE shape: only for parts
    centered on the axis (body, canopy). Paired side parts use `pair()` instead,
    otherwise both sides fuse into a single slab spanning the model.
    """
    pts = list(points)
    if symmetric:
        pts += [(-x, y, z) for x, y, z in pts if abs(x) > 1e-6]
    bm = bmesh.new()
    for p in pts:
        bm.verts.new(p)
    res = bmesh.ops.convex_hull(bm, input=bm.verts)
    junk = {v for v in res["geom_interior"] + res["geom_unused"] if isinstance(v, bmesh.types.BMVert)}
    bmesh.ops.delete(bm, geom=list(junk), context="VERTS")
    return _finish(name, bm, swatch)


def pair(build_side):
    """Build a side part twice: build_side(+1) on the right, build_side(-1) on the left.

    build_side receives the side sign and should use `mirror_x(points, side)` or
    multiply x by `side`. Returns [right, left]; names get _R / _L suffixes.
    """
    parts = []
    for side, suffix in ((1, "_R"), (-1, "_L")):
        obj = build_side(side)
        obj.name = obj.name.split(".")[0] + suffix
        parts.append(obj)
    return parts


def tube(name, a, b, r1, r2, swatch, segments=6):
    """Cylinder/cone from point a to b (engines, flames, spikes, horns).

    The object origin sits at `a`, so scaling it (e.g. a flickering flame) grows
    it from its base.
    """
    a, b = Vector(a), Vector(b)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=r1, radius2=r2,
                          depth=(b - a).length)
    rot = Vector((0, 0, 1)).rotation_difference(b - a).to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=rot @ Matrix.Translation((0, 0, (b - a).length / 2)), verts=bm.verts)
    return _finish(name, bm, swatch, location=a)


def blob(name, center, radius, swatch, scale=(1, 1, 1), subdivisions=1):
    """Low-poly icosphere (eyes, bulbs, spots, canopies). Origin at its center."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=radius)
    bmesh.ops.transform(bm, matrix=Matrix.Diagonal((*scale, 1)), verts=bm.verts)
    return _finish(name, bm, swatch, location=center)


def creature(name, nodes, edges, swatch, subdivisions=1, decimate=0.45):
    """Organic body from a stick skeleton: nodes = [((x, y, z), radius), ...].

    Skin modifier -> subdivision -> decimate, then flat-shaded: ~10 points give a
    faceted blob body with limbs/tentacles.
    """
    me = bpy.data.meshes.new(name)
    me.from_pydata([p for p, _ in nodes], edges, [])
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    obj.modifiers.new("skin", "SKIN")
    for i, (_, r) in enumerate(nodes):
        sv = me.skin_vertices[0].data[i]
        sv.radius = (r, r)
        sv.use_root = i == 0
    obj.modifiers.new("sub", "SUBSURF").levels = subdivisions
    obj.modifiers.new("dec", "DECIMATE").ratio = decimate
    _apply_modifiers(obj)
    return paint(obj, swatch)


# --- assembly ----------------------------------------------------------------
def join(name, parts):
    """Merge static parts into one mesh (one draw call in the game)."""
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = name
    obj.data.name = name
    # Joining keeps world positions but leaves the origin at parts[0]'s origin.
    _apply_transform(obj)
    return obj


def anim_part(obj, role, root):
    """Keep obj as a separate child the game animates, named anim_<role>."""
    obj.name = f"anim_{role}"
    _parent(obj, root)
    return obj


def socket(name, location, root):
    """Empty the game reads for a position: socket_balls, socket_muzzle, ..."""
    empty = bpy.data.objects.new(f"socket_{name}", None)
    empty.empty_display_type = "PLAIN_AXES"
    empty.empty_display_size = 2
    empty.location = location
    bpy.context.scene.collection.objects.link(empty)
    _parent(empty, root)
    return empty


def _parent(child, root):
    bpy.context.view_layer.update()  # matrix_world is stale until the depsgraph updates
    world = child.matrix_world.copy()
    child.parent = root
    child.matrix_world = world


def _apply_modifiers(obj):
    bpy.context.view_layer.objects.active = obj
    for m in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def _apply_transform(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def hierarchy(root):
    return [root] + list(root.children_recursive)


def triangle_count(root):
    return sum(
        sum(len(p.vertices) - 2 for p in o.data.polygons)
        for o in hierarchy(root) if o.type == "MESH"
    )


# --- output ------------------------------------------------------------------
def export_glb(root, path):
    bpy.ops.object.select_all(action="DESELECT")
    for o in hierarchy(root):
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True,
                              export_apply=True, export_yup=True)


def render_previews(root, out_prefix):
    """Top-down (the game's view) + 3/4 renders for review.

    Uses Cycles on the CPU: the GPU renderers (Workbench/EEVEE) crash in
    background mode with the dev machine's AMD driver.
    """
    scene = bpy.context.scene
    world = bpy.data.worlds.new("preview_world")
    scene.world = world
    nt = world.node_tree
    if nt is None:
        world.use_nodes = True
        nt = world.node_tree
    bg = nt.nodes["Background"]
    bg.inputs["Color"].default_value = (0.35, 0.38, 0.55, 1)
    bg.inputs["Strength"].default_value = 0.6
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = False
    scene.render.resolution_x = 640
    scene.render.resolution_y = 640

    sun = bpy.data.objects.new("preview_sun", bpy.data.lights.new("preview_sun", "SUN"))
    sun.data.energy = 3.5
    sun.rotation_euler = (math.radians(35), math.radians(-25), 0)
    scene.collection.objects.link(sun)

    cam_data = bpy.data.cameras.new("preview_cam")
    cam = bpy.data.objects.new("preview_cam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    size = max(max(root.dimensions.x, root.dimensions.y), 1.0)

    def shot(suffix, loc, ortho):
        cam.location = loc
        # Straight down with +Y (the nose) at the top of the frame, like the game.
        cam.rotation_euler = (0, 0, 0) if ortho else (-Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        if ortho:
            cam_data.type = "ORTHO"
            cam_data.ortho_scale = size * 1.5
        else:
            cam_data.type = "PERSP"
            cam_data.lens = 50
        scene.render.filepath = f"{out_prefix}_{suffix}.png"
        bpy.ops.render.render(write_still=True)

    shot("top", (0, 0, size * 4), ortho=True)
    shot("34", (0, -size * 2.2, size * 1.9), ortho=False)
