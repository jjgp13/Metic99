"""Splitling: one half of a destroyed alien_splitter (always a 2-number alien).

~22 px wide (one splitter lobe): a single pink lobe with one eye and a little cilium tail, so the
pair clearly came out of the splitter. The nucleus pulses (animated part).
"""
import metic_kit as kit


def build():
    lobe = kit.blob("lobe", (0, 0, 1), 11, "pink", scale=(1, 1.05, 0.7))
    pupil = kit.blob("pupil", (0, -7, 6.2), 1.8, "pupil", scale=(0.8, 1, 0.5), subdivisions=0)
    tail = kit.tube("tail", (0, 10, 0.5), (0, 17, 0), 1.8, 0.3, "magenta", 4)

    root = kit.join("alien_splitling", [lobe, pupil, tail])
    kit.anim_part(kit.blob("nucleus", (0, 3, 7), 3.8, "magenta", scale=(1, 1, 0.5)), "nucleus", root)
    kit.socket("balls", (0, 26, 0), root)
    return root
