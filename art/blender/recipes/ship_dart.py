"""Alt player ship A, sleek/angular: flat steel delta, long spine, one engine.

~34 px wide × ~44 px long (nose at +Y). Twin canted tail fins, cyan canopy.
"""
import metic_kit as kit


def build():
    wing = kit.hull("wing", [
        (0, 22, 0.6), (16, -12, 0.4), (13, -15, 0.4), (0, -11, 0.6),
        (0, 22, -0.6), (16, -12, -0.4), (13, -15, -0.4), (0, -11, -0.6),
    ], "metal")
    spine = kit.hull("spine", [
        (0, 21, 1.4), (3.5, 8, 3), (4.5, -8, 3), (3.5, -14, 2.2), (0, 4, 4.6),
        (2, -6, -1.6), (1.5, 12, -1),
    ], "hull_dark")
    edges = kit.pair(lambda s: kit.hull("edge", kit.mirror_x([
        (1, 19, 1), (15, -11, 0.8), (16.5, -13, 0.8), (13, -12, 0.8), (1, 14, 1),
        (1, 19, 0.2), (15, -11, 0.1), (16.5, -13, 0.1), (13, -12, 0.1), (1, 14, 0.2),
    ], s), "canopy", symmetric=False))
    canopy = kit.blob("canopy", (0, 7, 3.8), 2.2, "canopy", scale=(0.8, 2.4, 0.7))
    fins = kit.pair(lambda s: kit.hull("fin", kit.mirror_x([
        (4, -6, 1.5), (5, -13, 1.5), (8, -14, 8), (7.5, -10, 8),
    ], s), "hull_dark", symmetric=False))
    engine = kit.tube("engine", (0, -13, 1.2), (0, -18, 1.2), 3, 2.4, "engine")

    root = kit.join("ship_dart", [wing, spine, *edges, canopy, *fins, engine])
    kit.anim_part(kit.tube("flame", (0, -18, 1.2), (0, -26, 1.2), 2.2, 0.2, "flame"), "flame", root)
    kit.socket("engine", (0, -18, 1.2), root)
    kit.socket("muzzle", (0, 23, 1), root)
    return root
