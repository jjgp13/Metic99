"""Alt player ship B, chunky/round: toy pod with a bubble canopy and side pods.

~34 px wide × ~34 px long (nose at +Y). Stubby pylons hold two fat engine pods.
"""
import metic_kit as kit


def build():
    body = kit.lathe("body", [(0, 7), (7, 6.5), (11, 3.5), (12, 0), (10, -3), (0, -4)],
                     "hull_light", center=(0, 2, 0), segments=10, scale=(1, 1.2, 1))
    canopy = kit.blob("canopy", (0, 6, 6), 5.5, "canopy", scale=(1, 1.1, 0.75))
    bumper = kit.hull("bumper", [(0, 18, 0), (5, 16, 1), (7, 13, 0), (5, 16, -1.5), (0, 17, 3)], "trim")
    pylons = kit.pair(lambda s: kit.hull("pylon", kit.mirror_x([
        (8, 2, 1.5), (14, 0, 1.5), (14, -6, 1.5), (8, -5, 1.5),
        (8, 2, -1.5), (14, 0, -1.5), (14, -6, -1.5), (8, -5, -1.5),
    ], s), "hull_dark", symmetric=False))
    pods = kit.pair(lambda s: kit.tube("pod", (s * 14, 7, 0), (s * 14, -11, 0), 3.5, 4.5, "hull", 8))
    caps = kit.pair(lambda s: kit.blob("cap", (s * 14, 7, 0), 3.6, "trim", scale=(1, 1.3, 1)))
    nozzles = kit.pair(lambda s: kit.tube("nozzle", (s * 14, -11, 0), (s * 14, -13, 0), 4.5, 3.4, "engine", 8))

    root = kit.join("ship_pod", [body, canopy, bumper, *pylons, *pods, *caps, *nozzles])
    for side, suffix in ((1, "R"), (-1, "L")):
        flame = kit.tube("flame", (side * 14, -13, 0), (side * 14, -20, 0), 2.8, 0.3, "flame", 8)
        kit.anim_part(flame, f"flame_{suffix}", root)
        kit.socket(f"engine_{suffix}", (side * 14, -13, 0), root)
    kit.socket("muzzle", (0, 19, 1), root)
    return root
