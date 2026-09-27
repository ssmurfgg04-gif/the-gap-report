#!/usr/bin/env python3
"""Measure matrix table container right-edge border width vs other sides."""
from PIL import Image

im = Image.open("/home/z/my-project/screenshots/r18-d3-matrix.png").convert("RGB")
w, h = im.size

# Find the matrix table container: locate the red 2px THIS SYSTEM left-rule (accent ~ #c04030)
def is_accent(p):
    r, g, b = p
    return r > 120 and g < 110 and b < 110 and r - g > 60

accent_cols = set()
for yy in range(0, h, 4):
    for x in range(int(w*0.6), w):
        if is_accent(im.getpixel((x, yy))):
            accent_cols.add(x)
accent_cols = sorted(accent_cols)
print("accent rule columns (THIS SYSTEM left border):", accent_cols[:8], "..." if len(accent_cols) > 8 else "")

# Find the container edge: scan a horizontal line for light-gray border pixels (sum 640-720)
def border_scan(y):
    cols = []
    for x in range(0, w):
        p = im.getpixel((x, y))
        s = sum(p)
        if 600 < s < 730:
            cols.append(x)
    return cols

# try a few rows to find one crossing horizontal borders
for y in [300, 350, 420, 470, 520]:
    cols = border_scan(y)
    if cols:
        # group consecutive
        groups = []
        cur = [cols[0]]
        for x in cols[1:]:
            if x - cur[-1] <= 2:
                cur.append(x)
            else:
                groups.append((cur[0], cur[-1], len(cur)))
                cur = [x]
        groups.append((cur[0], cur[-1], len(cur)))
        print(f"y={y}: border groups: {groups[:6]}")
