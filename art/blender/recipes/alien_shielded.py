"""Shielded: ability alien that needs two correct answers.

~30 px wide. A grey armored beetle with a glowing shield emitter on its back;
the shield bubble itself is drawn in game code around the body. The emitter is
an animated part (pulses while the shield is up, dims once it breaks).
"""
import metic_kit as kit


def build():
    body = kit.hull("body", [
        (0, -14, 1), (7, -9, 3), (10, 0, 3), (8, 9, 2), (0, 12, 2),  # outline
        (0, -3, 7), (5, 3, 6),                                       # back
        (0, -11, -2), (8, 0, -2), (0, 10, -2),                       # belly
    ], "grey")
    plates = kit.pair(lambda s: kit.hull("plate", kit.mirror_x([
        (7, -7, 4), (12, -1, 4), (11, 8, 3), (6, 10, 3),
        (8, -6, 1), (13, 0, 1), (12, 8, 0.5),
    ], s), "purple_dark", symmetric=False))
    mandibles = kit.pair(lambda s: kit.tube(
        "mandible", (s * 4, -11, 1.5), (s * 7, -20, 1.5), 1.8, 0.4, "purple_dark", 4))
    eyes = kit.pair(lambda s: kit.blob("eye", (s * 3.5, -10, 4.2), 1.8, "glow_magenta",
                                       scale=(1, 0.8, 0.6), subdivisions=0))
    legs = kit.radial(3, lambda i, a, cs: kit.join("legs", kit.pair(lambda s: kit.tube(
        "leg", (s * 9, -5 + i * 7, 0), (s * 16, -7 + i * 8, -1), 1.8, 1.2, "grey", 4))))
    base = kit.lathe("base", [(0, 8.5), (4.5, 8), (5.5, 6.5), (0, 6)], "purple_dark",
                     segments=6, center=(0, 2, 0))

    root = kit.join("alien_shielded", [body, *plates, *mandibles, *eyes, *legs, base])
    emitter = kit.blob("emitter", (0, 2, 10), 3.4, "glow_magenta")
    kit.anim_part(emitter, "emitter", root)
    kit.socket("balls", (0, 34, 0), root)
    return root
