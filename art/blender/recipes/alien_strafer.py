"""Strafer: Galaga-style 2-number alien. Magenta wasp with wide swept wings.

~44 px wide. Patrols sideways across a band at the top, then dives, so the wide
wing silhouette reads as "flier" from the top. Faces -Y; balls sit above at +Y.
Each side's wing pair is one animated part (flap).
"""
import metic_kit as kit


def slab(points, half=0.7):
    """Flat outline -> points for a thin plate (top and bottom copies)."""
    return [(x, y, z + half) for x, y, z in points] + [(x, y, z - half) for x, y, z in points]


def build():
    head = kit.blob("head", (0, -10, 2.5), 5.5, "magenta", scale=(1.25, 1, 0.8))
    thorax = kit.hull("thorax", [
        (0, -6, 4.5), (4.5, -4, 3), (5, 2, 2.5), (2.5, 6, 2), (0, 6, 3.5),
        (0, -5, -1), (3.5, 1, -1.5),
    ], "magenta")
    abdomen = kit.hull("abdomen", [
        (0, 5, 3), (4, 8, 2.2), (3.5, 14, 1.2), (0, 19, 0.8), (0, 9, -1.2), (2, 14, -1),
    ], "purple_dark")
    eyes = kit.pair(lambda s: kit.blob("eye", (s * 3.4, -12, 5), 2.5, "glow_cyan", scale=(1, 1.15, 0.7)))
    fangs = kit.pair(lambda s: kit.tube("fang", (s * 2.5, -14, 1.5), (s * 1, -19, 1), 1.3, 0.2, "purple_dark", 4))
    root = kit.join("alien_strafer", [head, thorax, abdomen, *eyes, *fangs])

    # Forewings sweep forward (toward the player, -Y), hind wings trail back.
    wings = kit.pair(lambda s: kit.join("wing", [
        kit.hull("fore", kit.mirror_x(slab([
            (4, -3, 1.5), (17, -13, 1.5), (23, -10, 1.5), (20, -1, 1.5), (5, 3, 1.5)]), s),
            "metal", symmetric=False),
        kit.hull("hind", kit.mirror_x(slab([
            (4, 2, 1), (15, 5, 1), (17, 11, 1), (11, 14, 1), (3, 7, 1)]), s),
            "purple_dark", symmetric=False),
    ]))
    for wing in wings:
        kit.anim_part(wing, "wing" + wing.name[-2:], root)
    kit.socket("balls", (0, 30, 0), root)
    return root
