"""The player's ship: fat lavender hull, cyan canopy, swept wings, twin engines.

~36 px wide × ~42 px long (nose at +Y). Flames are animated parts; sockets mark
the muzzle and engine exhausts.
"""
import metic_kit as kit


def build():
    body = kit.hull("body", [
        (0, 20, 1), (3, 13, 3), (5, 0, 4), (5, -11, 3), (0, -13, 4),  # upper outline
        (0, 5, 5.5),                                                   # spine
        (3, 10, -1.5), (5, -4, -2), (4, -11, -1),                      # belly
    ], "hull")
    stripe = kit.hull("stripe", [(0, 19, 1.9), (1.4, 14, 3.6), (1.6, 9, 4.6), (0, 9, 5.4)], "trim")
    canopy = kit.blob("canopy", (0, 4, 4.8), 2.6, "canopy", scale=(1, 1.8, 0.8))

    wings = kit.pair(lambda s: kit.hull("wing", kit.mirror_x([
        (4, 3, 0.8), (16, -8, 0.8), (16, -12, 0.8), (4, -10, 0.8),
        (4, 3, -0.8), (16, -8, -0.8), (16, -12, -0.8), (4, -10, -0.8),
    ], s), "hull_dark", symmetric=False))
    tips = kit.pair(lambda s: kit.hull("wingtip", kit.mirror_x([
        (15, -6, 1.8), (18, -7.5, 1.8), (18, -13, 1.8), (15, -13, 1.8),
        (15, -6, -1.2), (18, -7.5, -1.2), (18, -13, -1.2), (15, -13, -1.2),
    ], s), "trim", symmetric=False))
    engines = kit.pair(lambda s: kit.tube("engine", (s * 4, -8, 1), (s * 4, -15, 1), 2.2, 2.7, "engine"))
    nozzles = kit.pair(lambda s: kit.tube("nozzle", (s * 4, -15, 1), (s * 4, -16, 1), 2.7, 2.2, "metal"))

    root = kit.join("ship_player", [body, stripe, canopy, *wings, *tips, *engines, *nozzles])

    for side, suffix in ((1, "R"), (-1, "L")):
        flame = kit.tube("flame", (side * 4, -16, 1), (side * 4, -22, 1), 1.9, 0.2, "flame")
        kit.anim_part(flame, f"flame_{suffix}", root)
        kit.socket(f"engine_{suffix}", (side * 4, -16, 1), root)
    kit.socket("muzzle", (0, 21, 1), root)
    return root
