"""Lumberer: big slow 3-number alien. Teal tortoise-beetle with a plated shell.

~50 px wide. Faces -Y (head toward the player); balls sit above at +Y. Four
stubby legs are animated parts (waddle).
"""
import math

import metic_kit as kit


def build():
    shell = kit.lathe("shell", [(0, 9), (11, 8), (18, 5), (21, 1), (20, -2), (0, -3)],
                      "teal_dark", segments=8, scale=(1, 0.95, 1))
    plate = kit.lathe("plate", [(0, 11), (7, 10.2), (11, 8), (11, 6)], "teal",
                      segments=6, center=(0, 1, 0))
    plates = kit.radial(6, lambda i, a, cs: kit.lathe(
        "scute", [(0, 2), (4, 1.2), (4.5, 0)], "teal", segments=5,
        center=(cs[0] * 13.5, cs[1] * 13, 4.5)), start=math.pi / 6)
    head = kit.blob("head", (0, -20, 2), 7, "teal", scale=(1.3, 1, 0.8))
    eyes = kit.pair(lambda s: kit.join("eye", [
        kit.blob("eye", (s * 4.5, -21, 6.5), 2.6, "eye"),
        kit.blob("pupil", (s * 4.8, -22.5, 8.2), 1.2, "pupil"),
    ]))

    root = kit.join("alien_lumberer", [shell, plate, *plates, head, *eyes])
    legs = kit.radial(4, lambda i, a, cs: kit.tube(
        "leg", (cs[0] * 14, cs[1] * 13, 0), (cs[0] * 24, cs[1] * 22, -1), 4.5, 3.5, "teal", 6),
        start=math.pi / 4)
    for leg, name in zip(legs, ("FR", "FL", "BL", "BR")[::-1]):
        kit.anim_part(leg, f"leg_{name}", root)
    kit.socket("balls", (0, 30, 0), root)
    return root
