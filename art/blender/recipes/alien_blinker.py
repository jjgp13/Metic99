"""Blinker: ability alien whose number balls open and close like eyelids.

~32 px wide. A magenta head that is mostly one big eye, looking up at the camera,
so the "eye" theme reads before any ball closes. The lid is an animated part
pivoted at its top edge: the game scales it along Y (0 = open, 1 = shut) in sync
with the ball lids, telegraphing each blink.
"""
import math

import metic_kit as kit


def build():
    head = kit.lathe("head", [(0, 6), (9, 5.5), (14, 2.5), (15, -0.5), (12, -3.5), (0, -4.5)],
                     "magenta", segments=10)
    # Lashes fan out along the front edge (toward the player, -Y).
    lashes = kit.radial(5, lambda i, a, cs: kit.tube(
        "lash", (cs[0] * 11, cs[1] * 11 - 1, 4), (cs[0] * 18, cs[1] * 18 - 1, 5.5),
        1.6, 0.3, "purple_dark", 4), start=math.radians(215), spread=math.radians(110))
    eye = kit.blob("eye", (0, -1, 5), 8.5, "eye", scale=(1, 1, 0.5))
    pupil = kit.blob("pupil", (0, -3, 8.6), 3.4, "pupil", scale=(0.75, 1, 0.45))

    # Three short trailing tentacles, kept clear of the ball row above.
    nodes, edges = [((0, 7, -1), 4)], []
    for s in (-1, 0, 1):
        prev = 0
        for x, y, r in ((5, 11, 2.6), (8, 15, 1.8), (9, 18, 1.0)):
            nodes.append(((s * x, y + (2 if s == 0 else 0), -1.5), r))
            edges.append((prev, len(nodes) - 1))
            prev = len(nodes) - 1
    tails = kit.creature("tails", nodes, edges, "purple_dark", subdivisions=0, decimate=1.0)

    root = kit.join("alien_blinker", [head, *lashes, eye, pupil, tails])
    lid = kit.blob("lid", (0, -1, 5.5), 9.4, "purple_dark", scale=(1, 1, 0.62))
    kit.anim_part(kit.pivot(lid, (0, 8.4, 5.5)), "lid", root)
    lid.scale.y = 0.05  # authored open; the game sets the Y scale to how shut it is
    kit.socket("balls", (0, 30, 0), root)
    return root
