"""Drifter: non-lethal bonus alien. Purple jellyfish-UFO with a glowing rim.

~46 px wide. Drifts sideways across the field. The rim lights glow (bonus
marker); the tentacle skirt is one animated part (spins/pulses).
"""
import math

import metic_kit as kit


def build():
    bell = kit.lathe("bell", [(0, 9), (6, 8.5), (11, 6), (14, 2), (15, 0), (12, -1.5), (0, -1)],
                     "purple", segments=10)
    dome = kit.lathe("dome", [(0, 11), (4, 10.3), (6, 8), (6.5, 7)], "pink", segments=8)
    rim = kit.lathe("rim", [(15.5, 0.8), (16.5, 0), (15.5, -0.8), (13, 0)], "purple_dark", segments=10)
    lights = kit.radial(10, lambda i, a, cs: kit.blob(
        "light", (cs[0] * 16.3, cs[1] * 16.3, 0.6), 1.3, "glow_magenta", subdivisions=0))
    root = kit.join("alien_drifter", [bell, dome, rim, *lights])

    # Tentacles curl outward from under the bell so they read from the top.
    nodes, edges = [((0, 0, -1), 6)], []
    for i in range(6):
        a = 2 * math.pi * i / 6 + math.pi / 6
        prev = 0
        for k, (r, twist, rad) in enumerate(((11, 0, 3), (18, 0.3, 2.4), (24, 0.65, 1.4))):
            nodes.append(((r * math.cos(a + twist), r * math.sin(a + twist), -1.5 - k), rad))
            edges.append((prev, len(nodes) - 1))
            prev = len(nodes) - 1
    skirt = kit.creature("skirt", nodes, edges, "pink", subdivisions=0, decimate=1.0)
    kit.anim_part(skirt, "skirt", root)
    kit.socket("balls", (0, 26, 0), root)
    return root
