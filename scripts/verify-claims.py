#!/usr/bin/env python3
"""Pixel-verify VLM claims: (1) matrix right-edge thickness, (2) mobile sub-header ascender clipping."""
from PIL import Image
import sys

# ---- 1. Matrix right edge: crop the right edge of the table at 4x zoom ----
img = Image.open("/home/z/my-project/screenshots/r18-d3-matrix.png").convert("RGB")
w, h = img.size
print("matrix shot size:", w, h)
# The matrix table's right border: find it by scanning a horizontal line near the table middle.
# Take a horizontal strip, find dark vertical border columns near the right side.
y = int(h * 0.45)
row = [img.getpixel((x, y)) for x in range(w)]
# locate dark pixels (borders) in the right quarter
dark_cols = [x for x in range(int(w*0.7), w) if sum(row[x]) < 500]
print("dark columns right quarter at y=", y, ":", dark_cols[:20])
# crop around the last dark column (the table's right edge), zoom 8x
if dark_cols:
    edge = max(dark_cols)
    crop = img.crop((edge - 6, y - 60, edge + 8, y + 60))
    crop = crop.resize((crop.width * 8, crop.height * 8), Image.NEAREST)
    crop.save("/tmp/matrix-right-edge-zoom.png")
    # measure actual border run-length: count consecutive non-white pixels at y across x=edge-3..edge+3
    runs = []
    x = edge - 4
    while x < edge + 6:
        if sum(img.getpixel((x, y))) < 500:
            start = x
            while x < w and sum(img.getpixel((x, y))) < 500:
                x += 1
            runs.append((start, x - start))
        else:
            x += 1
    print("dark runs at right edge:", runs)
    # compare with left edge
    dark_left = [x for x in range(0, int(w*0.3)) if sum(row[x]) < 500]
    if dark_left:
        e0 = min(dark_left)
        run = 0
        x = e0
        while x < w and sum(img.getpixel((x, y))) < 500:
            run += 1; x += 1
        print("left edge first dark run:", (e0, run))

# ---- 2. Mobile sub-header: find text near top of m8/m9 and check for cut glyphs ----
for name in ["r18-m8-system", "r18-m9-system2"]:
    im = Image.open(f"/home/z/my-project/screenshots/{name}.png").convert("RGB")
    w2, h2 = im.size
    # find the sub-header: scan rows 0..300 for dark pixel clusters (text lines)
    # check the first 12 rows: any dark pixels touching y<4 would indicate clipped text at viewport top
    dark_top_rows = []
    for yy in range(0, 40):
        cnt = sum(1 for x in range(0, w2, 3) if sum(im.getpixel((x, yy))) < 400)
        if cnt > 2:
            dark_top_rows.append((yy, cnt))
    print(f"{name}: dark rows in top 40px:", dark_top_rows[:10])
    # also crop top 160px for visual inspection at 2x
    crop = im.crop((0, 0, w2, 170))
    crop = crop.resize((int(w2*1.5), int(170*1.5)), Image.LANCZOS)
    crop.save(f"/tmp/{name}-top.png")
print("crops saved")
