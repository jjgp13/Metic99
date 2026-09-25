"""Compose art/previews/comparison.png: top + 3/4 renders and a game-size thumb.

Usage: python art/blender/contact_sheet.py  (needs Pillow; runs outside Blender)
"""
import json
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.join(os.path.dirname(__file__), "..", "previews")
ROWS = [
    ("MONSTERS", [("alien_darter", "Darter · 2-number, fast"),
                  ("alien_lumberer", "Lumberer · 3-number, slow"),
                  ("alien_drifter", "Drifter · bonus, non-lethal"),
                  ("alien_strafer", "Strafer · patrols, then dives")]),
    ("PLAYER SHIPS", [("ship_player", "ship_player · current"),
                      ("ship_dart", "Dart · sleek / angular"),
                      ("ship_pod", "Pod · chunky / round")]),
]
CELL, SMALL, PAD, HEAD = 360, 170, 20, 60
SIZES = json.load(open(os.path.join(HERE, "sizes.json"), encoding="utf-8"))
FONT = ImageFont.truetype("arialbd.ttf", 20)
SMALL_FONT = ImageFont.truetype("arial.ttf", 15)

cols = max(len(r[1]) for r in ROWS)
w = PAD + cols * (CELL + PAD)
row_h = HEAD + CELL + SMALL + PAD * 2
sheet = Image.new("RGB", (w, len(ROWS) * row_h + PAD), (24, 26, 40))
d = ImageDraw.Draw(sheet)
for r, (title, models) in enumerate(ROWS):
    y0 = PAD + r * row_h
    d.text((PAD, y0), title, font=FONT, fill=(255, 209, 102))
    for c, (name, label) in enumerate(models):
        x = PAD + c * (CELL + PAD)
        top = Image.open(os.path.join(HERE, f"{name}_top.png")).convert("RGB")
        sheet.paste(top.resize((CELL, CELL)), (x, y0 + HEAD))
        sheet.paste(Image.open(os.path.join(HERE, f"{name}_34.png")).convert("RGB")
                    .resize((SMALL, SMALL)), (x, y0 + HEAD + CELL + 8))
        # True game scale: the top frame spans size × 1.5 game px (render_previews).
        THUMB = round(SIZES[name] * 1.5)
        thumb = top.resize((THUMB, THUMB), Image.LANCZOS)
        sheet.paste(thumb, (x + SMALL + 40, y0 + HEAD + CELL + 8 + (SMALL - THUMB) // 2))
        d.text((x + SMALL + 20, y0 + HEAD + CELL + 8 + SMALL // 2 + THUMB // 2 + 6),
               "1:1 game px", font=SMALL_FONT, fill=(170, 170, 190))
        d.text((x + 4, y0 + HEAD - 22), label, font=SMALL_FONT, fill=(232, 230, 245))
out = os.path.join(HERE, "comparison.png")
sheet.save(out)
print(out)
