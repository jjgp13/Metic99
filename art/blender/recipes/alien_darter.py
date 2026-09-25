"""Darter: small fast 2-number alien. Orange arrowhead, swept fins, cyclops eye.

~26 px wide. Aliens face -Y (they dive toward the player); the ball row trails
above them at +Y (socket_balls). Tail and eye are animated parts.
"""
import metic_kit as kit


def build():
    body = kit.hull("body", [
        (0, -15, 1), (5, -6, 3), (6, 2, 2), (3, 9, 1.5), (0, 11, 1.5),  # outline
        (0, -3, 5.5),                                                   # spine
        (0, -11, -1), (4, 0, -2), (2, 8, -1),                           # belly
    ], "orange")
    fins = kit.pair(lambda s: kit.hull("fin", kit.mirror_x([
        (4, -2, 0.6), (13, 9, 0.6), (11, 13, 0.6), (3, 6, 0.6),
        (4, -2, -0.6), (13, 9, -0.6), (11, 13, -0.6), (3, 6, -0.6),
    ], s), "purple_dark", symmetric=False))
    fangs = kit.pair(lambda s: kit.tube("fang", (s * 3, -9, 2.5), (s * 5.5, -18, 2), 1.3, 0.2, "purple_dark", 4))

    root = kit.join("alien_darter", [body, *fins, *fangs])
    eye = kit.join("eye", [
        kit.blob("eye", (0, -5, 4.2), 3.2, "glow_cyan", scale=(1.2, 1, 0.6)),
        kit.blob("pupil", (0, -6, 5.6), 1.3, "pupil", scale=(0.45, 1.3, 0.5)),
    ])
    kit.anim_part(eye, "eye", root)
    kit.anim_part(kit.tube("tail", (0, 10, 1.5), (0, 21, 1.5), 2.2, 0.3, "purple_dark", 5), "tail", root)
    kit.socket("balls", (0, 28, 0), root)
    return root
