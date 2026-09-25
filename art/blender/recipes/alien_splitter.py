"""Splitter: ability alien that pops into two splitlings when destroyed.

~38 px wide. Two pink cell lobes fused along a glowing seam, like a cell caught
mid-division, so "this one comes apart" reads from the top. Each lobe looks like
one alien_splitling. The nuclei are animated parts (they pulse out of phase).
"""
import metic_kit as kit


def build():
    lobes = kit.pair(lambda s: kit.blob("lobe", (s * 8, 0, 1), 11, "pink", scale=(1, 1.05, 0.7)))
    seam = kit.hull("seam", [(0, -9, 2), (1.2, -6, 8.2), (1.2, 5, 8.2), (0, 8, 2)], "glow_magenta")
    pupils = kit.pair(lambda s: kit.blob("pupil", (s * 8, -7, 6.2), 1.8, "pupil",
                                         scale=(0.8, 1, 0.5), subdivisions=0))
    cilia = kit.pair(lambda s: kit.tube("cilia", (s * 17, 1, 0), (s * 22, 3, -0.5), 1.4, 0.3, "magenta", 4))

    root = kit.join("alien_splitter", [*lobes, seam, *pupils, *cilia])
    nuclei = kit.pair(lambda s: kit.blob("nucleus", (s * 8, 3, 7), 3.8, "magenta", scale=(1, 1, 0.5)))
    for n in nuclei:
        kit.anim_part(n, f"nucleus{n.name[-2:]}", root)
    kit.socket("balls", (0, 30, 0), root)
    return root
