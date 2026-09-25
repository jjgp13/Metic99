"""Build Metic's 3D models: run recipes -> export .glb -> render previews.

Usage (headless, from the repo root):
  "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup \
      -P art/blender/build.py -- [--only ship_player] [--no-previews]

Each recipe in art/blender/recipes/<name>.py defines `build() -> root object`.
Outputs: public/assets/models/<name>.glb and art/previews/<name>_{top,34}.png.
"""
import argparse
import importlib.util
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import metic_kit as kit  # noqa: E402

RECIPES = os.path.join(os.path.dirname(__file__), "recipes")
MODELS_OUT = os.path.join(kit.ROOT, "public", "assets", "models")
PREVIEWS_OUT = os.path.join(kit.ROOT, "art", "previews")

# Triangle budgets by name prefix (docs/ART_SPEC.md §5).
BUDGETS = {"ship": 600, "alien": 900, "boss": 2500, "prop": 200}
MAX_BYTES = 60_000


def load_recipe(name):
    spec = importlib.util.spec_from_file_location(name, os.path.join(RECIPES, f"{name}.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", nargs="*", help="recipe names to build (default: all)")
    parser.add_argument("--no-previews", action="store_true")
    args = parser.parse_args(argv)

    names = args.only or sorted(f[:-3] for f in os.listdir(RECIPES) if f.endswith(".py"))
    os.makedirs(MODELS_OUT, exist_ok=True)
    os.makedirs(PREVIEWS_OUT, exist_ok=True)

    failed = False
    for name in names:
        kit.begin()
        root = load_recipe(name).build()
        root.name = name
        path = os.path.join(MODELS_OUT, f"{name}.glb")
        kit.export_glb(root, path)

        tris = kit.triangle_count(root)
        size = os.path.getsize(path)
        budget = next((b for prefix, b in BUDGETS.items() if name.startswith(prefix)), None)
        over = (budget is not None and tris > budget) or size > MAX_BYTES
        failed |= over
        dims = root.dimensions
        print(f"[build] {name}: {tris} tris (budget {budget}), {size} bytes, "
              f"{dims.x:.1f}x{dims.y:.1f}x{dims.z:.1f} px {'OVER BUDGET' if over else 'ok'}")

        if not args.no_previews:
            kit.render_previews(root, os.path.join(PREVIEWS_OUT, name))

    sys.exit(1 if failed else 0)


main()
