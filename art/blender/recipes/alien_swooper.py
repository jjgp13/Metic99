"""Swooper: 2-number alien that flies in from a side edge. Teal manta ray.

~36 px wide. Enters sideways below the HUD, then glides straight down, so the
flat wide wings read as "glider" from the top, unlike the strafer's wasp wings.
Faces -Y (orange head fins toward the player); balls sit above at +Y. Each
wing is an animated part hinged at the body (slow flap); the tail wags.
"""
import metic_kit as kit


def slab(points, half=0.8):
    """Flat outline -> points for a thin plate (top and bottom copies)."""
    return [(x, y, z + half) for x, y, z in points] + [(x, y, z - half) for x, y, z in points]


def build():
    body = kit.hull("body", [
        (0, -10, 1.5), (4, -8, 2), (6, -2, 2), (5, 6, 1.5), (0, 9, 1.5),  # outline
        (0, -4, 4.5), (0, 3, 3.5),                                        # ridge
        (0, -8, -1), (4, 0, -1.5), (0, 7, -1),                            # belly
    ], "teal_dark")
    horns = kit.pair(lambda s: kit.hull("horn", kit.mirror_x(slab([
        (2, -9, 1.5), (4, -9, 1.5), (5, -16, 1.5), (3, -15, 1.5)], 0.7), s),
        "orange", symmetric=False))
    eyes = kit.pair(lambda s: kit.blob("eye", (s * 3.2, -6, 3.6), 1.6, "glow_cyan", scale=(1, 1.2, 0.7)))
    root = kit.join("alien_swooper", [body, *horns, *eyes])

    # Wide triangular wings swept back toward the tail, tips a little raised.
    wings = kit.pair(lambda s: kit.pivot(kit.hull("wing", kit.mirror_x(slab([
        (4, -7, 1.5), (12, -4, 2), (18, 2, 2.5), (15, 5, 2), (5, 6, 1.2)]), s),
        "teal", symmetric=False), (s * 5, 0, 1.5)))
    for wing in wings:
        kit.anim_part(wing, "wing" + wing.name[-2:], root)
    tail = kit.tube("tail", (0, 8, 1.5), (0, 17, 1.5), 1.4, 0.3, "orange", 4)
    kit.anim_part(kit.pivot(tail, (0, 8, 1.5)), "tail", root)
    kit.socket("balls", (0, 28, 0), root)
    return root
