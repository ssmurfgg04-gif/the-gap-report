#!/usr/bin/env python3
"""Check sub-header glyph rendering in m8 screenshot (element at viewport y=601.8, h=33)."""
from PIL import Image

im = Image.open("/home/z/my-project/screenshots/r18-m8-system.png").convert("RGB")
w, h = im.size
print("shot:", w, h)

# sub-header box: y 601.8 .. 634.8, x = px-6 = 24 .. w-24
y0, y1 = 598, 638
x0, x1 = 20, w - 20

# row-by-row dark pixel counts inside the element box
for yy in range(y0, y1):
    cnt = sum(1 for x in range(x0, x1, 2) if sum(im.getpixel((x, yy))) < 420)
    if cnt:
        print(f"y={yy}: {cnt} dark px")

# crop zoomed for inspection
crop = im.crop((x0, y0 - 4, x1, y1 + 4))
crop = crop.resize((crop.width * 2, crop.height * 2), Image.LANCZOS)
crop.save("/tmp/subhead-m8.png")
print("saved /tmp/subhead-m8.png")
